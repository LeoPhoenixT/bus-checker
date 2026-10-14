import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CitybusError } from './citybus';
import { fetchCitybusRoutes, fetchCitybusRouteStops, getCitybusRouteDetail, resetCitybusRoutesCacheForTests, searchCitybusRoutes } from './citybusRoutes';
import { fetchCitybusStop, resolveCitybusStops, resetCitybusStopsCacheForTests } from './citybusStops';
import { getCitybusRouteETA, resetCitybusEtaCacheForTests } from './citybusEta';

const route = { co: 'CTB', route: '1', orig_en: 'Central', orig_tc: '中環', dest_en: 'Happy Valley', dest_tc: '跑馬地' };
const stop = { stop: '000001', name_en: 'Central', name_tc: '中環', lat: '22.28', long: '114.15' };
const topology = (seq: number, id = '000001', dir = 'O') => ({ co: 'CTB', route: '1', dir, seq, stop: id });
const eta = (seq: number, dir = 'O') => ({ co: 'CTB', route: '1', dir, seq, stop: '000001', eta_seq: 1, eta: '2026-10-14T12:10:00+08:00', data_timestamp: '2026-10-14T12:00:00+08:00' });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn();

beforeEach(() => {
  resetCitybusRoutesCacheForTests(); resetCitybusStopsCacheForTests(); resetCitybusEtaCacheForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function serve(overrides: Record<string, unknown> = {}) {
  const endpoints: Record<string, unknown> = {
    'route/CTB': { data: [route] },
    'route-stop/CTB/1/outbound': { data: [topology(1), topology(2, '000002'), topology(3)] },
    'route-stop/CTB/1/inbound': { data: [] },
    'stop/000001': { data: stop },
    'stop/000002': { data: { ...stop, stop: '000002' } },
    ...overrides,
  };
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.split('/citybus/')[1];
    if (!(path in endpoints)) throw new Error(`Unexpected request ${path}`);
    const value = endpoints[path];
    if (value instanceof Error) throw value;
    return json(value);
  });
}

describe('Citybus route provider', () => {
  it('searches and caches the catalogue without requesting stop topology', async () => {
    serve({ 'route/CTB': { data: [route, { ...route, route: '10' }] } });
    expect((await searchCitybusRoutes('1')).map((item) => item.route)).toEqual(['1', '10']);
    await fetchCitybusRoutes();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await fetchCitybusRoutes())[0]).not.toHaveProperty('serviceType');
  });

  it('keeps repeated occurrences and only fetches each unique stop once', async () => {
    serve();
    const result = await getCitybusRouteDetail('1');
    expect(result?.variant.bound).toBe('O');
    expect(result?.stops.map((row) => row.status === 'resolved' && row.stop.seq)).toEqual([1, 2, 3]);
    expect(result?.stops[0]).toMatchObject({ status: 'resolved', stop: { stopId: '000001', lat: 22.28, long: 114.15 } });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/stop/000001'))).toHaveLength(1);
    expect(result?.directions).toContainEqual({ bound: 'I', status: 'empty' });
  });

  it('selects a real inbound direction and swaps termini, but never overrides an explicit empty outbound', async () => {
    serve({ 'route-stop/CTB/1/outbound': { data: [] }, 'route-stop/CTB/1/inbound': { data: [topology(1, '000001', 'I')] } });
    expect((await getCitybusRouteDetail('1'))?.variant).toMatchObject({ bound: 'I', originTc: '跑馬地', destinationTc: '中環' });
    expect(await getCitybusRouteDetail('1', 'O')).toBeNull();
  });

  it('distinguishes an unavailable other direction from an empty direction', async () => {
    serve({ 'route-stop/CTB/1/inbound': new Error('offline') });
    expect((await getCitybusRouteDetail('1', 'O'))?.directions).toContainEqual({ bound: 'I', status: 'unavailable' });
    await expect(getCitybusRouteDetail('1', 'I')).rejects.toBeInstanceOf(CitybusError);
  });

  it('preserves stop identity on failed metadata and rejects invalid coordinates', async () => {
    serve({ 'stop/000001': { data: { ...stop, lat: null } }, 'stop/000002': new Error('offline') });
    expect((await getCitybusRouteDetail('1'))?.stops).toEqual([
      { status: 'invalid', stopId: '000001', seq: 1 },
      { status: 'unavailable', stopId: '000002', seq: 2 },
      { status: 'invalid', stopId: '000001', seq: 3 },
    ]);
  });

  it('shares in-flight metadata and retries failure after backoff instead of caching invalid data as success', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    fetchMock.mockResolvedValueOnce(json({ data: { ...stop, long: 'invalid' } })).mockResolvedValue(json({ data: stop }));
    const results = await Promise.allSettled([fetchCitybusStop('000001'), fetchCitybusStop('000001')]);
    expect(results.every((item) => item.status === 'rejected')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(fetchCitybusStop('000001')).rejects.toBeInstanceOf(CitybusError);
    now += 31_000;
    await expect(fetchCitybusStop('000001')).resolves.toMatchObject({ lat: 22.28 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds metadata concurrency and stops scheduling after the caller deadline', async () => {
    const release: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => release.push(resolve)));
    const occurrences = Array.from({ length: 10 }, (_, index) => ({ stopId: String(index + 1).padStart(6, '0'), seq: index + 1 }));
    const result = await resolveCitybusStops(occurrences, 10);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result).toHaveLength(10);
    expect(result.every((row) => row.status === 'unavailable')).toBe(true);
    release.forEach((resolve, index) => resolve(json({ data: { ...stop, stop: occurrences[index].stopId } })));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('rejects duplicate sequence numbers without merging different occurrences', async () => {
    serve({ 'route-stop/CTB/1/outbound': { data: [topology(1), topology(1, '000002')] } });
    await expect(fetchCitybusRouteStops('1', 'O')).rejects.toMatchObject({ status: 502 });
  });
});

describe('Citybus selected-route ETA', () => {
  it('validates topology only and filters direction and repeated boarding sequence', async () => {
    serve({ 'eta/CTB/000001/1': {
      generated_timestamp: '2026-10-14T12:00:30+08:00',
      data: [eta(1), eta(3), eta(1, 'I'), { ...eta(1), eta_seq: 2, eta: '', rmk_tc: '九巴時段' }],
    } });
    const result = await getCitybusRouteETA('1', 'O', '000001', 1);
    expect(result.data).toHaveLength(2);
    expect(result.data[1]).toMatchObject({ eta: null, rmk_tc: '九巴時段' });
    expect(result.data[0]).not.toHaveProperty('service_type');
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/stop/') && !String(url).endsWith('/route/CTB'))).toBe(true);
    expect((await getCitybusRouteETA('1', 'O', '000001', 3)).data).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/eta/'))).toHaveLength(1);
  });

  it('never fetches ETA for a stop or sequence outside the requested direction', async () => {
    serve();
    await expect(getCitybusRouteETA('1', 'O', '000001', 99)).rejects.toMatchObject({ status: 404 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/eta/'))).toBe(false);
  });
});
