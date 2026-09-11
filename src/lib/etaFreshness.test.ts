import { describe, expect, it } from 'vitest';
import { getETAFreshness } from './etaFreshness';

describe('getETAFreshness', () => {
  const now = new Date('2026-09-11T10:00:00.000Z').getTime();

  it('distinguishes the ETA freshness thresholds', () => {
    expect(getETAFreshness(null, now)).toBe('unavailable');
    expect(getETAFreshness(new Date(now - 59_999), now)).toBe('fresh');
    expect(getETAFreshness(new Date(now - 60_000), now)).toBe('slightly-old');
    expect(getETAFreshness(new Date(now - 120_000), now)).toBe('stale');
    expect(getETAFreshness(new Date(now - 300_000), now)).toBe('very-stale');
  });
});
