import { NextResponse } from 'next/server';
import { isValidRouteQuery, isValidServiceType, normalizeRouteQuery } from '@/lib/routeVariants';
import { getKmbRetryAfterSeconds, getKmbRouteDetail, KmbRoutesError, KmbRouteStopsError } from '@/lib/server/kmbRoutes';
import { getCitybusRouteDetail } from '@/lib/server/citybusRoutes';
import { CitybusError } from '@/lib/server/citybus';

function firstSearchParam(value: string | null): string {
  return value?.trim().toUpperCase() ?? '';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ route: string }> },
) {
  const { route: rawRoute } = await params;
  const route = normalizeRouteQuery(rawRoute);
  const searchParams = new URL(request.url).searchParams;
  const operator = searchParams.get('operator') ?? 'KMB';
  if (operator !== 'KMB' && operator !== 'CTB') return NextResponse.json({ error: 'Invalid route operator' }, { status: 400 });
  const bound = firstSearchParam(searchParams.get('bound'));
  if (operator === 'CTB') {
    if (!isValidRouteQuery(route) || (bound !== '' && bound !== 'I' && bound !== 'O')) {
      return NextResponse.json({ error: 'Invalid Citybus route direction' }, { status: 400 });
    }
    try {
      const detail = await getCitybusRouteDetail(route, bound || undefined);
      if (!detail) return NextResponse.json({ error: 'Citybus route direction has no available stops' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      // Incomplete metadata must be retryable, rather than cached by a CDN.
      return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return NextResponse.json({ error: 'Citybus route data is temporarily unavailable' }, {
        status: error instanceof CitybusError ? error.status : 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(error instanceof CitybusError ? error.retryAfterSeconds : 30) },
      });
    }
  }
  const serviceType = firstSearchParam(searchParams.get('serviceType'));
  if (!isValidRouteQuery(route) || (bound !== 'I' && bound !== 'O') || !isValidServiceType(serviceType)) {
    return NextResponse.json({ error: 'Invalid route variant' }, { status: 400 });
  }

  try {
    const detail = await getKmbRouteDetail(route, bound, serviceType);
    if (!detail) return NextResponse.json({ error: 'Route variant was not found' }, { status: 404 });
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    if (error instanceof KmbRoutesError || error instanceof KmbRouteStopsError) {
      const retryAfter = getKmbRetryAfterSeconds(error);
      return NextResponse.json({ error: 'KMB route data is temporarily unavailable' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', ...(retryAfter === null ? {} : { 'Retry-After': String(retryAfter) }) },
      });
    }
    console.error('Unexpected route detail request failure', { route, bound, serviceType, error });
    return NextResponse.json({ error: 'Failed to load route detail' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
