import { NextResponse } from 'next/server';
import { isValidRouteQuery, normalizeRouteQuery } from '@/lib/routeVariants';
import { CitybusError, isCitybusStopId, positiveInteger } from '@/lib/server/citybus';
import { getCitybusRouteETA } from '@/lib/server/citybusEta';

export async function GET(request: Request, { params }: { params: Promise<{ route: string }> }) {
  const route = normalizeRouteQuery((await params).route);
  const query = new URL(request.url).searchParams;
  const stop = query.get('stop') ?? '';
  const bound = query.get('bound');
  const seq = positiveInteger(query.get('seq'));
  const headers = { 'Cache-Control': 'no-store' };
  if (!isValidRouteQuery(route) || !isCitybusStopId(stop) || (bound !== 'I' && bound !== 'O') || seq === null) {
    return NextResponse.json({ error: 'Invalid Citybus boarding point' }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await getCitybusRouteETA(route, bound, stop, seq), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof CitybusError && error.status === 404 ? 'Boarding stop not found' : 'Citybus ETA temporarily unavailable' }, {
      status: error instanceof CitybusError ? error.status : 503,
      headers: { ...headers, 'Retry-After': String(error instanceof CitybusError ? error.retryAfterSeconds : 30) },
    });
  }
}
