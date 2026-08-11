import { NextResponse } from 'next/server';
import { matchDirectRoutes } from '@/lib/directRouteMatcher';
import { fetchKmbRouteStops, KmbRouteStopsError } from '@/lib/server/kmbRouteStops';

const VALID_STOP_ID = /^[A-Z0-9]{8,32}$/i;
const MAX_CANDIDATES_PER_AREA = 10_000;
const MAX_REQUEST_BYTES = 512_000;

function normalizeStopIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_CANDIDATES_PER_AREA) return null;
  if (!value.every((item) => typeof item === 'string' && VALID_STOP_ID.test(item.trim()))) return null;
  return [...new Set(value.map((item) => (item as string).trim().toUpperCase()))].sort();
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const originStops = normalizeStopIds(record.originStops);
  const destinationStops = normalizeStopIds(record.destinationStops);
  if (!originStops || !destinationStops) {
    return NextResponse.json({ error: 'Invalid or excessive stop candidates' }, { status: 400 });
  }

  if (originStops.length === 0 || destinationStops.length === 0) {
    return NextResponse.json({ matchesByOriginStop: {} });
  }

  try {
    const routeStops = await fetchKmbRouteStops();
    return NextResponse.json({
      matchesByOriginStop: matchDirectRoutes(routeStops, originStops, destinationStops),
    });
  } catch (error) {
    if (error instanceof KmbRouteStopsError) {
      return NextResponse.json({ error: 'KMB route data is temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to match direct routes' }, { status: 500 });
  }
}
