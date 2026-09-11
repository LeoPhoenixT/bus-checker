import { NextResponse } from 'next/server';
import { isValidRouteQuery, normalizeRouteQuery } from '@/lib/routeVariants';
import { KmbRoutesError, searchKmbRouteVariants } from '@/lib/server/kmbRoutes';

const MAX_RESULTS = 50;

export async function GET(request: Request) {
  const rawQuery = new URL(request.url).searchParams.get('q') ?? '';
  const query = normalizeRouteQuery(rawQuery);
  if (!isValidRouteQuery(query)) {
    return NextResponse.json({ error: 'Route query must contain 1 to 10 letters, numbers, or hyphens' }, { status: 400 });
  }

  try {
    const routes = await searchKmbRouteVariants(query, MAX_RESULTS);
    return NextResponse.json({ routes }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    if (error instanceof KmbRoutesError) {
      return NextResponse.json({ error: 'KMB route data is temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to search KMB routes' }, { status: 500 });
  }
}
