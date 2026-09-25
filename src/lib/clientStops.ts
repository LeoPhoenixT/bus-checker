import { fetchAllStops } from './kmb';
import { getKmbServiceDay } from './kmbServiceDay';
import type { Stop } from './types';

let stopCache: { serviceDay: string; stops: Stop[] } | null = null;
let pendingFetch: { serviceDay: string; promise: Promise<Stop[]> } | null = null;

export async function getCachedStops(now = new Date()): Promise<Stop[]> {
  const serviceDay = getKmbServiceDay(now);
  if (stopCache?.serviceDay === serviceDay) return stopCache.stops;
  if (pendingFetch?.serviceDay !== serviceDay) {
    const refresh = { serviceDay, promise: Promise.resolve([] as Stop[]) };
    refresh.promise = fetchAllStops()
      .then((response) => {
        // A KMB stop ID is a boarding-point identity. Do not merge records by
        // name or coordinates: interchanges and termini can assign identical
        // coordinates to separate platforms with different services.
        if (!Array.isArray(response.data)) throw new Error('Invalid KMB stop response');
        if (pendingFetch === refresh) stopCache = { serviceDay, stops: response.data };
        return response.data;
      })
      .finally(() => {
        if (pendingFetch === refresh) pendingFetch = null;
      });
    pendingFetch = refresh;
  }
  return pendingFetch.promise;
}
