import type { FavouriteRouteStop, FavouriteRouteStopMetadata, RouteDetail, RouteSearchResult, StopListResponse, StopETAResponse } from './types';

export async function fetchAllStops(): Promise<StopListResponse> {
  const res = await fetch('/api/stops');
  if (!res.ok) throw new Error(`Failed to fetch stops: ${res.status}`);
  return res.json() as Promise<StopListResponse>;
}

export interface FetchStopETAOptions {
  signal?: AbortSignal;
}

export async function fetchStopETAs(
  stopId: string,
  { signal }: FetchStopETAOptions = {},
): Promise<StopETAResponse> {
  const res = await fetch(`/api/stop-eta/${encodeURIComponent(stopId)}`, { signal });
  if (!res.ok) throw new Error(`Failed to fetch ETAs for ${stopId}: ${res.status}`);
  return res.json() as Promise<StopETAResponse>;
}

export async function searchRoutes(query: string, { signal }: FetchStopETAOptions = {}): Promise<RouteSearchResult> {
  const res = await fetch(`/api/routes?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`Failed to search routes: ${res.status}`);
  const body = await res.json() as Partial<RouteSearchResult>;
  return { routes: body.routes ?? [], truncated: body.truncated === true };
}

export async function fetchRouteDetail(
  route: string,
  bound: string,
  serviceType: string,
  { signal }: FetchStopETAOptions = {},
): Promise<RouteDetail> {
  const params = new URLSearchParams({ bound, serviceType });
  const res = await fetch(`/api/routes/${encodeURIComponent(route)}?${params}`, { signal });
  if (!res.ok) throw new Error(`Failed to fetch route detail: ${res.status}`);
  return res.json() as Promise<RouteDetail>;
}

export async function fetchFavouriteRouteStopMetadata(
  items: FavouriteRouteStop[],
  { signal }: FetchStopETAOptions = {},
): Promise<FavouriteRouteStopMetadata[]> {
  const res = await fetch('/api/favourite-route-stops', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Failed to resolve favourites: ${res.status}`);
  const body = await res.json() as Partial<{ items: FavouriteRouteStopMetadata[] }>;
  return body.items ?? [];
}
