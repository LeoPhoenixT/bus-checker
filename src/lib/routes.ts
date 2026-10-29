import { searchRoutes } from './kmb';
import { getJSON } from './client/http';
import type { CitybusBound, CitybusETAResponse, CitybusRoute, CitybusRouteDetail } from './citybusTypes';
import type { OperatorRouteResults, RouteOperator } from './routeSearch';

export async function searchOperatorRoutes(query: string, operator: RouteOperator, signal?: AbortSignal): Promise<OperatorRouteResults> {
  if (operator === 'KMB') {
    const result = await searchRoutes(query, { signal });
    return { ...result, routes: result.routes.map((route) => ({ ...route, operator: 'KMB' as const })) };
  }
  const result = await getJSON<{ routes: CitybusRoute[]; truncated: boolean }>(`/api/routes?operator=CTB&q=${encodeURIComponent(query)}`, { signal, cache: 'no-store', timeoutMs: 25_000 });
  if (!Array.isArray(result.routes)) throw new Error('Invalid Citybus search results');
  return { routes: result.routes, truncated: result.truncated === true };
}

export function fetchCitybusRouteDetail(route: string, bound?: CitybusBound, signal?: AbortSignal): Promise<CitybusRouteDetail> {
  const params = new URLSearchParams({ operator: 'CTB' });
  if (bound) params.set('bound', bound);
  return getJSON(`/api/routes/${encodeURIComponent(route)}?${params}`, { signal, cache: 'no-store', timeoutMs: 45_000 });
}

export function fetchCitybusRouteETA(route: string, bound: CitybusBound, stopId: string, seq: number, signal?: AbortSignal): Promise<CitybusETAResponse> {
  const params = new URLSearchParams({ stop: stopId, bound, seq: String(seq) });
  return getJSON(`/api/citybus/routes/${encodeURIComponent(route)}/eta?${params}`, { signal, cache: 'no-store', timeoutMs: 12_000 });
}
