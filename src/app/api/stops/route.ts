import { NextResponse } from 'next/server';
import { fetchKmbStops, KmbRoutesError } from '@/lib/server/kmbRoutes';

export async function GET() {
  try {
    const data = await fetchKmbStops();
    return NextResponse.json({ type: 'StopList', version: '1.0', generated_timestamp: '', data }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof KmbRoutesError ? 'KMB stop data is temporarily unavailable' : 'Failed to fetch stop list' }, { status: 503 });
  }
}
