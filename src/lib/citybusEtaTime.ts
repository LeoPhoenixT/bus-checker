import type { CitybusETAResponse } from './citybusTypes';

/** Keep transport success separate from the age of the predictions themselves. */
export function citybusDataTime(response: CitybusETAResponse, now = Date.now()): Date | null {
  const times = [response.generated_timestamp, ...response.data.map((row) => row.data_timestamp)].map((time) => Date.parse(time));
  if (times.some((time) => !Number.isFinite(time) || time > now + 60_000)) return null;
  return new Date(Math.min(...times));
}
