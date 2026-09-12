import { describe, expect, it } from 'vitest';
import { filterFavouriteRouteStopETAs, filterRouteVariantETAs } from './routeEta';
import type { ETAEntry, RouteVariant } from './types';

function eta(overrides: Partial<ETAEntry>): ETAEntry {
  return {
    co: 'KMB', route: '87D', dir: 'O', service_type: '3', seq: 5, stop: 'STOPA',
    dest_en: 'Hung Hom', dest_tc: '紅磡', dest_sc: '红磡', eta_seq: 2, eta: '2099-01-01T00:00:00+08:00',
    rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '', ...overrides,
  };
}

const variant: RouteVariant = {
  route: '87D', bound: 'O', serviceType: '3', originEn: 'Town Centre', originTc: '市中心',
  destinationEn: 'Hung Hom', destinationTc: '紅磡', isSpecial: true,
};

describe('filterRouteVariantETAs', () => {
  it('requires the selected stop as well as route, bound, and service type', () => {
    const matchingFirst = eta({ eta_seq: 1 });
    const matchingSecond = eta({ eta_seq: 2 });
    const results = filterRouteVariantETAs([
      matchingSecond,
      eta({ service_type: '1' }),
      eta({ dir: 'I' }),
      eta({ stop: 'STOPB' }),
      eta({ route: '87X' }),
      matchingFirst,
    ], variant, 'stopa');
    expect(results).toEqual([matchingFirst, matchingSecond]);
  });

  it('ignores malformed upstream records without crashing', () => {
    const malformed = eta({ stop: undefined as unknown as string });
    expect(filterRouteVariantETAs([malformed, eta({})], variant, 'STOPA')).toHaveLength(1);
  });
});

describe('filterFavouriteRouteStopETAs', () => {
  it('keeps only the exact saved route, direction, service type and stop', () => {
    const favourite = { route: '87D', bound: 'O' as const, serviceType: '3', stopId: 'STOPA' };
    const result = filterFavouriteRouteStopETAs([
      eta({}),
      eta({ service_type: '1' }),
      eta({ stop: 'STOP2' }),
      eta({ route: '87X' }),
    ], favourite);
    expect(result).toEqual([eta({})]);
  });
});
