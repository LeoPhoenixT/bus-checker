export const CITYBUS_API_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
export const CITYBUS_METADATA_TTL_MS = 300_000;
export const CITYBUS_REQUEST_TIMEOUT_MS = 20_000;

export class CitybusError extends Error {
  constructor(message: string, readonly status = 503, readonly retryAfterSeconds = 30) {
    super(message);
    this.name = 'CitybusError';
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

export function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isCitybusStopId(value: string): boolean { return /^\d{6}$/.test(value); }

export async function fetchCitybusJSON(path: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${CITYBUS_API_BASE}/${path}`, {
      cache: 'no-store', signal: AbortSignal.timeout(CITYBUS_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CitybusError('Citybus request failed or timed out');
  }
  if (!response.ok) {
    const retry = response.headers.get('Retry-After');
    const seconds = retry && /^\d+$/.test(retry) ? Math.min(3600, Math.max(1, Number(retry))) : 30;
    throw new CitybusError(`Citybus returned HTTP ${response.status}`, response.status === 429 ? 503 : 502, seconds);
  }
  let body: unknown;
  try { body = await response.json(); } catch { throw new CitybusError('Invalid Citybus JSON', 502); }
  if (!record(body)) throw new CitybusError('Invalid Citybus response', 502);
  return body;
}

/** Process-local bounded cache. Shared work owns its timeout, never a caller's cancellation. */
export function createCitybusCache<T>(ttl: number, maxEntries: number) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  const failures = new Map<string, { error: CitybusError; until: number }>();
  function trim<V>(map: Map<string, V>) {
    while (map.size > maxEntries) map.delete(map.keys().next().value!);
  }
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const cached = values.get(key);
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
      values.delete(key);
      const failure = failures.get(key);
      if (failure && failure.until > Date.now()) return Promise.reject(failure.error);
      failures.delete(key);
      const active = pending.get(key);
      if (active) return active;
      const promise = Promise.resolve().then(load).then((value) => {
        values.set(key, { value, expiresAt: Date.now() + ttl });
        trim(values);
        return value;
      }).catch((error: unknown) => {
        const failure = error instanceof CitybusError ? error : new CitybusError('Citybus data unavailable');
        failures.set(key, { error: failure, until: Date.now() + failure.retryAfterSeconds * 1000 });
        trim(failures);
        throw failure;
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
    reset() { values.clear(); failures.clear(); pending.clear(); },
  };
}

/** Stop waiting without cancelling work used by another request. */
export function waitForCitybus<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new CitybusError('Citybus detail deadline exceeded'));
    if (signal.aborted) { promise.catch(() => {}); abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
