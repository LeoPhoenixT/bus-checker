import { describe, expect, it } from 'vitest';
import { mergeRouteResults, routeLookupHref, routeSearchHref, type RouteLookup } from './routeSearch';

const citybus = (route: string): RouteLookup => ({ operator: 'CTB', route, originEn: 'A', originTc: '甲', destinationEn: 'B', destinationTc: '乙' });
const kmb: RouteLookup = { operator: 'KMB', route: '1', bound: 'O', serviceType: '1', originEn: 'A', originTc: '甲', destinationEn: 'B', destinationTc: '乙', isSpecial: false };

describe('multi-operator route results', () => {
  it('keeps operator identities and KMB variants, exact matches first and numeric order afterwards', () => {
    const result = mergeRouteResults([{ routes: [citybus('10'), citybus('1'), citybus('2'), kmb, { ...kmb, serviceType: '2', isSpecial: true }], truncated: false }], '1');
    expect(result.routes.map((row) => `${row.operator}:${row.route}`)).toEqual(['KMB:1', 'KMB:1', 'CTB:1', 'CTB:2', 'CTB:10']);
  });
  it('caps the merged list and preserves upstream truncation even if the visible list is short', () => {
    expect(mergeRouteResults([{ routes: [citybus('1')], truncated: true }], '1').truncated).toBe(true);
    const result = mergeRouteResults([{ routes: Array.from({ length: 50 }, (_, i) => citybus(String(i))), truncated: false }, { routes: [kmb], truncated: false }], '1');
    expect(result.routes).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.routes[0]).toEqual(kmb);
  });
  it('preserves lookup filters in links without fabricating a Citybus service type', () => {
    const link = routeLookupHref(citybus('1'), '1', 'CTB');
    expect(link).toBe('/routes/1?operator=CTB&q=1&filter=CTB');
    expect(link).not.toContain('serviceType');
    expect(routeSearchHref('1', 'CTB')).toBe('/routes?q=1&operator=CTB');
    expect(routeLookupHref(kmb, '1', 'all')).toBe('/routes/1?bound=O&serviceType=1&q=1');
  });
});
