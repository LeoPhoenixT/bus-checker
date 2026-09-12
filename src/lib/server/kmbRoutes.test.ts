import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchKmbRouteVariants,
  getKmbRouteDetail,
  resetKmbRoutesCacheForTests,
  searchKmbRouteVariants,
} from './kmbRoutes';
import { resetKmbRouteStopsCacheForTests } from './kmbRouteStops';

function response(data: unknown[]): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  resetKmbRoutesCacheForTests();
  resetKmbRouteStopsCacheForTests();
});
afterEach(() => vi.restoreAllMocks());

describe('getKmbRouteDetail', () => {
  it('uses the exact route, bound, and service type and returns stops in sequence order', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/route/')) return Promise.resolve(response([
        { route: '87D', bound: 'O', service_type: '1', orig_en: 'Kam Ying Court', orig_tc: '錦英苑', dest_en: 'Hung Hom Station', dest_tc: '紅磡站' },
        { route: '87D', bound: 'I', service_type: '1', orig_en: 'Hung Hom Station', orig_tc: '紅磡站', dest_en: 'Kam Ying Court', dest_tc: '錦英苑' },
      ]));
      if (value.endsWith('/route-stop')) return Promise.resolve(response([
        { route: '87D', bound: 'O', service_type: '1', seq: 2, stop: 'STOPB' },
        { route: '87D', bound: 'O', service_type: '3', seq: 1, stop: 'STOPC' },
        { route: '87D', bound: 'O', service_type: '1', seq: 1, stop: 'STOPA' },
      ]));
      if (value.endsWith('/stop')) return Promise.resolve(response([
        { stop: 'STOPA', name_en: 'First Stop', name_tc: '第一站', lat: 22.3, long: 114.1 },
        { stop: 'STOPB', name_en: 'Second Stop', name_tc: '第二站', lat: 22.4, long: 114.2 },
        { stop: 'STOPC', name_en: 'Special Stop', name_tc: '特別站', lat: 22.5, long: 114.3 },
      ]));
      throw new Error(`Unexpected URL: ${value}`);
    });

    const detail = await getKmbRouteDetail('87d', 'O', '1');
    expect(detail?.stops.map((stop) => stop.stopId)).toEqual(['STOPA', 'STOPB']);
    expect(detail?.reverseVariants).toHaveLength(1);
    expect(detail?.reverseVariants[0]).toMatchObject({ bound: 'I', serviceType: '1' });
  });

  it('does not invent a topology when the exact service type has no stops', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/route/')) return Promise.resolve(response([
        { route: '87D', bound: 'O', service_type: '3', orig_en: 'Town Centre', orig_tc: '市中心', dest_en: 'Hung Hom', dest_tc: '紅磡' },
      ]));
      if (value.endsWith('/route-stop')) return Promise.resolve(response([
        { route: '87D', bound: 'O', service_type: '1', seq: 1, stop: 'STOPA' },
      ]));
      if (value.endsWith('/stop')) return Promise.resolve(response([
        { stop: 'STOPA', name_en: 'First Stop', name_tc: '第一站', lat: 22.3, long: 114.1 },
      ]));
      throw new Error(`Unexpected URL: ${value}`);
    });

    await expect(getKmbRouteDetail('87D', 'O', '3')).resolves.toBeNull();
  });
});

describe('searchKmbRouteVariants', () => {
  it('matches route prefixes only and keeps an exact route ahead of longer routes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
      if (String(url).endsWith('/route/')) return Promise.resolve(response([
        { route: '87D1', bound: 'O', service_type: '1', orig_en: 'A', orig_tc: '甲', dest_en: 'B', dest_tc: '乙' },
        { route: '187D', bound: 'O', service_type: '1', orig_en: 'A', orig_tc: '甲', dest_en: 'B', dest_tc: '乙' },
        { route: '87D', bound: 'O', service_type: '1', orig_en: 'A', orig_tc: '甲', dest_en: 'B', dest_tc: '乙' },
      ]));
      throw new Error(`Unexpected URL: ${String(url)}`);
    });

    const routes = await searchKmbRouteVariants('87d');
    expect(routes.map((item) => item.route)).toEqual(['87D', '87D1']);
  });
});

describe('KMB route metadata service-day cache', () => {
  it('replaces metadata at the same 05:10 HKT service-day boundary as route stops', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([
        { route: '1', bound: 'O', service_type: '1', orig_en: 'Old origin', orig_tc: '舊起點', dest_en: 'Old destination', dest_tc: '舊終點' },
      ]))
      .mockResolvedValueOnce(response([
        { route: '2', bound: 'O', service_type: '1', orig_en: 'New origin', orig_tc: '新起點', dest_en: 'New destination', dest_tc: '新終點' },
      ]));

    const previous = await fetchKmbRouteVariants(new Date('2026-08-04T21:09:00.000Z'));
    const current = await fetchKmbRouteVariants(new Date('2026-08-04T21:10:00.000Z'));

    expect(previous.map((item) => item.route)).toEqual(['1']);
    expect(current.map((item) => item.route)).toEqual(['2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not allow an old service-day request to overwrite a newer snapshot', async () => {
    let resolveOld!: (value: Response) => void;
    let resolveNew!: (value: Response) => void;
    const oldFetch = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const newFetch = new Promise<Response>((resolve) => { resolveNew = resolve; });
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldFetch)
      .mockReturnValueOnce(newFetch);

    const oldRequest = fetchKmbRouteVariants(new Date('2026-08-04T21:09:00.000Z'));
    const newRequest = fetchKmbRouteVariants(new Date('2026-08-04T21:10:00.000Z'));
    resolveOld(response([
      { route: '1', bound: 'O', service_type: '1', orig_en: 'Old', orig_tc: '舊', dest_en: 'Old destination', dest_tc: '舊終點' },
    ]));
    resolveNew(response([
      { route: '2', bound: 'O', service_type: '1', orig_en: 'New', orig_tc: '新', dest_en: 'New destination', dest_tc: '新終點' },
    ]));
    await Promise.all([oldRequest, newRequest]);

    const afterBoundary = await fetchKmbRouteVariants(new Date('2026-08-04T22:00:00.000Z'));
    expect(afterBoundary.map((item) => item.route)).toEqual(['2']);
  });
});
