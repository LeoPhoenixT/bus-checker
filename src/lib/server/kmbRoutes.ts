import { fetchKmbRouteStops, KmbRouteStopsError } from './kmbRouteStops';
import { KMB_API_BASE } from './kmb';
import { findReverseVariants, isSpecialService, normalizeRouteQuery, routeVariantKey, sortRouteVariants } from '@/lib/routeVariants';
import type { RouteDetail, RouteDetailStop, RouteVariant, Stop } from '@/lib/types';

const ROUTES_URL = `${KMB_API_BASE}/route/`;
const STOPS_URL = `${KMB_API_BASE}/stop`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const REFRESH_FAILURE_BACKOFF_MS = 60_000;

interface CachedValue<T> {
  value: T;
  fetchedAt: number;
}

interface FailedRefresh {
  retryAfter: number;
  error: KmbRoutesError;
}

let routesSnapshot: CachedValue<RouteVariant[]> | null = null;
let stopsSnapshot: CachedValue<Stop[]> | null = null;
let pendingRoutes: Promise<RouteVariant[]> | null = null;
let pendingStops: Promise<Stop[]> | null = null;
let failedRoutes: FailedRefresh | null = null;
let failedStops: FailedRefresh | null = null;

export class KmbRoutesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KmbRoutesError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRouteVariant(value: unknown): RouteVariant | null {
  if (!isRecord(value)) return null;
  const route = normalizeRouteQuery(text(value.route));
  const bound = text(value.bound).toUpperCase();
  const serviceType = String(value.service_type ?? '').trim().toUpperCase();
  const originEn = text(value.orig_en);
  const originTc = text(value.orig_tc);
  const destinationEn = text(value.dest_en);
  const destinationTc = text(value.dest_tc);
  if (!route || (bound !== 'I' && bound !== 'O') || !serviceType) return null;
  if (!originEn && !originTc && !destinationEn && !destinationTc) return null;
  return {
    route,
    bound,
    serviceType,
    originEn,
    originTc,
    destinationEn,
    destinationTc,
    isSpecial: isSpecialService(serviceType),
  } as RouteVariant;
}

function normalizeStop(value: unknown): Stop | null {
  if (!isRecord(value)) return null;
  const stop = text(value.stop).toUpperCase();
  const nameEn = text(value.name_en);
  const nameTc = text(value.name_tc);
  const nameSc = text(value.name_sc);
  const lat = Number(value.lat);
  const long = Number(value.long);
  const timestamp = text(value.data_timestamp);
  if (!stop || (!nameEn && !nameTc) || !Number.isFinite(lat) || !Number.isFinite(long)) return null;
  return { stop, name_en: nameEn, name_tc: nameTc, name_sc: nameSc, lat, long, data_timestamp: timestamp };
}

