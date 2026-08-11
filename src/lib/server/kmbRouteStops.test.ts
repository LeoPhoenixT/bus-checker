import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchKmbRouteStops,
  getKmbServiceDay,
  resetKmbRouteStopsCacheForTests,
} from './kmbRouteStops';

function upstreamResponse(route: string): Response {
  return new Response(JSON.stringify({
    type: 'RouteStop',
    version: '1.0',
    generated_timestamp: '2026-08-05T05:10:00+08:00',
    data: [{
      route,
      bound: 'O',
      service_type: '1',
      seq: '1',
      stop: '18492910339410B1',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => resetKmbRouteStopsCacheForTests());
afterEach(() => vi.restoreAllMocks());

describe('getKmbServiceDay', () => {
  it('changes service day at 05:10 Hong Kong time', () => {
    expect(getKmbServiceDay(new Date('2026-08-04T21:09:59.999Z'))).toBe('2026-08-04');
    expect(getKmbServiceDay(new Date('2026-08-04T21:10:00.000Z'))).toBe('2026-08-05');
  });

  it('handles month and year boundaries', () => {
    expect(getKmbServiceDay(new Date('2025-12-31T20:00:00.000Z'))).toBe('2025-12-31');
    expect(getKmbServiceDay(new Date('2025-12-31T21:10:00.000Z'))).toBe('2026-01-01');
  });
});

describe('fetchKmbRouteStops daily snapshot', () => {
  it('reuses one normalized snapshot throughout a service day', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstreamResponse('1'));

    const first = await fetchKmbRouteStops(new Date('2026-08-05T01:00:00.000Z'));
    const second = await fetchKmbRouteStops(new Date('2026-08-05T20:00:00.000Z'));

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.etabus.gov.hk/v1/transport/kmb/route-stop',
      { cache: 'no-store' },
    );
  });

  it('coalesces concurrent cold-cache requests', async () => {
    let resolveFetch!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(pending);
    const now = new Date('2026-08-05T01:00:00.000Z');

    const first = fetchKmbRouteStops(now);
    const second = fetchKmbRouteStops(now);
    resolveFetch(upstreamResponse('1'));

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).toBe(firstResult);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('replaces the snapshot after the next service-day boundary', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(upstreamResponse('1'))
      .mockResolvedValueOnce(upstreamResponse('2'));

    const previous = await fetchKmbRouteStops(new Date('2026-08-04T21:09:00.000Z'));
    const current = await fetchKmbRouteStops(new Date('2026-08-04T21:10:00.000Z'));

    expect(previous[0].route).toBe('1');
    expect(current[0].route).toBe('2');
    expect(current).not.toBe(previous);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed and backs off for 60 seconds before retrying', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(upstreamResponse('1'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(upstreamResponse('2'));

    await fetchKmbRouteStops(new Date('2026-08-04T21:09:00.000Z'));
    const boundary = new Date('2026-08-04T21:10:00.000Z');
    await expect(fetchKmbRouteStops(boundary)).rejects.toThrow('HTTP 503');
    await expect(fetchKmbRouteStops(new Date(boundary.getTime() + 59_999))).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const refreshed = await fetchKmbRouteStops(new Date(boundary.getTime() + 60_000));
    expect(refreshed[0].route).toBe('2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
