'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FAVOURITES_STORAGE_KEY,
  LEGACY_FAVOURITES_STORAGE_KEY,
  dedupeFavouriteRouteStops,
  favouriteRouteStopKey,
  normalizeFavouriteRouteStop,
  parseStoredFavourites,
  serializeFavourites,
} from '@/lib/favourites';
import type { FavouriteRouteStop } from '@/lib/types';

interface FavouriteContextType {
  favourites: FavouriteRouteStop[];
  hydrated: boolean;
  isFavourite: (favourite: FavouriteRouteStop) => boolean;
  toggleFavourite: (favourite: FavouriteRouteStop) => void;
  removeFavourite: (favourite: FavouriteRouteStop) => void;
}

const FavouriteContext = createContext<FavouriteContextType | undefined>(undefined);

export function FavouriteProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<FavouriteRouteStop[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // The old route-only shape cannot identify a boarding point. The app has a
    // tiny pre-release user base, so intentionally discard it rather than
    // inventing a direction or stop.
    localStorage.removeItem(LEGACY_FAVOURITES_STORAGE_KEY);
    setFavourites(parseStoredFavourites(localStorage.getItem(FAVOURITES_STORAGE_KEY)));
    setHydrated(true);
  }, []);

  const persist = useCallback((next: FavouriteRouteStop[]) => {
    const normalized = dedupeFavouriteRouteStops(next);
    if (normalized.length === 0) localStorage.removeItem(FAVOURITES_STORAGE_KEY);
    else localStorage.setItem(FAVOURITES_STORAGE_KEY, serializeFavourites(normalized));
    return normalized;
  }, []);

  const isFavourite = useCallback((candidate: FavouriteRouteStop) => {
    const normalized = normalizeFavouriteRouteStop(candidate);
    return normalized !== null && favourites.some((item) => favouriteRouteStopKey(item) === favouriteRouteStopKey(normalized));
  }, [favourites]);

  const toggleFavourite = useCallback((candidate: FavouriteRouteStop) => {
    // A click before localStorage hydration would otherwise be replaced by
    // the later hydrate result. There is no selected-stop action until the
    // client UI is live, so ignoring that tiny window is safe and deterministic.
    if (!hydrated) return;
    const normalized = normalizeFavouriteRouteStop(candidate);
    if (!normalized) return;
    const key = favouriteRouteStopKey(normalized);
    setFavourites((previous) => {
      const next = previous.some((item) => favouriteRouteStopKey(item) === key)
        ? previous.filter((item) => favouriteRouteStopKey(item) !== key)
        : [...previous, normalized];
      return persist(next);
    });
  }, [hydrated, persist]);

  const removeFavourite = useCallback((candidate: FavouriteRouteStop) => {
    if (!hydrated) return;
    const normalized = normalizeFavouriteRouteStop(candidate);
    if (!normalized) return;
    const key = favouriteRouteStopKey(normalized);
    setFavourites((previous) => persist(previous.filter((item) => favouriteRouteStopKey(item) !== key)));
  }, [hydrated, persist]);

  const value = useMemo(() => ({ favourites, hydrated, isFavourite, toggleFavourite, removeFavourite }), [favourites, hydrated, isFavourite, removeFavourite, toggleFavourite]);
  return <FavouriteContext.Provider value={value}>{children}</FavouriteContext.Provider>;
}

export function useFavourites(): FavouriteContextType {
  const context = useContext(FavouriteContext);
  if (!context) throw new Error('useFavourites must be used within a FavouriteProvider');
  return context;
}
