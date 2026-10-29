import { getKmbServiceDay } from './kmbServiceDay';

interface RetryableError extends Error {
  retryAfterAt?: number;
}

/** A single current service-day snapshot, with shared refresh and failure backoff. */
export function createServiceDayCache<T, E extends RetryableError>({
  load,
  toError,
  onFailure,
}: {
  load: () => Promise<T>;
  toError: (error: unknown) => E;
  onFailure: (error: E) => void;
}) {
  let snapshot: { serviceDay: string; value: T } | null = null;
  let pending: { serviceDay: string; promise: Promise<T> } | null = null;
  let failed: { serviceDay: string; retryAfter: number; error: E } | null = null;

  return {
    get(now = new Date()): Promise<T> {
      const serviceDay = getKmbServiceDay(now);
      const nowMs = now.getTime();
      if (snapshot?.serviceDay === serviceDay) return Promise.resolve(snapshot.value);
      snapshot = null;
      if (failed?.serviceDay === serviceDay && nowMs < failed.retryAfter) return Promise.reject(failed.error);
      if (pending?.serviceDay === serviceDay) return pending.promise;

      const refresh: { serviceDay: string; promise: Promise<T> } = { serviceDay, promise: Promise.resolve(undefined as T) };
      refresh.promise = load()
        .then((value) => {
          // Superseded jobs may resolve for their callers, but cannot mutate current state.
          if (pending === refresh) {
            snapshot = { serviceDay, value };
            failed = null;
          }
          return value;
        })
        .catch((cause: unknown) => {
          const error = toError(cause);
          if (pending === refresh) {
            error.retryAfterAt = nowMs + 60_000;
            failed = { serviceDay, retryAfter: error.retryAfterAt, error };
            onFailure(error);
          }
          throw error;
        })
        .finally(() => {
          if (pending === refresh) pending = null;
        });
      pending = refresh;
      return refresh.promise;
    },
    reset() {
      snapshot = null;
      pending = null;
      failed = null;
    },
  };
}
