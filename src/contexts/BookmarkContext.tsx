'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface BookmarkContextType {
  favoriteRoutes: Set<string>;
  toggleBookmark: (routeNumber: string) => void;
  isBookmarked: (routeNumber: string) => boolean;
  getFavoriteRoutes: () => Set<string>;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

const STORAGE_KEY = 'bus-checker-favorite-routes';

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [favoriteRoutes, setFavoriteRoutes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const routes = JSON.parse(stored) as string[];
        setFavoriteRoutes(new Set<string>(routes));
      } catch (e) {
        console.error('Failed to parse favorite routes:', e);
      }
    }
  }, []);

  const toggleBookmark = (routeNumber: string) => {
    setFavoriteRoutes((prev) => {
      const next = new Set<string>(prev);
      if (next.has(routeNumber)) {
        next.delete(routeNumber);
      } else {
        next.add(routeNumber);
      }
      if (next.size === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const isBookmarked = (routeNumber: string): boolean => {
    return favoriteRoutes.has(routeNumber);
  };

  const getFavoriteRoutes = (): Set<string> => {
    return new Set<string>(favoriteRoutes);
  };

  return (
    <BookmarkContext.Provider value={{ favoriteRoutes, toggleBookmark, isBookmarked, getFavoriteRoutes }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
}
