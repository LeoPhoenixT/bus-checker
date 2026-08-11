'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DirectRouteMatchesByOriginStop } from '@/lib/types';

function stableIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim().toUpperCase()).filter(Boolean))].sort();
}

export function useDirectRoutes(
  originStopIds: string[],
  destinationStopIds: string[],
  enabled: boolean,
): {
  matchesByOriginStop: DirectRouteMatchesByOriginStop;
  loading: boolean;
  error: string | null;
} {
  const originKey = useMemo(() => stableIds(originStopIds).join(','), [originStopIds]);
  const destinationKey = useMemo(
    () => stableIds(destinationStopIds).join(','),
    [destinationStopIds],
  );
  const queryKey = `${originKey}::${destinationKey}`;
  const [matchesByOriginStop, setMatchesByOriginStop] =
    useState<DirectRouteMatchesByOriginStop>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!enabled) {
      setMatchesByOriginStop({});
      setLoading(false);
      setError(null);
      setCompletedKey(null);
      return () => controller.abort();
    }

    const originStops = originKey ? originKey.split(',') : [];
    const destinationStops = destinationKey ? destinationKey.split(',') : [];
    if (originStops.length === 0 || destinationStops.length === 0) {
      setMatchesByOriginStop({});
      setLoading(false);
      setError(null);
      setCompletedKey(queryKey);
      return () => controller.abort();
    }

    setMatchesByOriginStop({});
    setLoading(true);
    setError(null);
    setCompletedKey(null);

    void fetch('/api/direct-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originStops, destinationStops }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const message = typeof data === 'object' && data !== null && 'error' in data
            && typeof data.error === 'string'
            ? data.error
            : `Direct-route search failed (${response.status})`;
          throw new Error(message);
        }
        if (typeof data !== 'object' || data === null || !('matchesByOriginStop' in data)) {
          throw new Error('Direct-route search returned an invalid response');
        }
        setMatchesByOriginStop(data.matchesByOriginStop as DirectRouteMatchesByOriginStop);
        setCompletedKey(queryKey);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setMatchesByOriginStop({});
        setError(requestError instanceof Error ? requestError.message : 'Direct-route search failed');
        setCompletedKey(queryKey);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [destinationKey, enabled, originKey, queryKey]);

  const requestPending = enabled && originKey.length > 0 && destinationKey.length > 0
    && completedKey !== queryKey;
  return {
    matchesByOriginStop: completedKey === queryKey ? matchesByOriginStop : {},
    loading: loading || requestPending,
    error: completedKey === queryKey ? error : null,
  };
}
