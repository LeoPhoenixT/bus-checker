export type ETAFreshness = 'fresh' | 'slightly-old' | 'stale' | 'very-stale' | 'unavailable';

export const ETA_FRESHNESS_MS = {
  FRESH: 60_000,
  SLIGHTLY_OLD: 120_000,
  STALE: 300_000,
} as const;

/**
 * Freshness is derived from the last successful response, rather than the last
 * request. A failed refresh must not make previously useful ETA data disappear.
 */
export function getETAFreshness(
  lastSuccessfulAt: Date | null,
  now = Date.now(),
): ETAFreshness {
  if (!lastSuccessfulAt) return 'unavailable';

  const age = Math.max(0, now - lastSuccessfulAt.getTime());
  if (age < ETA_FRESHNESS_MS.FRESH) return 'fresh';
  if (age < ETA_FRESHNESS_MS.SLIGHTLY_OLD) return 'slightly-old';
  if (age < ETA_FRESHNESS_MS.STALE) return 'stale';
  return 'very-stale';
}

export function getETAAgeSeconds(lastSuccessfulAt: Date | null, now = Date.now()): number | null {
  if (!lastSuccessfulAt) return null;
  return Math.max(0, Math.floor((now - lastSuccessfulAt.getTime()) / 1_000));
}
