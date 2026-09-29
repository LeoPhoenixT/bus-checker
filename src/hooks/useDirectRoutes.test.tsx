import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDirectRoutes } from './useDirectRoutes';
import type { DirectRouteMatchesByOriginStop } from '@/lib/types';

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function response(matchesByOriginStop: DirectRouteMatchesByOriginStop): Response {
  return new Response(JSON.stringify({ matchesByOriginStop }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('useDirectRoutes', () => {
  it('ignores a superseded response whose JSON body finishes after the current result', async () => {
    let resolveBody!: (value: unknown) => void;
    const body = new Promise((resolve) => { resolveBody = resolve; });
    const readBody = vi.fn(() => body);
    const current = { ORIGIN01: [{ route: '2', bound: 'O' as const, serviceType: '1', boardingStop: 'ORIGIN01', boardingSeq: 1, alightingStop: 'DEST0002', alightingSeq: 2 }] };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: readBody } as unknown as Response)
      .mockResolvedValueOnce(response(current));
    const { result, rerender } = renderHook(({ destination }) => useDirectRoutes(['ORIGIN01'], [destination], true), { initialProps: { destination: 'DEST0001' } });
    await waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    rerender({ destination: 'DEST0002' });
    await waitFor(() => expect(result.current.matchesByOriginStop).toEqual(current));
    await act(async () => resolveBody({ matchesByOriginStop: { ORIGIN01: [] } }));
    expect(result.current).toEqual({ matchesByOriginStop: current, loading: false, error: null });
  });
  it('stays idle and preserves ordinary behavior when disabled', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useDirectRoutes(['ORIGIN01'], ['DEST0001'], false));
    expect(result.current).toEqual({ matchesByOriginStop: {}, loading: false, error: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let a superseded destination response overwrite the current result', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ destination }) => useDirectRoutes(['ORIGIN01'], [destination], true),
      { initialProps: { destination: 'DEST0001' } },
    );
    rerender({ destination: 'DEST0002' });

    const current = { ORIGIN01: [{
      route: '2', bound: 'O' as const, serviceType: '1', boardingStop: 'ORIGIN01', boardingSeq: 1,
      alightingStop: 'DEST0002', alightingSeq: 2,
    }] };
    await act(async () => second.resolve(response(current)));
    await waitFor(() => expect(result.current.matchesByOriginStop).toEqual(current));

    const stale = { ORIGIN01: [{
      route: '1', bound: 'O' as const, serviceType: '1', boardingStop: 'ORIGIN01', boardingSeq: 1,
      alightingStop: 'DEST0001', alightingSeq: 2,
    }] };
    await act(async () => first.resolve(response(stale)));
    expect(result.current.matchesByOriginStop).toEqual(current);
  });

  it('logs a failed request without returning its details for display', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Internal upstream detail' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ));

    const { result } = renderHook(() => useDirectRoutes(['ORIGIN01'], ['DEST0001'], true));
    await waitFor(() => expect(result.current.error).toBe('unavailable'));
    expect(consoleError).toHaveBeenCalledWith('Direct-route request failed', expect.any(Error));
    expect(result.current.error).not.toContain('Internal upstream detail');
  });
});
