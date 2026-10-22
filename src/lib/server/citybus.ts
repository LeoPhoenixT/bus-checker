export const CITYBUS_API_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
export const CITYBUS_METADATA_TTL_MS = 300_000;
export const CITYBUS_REQUEST_TIMEOUT_MS = 20_000;

export class CitybusError extends Error {
  readonly retryAt: number;

  constructor(message: string, readonly status = 503, retryAfterSeconds = 30) {
    super(message);
    this.name = 'CitybusError';
    this.retryAt = Date.now() + retryAfterSeconds * 1000;
  }

  get retryAfterSeconds(): number {
    return Math.max(0, Math.ceil((this.retryAt - Date.now()) / 1000));
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

/** Bounded process-local cache. Abandon queued work only when no waiters remain. */
export function createCitybusCache<T>(ttl: number, maxEntries: number) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  type Pending = { promise: Promise<T>; controller: AbortController; waiters: number; settled: boolean };
  const pending = new Map<string, Pending>();
  const failures = new Map<string, { error: CitybusError; until: number }>();
  function trim<V>(map: Map<string, V>) {
    while (map.size > maxEntries) map.delete(map.keys().next().value!);
  }
  function join(entry: Pending, signal?: AbortSignal): Promise<T> {
    entry.waiters++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (--entry.waiters === 0 && !entry.settled) entry.controller.abort();
    };
    signal?.addEventListener('abort', release, { once: true });
    return (signal ? waitForCitybus(entry.promise, signal) : entry.promise).finally(() => {
      signal?.removeEventListener('abort', release);
      release();
    });
  }
  return {
    get(key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const cached = values.get(key);
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
      values.delete(key);
      const failure = failures.get(key);
      if (failure && failure.until > Date.now()) return Promise.reject(failure.error);
      failures.delete(key);
      const active = pending.get(key);
      if (active) {
        // Drain abandoned queued work before retrying. Started work can still fill values.
        if (active.controller.signal.aborted) {
          const retry = active.promise.catch(() => {}).then(() => this.get(key, load, signal));
          return signal ? waitForCitybus(retry, signal) : retry;
        }
        return join(active, signal);
      }
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => load(controller.signal)).then((value) => {
        values.set(key, { value, expiresAt: Date.now() + ttl });
        trim(values);
        return value;
      }).catch((error: unknown) => {
        if (controller.signal.aborted && error === controller.signal.reason) throw error;
        const failure = error instanceof CitybusError ? error : new CitybusError('Citybus data unavailable');
        failures.set(key, { error: failure, until: failure.retryAt });
        trim(failures);
        throw failure;
      }).finally(() => { entry.settled = true; pending.delete(key); });
      const entry: Pending = { promise, controller, waiters: 0, settled: false };
      pending.set(key, entry);
      return join(entry, signal);
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