async function loadKmbCollection<T>(url: string, normalizer: (value: unknown) => T | null, label: string): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new KmbRoutesError(`Unable to reach the KMB ${label} service`, { cause: error });
  }
  if (!response.ok) throw new KmbRoutesError(`KMB ${label} service returned HTTP ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new KmbRoutesError(`KMB ${label} service returned invalid JSON`, { cause: error });
  }
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new KmbRoutesError(`KMB ${label} service returned an unexpected response shape`);
  }
  const normalized = body.data.map(normalizer).filter((item): item is T => item !== null);
  if (normalized.length === 0) throw new KmbRoutesError(`KMB ${label} service contained no valid records`);
  return normalized;
}

function isFresh<T>(snapshot: CachedValue<T> | null, now: number): snapshot is CachedValue<T> {
  return snapshot !== null && now - snapshot.fetchedAt < CACHE_TTL_MS;
}

function fetchCached<T>(
  now: number,
  snapshot: CachedValue<T> | null,
  pending: Promise<T> | null,
  failed: FailedRefresh | null,
  load: () => Promise<T>,
  commit: (value: CachedValue<T>) => void,
  setPending: (value: Promise<T> | null) => void,
  setFailed: (value: FailedRefresh | null) => void,
): Promise<T> {
  if (isFresh(snapshot, now)) return Promise.resolve(snapshot.value);
  if (failed && now < failed.retryAfter) return Promise.reject(failed.error);
  if (pending) return pending;
  const refresh = load()
    .then((value) => {
      commit({ value, fetchedAt: now });
      setFailed(null);
      return value;
    })
    .catch((error: unknown) => {
      const routeError = error instanceof KmbRoutesError
        ? error
        : new KmbRoutesError('Unable to refresh KMB route data', { cause: error });
      setFailed({ retryAfter: now + REFRESH_FAILURE_BACKOFF_MS, error: routeError });
      throw routeError;
    })
    .finally(() => setPending(null));
  setPending(refresh);
  return refresh;
}

export function fetchKmbRouteVariants(now = new Date()): Promise<RouteVariant[]> {
  const nowMs = now.getTime();
  return fetchCached(
    nowMs, routesSnapshot, pendingRoutes, failedRoutes,
    async () => {
      const variants = await loadKmbCollection(ROUTES_URL, normalizeRouteVariant, 'route');
      const unique = new Map<string, RouteVariant>();
      for (const variant of variants) unique.set(routeVariantKey(variant), variant);
      return sortRouteVariants([...unique.values()]);
    },
    (value) => { routesSnapshot = value; },
    (value) => { pendingRoutes = value; },
    (value) => { failedRoutes = value; },
  );
}

export function fetchKmbStops(now = new Date()): Promise<Stop[]> {
  const nowMs = now.getTime();
  return fetchCached(
    nowMs, stopsSnapshot, pendingStops, failedStops,
    () => loadKmbCollection(STOPS_URL, normalizeStop, 'stop'),
    (value) => { stopsSnapshot = value; },
    (value) => { pendingStops = value; },
    (value) => { failedStops = value; },
  );
}

export async function searchKmbRouteVariants(query: string, limit = 50): Promise<RouteVariant[]> {
  const normalized = normalizeRouteQuery(query);
  const variants = await fetchKmbRouteVariants();
  return sortRouteVariants(variants.filter((variant) => variant.route.startsWith(normalized)), normalized).slice(0, limit);
}

export async function getKmbRouteDetail(
  route: string,
  bound: 'I' | 'O',
  serviceType: string,
): Promise<RouteDetail | null> {
  const normalizedRoute = normalizeRouteQuery(route);
  const normalizedServiceType = serviceType.trim().toUpperCase();
  const [variants, routeStops, stops] = await Promise.all([
    fetchKmbRouteVariants(),
    fetchKmbRouteStops(),
    fetchKmbStops(),
  ]);
  const variant = variants.find((item) => (
    item.route === normalizedRoute && item.bound === bound && item.serviceType === normalizedServiceType
  ));
  if (!variant) return null;

  const stopsById = new Map(stops.map((stop) => [stop.stop, stop]));
  const orderedStops: RouteDetailStop[] = routeStops
    .filter((item) => item.route === normalizedRoute && item.bound === bound && item.service_type === normalizedServiceType)
    .sort((a, b) => a.seq - b.seq)
    .flatMap((item) => {
      const stop = stopsById.get(item.stop);
      if (!stop) return [];
      return [{
        stopId: item.stop,
        seq: item.seq,
        nameEn: stop.name_en,
        nameTc: stop.name_tc,
        lat: stop.lat,
        long: stop.long,
      }];
    });
  if (orderedStops.length === 0) return null;

  return {
    variant,
    stops: orderedStops,
    reverseVariants: findReverseVariants(variant, variants),
  };
}

/** Reset process-local caches between isolated unit tests. */
export function resetKmbRoutesCacheForTests(): void {
  routesSnapshot = null;
  stopsSnapshot = null;
  pendingRoutes = null;
  pendingStops = null;
  failedRoutes = null;
  failedStops = null;
}

export { KmbRouteStopsError };
