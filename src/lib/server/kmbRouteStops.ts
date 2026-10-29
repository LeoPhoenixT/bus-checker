import type { RouteStop } from '@/lib/types';
import { createServiceDayCache } from './serviceDayCache';

const KMB_ROUTE_STOPS_URL = 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop/';
export class KmbRouteStopsError extends Error {
  retryAfterAt?: number;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KmbRouteStopsError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRouteStop(value: unknown): RouteStop | null {
  if (!isRecord(value)) return null;

  const route = typeof value.route === 'string' ? value.route.trim().toUpperCase() : '';
  const bound = typeof value.bound === 'string' ? value.bound.trim().toUpperCase() : '';
  const serviceType = typeof value.service_type === 'string' || typeof value.service_type === 'number'
    ? String(value.service_type).trim().toUpperCase()
    : '';
  const stop = typeof value.stop === 'string' ? value.stop.trim().toUpperCase() : '';
  const seq = typeof value.seq === 'number' ? value.seq : Number(value.seq);
  const dataTimestamp = typeof value.data_timestamp === 'string' ? value.data_timestamp : '';

  if (!route || (bound !== 'I' && bound !== 'O') || !serviceType || !stop) return null;
  if (!Number.isFinite(seq) || seq <= 0) return null;

  return {
    route,
    bound,
    service_type: serviceType,
    seq,
    stop,
    data_timestamp: dataTimestamp,
  };
}

async function loadKmbRouteStops(): Promise<RouteStop[]> {
  let response: Response;
  try {
    response = await fetch(KMB_ROUTE_STOPS_URL, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new KmbRouteStopsError('Unable to reach the KMB route data service', { cause: error });
  }

  if (!response.ok) {
    throw new KmbRouteStopsError(`KMB route data returned HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new KmbRouteStopsError('KMB route data was not valid JSON', { cause: error });
  }

  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new KmbRouteStopsError('KMB route data had an unexpected response shape');
  }

  const normalized = body.data.map(normalizeRouteStop).filter((item): item is RouteStop => item !== null);
  if (normalized.length === 0) {
    throw new KmbRouteStopsError('KMB route data contained no valid route-stop records');
  }

  return normalized;
}

const routeStopsCache = createServiceDayCache({
  load: loadKmbRouteStops,
  toError: (error) => error instanceof KmbRouteStopsError
    ? error
    : new KmbRouteStopsError('Unable to refresh KMB route data', { cause: error }),
  onFailure: (error) => console.error('KMB route-stop refresh failed', error),
});

export function fetchKmbRouteStops(now = new Date()): Promise<RouteStop[]> {
  return routeStopsCache.get(now);
}

/** Reset process-local state between isolated unit tests. */
export function resetKmbRouteStopsCacheForTests(): void {
  routeStopsCache.reset();
}

export { getKmbServiceDay } from './kmbServiceDay';
