import { KMB_API_BASE } from './kmb';

export class KmbETAError extends Error {
  constructor(message: string, readonly status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KmbETAError';
  }
}

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
      || !Number.isSafeInteger(entry.seq) || Number(entry.seq) <= 0
      || !Number.isSafeInteger(entry.eta_seq) || Number(entry.eta_seq) <= 0
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

export async function fetchKmbStopETAs(stopId: string, requestSignal?: AbortSignal): Promise<Record<string, unknown>> {
  const timeout = AbortSignal.timeout(10_000);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${KMB_API_BASE}/stop-eta/${stopId}`, { cache: 'no-store', signal });
  } catch (error) {
    console.error('KMB ETA request failed', { stopId, error });
    throw new KmbETAError('Unable to reach KMB ETA service', timeout.aborted ? 504 : 502, { cause: error });
  }
  if (!response.ok) throw new KmbETAError(`Failed to fetch ETAs for stop ${stopId}`, response.status);
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error('KMB ETA JSON parsing failed', { stopId, error });
    throw new KmbETAError('Invalid KMB ETA response', timeout.aborted ? 504 : 502, { cause: error });
  }
  const normalized = normalizeStopETAResponse(data, stopId);
  if (!normalized) {
    console.error('KMB ETA payload validation failed', { stopId });
    throw new KmbETAError('Invalid KMB ETA response', 502);
  }
  return normalized;
}
