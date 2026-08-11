import { NextResponse } from 'next/server';

const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';

export async function GET() {
  const res = await fetch(`${KMB_BASE}/stop`, {
    next: { revalidate: 86400 }, // cache for 24 h — stop locations are static
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch stop list from KMB API' },
      { status: res.status },
    );
  }

  const data: unknown = await res.json();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
