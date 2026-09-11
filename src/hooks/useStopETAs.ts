'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchStopETAs } from '@/lib/kmb';
import { APP_CONFIG } from '@/config';
import type { ETAEntry } from '@/lib/types';
import { getETAFreshness, type ETAFreshness } from '@/lib/etaFreshness';

export type StopETAsMap = Record<string, ETAEntry[]>;

export interface StopETAState {
  data: ETAEntry[];
  lastSuccessfulAt: Date | null;
  lastAttemptAt: Date | null;
  attemptStatus: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

export interface StopETAStateWithFreshness extends StopETAState {
  freshness: ETAFreshness;
}

const EMPTY_STOP_ETA_STATE: StopETAState = {
  data: [],
  lastSuccessfulAt: null,
  lastAttemptAt: null,
  attemptStatus: 'idle',
  error: null,
};

function normaliseStopIds(stopIds: string[]): string[] {
  return [...new Set(stopIds.map((id) => id.trim().toUpperCase()).filter(Boolean))].sort();
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Unable to fetch ETA data';
}

function timeoutError(): Error {
  return new Error('ETA request timed out');
}

export function useStopETAs(stopIds: string[]): {
  etasMap: StopETAsMap;
  etaStates: Record<string, StopETAStateWithFreshness>;
  lastRefreshed: Date | null;
  lastAttemptAt: Date | null;
  failedStopCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [statesByStop, setStatesByStop] = useState<Record<string, StopETAState>>({});
  const [loading, setLoading] = useState(false);
  // Re-render periodically so data can become stale even while the API is down.
  const [freshnessClock, setFreshnessClock] = useState(() => Date.now());
  const ids = normaliseStopIds(stopIds);
  const stopIdsKey = ids.join(',');
  const idsRef = useRef(ids);
  const idsKeyRef = useRef(stopIdsKey);
  const generationRef = useRef(0);
  const requestIdRef = useRef(0);
  const currentRequestIdRef = useRef<number | null>(null);
  const inFlightRef = useRef(new Map<string, { promise: Promise<void>; abort: () => void }>());
  const isMountedRef = useRef(false);

  idsRef.current = ids;
  idsKeyRef.current = stopIdsKey;

  const runRefresh = useCallback(async (requestedIds: string[], key: string, generation: number) => {
    if (requestedIds.length === 0) return;

    const requestKey = `${generation}:${key}`;
    const existing = inFlightRef.current.get(requestKey);
    if (existing) return existing.promise;

    const requestId = ++requestIdRef.current;
    currentRequestIdRef.current = requestId;
    if (!isMountedRef.current) return;
    setLoading(true);
    const attemptedAt = new Date();
    setStatesByStop((previous) => {
      const next = { ...previous };
      for (const id of requestedIds) {
        const previousState = previous[id] ?? EMPTY_STOP_ETA_STATE;
        next[id] = {
          ...previousState,
          lastAttemptAt: attemptedAt,
          attemptStatus: 'loading',
        };
      }
      return next;
    });

    const batchController = new AbortController();
    const isCurrentRequest = () => (
      isMountedRef.current
      && !batchController.signal.aborted
      && generationRef.current === generation
      && idsKeyRef.current === key
    );

    const fetchWithTimeout = async (id: string) => {
      const controller = new AbortController();
      const abortForBatch = () => controller.abort(batchController.signal.reason);
      batchController.signal.addEventListener('abort', abortForBatch, { once: true });
      const timeout = window.setTimeout(() => controller.abort(timeoutError()), APP_CONFIG.ETA_REQUEST_TIMEOUT_MS);

      try {
        return await fetchStopETAs(id, { signal: controller.signal });
      } finally {
        window.clearTimeout(timeout);
        batchController.signal.removeEventListener('abort', abortForBatch);
      }
    };

    const settleStop = async (id: string) => {
      try {
        const result = await fetchWithTimeout(id);
        if (!isCurrentRequest()) return;

        const completedAt = new Date();
        setStatesByStop((previous) => {
          const previousState = previous[id] ?? EMPTY_STOP_ETA_STATE;
          return {
            ...previous,
            [id]: {
              ...previousState,
              data: result.data ?? [],
              lastSuccessfulAt: completedAt,
              lastAttemptAt: attemptedAt,
              attemptStatus: 'success',
              error: null,
            },
          };
        });
      } catch (reason) {
        // Stop-list changes and unmounts deliberately abort their work. They
        // are not failed KMB responses and must not update removed UI state.
        if (!isCurrentRequest()) return;

        setStatesByStop((previous) => {
          const previousState = previous[id] ?? EMPTY_STOP_ETA_STATE;
          return {
            ...previous,
            [id]: {
              ...previousState,
              lastAttemptAt: attemptedAt,
              attemptStatus: 'error',
              error: errorMessage(reason),
            },
          };
        });
      }
    };

    const request = (async () => {
      // Settle and commit each stop independently: a slow or timed-out stop
      // cannot withhold successful ETA data for other stops in this batch.
      await Promise.allSettled(requestedIds.map(settleStop));
    })();

    inFlightRef.current.set(requestKey, {
      promise: request,
      abort: () => batchController.abort(),
    });
    try {
      await request;
    } finally {
      inFlightRef.current.delete(requestKey);
      if (isMountedRef.current && currentRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    await runRefresh(idsRef.current, idsKeyRef.current, generationRef.current);
  }, [runRefresh]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      for (const request of inFlightRef.current.values()) request.abort();
      inFlightRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessClock(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    const activeIds = idsRef.current;
    const activeKey = idsKeyRef.current;
    currentRequestIdRef.current = null;

    // Cancel no-longer-relevant calls immediately. This prevents stale state
    // writes and releases a hanging request without waiting for its timeout.
    for (const [requestKey, request] of inFlightRef.current) {
      if (requestKey !== `${generation}:${activeKey}`) request.abort();
    }

    setStatesByStop((previous) => Object.fromEntries(
      activeIds.flatMap((id) => previous[id] ? [[id, previous[id]]] : []),
    ));

    if (activeIds.length === 0) {
      setLoading(false);
      return;
    }

    void runRefresh(activeIds, activeKey, generation);
    const interval = window.setInterval(
      () => void runRefresh(activeIds, activeKey, generation),
      APP_CONFIG.REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [runRefresh, stopIdsKey]);

  const etaStates = useMemo(() => Object.fromEntries(
    Object.entries(statesByStop).map(([id, state]) => [id, {
      ...state,
      freshness: getETAFreshness(state.lastSuccessfulAt),
    }]),
  ), [freshnessClock, statesByStop]);

  const etasMap = useMemo(() => Object.fromEntries(
    Object.entries(etaStates).map(([id, state]) => [id, state.data]),
  ), [etaStates]);

  const activeStates = ids
    .map((id) => etaStates[id])
    .filter((state): state is StopETAStateWithFreshness => Boolean(state));
  const successfulTimes = activeStates
    .map((state) => state.lastSuccessfulAt?.getTime() ?? null)
    .filter((time): time is number => time !== null);
  const attemptedTimes = activeStates
    .map((state) => state.lastAttemptAt?.getTime() ?? null)
    .filter((time): time is number => time !== null);
  const lastRefreshed = successfulTimes.length > 0 ? new Date(Math.max(...successfulTimes)) : null;
  const lastAttemptAt = attemptedTimes.length > 0 ? new Date(Math.max(...attemptedTimes)) : null;
  const failedStopCount = activeStates.filter((state) => state.attemptStatus === 'error').length;

  return {
    etasMap,
    etaStates,
    lastRefreshed,
    lastAttemptAt,
    failedStopCount,
    loading,
    refresh,
  };
}
