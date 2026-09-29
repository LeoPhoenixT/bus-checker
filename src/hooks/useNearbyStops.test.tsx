import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNearbyStops } from './useNearbyStops';

const getCachedStopsMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/clientStops', () => ({ getCachedStops: getCachedStopsMock }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useNearbyStops', () => {
  it('refreshes stationary users after the service-day change and ignores old pending data', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-04T21:09:59.000Z'));
    const stop = { stop: 'NEW', name_en: 'New', name_tc: '新站', name_sc: '新站', lat: 22.3, long: 114.1, data_timestamp: '' };
    let resolveOld!: (value: typeof stop[]) => void;
    getCachedStopsMock.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce([stop]);
    const { result } = renderHook(() => useNearbyStops(22.3, 114.1));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await waitFor(() => expect(result.current.stops[0]?.stop).toBe('NEW'));
    await act(async () => resolveOld([{ ...stop, stop: 'OLD' }]));
    expect(result.current.stops[0].stop).toBe('NEW');
    expect(getCachedStopsMock).toHaveBeenCalledTimes(2);
  });
  it('logs stop-list failures but returns only a generic error state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCachedStopsMock.mockRejectedValue(new Error('Internal upstream detail'));

    const { result } = renderHook(() => useNearbyStops(22.3, 114.1));
    await waitFor(() => expect(result.current.error).toBe('unavailable'));
    expect(consoleError).toHaveBeenCalledWith('Nearby KMB stop request failed', expect.any(Error));
    expect(result.current.error).not.toContain('Internal upstream detail');
  });
});
