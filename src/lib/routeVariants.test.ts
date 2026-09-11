import { describe, expect, it } from 'vitest';
import { findReverseVariants, isSpecialService, normalizeRouteQuery, sortRouteVariants } from './routeVariants';
import type { RouteVariant } from './types';

function variant(overrides: Partial<RouteVariant>): RouteVariant {
  return {
    route: '87D', bound: 'O', serviceType: '1', originEn: 'Kam Ying Court', originTc: '錦英苑',
    destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: false, ...overrides,
  };
}

describe('route variant helpers', () => {
  it('normalizes route queries and recognizes special services', () => {
    expect(normalizeRouteQuery(' 87 d ')).toBe('87D');
    expect(isSpecialService('1')).toBe(false);
    expect(isSpecialService('3')).toBe(true);
    expect(isSpecialService('express')).toBe(false);
  });

  it('puts exact route matches before prefix matches and normal service first', () => {
    const sorted = sortRouteVariants([
      variant({ route: '87D', serviceType: '3', isSpecial: true }),
      variant({ route: '87', destinationTc: '大學站' }),
      variant({ route: '87D', destinationTc: '紅磡站' }),
    ], '87D');
    expect(sorted.map((item) => `${item.route}:${item.serviceType}`)).toEqual(['87D:1', '87D:3', '87:1']);
  });

  it('only offers real opposite-bound variants starting at the current destination', () => {
    const current = variant({ bound: 'O' });
    const reverse = variant({ bound: 'I', originTc: '紅磡站', destinationTc: '錦英苑' });
    const alternate = variant({ bound: 'I', serviceType: '3', isSpecial: true, originTc: '紅磡站', destinationTc: '馬鞍山市中心' });
    const wrong = variant({ bound: 'I', originTc: '尖沙咀', destinationTc: '錦英苑' });
    expect(findReverseVariants(current, [current, alternate, wrong, reverse])).toEqual([reverse, alternate]);
  });
});
