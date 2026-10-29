import type { RouteOperatorFilter } from './routeSearch';

interface RouteLinkContext {
  searchQuery?: string;
  searchFilter?: RouteOperatorFilter;
  stopId?: string;
  boardingSeq?: number;
}

function detailHref(route: string, params: URLSearchParams, context: RouteLinkContext): string {
  if (context.stopId !== undefined) params.set('stop', context.stopId);
  if (context.boardingSeq !== undefined) params.set('seq', String(context.boardingSeq));
  if (context.searchQuery) params.set('q', context.searchQuery);
  if (context.searchFilter && context.searchFilter !== 'all') params.set('filter', context.searchFilter);
  return `/routes/${encodeURIComponent(route)}?${params}`;
}

export function kmbRouteHref(
  variant: { route: string; bound: string; serviceType: string },
  context: RouteLinkContext = {},
): string {
  return detailHref(variant.route, new URLSearchParams({ bound: variant.bound, serviceType: variant.serviceType }), context);
}

export function citybusRouteHref(route: string, bound?: string, context: RouteLinkContext = {}): string {
  const params = new URLSearchParams({ operator: 'CTB' });
  if (bound) params.set('bound', bound);
  return detailHref(route, params, context);
}
