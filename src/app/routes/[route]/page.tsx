import { notFound } from 'next/navigation';
import { RouteDetailPage } from '@/components/RouteDetailPage';
import { isValidRouteQuery, isValidServiceType, normalizeRouteQuery } from '@/lib/routeVariants';
import { CitybusRouteDetailPage } from '@/components/CitybusRouteDetailPage';
import { isRouteOperatorFilter } from '@/lib/routeSearch';

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ route: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { route: rawRoute } = await params;
  const query = await searchParams;
  const route = normalizeRouteQuery(rawRoute);
  const operator = query.operator ?? 'KMB';
  if (operator !== 'KMB' && operator !== 'CTB') notFound();
  const bound = typeof query.bound === 'string' ? query.bound.trim().toUpperCase() : '';
  const serviceType = typeof query.serviceType === 'string' ? query.serviceType.trim().toUpperCase() : '';
  const stopId = typeof query.stop === 'string' ? query.stop.trim().toUpperCase() : undefined;
  // Keep an invalid supplied sequence distinct from a legacy stop-only link.
  const stopSeq = query.seq === undefined ? undefined
    : typeof query.seq === 'string' && /^\d+$/.test(query.seq) && Number.isSafeInteger(Number(query.seq)) && Number(query.seq) > 0
      ? Number(query.seq) : -1;
  const searchQuery = typeof query.q === 'string' ? normalizeRouteQuery(query.q) : '';
  const searchFilter = isRouteOperatorFilter(query.filter) ? query.filter : 'all';
  if (operator === 'CTB') {
    if (!isValidRouteQuery(route) || (bound !== '' && bound !== 'I' && bound !== 'O')) notFound();
    return <CitybusRouteDetailPage route={route} bound={bound || undefined} searchQuery={isValidRouteQuery(searchQuery) ? searchQuery : undefined}
      searchFilter={searchFilter} initialStopId={stopId} initialStopSeq={stopSeq} />;
  }
  if (!isValidRouteQuery(route) || (bound !== 'I' && bound !== 'O') || !isValidServiceType(serviceType)) notFound();
  return <RouteDetailPage
    route={route}
    bound={bound}
    serviceType={serviceType}
    searchQuery={isValidRouteQuery(searchQuery) ? searchQuery : undefined}
    searchFilter={searchFilter}
    initialStopId={stopId || undefined}
    initialStopSeq={stopSeq}
  />;
}
