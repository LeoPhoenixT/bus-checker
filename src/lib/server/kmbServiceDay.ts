const HONG_KONG_OFFSET_MS = 8 * 60 * 60 * 1_000;
const KMB_REFRESH_HOUR = 5;
const KMB_REFRESH_GRACE_MINUTES = 10;

/**
 * KMB publishes its static datasets around 05:00 HKT. Keeping the previous
 * service day until 05:10 avoids joining a newly-published collection with a
 * collection that is still being updated upstream.
 */
export function getKmbServiceDay(now: Date): string {
  const hongKongTime = new Date(now.getTime() + HONG_KONG_OFFSET_MS);
  const beforeRefreshBoundary = hongKongTime.getUTCHours() < KMB_REFRESH_HOUR
    || (
      hongKongTime.getUTCHours() === KMB_REFRESH_HOUR
      && hongKongTime.getUTCMinutes() < KMB_REFRESH_GRACE_MINUTES
    );

  if (beforeRefreshBoundary) {
    hongKongTime.setUTCDate(hongKongTime.getUTCDate() - 1);
  }

  return hongKongTime.toISOString().slice(0, 10);
}
