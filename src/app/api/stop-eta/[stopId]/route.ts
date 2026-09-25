import { NextResponse } from 'next/server';
import { KMB_API_BASE } from '@/lib/server/kmb';

// KMB stop IDs are uppercase hex strings (e.g. "A3ADFCDF8487ADB9")
const VALID_STOP_ID = /^[A-Z0-9]{8,20}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * KMB's stop-ETA endpoint is scoped to one stop, but some valid ETA records
 * omit their redundant `stop` property. Restore it at the API boundary so
 * downstream consumers can keep exact stop filtering without losing live ETA.
 */
function normalizeStopETAResponse(value: unknown, stopId: string): Record<string, unknown> | null {
  if (!isRecord(value) || !Array.isArray(value.data)) return null;
  const rows = value.data.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.route !== 'string' || !entry.route.trim()
      || (entry.dir !== 'I' && entry.dir !== 'O')
      || !((typeof entry.service_type === 'string' && entry.service_type.trim()) || typeof entry.service_type === 'number')
      || !('eta' in entry) || !(entry.eta === null || (typeof entry.eta === 'string' && Number.isFinite(Date.parse(entry.eta))))
      || (entry.dest_en !== undefined && typeof entry.dest_en !== 'string')
      || (entry.dest_tc !== undefined && typeof entry.dest_tc !== 'string')) return null;
    const entryStop = typeof entry.stop === 'string' ? entry.stop.trim() : '';
    return entryStop ? entry : { ...entry, stop: stopId };
  });
  if (rows.some((entry) => entry === null)) return null;
  return {
    ...value,
    data: rows,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await params;

  // Input validation — prevent path traversal / injection
  if (!VALID_STOP_ID.test(stopId)) {
    return NextResponse.json({ error: 'Invalid stop ID' }, { status: 400 });
  }

  const normalizedStopId = stopId.toUpperCase();
  const res = await fetch(`${KMB_API_BASE}/stop-eta/${normalizedStopId}`, {
    cache: 'no-store', // always fresh — real-time ETA
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Failed to fetch ETAs for stop ${stopId}` },
      { status: res.status },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'Invalid KMB ETA response' }, { status: 502 });
  }
  const normalized = normalizeStopETAResponse(data, normalizedStopId);
  if (!normalized) return NextResponse.json({ error: 'Invalid KMB ETA response' }, { status: 502 });
  return NextResponse.json(normalized);
}
