import { NextResponse } from 'next/server';

const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';

// KMB stop IDs are uppercase hex strings (e.g. "A3ADFCDF8487ADB9")
const VALID_STOP_ID = /^[A-Z0-9]{8,20}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await params;

  // Input validation — prevent path traversal / injection
  if (!VALID_STOP_ID.test(stopId)) {
    return NextResponse.json({ error: 'Invalid stop ID' }, { status: 400 });
  }

  const res = await fetch(`${KMB_BASE}/stop-eta/${stopId}`, {
    cache: 'no-store', // always fresh — real-time ETA
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Failed to fetch ETAs for stop ${stopId}` },
      { status: res.status },
    );
  }

  const data: unknown = await res.json();
  return NextResponse.json(data);
}
