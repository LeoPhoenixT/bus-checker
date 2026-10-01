import { describe, expect, it } from 'vitest';
import { groupIdenticalForecasts, groupNearbyRouteVariants, type NearbyRouteVariant } from './nearbyRoutePresentation';
import type { ETAEntry } from './types';

const now = Date.parse('2026-10-01T12:00:00Z');
const row: ETAEntry = {
  co: 'KMB', route: '87D', dir: 'O', service_type: '1', seq: 23, stop: 'STOP1',
  dest_en: 'Hung Hom', dest_tc: '紅磡站', dest_sc: '红磡站', eta_seq: 1,
  eta: '2026-10-01T12:10:05Z', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '',
};
function variant(serviceType = '1', seq = 23, overrides: Partial<ETAEntry> = {}): NearbyRouteVariant {
  return {
    route: '87D', bound: 'O', serviceType, boardingStopId: 'STOP1', boardingSeq: seq,
    isSpecial: serviceType !== '1', alightingStopIds: [],
    etas: [{ ...row, service_type: serviceType, seq, ...overrides }],
  };
}

describe('nearby route presentation', () => {
  it('shares identical forecasts across service types while preserving their local sequences', () => {
    const variants = [variant('4', 22), variant('1', 23), variant('3', 17)];
    const containers = groupNearbyRouteVariants(variants);
    expect(containers).toHaveLength(1);
    expect(containers[0].variants.map((v) => [v.serviceType, v.boardingSeq])).toEqual([['1', 23], ['3', 17], ['4', 22]]);
    expect(groupIdenticalForecasts(containers[0].variants, now)).toHaveLength(1);
    expect(variants.map((v) => v.serviceType)).toEqual(['4', '1', '3']);
  });

  it('retains the container identity when forecasts change or become empty', () => {
    const original = groupNearbyRouteVariants([variant(), variant('3', 17)])[0];
    const changed = groupNearbyRouteVariants([variant(), variant('3', 17, { eta: null })])[0];
    expect(changed.key).toBe(original.key);
    expect(groupIdenticalForecasts(changed.variants, now)).toHaveLength(2);
  });

  it.each([
    { boardingStopId: 'STOP2', etas: [{ ...row, stop: 'STOP2' }] },
    { bound: 'I' as const, etas: [{ ...row, dir: 'I' as const }] },
    { route: '87X', etas: [{ ...row, route: '87X' }] },
    { etas: [{ ...row, dest_tc: '另一目的地' }] },
    { etas: [{ ...row, co: 'CTB' }] },
  ])('keeps distinct source identities in separate containers: %j', (change) => {
    expect(groupNearbyRouteVariants([variant(), { ...variant('3', 17), ...change }])).toHaveLength(2);
  });

  it('keeps all types separate when one type visits the stop more than once', () => {
    expect(groupNearbyRouteVariants([variant(), variant('1', 30), variant('3', 17)])).toHaveLength(3);
  });

  it('does not group a variant whose rows disagree on destination', () => {
    const mixed = variant('3', 17);
    mixed.etas.push({ ...mixed.etas[0], eta_seq: 2, dest_en: 'Other' });
    expect(groupNearbyRouteVariants([variant(), mixed])).toHaveLength(2);
  });

  it.each([
    { eta: '2026-10-01T12:10:50Z' },
    { rmk_tc: '原定班次' },
    { rmk_en: 'Scheduled Bus' },
    { rmk_sc: '原定班次' },
  ])('does not share different exact times or remarks: %j', (change) => {
    expect(groupIdenticalForecasts([variant(), variant('3', 17, change)], now)).toHaveLength(2);
  });

  it('compares the full list, including fourth predictions and record multiplicity', () => {
    const a = variant();
    a.etas = Array.from({ length: 4 }, (_, index) => ({ ...row, eta_seq: index + 1, eta: new Date(now + (index + 1) * 600_000).toISOString() }));
    const b = { ...variant('3', 17), etas: a.etas.map((eta) => ({ ...eta })) };
    b.etas[3].eta = new Date(now + 3_000_000).toISOString();
    expect(groupIdenticalForecasts([a, b], now)).toHaveLength(2);
    b.etas = [...a.etas, { ...a.etas[0], eta_seq: 5 }];
    expect(groupIdenticalForecasts([a, b], now)).toHaveLength(2);
  });

  it('preserves null-time notices when comparing otherwise identical timed predictions', () => {
    const a = variant();
    const b = variant('3', 17);
    a.etas.push({ ...row, eta_seq: 2, eta: null, rmk_tc: '最後班次' });
    b.etas.push({ ...row, eta_seq: 2, eta: null, rmk_tc: '暫停服務' });
    expect(groupIdenticalForecasts([a, b], now)).toHaveLength(2);
  });

  it.each([null, '2026-10-01T11:00:00Z', 'invalid'])('requires a current valid prediction rather than matching empty/expired values: %s', (eta) => {
    expect(groupIdenticalForecasts([variant('1', 23, { eta }), variant('3', 17, { eta })], now)).toHaveLength(2);
  });

  it('uses forecast order rather than upstream array order or refresh timestamps', () => {
    const a = variant();
    a.etas.push({ ...row, eta_seq: 2, eta: '2026-10-01T12:20:00Z' });
    const b = { ...variant('3', 17), etas: [...a.etas].reverse().map((eta) => ({ ...eta, data_timestamp: 'later' })) };
    expect(groupIdenticalForecasts([a, b], now)).toHaveLength(1);
    expect(b.etas[0].eta_seq).toBe(2);
  });

  it('accepts optional multilingual fields omitted by a valid API response', () => {
    const a = variant();
    const sparse = a.etas[0] as Partial<ETAEntry>;
    delete sparse.dest_sc;
    delete sparse.rmk_en;
    delete sparse.rmk_tc;
    delete sparse.rmk_sc;
    const containers = groupNearbyRouteVariants([a, variant('3', 17)]);
    expect(containers).toHaveLength(2); // A missing destination translation differs from a supplied one.
    const b = { ...variant('3', 17), etas: [{ ...a.etas[0] }] };
    expect(groupNearbyRouteVariants([a, b])).toHaveLength(1);
    expect(groupIdenticalForecasts([a, b], now)).toHaveLength(1);
  });

  it('keeps malformed optional text fields separate rather than treating them as empty', () => {
    const invalid = variant('3', 17);
    (invalid.etas[0] as unknown as Record<string, unknown>).rmk_tc = {};
    expect(groupNearbyRouteVariants([variant(), invalid])).toHaveLength(2);
    expect(groupIdenticalForecasts([variant(), invalid], now)).toHaveLength(2);
  });
});
