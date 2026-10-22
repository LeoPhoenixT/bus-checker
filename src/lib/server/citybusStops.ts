import type { CitybusStopResult } from '../citybusTypes';
import type { RouteDetailStop, RouteStopOccurrence } from '../types';
import { CITYBUS_METADATA_TTL_MS, CitybusError, createCitybusCache, fetchCitybusJSON, isCitybusStopId, record, text } from './citybus';

type StopMetadata = Omit<RouteDetailStop, 'seq'>;
const cache = createCitybusCache<StopMetadata>(CITYBUS_METADATA_TTL_MS, 6000);
const CONCURRENCY = 6;
let active = 0;
const queue: (() => void)[] = [];

async function withStopSlot<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  if (active >= CONCURRENCY) {
    if (queue.length >= 100) throw new CitybusError('Citybus stop queue is busy');
    await new Promise<void>((resolve, reject) => {
      const remove = () => {
        const index = queue.indexOf(start);
        if (index !== -1) queue.splice(index, 1);
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => { remove(); reject(signal.reason); };
      const start = () => { remove(); resolve(); };
      const timer = setTimeout(() => {
        remove();
        reject(new CitybusError('Citybus stop queue timed out'));
      }, 20_000);
      signal.addEventListener('abort', abort, { once: true });
      queue.push(start);
    });
  }
  else active++;
  try { signal.throwIfAborted(); return await load(); }
  finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}

function coordinate(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
}

export function fetchCitybusStop(stopId: string, signal?: AbortSignal): Promise<StopMetadata> {
  if (!isCitybusStopId(stopId)) return Promise.reject(new CitybusError('Invalid Citybus stop ID', 400));
  return cache.get(stopId, (sharedSignal) => withStopSlot(async () => {
    const { data } = await fetchCitybusJSON(`stop/${stopId}`);
    if (record(data) && Object.keys(data).length === 0) throw new CitybusError('Citybus stop not found', 404);
    if (!record(data)) throw new CitybusError('Invalid Citybus stop data', 502);
    const lat = coordinate(data.lat), long = coordinate(data.long);
    const nameEn = text(data.name_en), nameTc = text(data.name_tc);
    if (data.stop !== stopId || (!nameEn && !nameTc) || !Number.isFinite(lat) || !Number.isFinite(long)
      || lat < -90 || lat > 90 || long < -180 || long > 180) {
      throw new CitybusError('Invalid Citybus stop data', 502);
    }
    return { stopId, nameEn, nameTc, lat, long };
  }, sharedSignal), signal);
}

export async function resolveCitybusStops(occurrences: RouteStopOccurrence[], deadlineMs = 20_000): Promise<{ stops: CitybusStopResult[]; retryAt: number }> {
  const signal = AbortSignal.timeout(deadlineMs);
  const ids = [...new Set(occurrences.map((stop) => stop.stopId))];
  const results = new Map<string, StopMetadata | 'unavailable' | 'missing' | 'invalid'>();
  let retryAt = 0;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, async () => {
    while (cursor < ids.length && !signal.aborted) {
      const id = ids[cursor++];
      try { results.set(id, await fetchCitybusStop(id, signal)); }
      catch (error) {
        retryAt = Math.max(retryAt, error instanceof CitybusError ? error.retryAt : Date.now() + 30_000);
        results.set(id, error instanceof CitybusError && error.status === 404 ? 'missing'
          : error instanceof CitybusError && error.status === 502 ? 'invalid' : 'unavailable');
      }
    }
  }));
  const stops: CitybusStopResult[] = occurrences.map(({ stopId, seq }) => {
    const result = results.get(stopId) ?? 'unavailable';
    return typeof result === 'string' ? { status: result, stopId, seq }
      : { status: 'resolved', stop: { ...result, seq } };
  });
  return { stops, retryAt };
}

export function resetCitybusStopsCacheForTests() { cache.reset(); }
