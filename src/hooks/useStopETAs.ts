'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStopETAs } from '@/lib/kmb';
import { APP_CONFIG } from '@/config';
import type { ETAEntry } from '@/lib/types';

export type StopETAsMap = Record<string, ETAEntry[]>;

export function useStopETAs(stopIds: string[]): {
  etasMap: StopETAsMap;
  lastRefreshed: Date | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [etasMap, setEtasMap] = useState<StopETAsMap>({});
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const idsRef = useRef(stopIds);
  idsRef.current = stopIds;

  const refresh = useCallback(async () => {
    const ids = idsRef.current;
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(ids.map((id) => fetchStopETAs(id)));
      const map: StopETAsMap = {};
      results.forEach((res, i) => {
        map[ids[i]] = res.data ?? [];
      });
      setEtasMap(map);
      setLastRefreshed(new Date());
    } catch {
      // keep stale data on error; next interval will retry
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run whenever the set of stop IDs changes
  const stopIdsKey = stopIds.join(',');

  useEffect(() => {
    if (stopIds.length === 0) {
      setEtasMap({});
      setLastRefreshed(null);
      return;
    }
    void refresh();
    const interval = setInterval(() => void refresh(), APP_CONFIG.REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopIdsKey, refresh]);

  return { etasMap, lastRefreshed, loading, refresh };
}
