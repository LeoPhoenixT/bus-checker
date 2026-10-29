/** The API accepts only bounded integer delay seconds, not HTTP-date values. */
export function parseRetryAfterSeconds(raw: string | null): number | null {
  const seconds = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 3600 ? seconds : null;
}

export class RouteDetailRequestError extends Error {
  constructor(readonly status: number, readonly retryAfterSeconds: number | null) {
    super(`Failed to fetch route detail: ${status}`);
    this.name = 'RouteDetailRequestError';
  }
}

export async function getJSON<T>(url: string, {
  signal,
  timeoutMs,
  cache,
}: { signal?: AbortSignal; timeoutMs?: number; cache?: RequestCache } = {}): Promise<T> {
  const controller = timeoutMs === undefined ? null : new AbortController();
  const abort = () => controller?.abort(signal?.reason);
  if (signal?.aborted) abort();
  else if (controller) signal?.addEventListener('abort', abort, { once: true });
  const timeout = controller ? setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs) : null;
  try {
    const response = await fetch(url, { signal: controller?.signal ?? signal, ...(cache ? { cache } : {}) });
    if (!response.ok) throw new RouteDetailRequestError(response.status, parseRetryAfterSeconds(response.headers.get('Retry-After')));
    return await response.json() as T;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
    if (controller) signal?.removeEventListener('abort', abort);
  }
}
