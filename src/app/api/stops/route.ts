import { NextResponse } from 'next/server';
import { fetchKmbStops, getKmbRetryAfterSeconds, KmbRoutesError } from '@/lib/server/kmbRoutes';

export async function GET() {
  try {
    const data = await fetchKmbStops();
    return NextResponse.json({ type: 'StopList', version: '1.0', generated_timestamp: '', data }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (!(error instanceof KmbRoutesError)) console.error('Unexpected stop-list request failure', error);
    const retryAfter = error instanceof KmbRoutesError ? getKmbRetryAfterSeconds(error) : null;
    return NextResponse.json({ error: 'KMB stop data is temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', ...(retryAfter === null ? {} : { 'Retry-After': String(retryAfter) }) },
    });
  }
}
