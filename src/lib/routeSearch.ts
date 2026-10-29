import { citybusRouteHref, kmbRouteHref } from './routeUrls';
import type { CitybusRoute } from './citybusTypes';
import type { RouteVariant } from './types';
import { compareRouteVariants } from './routeVariants';

export type RouteOperator = 'KMB' | 'CTB';
export type RouteOperatorFilter = RouteOperator | 'all';
export type RouteLookup = (RouteVariant & { operator: 'KMB' }) | CitybusRoute;
export interface OperatorRouteResults { routes: RouteLookup[]; truncated: boolean }

export function isRouteOperatorFilter(value: unknown): value is RouteOperatorFilter {
  return value === 'KMB' || value === 'CTB' || value === 'all';
}

export function routeLookupKey(item: RouteLookup): string {
  return item.operator === 'CTB' ? `CTB|${item.route}` : `KMB|${item.route}|${item.bound}|${item.serviceType}`;
}

export function compareRouteLookups(a: RouteLookup, b: RouteLookup, query: string): number {
  const exact = Number(b.route === query) - Number(a.route === query);
  if (exact) return exact;
  const route = a.route.localeCompare(b.route, 'en', { numeric: true, sensitivity: 'base' });
  if (route) return route;
  if (a.operator !== b.operator) return a.operator === 'KMB' ? -1 : 1;
  if (a.operator === 'KMB' && b.operator === 'KMB') {
    return compareRouteVariants(a, b, query);
  }
  return 0;
}

export function mergeRouteResults(sources: OperatorRouteResults[], query: string, limit = 50): OperatorRouteResults {
  const unique = new Map<string, RouteLookup>();
  for (const source of sources) for (const item of source.routes) unique.set(routeLookupKey(item), item);
  const routes = [...unique.values()].sort((a, b) => compareRouteLookups(a, b, query));
  return { routes: routes.slice(0, limit), truncated: sources.some((source) => source.truncated) || routes.length > limit };
}

export function routeSearchHref(query = '', filter: RouteOperatorFilter = 'all'): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (filter !== 'all') params.set('operator', filter);
  return `/routes${params.size ? `?${params}` : ''}`;
}

export function routeLookupHref(item: RouteLookup, query: string, filter: RouteOperatorFilter): string {
  const context = { searchQuery: query, searchFilter: filter };
  return item.operator === 'CTB' ? citybusRouteHref(item.route, undefined, context) : kmbRouteHref(item, context);
}
