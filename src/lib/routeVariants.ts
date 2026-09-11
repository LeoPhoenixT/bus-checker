import type { RouteVariant, RouteVariantId } from './types';

const ROUTE_QUERY_PATTERN = /^[A-Z0-9-]{1,10}$/;
const SERVICE_TYPE_PATTERN = /^\d{1,3}$/;

export function normalizeRouteQuery(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidRouteQuery(value: string): boolean {
  return ROUTE_QUERY_PATTERN.test(value);
}

export function isValidServiceType(value: string): boolean {
  return SERVICE_TYPE_PATTERN.test(value);
}

export function normalizeRouteVariantId(value: RouteVariantId): RouteVariantId | null {
  const route = normalizeRouteQuery(value.route);
  const bound = value.bound.trim().toUpperCase();
  const serviceType = String(value.serviceType).trim().toUpperCase();
  if (!isValidRouteQuery(route) || (bound !== 'I' && bound !== 'O') || !isValidServiceType(serviceType)) return null;
  return { route, bound, serviceType } as RouteVariantId;
}

export function routeVariantKey({ route, bound, serviceType }: RouteVariantId): string {
  return `${route}|${bound}|${serviceType}`;
}

export function isSpecialService(serviceType: string): boolean {
  const parsed = Number.parseInt(serviceType, 10);
  return Number.isFinite(parsed) && parsed >= 2;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export function sortRouteVariants(variants: RouteVariant[], query = ''): RouteVariant[] {
  const normalizedQuery = normalizeRouteQuery(query);
  const score = (route: string) => route === normalizedQuery ? 0 : route.startsWith(normalizedQuery) ? 1 : 2;
  return [...variants].sort((a, b) => {
    const routeScore = score(a.route) - score(b.route);
    if (routeScore) return routeScore;
    const routeComparison = compareText(a.route, b.route);
    if (routeComparison) return routeComparison;
    if (a.isSpecial !== b.isSpecial) return a.isSpecial ? 1 : -1;
    const originComparison = compareText(a.originTc || a.originEn, b.originTc || b.originEn);
    if (originComparison) return originComparison;
    const destinationComparison = compareText(a.destinationTc || a.destinationEn, b.destinationTc || b.destinationEn);
    if (destinationComparison) return destinationComparison;
    return compareText(a.serviceType, b.serviceType);
  });
}

function sameName(a: string, b: string): boolean {
  const normalizedA = a.trim().toLocaleUpperCase();
  const normalizedB = b.trim().toLocaleUpperCase();
  return Boolean(normalizedA) && Boolean(normalizedB) && normalizedA === normalizedB;
}

/**
 * Return only real opposite-bound variants which start at this variant's
 * destination.  Prefer an exact terminus swap and the same service type, but
 * retain other real variants so users can choose between special services.
 */
export function findReverseVariants(current: RouteVariant, allVariants: RouteVariant[]): RouteVariant[] {
  const candidates = allVariants.filter((candidate) => (
    candidate.route === current.route
    && candidate.bound !== current.bound
    && (sameName(candidate.originTc, current.destinationTc)
      || sameName(candidate.originEn, current.destinationEn))
  ));

  return [...candidates].sort((a, b) => {
    const aExact = sameName(a.destinationTc, current.originTc) || sameName(a.destinationEn, current.originEn);
    const bExact = sameName(b.destinationTc, current.originTc) || sameName(b.destinationEn, current.originEn);
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aSameService = a.serviceType === current.serviceType;
    const bSameService = b.serviceType === current.serviceType;
    if (aSameService !== bSameService) return aSameService ? -1 : 1;
    return sortRouteVariants([a, b])[0] === a ? -1 : 1;
  });
}
