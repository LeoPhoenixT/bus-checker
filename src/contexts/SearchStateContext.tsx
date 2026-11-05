'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { RouteOperatorFilter } from '@/lib/routeSearch';

export interface RouteSearchState {
  query: string;
  filter: RouteOperatorFilter;
}

function useSearchStateValue() {
  const [nearbyDraft, setNearbyDraft] = useState('');
  const [nearbyFilters, setNearbyFilters] = useState<string[]>([]);
  const [showRoutesWithoutETA, setShowRoutesWithoutETA] = useState(true);
  const [routeSearch, setRouteSearch] = useState<RouteSearchState>({ query: '', filter: 'all' });
  return {
    nearbyDraft, setNearbyDraft, nearbyFilters, setNearbyFilters,
    showRoutesWithoutETA, setShowRoutesWithoutETA, routeSearch, setRouteSearch,
  };
}

const SearchStateContext = createContext<ReturnType<typeof useSearchStateValue> | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const state = useSearchStateValue();
  return <SearchStateContext.Provider value={state}>{children}</SearchStateContext.Provider>;
}

export function useSearchState() {
  const state = useContext(SearchStateContext);
  if (!state) throw new Error('useSearchState must be used within SearchStateProvider');
  return state;
}
