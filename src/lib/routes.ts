import { searchRoutes, RouteDetailRequestError } from './kmb';
import type { CitybusBound, CitybusETAResponse, CitybusRoute, CitybusRouteDetail } from './citybusTypes';
import type { OperatorRouteResults, RouteOperator } from './routeSearch';

async function getJSON<T>(url: string, signal?: AbortSignal, timeoutMs = 45_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      const raw = response.headers.get('Retry-After');
      const retry = raw && /^\d+$/.test(raw) ? Number(raw) : null;
      throw new RouteDetailRequestError(response.status, retry !== null && retry > 0 && retry <= 3600 ? retry : null);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function searchOperatorRoutes(query: string, operator: RouteOperator, signal?: AbortSignal): Promise<OperatorRouteResults> {
  if (operator === 'KMB') {
    const result = await searchRoutes(query, { signal });
    return { ...result, routes: result.routes.map((route) => ({ ...route, operator: 'KMB' as const })) };
  }
  const result = await getJSON<{ routes: CitybusRoute[]; truncated: boolean }>(`/api/routes?operator=CTB&q=${encodeURIComponent(query)}`, signal, 25_000);
  if (!Array.isArray(result.routes)) throw new Error('Invalid Citybus search results');
  return { routes: result.routes, truncated: result.truncated === true };
}

export function fetchCitybusRouteDetail(route: string, bound?: CitybusBound, signal?: AbortSignal): Promise<CitybusRouteDetail> {
  const params = new URLSearchParams({ operator: 'CTB' });
  if (bound) params.set('bound', bound);
  return getJSON(`/api/routes/${encodeURIComponent(route)}?${params}`, signal);
}

export function fetchCitybusRouteETA(route: string, bound: CitybusBound, stopId: string, seq: number, signal?: AbortSignal): Promise<CitybusETAResponse> {
  const params = new URLSearchParams({ stop: stopId, bound, seq: String(seq) });
  return getJSON(`/api/citybus/routes/${encodeURIComponent(route)}/eta?${params}`, signal, 12_000);
}
