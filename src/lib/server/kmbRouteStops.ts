import type { RouteStop } from '@/lib/types';

const KMB_ROUTE_STOPS_URL = 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop';
const HONG_KONG_OFFSET_MS = 8 * 60 * 60 * 1_000;
const KMB_REFRESH_HOUR = 5;
const KMB_REFRESH_GRACE_MINUTES = 10;
const REFRESH_FAILURE_BACKOFF_MS = 60_000;

interface RouteStopSnapshot {
  serviceDay: string;
  routeStops: RouteStop[];
}

interface PendingRefresh {
  serviceDay: string;
  promise: Promise<RouteStop[]>;
}

interface FailedRefresh {
  serviceDay: string;
  retryAfter: number;
  error: KmbRouteStopsError;
}

let snapshot: RouteStopSnapshot | null = null;
let pendingRefresh: PendingRefresh | null = null;
let failedRefresh: FailedRefresh | null = null;

export class KmbRouteStopsError extends Error {
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

/**
 * KMB publishes the new route-stop dataset daily at 05:00 HKT. A ten-minute
 * grace period avoids capturing the previous feed while publication finishes.
 */
export function getKmbServiceDay(now: Date): string {
  const hongKongTime = new Date(now.getTime() + HONG_KONG_OFFSET_MS);
  const beforeRefreshBoundary = hongKongTime.getUTCHours() < KMB_REFRESH_HOUR
    || (
      hongKongTime.getUTCHours() === KMB_REFRESH_HOUR
      && hongKongTime.getUTCMinutes() < KMB_REFRESH_GRACE_MINUTES
    );

  if (beforeRefreshBoundary) {
    hongKongTime.setUTCDate(hongKongTime.getUTCDate() - 1);
  }

  return hongKongTime.toISOString().slice(0, 10);
}

async function loadKmbRouteStops(): Promise<RouteStop[]> {
  let response: Response;
  try {
    response = await fetch(KMB_ROUTE_STOPS_URL, { cache: 'no-store' });
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

export function fetchKmbRouteStops(now = new Date()): Promise<RouteStop[]> {
  const serviceDay = getKmbServiceDay(now);
  const nowMs = now.getTime();

  if (snapshot?.serviceDay === serviceDay) return Promise.resolve(snapshot.routeStops);

  // Never serve yesterday's topology after the daily refresh boundary.
  if (snapshot && snapshot.serviceDay !== serviceDay) snapshot = null;

  if (
    failedRefresh?.serviceDay === serviceDay
    && nowMs < failedRefresh.retryAfter
  ) {
    return Promise.reject(failedRefresh.error);
  }

  if (pendingRefresh?.serviceDay === serviceDay) return pendingRefresh.promise;

  const refresh: PendingRefresh = {
    serviceDay,
    promise: Promise.resolve([]),
  };
  refresh.promise = loadKmbRouteStops()
    .then((routeStops) => {
      // A refresh from an older service day must not overwrite a newer job.
      if (pendingRefresh === refresh) {
        snapshot = { serviceDay, routeStops };
        failedRefresh = null;
      }
      return routeStops;
    })
    .catch((error: unknown) => {
      const routeError = error instanceof KmbRouteStopsError
        ? error
        : new KmbRouteStopsError('Unable to refresh KMB route data', { cause: error });
      if (pendingRefresh === refresh) {
        failedRefresh = {
          serviceDay,
          retryAfter: nowMs + REFRESH_FAILURE_BACKOFF_MS,
          error: routeError,
        };
      }
      throw routeError;
    })
    .finally(() => {
      if (pendingRefresh === refresh) pendingRefresh = null;
    });

  pendingRefresh = refresh;
  return refresh.promise;
}

/** Reset process-local state between isolated unit tests. */
export function resetKmbRouteStopsCacheForTests(): void {
  snapshot = null;
  pendingRefresh = null;
  failedRefresh = null;
}
