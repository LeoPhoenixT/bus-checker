import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getKmbRouteDetail, resetKmbRoutesCacheForTests, searchKmbRouteVariants } from './kmbRoutes';
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
