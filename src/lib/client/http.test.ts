import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJSON, parseRetryAfterSeconds, RouteDetailRequestError } from './http';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('parseRetryAfterSeconds', () => {
  it.each([null, '', '0', '-1', '1.5', '3601', '9007199254740993', 'Wed, 21 Oct 2026 07:28:00 GMT'])('ignores unsupported or unsafe delays: %s', (raw) => {
    expect(parseRetryAfterSeconds(raw)).toBeNull();
  });
  it.each(['1', '42', '3600'])('accepts bounded delay seconds: %s', (raw) => {
    expect(parseRetryAfterSeconds(raw)).toBe(Number(raw));
  });
});

describe('getJSON', () => {
  it('preserves the caller signal without adding a timeout when none is requested', async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [] }));
    await expect(getJSON('/api/test', { signal: controller.signal })).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledWith('/api/test', { signal: controller.signal });
  });

  it('returns a shared typed error with bounded Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503, headers: { 'Retry-After': '42' } }));
    await expect(getJSON('/api/test')).rejects.toBeInstanceOf(RouteDetailRequestError);
    await expect(getJSON('/api/test')).rejects.toMatchObject({ status: 503, retryAfterSeconds: 42 });
  });

  it('cancels a timed request when its deadline expires and cleans up the timer', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const result = expect(getJSON('/api/test', { timeoutMs: 1000 })).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves caller cancellation during a timed request and clears the deadline', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const result = expect(getJSON('/api/test', { signal: controller.signal, timeoutMs: 1000 })).rejects.toThrow('Cancelled');
    controller.abort(new Error('Cancelled'));
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
