'use client';

import { useEffect, useState } from 'react';
import { searchOperatorRoutes } from '@/lib/routes';
import { mergeRouteResults, type OperatorRouteResults, type RouteOperator, type RouteOperatorFilter } from '@/lib/routeSearch';

interface SourceState extends OperatorRouteResults {
  key: string;
  status: 'idle' | 'loading' | 'success' | 'error';
}
const empty = { routes: [], truncated: false };

function useOperatorSearch(query: string, operator: RouteOperator, enabled: boolean) {
  const key = `${enabled}:${query}`;
  const [state, setState] = useState<SourceState>({ key: '', status: 'idle', ...empty });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !query) return;
    const controller = new AbortController();
    setState({ key, status: 'loading', ...empty });
    const timer = window.setTimeout(() => {
      void searchOperatorRoutes(query, operator, controller.signal).then((result) => {
        if (!controller.signal.aborted) setState({ key, status: 'success', ...result });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ key, status: 'error', ...empty });
      });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, operator, enabled, key, attempt]);
  const current: SourceState = !enabled || !query ? { key, status: 'idle', ...empty }
    : state.key !== key ? { key, status: 'loading', ...empty } : state;
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}

export function useRouteSearch(query: string, filter: RouteOperatorFilter) {
  const KMB = useOperatorSearch(query, 'KMB', filter !== 'CTB');
  const CTB = useOperatorSearch(query, 'CTB', filter !== 'KMB');
  const sources = { KMB, CTB };
  const enabled = [KMB, CTB].filter((source) => source.status !== 'idle');
  return {
    sources,
    ...mergeRouteResults(enabled.filter((source) => source.status === 'success'), query),
    loading: enabled.some((source) => source.status === 'loading'),
    complete: enabled.length > 0 && enabled.every((source) => source.status === 'success'),
  };
}
