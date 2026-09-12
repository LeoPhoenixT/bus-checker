import { RouteSearchPage } from '@/components/RouteSearchPage';
import { isValidRouteQuery, normalizeRouteQuery } from '@/lib/routeVariants';

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const initialQuery = typeof query.q === 'string' ? normalizeRouteQuery(query.q) : '';
  return <RouteSearchPage initialQuery={isValidRouteQuery(initialQuery) ? initialQuery : ''} />;
}
