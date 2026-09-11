import { NextResponse } from 'next/server';
import { isValidRouteQuery, isValidServiceType, normalizeRouteQuery } from '@/lib/routeVariants';
import { getKmbRouteDetail, KmbRoutesError, KmbRouteStopsError } from '@/lib/server/kmbRoutes';

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
  const bound = firstSearchParam(searchParams.get('bound'));
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
      return NextResponse.json({ error: 'KMB route data is temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load route detail' }, { status: 500 });
  }
}
