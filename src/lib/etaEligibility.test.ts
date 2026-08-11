import { describe, expect, it } from 'vitest';
import { filterEligibleETAs } from './etaEligibility';
import type { DirectRouteMatch, ETAEntry } from './types';

function eta(overrides: Partial<ETAEntry> = {}): ETAEntry {
  return {
    co: 'KMB', route: '88X', dir: 'O', service_type: '1', seq: 5, stop: 'ORIGIN01',
    dest_en: '', dest_tc: '', dest_sc: '', eta_seq: 1, eta: null,
    rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '', ...overrides,
  };
}

const matches: DirectRouteMatch[] = [{
  route: '88X', bound: 'O', serviceType: '1', boardingSeq: 5,
  alightingStop: 'DEST0001', alightingSeq: 18,
}];

describe('filterEligibleETAs', () => {
  it('keeps only exact route, bound, and service-type variants', () => {
    const eligible = eta();
    expect(filterEligibleETAs([
      eligible,
      eta({ dir: 'I' }),
      eta({ service_type: '2' }),
      eta({ route: '88' }),
    ], matches)).toEqual([eligible]);
  });

  it('does not filter normal nearby-stop ETAs when destination matching is inactive', () => {
    const etas = [eta(), eta({ service_type: '2' })];
    expect(filterEligibleETAs(etas, undefined)).toBe(etas);
  });

  it('allows multiple eligible service types for later route-direction grouping', () => {
    const secondMatch = { ...matches[0], serviceType: '2' };
    expect(filterEligibleETAs(
      [eta(), eta({ service_type: '2' }), eta({ service_type: '3' })],
      [...matches, secondMatch],
    )).toHaveLength(2);
  });

  it('normalizes numeric service types returned by the live ETA API', () => {
    expect(filterEligibleETAs([eta({ service_type: 1 })], matches)).toHaveLength(1);
  });
});
