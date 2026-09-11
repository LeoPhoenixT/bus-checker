import { isValidRouteQuery, isValidServiceType, normalizeRouteQuery } from './routeVariants';
import type { FavouriteRouteStop } from './types';

export const FAVOURITES_STORAGE_KEY = 'bus-checker-favourite-route-stops-v2';
export const LEGACY_FAVOURITES_STORAGE_KEY = 'bus-checker-favorite-routes';
export const FAVOURITES_STORAGE_VERSION = 2;

interface StoredFavourites {
  version: typeof FAVOURITES_STORAGE_VERSION;
  items: FavouriteRouteStop[];
}

export function normalizeFavouriteRouteStop(value: FavouriteRouteStop): FavouriteRouteStop | null {
  const route = normalizeRouteQuery(String(value.route ?? ''));
  const bound = String(value.bound ?? '').trim().toUpperCase();
  const rawServiceType = String(value.serviceType ?? '').trim().toUpperCase();
  const serviceType = isValidServiceType(rawServiceType) ? String(Number.parseInt(rawServiceType, 10)) : '';
  const stopId = String(value.stopId ?? '').trim().toUpperCase();
  if (!isValidRouteQuery(route) || (bound !== 'I' && bound !== 'O') || !isValidServiceType(serviceType) || !stopId) return null;
  return { route, bound, serviceType, stopId } as FavouriteRouteStop;
}

export function favouriteRouteStopKey(value: FavouriteRouteStop): string {
  return `${value.route}|${value.bound}|${value.serviceType}|${value.stopId}`;
}

export function dedupeFavouriteRouteStops(values: FavouriteRouteStop[]): FavouriteRouteStop[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = normalizeFavouriteRouteStop(value);
    if (!normalized) return [];
    const key = favouriteRouteStopKey(normalized);
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

export function parseStoredFavourites(value: string | null): FavouriteRouteStop[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const stored = parsed as Partial<StoredFavourites>;
    if (stored.version !== FAVOURITES_STORAGE_VERSION || !Array.isArray(stored.items)) return [];
    return dedupeFavouriteRouteStops(stored.items);
  } catch {
    return [];
  }
}

export function serializeFavourites(items: FavouriteRouteStop[]): string {
  const stored: StoredFavourites = { version: FAVOURITES_STORAGE_VERSION, items: dedupeFavouriteRouteStops(items) };
  return JSON.stringify(stored);
}
