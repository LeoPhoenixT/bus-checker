import { NextResponse } from 'next/server';
import { normalizeFavouriteRouteStop } from '@/lib/favourites';
import { getKmbFavouriteRouteStopMetadata, KmbRoutesError, KmbRouteStopsError } from '@/lib/server/kmbRoutes';
import type { FavouriteRouteStop } from '@/lib/types';

const MAX_FAVOURITES_PER_REQUEST = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length > MAX_FAVOURITES_PER_REQUEST) {
    return NextResponse.json({ error: 'Invalid favourites request' }, { status: 400 });
  }
  const items = body.items.flatMap((item) => (
    isRecord(item) ? [normalizeFavouriteRouteStop(item as unknown as FavouriteRouteStop)].filter((value): value is FavouriteRouteStop => value !== null) : []
  ));
  if (items.length !== body.items.length) return NextResponse.json({ error: 'Invalid favourite identity' }, { status: 400 });

  try {
    const itemsWithMetadata = await getKmbFavouriteRouteStopMetadata(items);
    return NextResponse.json({ items: itemsWithMetadata }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    if (error instanceof KmbRoutesError || error instanceof KmbRouteStopsError) {
      return NextResponse.json({ error: 'KMB route data is temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to resolve favourites' }, { status: 500 });
  }
}
