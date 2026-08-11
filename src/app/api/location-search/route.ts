import { NextResponse } from 'next/server';
import proj4 from 'proj4';
import type { AddressSearchResult } from '@/lib/types';

const HK1980_GRID = '+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.24365,-1.15883,-1.09425 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 8;

interface GeodataResult {
  x: number;
  y: number;
  addressZH?: string;
  addressEN?: string;
  nameZH?: string;
  nameEN?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeResult(value: unknown, index: number): AddressSearchResult | null {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const item = value as unknown as GeodataResult;
  const [lon, lat] = proj4(HK1980_GRID, WGS84, [x, y]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const labelEn = [item.nameEN, item.addressEN].filter(Boolean).join(' - ').trim();
  const labelTc = [item.nameZH, item.addressZH].filter(Boolean).join(' - ').trim();
  if (!labelEn && !labelTc) return null;

  return {
    id: `${x}:${y}:${index}`,
    labelEn: labelEn || labelTc,
    labelTc: labelTc || labelEn,
    lat,
    lon,
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Query must contain 1 to 100 characters' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=${encodeURIComponent(query)}`,
      { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(5_000) },
    );
  } catch {
    return NextResponse.json({ error: 'Address search is temporarily unavailable' }, { status: 503 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: 'Address search is temporarily unavailable' }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return NextResponse.json({ error: 'Address search returned invalid data' }, { status: 502 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Address search returned invalid data' }, { status: 502 });
  }

  const results = body
    .map(normalizeResult)
    .filter((item): item is AddressSearchResult => item !== null)
    .slice(0, MAX_RESULTS);
  return NextResponse.json({ results });
}
