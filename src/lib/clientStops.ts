import { fetchAllStops } from './kmb';
import { groupStopsByLocation } from './stopGroups';
import type { Stop } from './types';

let stopCache: Stop[] | null = null;
let pendingFetch: Promise<Stop[]> | null = null;

export async function getCachedStops(): Promise<Stop[]> {
  if (stopCache) return stopCache;
  if (!pendingFetch) {
    pendingFetch = fetchAllStops()
      .then((response) => {
        stopCache = groupStopsByLocation(response.data);
        return stopCache;
      })
      .finally(() => {
        pendingFetch = null;
      });
  }
  return pendingFetch;
}
