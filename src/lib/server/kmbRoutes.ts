import { fetchKmbRouteStops, KmbRouteStopsError } from './kmbRouteStops';
import { KMB_API_BASE } from './kmb';
import { createServiceDayCache } from './serviceDayCache';
import { findReverseVariants, isSpecialService, normalizeRouteQuery, routeVariantKey, sortRouteVariants } from '@/lib/routeVariants';
import type { FavouriteRouteStop, FavouriteRouteStopMetadata, RouteDetail, RouteDetailStop, RouteStop, RouteVariant, Stop } from '@/lib/types';

const ROUTES_URL = `${KMB_API_BASE}/route/`;
const STOPS_URL = `${KMB_API_BASE}/stop/`;
export class KmbRoutesError extends Error {
  retryAfterAt?: number;

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

export function getKmbRetryAfterSeconds(error: KmbRoutesError | KmbRouteStopsError): number | null {
  if (error.retryAfterAt === undefined) return null;
  const remaining = error.retryAfterAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}

function coordinate(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
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
  const lat = coordinate(value.lat);
  const long = coordinate(value.long);
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

function metadataCache<T>(load: () => Promise<T>) {
  return createServiceDayCache({
    load,
    toError: (error) => error instanceof KmbRoutesError
      ? error
      : new KmbRoutesError('Unable to refresh KMB route data', { cause: error }),
    onFailure: (error) => console.error('KMB route or stop metadata refresh failed', error),
  });
}

const routesCache = metadataCache(async () => {
  const variants = await loadKmbCollection(ROUTES_URL, normalizeRouteVariant, 'route');
  const unique = new Map<string, RouteVariant>();
  for (const variant of variants) unique.set(routeVariantKey(variant), variant);
  return sortRouteVariants([...unique.values()]);
});
const stopsCache = metadataCache(() => loadKmbCollection(STOPS_URL, normalizeStop, 'stop'));

export function fetchKmbRouteVariants(now = new Date()): Promise<RouteVariant[]> {
  return routesCache.get(now);
}

export function fetchKmbStops(now = new Date()): Promise<Stop[]> {
  return stopsCache.get(now);
}

export async function searchKmbRouteVariants(query: string, limit = 50): Promise<RouteVariant[]> {
  const normalized = normalizeRouteQuery(query);
  const variants = await fetchKmbRouteVariants();
  return sortRouteVariants(variants.filter((variant) => variant.route.startsWith(normalized)), normalized).slice(0, limit);
}

async function createRouteDetailResolver() {
  // Keep all collections on one service day, including a batch spanning 05:10 HKT.
  const snapshotNow = new Date();
  const [variants, routeStops, stops] = await Promise.all([
    fetchKmbRouteVariants(snapshotNow),
    fetchKmbRouteStops(snapshotNow),
    fetchKmbStops(snapshotNow),
  ]);
  const variantsByKey = new Map(variants.map((variant) => [routeVariantKey(variant), variant]));
  const stopsById = new Map(stops.map((stop) => [stop.stop, stop]));
  const stopsByVariant = new Map<string, RouteStop[]>();
  for (const item of routeStops) {
    const key = routeVariantKey({ route: item.route, bound: item.bound, serviceType: item.service_type });
    const ordered = stopsByVariant.get(key) ?? [];
    ordered.push(item);
    stopsByVariant.set(key, ordered);
  }
  return (route: string, bound: 'I' | 'O', serviceType: string): RouteDetail | null => {
    const key = routeVariantKey({ route: normalizeRouteQuery(route), bound, serviceType: serviceType.trim().toUpperCase() });
    const variant = variantsByKey.get(key);
    if (!variant) return null;
    const orderedStops: RouteDetailStop[] = [...(stopsByVariant.get(key) ?? [])]
      .sort((a, b) => a.seq - b.seq)
      .flatMap((item) => {
        const stop = stopsById.get(item.stop);
        return stop ? [{ stopId: item.stop, seq: item.seq, nameEn: stop.name_en, nameTc: stop.name_tc, lat: stop.lat, long: stop.long }] : [];
      });
    if (!orderedStops.length) return null;
    return { variant, stops: orderedStops, reverseVariants: findReverseVariants(variant, variants) };
  };
}

export async function getKmbRouteDetail(
  route: string,
  bound: 'I' | 'O',
  serviceType: string,
): Promise<RouteDetail | null> {
  const resolve = await createRouteDetailResolver();
  return resolve(route, bound, serviceType);
}

/**
 * Resolve saved boarding points in one server request. Each favourite is
 * independent: an obsolete variant must not hide the other daily-use cards.
 */
export async function getKmbFavouriteRouteStopMetadata(
  favourites: FavouriteRouteStop[],
): Promise<FavouriteRouteStopMetadata[]> {
  if (favourites.length === 0) return [];
  const resolve = await createRouteDetailResolver();
  const detailsByVariant = new Map<string, RouteDetail | null>();
  const details = favourites.map((favourite) => {
    const key = routeVariantKey({ ...favourite, route: normalizeRouteQuery(favourite.route), serviceType: favourite.serviceType.trim().toUpperCase() });
    if (!detailsByVariant.has(key)) detailsByVariant.set(key, resolve(favourite.route, favourite.bound, favourite.serviceType));
    return detailsByVariant.get(key) ?? null;
  });
  return details.map((result, index) => {
    const favourite = favourites[index];
    if (result === null) return { favourite, status: 'missing' };
    const occurrences = result.stops.filter((item) => item.stopId === favourite.stopId);
    if (favourite.boardingSeq === undefined && occurrences.length > 1) return { favourite, status: 'ambiguous', variant: result.variant };
    const stop = favourite.boardingSeq === undefined
      ? occurrences[0]
      : occurrences.find((item) => item.seq === favourite.boardingSeq);
    if (!stop) return { favourite, status: 'missing' };
    return { favourite, status: 'resolved', variant: result.variant, stop };
  });
}

/** Reset process-local caches between isolated unit tests. */
export function resetKmbRoutesCacheForTests(): void {
  routesCache.reset();
  stopsCache.reset();
}

export { KmbRouteStopsError };
