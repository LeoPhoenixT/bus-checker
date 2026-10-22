import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteSearch } from './useRouteSearch';
import type { OperatorRouteResults, RouteOperatorFilter } from '@/lib/routeSearch';

const search = vi.hoisted(() => vi.fn());
vi.mock('@/lib/routes', () => ({ searchOperatorRoutes: search }));
const empty = { routes: [], truncated: false };
const ctb: OperatorRouteResults = { routes: [{ operator: 'CTB', route: '1', originEn: 'A', originTc: '甲', destinationEn: 'B', destinationTc: '乙' }], truncated: false };
beforeEach(() => { vi.useFakeTimers(); search.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('route search source independence', () => {
  it('shows a completed source while the other is pending, then retries only the failed source', async () => {
    let rejectCitybus!: (reason: Error) => void;
    search.mockImplementation((_query, operator) => operator === 'KMB' ? Promise.resolve(empty) : new Promise((_resolve, reject) => { rejectCitybus = reject; }));
    const { result } = renderHook(() => useRouteSearch('1', 'all'));
    await act(() => vi.advanceTimersByTimeAsync(180));
    expect(result.current.sources.KMB.status).toBe('success');
    expect(result.current.sources.CTB.status).toBe('loading');
    expect(result.current.complete).toBe(false);
    await act(async () => rejectCitybus(new Error('offline')));
    expect(result.current.sources.CTB.status).toBe('error');
    expect(result.current.complete).toBe(false);
    search.mockResolvedValue(ctb);
    act(() => result.current.sources.CTB.retry());
    await act(() => vi.advanceTimersByTimeAsync(180));
    expect(search.mock.calls.filter((args) => args[1] === 'KMB')).toHaveLength(1);
    expect(result.current.routes).toEqual(ctb.routes);
    expect(result.current.complete).toBe(true);
  });

  it('discards old-query responses even when the transport ignores cancellation', async () => {
    let resolveOld!: (value: OperatorRouteResults) => void;
    search.mockImplementation((query) => query === '1' ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(empty));
    const { result, rerender } = renderHook(({ query, filter }: { query: string; filter: RouteOperatorFilter }) => useRouteSearch(query, filter), { initialProps: { query: '1', filter: 'CTB' } });
    await act(() => vi.advanceTimersByTimeAsync(180));
    const oldSignal = search.mock.calls[0][2] as AbortSignal;
    rerender({ query: '2', filter: 'CTB' });
    await act(() => vi.advanceTimersByTimeAsync(180));
    await act(async () => resolveOld(ctb));
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.routes).toEqual([]);
    expect(search.mock.calls.every((args) => args[1] === 'CTB')).toBe(true);
  });
});
