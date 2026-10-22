'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config';
import { fetchCitybusRouteETA } from '@/lib/routes';
import { citybusDataTime } from '@/lib/citybusEtaTime';
import { getETAFreshness } from '@/lib/etaFreshness';
import type { CitybusBound, CitybusETAEntry } from '@/lib/citybusTypes';
import type { RouteStopOccurrence } from '@/lib/types';

interface State {
  key: string;
  data: CitybusETAEntry[];
  dataTime: Date | null;
  lastSuccessfulAt: Date | null;
  lastAttemptAt: Date | null;
  loading: boolean;
  error: boolean;
}
const empty = { data: [], dataTime: null, lastSuccessfulAt: null, lastAttemptAt: null, loading: false, error: false };

export function useCitybusRouteETA(route: string, bound: CitybusBound | undefined, stop: RouteStopOccurrence | null) {
  const key = bound && stop ? `CTB|${route}|${bound}|${stop.stopId}|${stop.seq}` : '';
  const [state, setState] = useState<State>({ key: '', ...empty });
  const [now, setNow] = useState(Date.now);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!key || !bound || !stop) { refreshRef.current = async () => {}; return; }
    let active = true;
    let pending: Promise<void> | null = null;
    let controller: AbortController | null = null;
    setState({ key, ...empty, loading: true });
    const refresh = (): Promise<void> => {
      if (pending) return pending;
      controller = new AbortController();
      const signal = controller.signal;
      const attemptedAt = new Date();
      setState((previous) => ({ ...previous, loading: true, lastAttemptAt: attemptedAt }));
      pending = fetchCitybusRouteETA(route, bound, stop.stopId, stop.seq, signal).then((response) => {
        if (!active || signal.aborted) return;
        const completed = new Date();
        setState({ key, data: response.data, dataTime: citybusDataTime(response), lastSuccessfulAt: completed, lastAttemptAt: attemptedAt, loading: false, error: false });
      }).catch(() => {
        if (active && !signal.aborted) setState((previous) => ({ ...previous, loading: false, error: true }));
      }).finally(() => { pending = null; });
      return pending;
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => void refresh(), APP_CONFIG.REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      refreshRef.current = async () => {};
    };
    // Identity, rather than the caller's object reference, owns the request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, route, bound, stop?.stopId, stop?.seq]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const current = state.key === key ? state : { key, ...empty, loading: Boolean(key) };
  const refresh = useCallback(() => refreshRef.current(), []);
  return { ...current, freshness: getETAFreshness(current.dataTime, now), refresh };
}
