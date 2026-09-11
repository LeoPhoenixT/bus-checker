import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStopETAs } from './useStopETAs';
import type { ETAEntry } from '@/lib/types';

const fetchStopETAsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/kmb', () => ({
  fetchStopETAs: fetchStopETAsMock,
}));

function eta(stop: string): ETAEntry {
  return {
    co: 'KMB', route: '88X', dir: 'O', service_type: '1', seq: 1, stop,
    dest_en: 'Destination', dest_tc: '目的地', dest_sc: '目的地', eta_seq: 1,
    eta: '2099-01-01T00:00:00+08:00', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '',
  };
}

function response(stop: string) {
  return {
    type: 'ETA', version: '1', generated_timestamp: '', data: [eta(stop)],
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useStopETAs', () => {
  it('keeps successful stop responses when another stop request fails', async () => {
    fetchStopETAsMock
      .mockResolvedValueOnce(response('STOP_A'))
      .mockRejectedValueOnce(new Error('KMB unavailable'));

    const { result } = renderHook(() => useStopETAs(['stop_a', 'stop_b']));

    await waitFor(() => expect(result.current.etaStates.STOP_B?.attemptStatus).toBe('error'));

    expect(result.current.etasMap.STOP_A).toHaveLength(1);
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('success');
    expect(result.current.etaStates.STOP_B.attemptStatus).toBe('error');
    expect(result.current.etaStates.STOP_B.data).toEqual([]);
    expect(result.current.etaStates.STOP_B.freshness).toBe('unavailable');
    expect(result.current.failedStopCount).toBe(1);
  });

  it('keeps the last successful ETA when a later refresh fails', async () => {
    fetchStopETAsMock
      .mockResolvedValueOnce(response('STOP_A'))
      .mockRejectedValueOnce(new Error('KMB unavailable'));

    const { result } = renderHook(() => useStopETAs(['STOP_A']));
    await waitFor(() => expect(result.current.etaStates.STOP_A?.attemptStatus).toBe('success'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.etasMap.STOP_A).toHaveLength(1);
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('error');
    expect(result.current.etaStates.STOP_A.lastSuccessfulAt).not.toBeNull();
  });

  it('ignores a response from a stop set that has since changed', async () => {
    let resolveOldRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    fetchStopETAsMock.mockImplementation((stopId: string) => {
      if (stopId === 'STOP_A') {
        return new Promise<ReturnType<typeof response>>((resolve) => {
          resolveOldRequest = resolve;
        });
      }
      return Promise.resolve(response(stopId));
    });

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useStopETAs(ids),
      { initialProps: { ids: ['STOP_A'] } },
    );
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith(
      'STOP_A',
      expect.objectContaining({ signal: expect.anything() }),
    ));

    rerender({ ids: ['STOP_B'] });
    await waitFor(() => expect(result.current.etaStates.STOP_B?.attemptStatus).toBe('success'));

    await act(async () => {
      resolveOldRequest?.(response('STOP_A'));
    });

    expect(result.current.etaStates.STOP_A).toBeUndefined();
    expect(result.current.etasMap.STOP_B).toHaveLength(1);
  });

  it('reuses an in-flight request when the user retries before it completes', async () => {
    let resolveRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    fetchStopETAsMock.mockImplementation(() => new Promise<ReturnType<typeof response>>((resolve) => {
      resolveRequest = resolve;
    }));

    const { result } = renderHook(() => useStopETAs(['STOP_A']));
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledTimes(1));

    let retry: Promise<void> | undefined;
    act(() => {
      retry = result.current.refresh();
    });
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(response('STOP_A'));
      await retry;
    });
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('success');
  });

  it('does not start overlapping interval requests while the current request is pending', async () => {
    vi.useFakeTimers();
    let resolveRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    fetchStopETAsMock.mockImplementation(() => new Promise<ReturnType<typeof response>>((resolve) => {
      resolveRequest = resolve;
    }));

    const { result } = renderHook(() => useStopETAs(['STOP_A']));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(response('STOP_A'));
    });
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('success');
  });

  it('times out a pending stop, commits other successful stops, and allows retry', async () => {
    vi.useFakeTimers();
    fetchStopETAsMock
      .mockImplementationOnce((_stopId: string, { signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }))
      .mockResolvedValueOnce(response('STOP_B'))
      .mockResolvedValueOnce(response('STOP_A'))
      .mockResolvedValueOnce(response('STOP_B'));

    const { result } = renderHook(() => useStopETAs(['STOP_A', 'STOP_B']));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.etaStates.STOP_B.attemptStatus).toBe('success');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('error');
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(4);
    expect(result.current.etaStates.STOP_A.attemptStatus).toBe('success');
  });

  it('updates freshness as the clock crosses 60, 120, and 300 second thresholds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
    fetchStopETAsMock
      .mockResolvedValueOnce(response('STOP_A'))
      .mockRejectedValue(new Error('Temporary API error'));

    const { result } = renderHook(() => useStopETAs(['STOP_A']));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.etaStates.STOP_A.freshness).toBe('fresh');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.etaStates.STOP_A.freshness).toBe('slightly-old');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.etaStates.STOP_A.freshness).toBe('stale');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(result.current.etaStates.STOP_A.freshness).toBe('very-stale');
  });

  it('aborts pending requests when unmounted', async () => {
    let signal: AbortSignal | undefined;
    fetchStopETAsMock.mockImplementation((_stopId: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    });

    const { unmount } = renderHook(() => useStopETAs(['STOP_A']));
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
