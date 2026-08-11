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
      route: '2', bound: 'O' as const, serviceType: '1', boardingSeq: 1,
      alightingStop: 'DEST0002', alightingSeq: 2,
    }] };
    await act(async () => second.resolve(response(current)));
    await waitFor(() => expect(result.current.matchesByOriginStop).toEqual(current));

    const stale = { ORIGIN01: [{
      route: '1', bound: 'O' as const, serviceType: '1', boardingSeq: 1,
      alightingStop: 'DEST0001', alightingSeq: 2,
    }] };
    await act(async () => first.resolve(response(stale)));
    expect(result.current.matchesByOriginStop).toEqual(current);
  });
});
