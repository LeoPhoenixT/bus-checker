import { describe, expect, it } from 'vitest';
import { matchDirectRoutes } from './directRouteMatcher';
import { filterEligibleETAs } from './etaEligibility';
import { filterFavouriteRouteStopETAs } from './routeEta';
import type { ETAEntry, RouteStop } from './types';

const occurrence = (stop: string, seq: number): RouteStop => ({ route: '219X', bound: 'O', service_type: '4', stop, seq, data_timestamp: '' });
const eta = (seq: number): ETAEntry => ({ co: 'KMB', route: '219X', dir: 'O', service_type: 4, stop: 'ORIGIN01', seq, eta_seq: 1, eta: null, dest_en: '', dest_tc: '', dest_sc: '', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '' });

describe('repeated boarding occurrences', () => {
  it('excludes the later pass when it cannot reach the selected destination', () => {
    const matches = matchDirectRoutes([occurrence('ORIGIN01', 2), occurrence('DEST0001', 10), occurrence('ORIGIN01', 23)], ['ORIGIN01'], ['DEST0001']);
    expect(matches.ORIGIN01.map((match) => match.boardingSeq)).toEqual([2]);
    expect(filterEligibleETAs([eta(2), eta(23)], matches.ORIGIN01)).toEqual([eta(2)]);
  });

  it('retains both passes when each has a later destination occurrence', () => {
    const matches = matchDirectRoutes([occurrence('ORIGIN01', 2), occurrence('DEST0001', 10), occurrence('ORIGIN01', 23), occurrence('DEST0001', 30)], ['ORIGIN01'], ['DEST0001']);
    expect(matches.ORIGIN01.map(({ boardingSeq, alightingSeq }) => [boardingSeq, alightingSeq])).toEqual([[2, 10], [23, 30]]);
    expect(filterEligibleETAs([eta(2), eta(23)], matches.ORIGIN01)).toEqual([eta(2), eta(23)]);
  });

  it('requires a resolved sequence for legacy favourites and excludes missing ETA sequences', () => {
    const legacy = { route: '219X', bound: 'O' as const, serviceType: '4', stopId: 'ORIGIN01' };
    expect(filterFavouriteRouteStopETAs([eta(2), eta(23)], legacy)).toEqual([]);
    expect(filterFavouriteRouteStopETAs([eta(2), eta(23), eta(undefined as unknown as number)], legacy, 23)).toEqual([eta(23)]);
  });
});
