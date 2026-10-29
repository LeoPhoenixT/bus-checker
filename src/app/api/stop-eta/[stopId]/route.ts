import { NextResponse } from 'next/server';
import { fetchKmbStopETAs, KmbETAError } from '@/lib/server/kmbEta';

const VALID_STOP_ID = /^[A-Z0-9]{8,20}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await params;
  if (!VALID_STOP_ID.test(stopId)) {
    return NextResponse.json({ error: 'Invalid stop ID' }, { status: 400 });
  }
  try {
    return NextResponse.json(await fetchKmbStopETAs(stopId.toUpperCase(), req.signal));
  } catch (error) {
    if (!(error instanceof KmbETAError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
