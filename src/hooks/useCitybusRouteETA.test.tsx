import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCitybusRouteETA } from './useCitybusRouteETA';
import type { CitybusBound, CitybusETAResponse } from '@/lib/citybusTypes';

const fetchETA = vi.hoisted(() => vi.fn());
vi.mock('@/lib/routes', () => ({ fetchCitybusRouteETA: fetchETA }));
const response = (): CitybusETAResponse => ({ generated_timestamp: '2026-10-14T12:00:00+08:00', data: [] });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T12:00:00+08:00')); fetchETA.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('selected Citybus route ETA lifecycle', () => {
  it('does not request anything before selection, and shares an in-progress refresh', async () => {
    let resolve!: (data: CitybusETAResponse) => void;
    fetchETA.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ selected }) => useCitybusRouteETA('1', 'O', selected ? { stopId: '000001', seq: 1 } : null), { initialProps: { selected: false } });
    expect(fetchETA).not.toHaveBeenCalled();
    rerender({ selected: true });
    act(() => { void result.current.refresh(); });
    expect(fetchETA).toHaveBeenCalledTimes(1);
    await act(async () => resolve(response()));
    expect(result.current.loading).toBe(false);
    expect(result.current.lastSuccessfulAt).not.toBeNull();
  });

  it('cancels direction changes and never shows the previous direction response', async () => {
    let resolveOld!: (data: CitybusETAResponse) => void;
    fetchETA.mockImplementationOnce(() => new Promise((done) => { resolveOld = done; })).mockResolvedValue(response());
    const { result, rerender } = renderHook(({ bound }: { bound: CitybusBound }) => useCitybusRouteETA('1', bound, { stopId: '000001', seq: 1 }), { initialProps: { bound: 'O' } });
    const signal = fetchETA.mock.calls[0][4] as AbortSignal;
    rerender({ bound: 'I' });
    await act(async () => {});
    await act(async () => resolveOld({ generated_timestamp: '', data: [] }));
    expect(signal.aborted).toBe(true);
    expect(result.current.key).toContain('|I|');
    expect(result.current.dataTime?.toISOString()).toBe(new Date(response().generated_timestamp).toISOString());
  });

  it('does not renew source age when cached data is received and preserves data on a refresh failure', async () => {
    fetchETA.mockResolvedValue(response());
    const { result } = renderHook(() => useCitybusRouteETA('1', 'O', { stopId: '000001', seq: 1 }));
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(result.current.freshness).toBe('stale');
    expect(result.current.dataTime?.getTime()).toBe(Date.parse(response().generated_timestamp));
    const successful = result.current.lastSuccessfulAt;
    fetchETA.mockRejectedValue(new Error('offline'));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe(true);
    expect(result.current.lastSuccessfulAt).toBe(successful);
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(result.current.freshness).toBe('very-stale');
  });
});
