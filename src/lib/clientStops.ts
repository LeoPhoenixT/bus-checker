import { fetchAllStops } from './kmb';
import type { Stop } from './types';

let stopCache: Stop[] | null = null;
let pendingFetch: Promise<Stop[]> | null = null;

export async function getCachedStops(): Promise<Stop[]> {
  if (stopCache) return stopCache;
  if (!pendingFetch) {
    pendingFetch = fetchAllStops()
      .then((response) => {
        // A KMB stop ID is a boarding-point identity. Do not merge records by
        // name or coordinates: interchanges and termini can assign identical
        // coordinates to separate platforms with different services.
        stopCache = response.data;
        return stopCache;
      })
      .finally(() => {
        pendingFetch = null;
      });
  }
  return pendingFetch;
}
