'use client';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { StopCard } from './StopCard';
import { filterEligibleETAs } from '@/lib/etaEligibility';
import type { DirectRouteMatchesByOriginStop, DestinationStopNames, NearbyStop, ETAEntry } from '@/lib/types';

interface BookmarkSectionProps {
  etasMap: Record<string, ETAEntry[]>;
  stops: NearbyStop[];
  routeFilters: string[];
  isOpen: boolean;
  onToggleOpen: () => void;
  matchesByOriginStop?: DirectRouteMatchesByOriginStop;
  destinationStopNames?: DestinationStopNames;
}

export function BookmarkSection({
  etasMap,
  stops,
  routeFilters,
  isOpen,
  onToggleOpen,
  matchesByOriginStop,
  destinationStopNames,
}: BookmarkSectionProps) {
  const { lang } = useLang();
  const { favoriteRoutes } = useBookmarks();

  if (favoriteRoutes.size === 0) return null;

  // Filter bookmarked stops and compute filtered favorite count
  const bookmarkedStops = stops.filter((stop) => {
    const matches = matchesByOriginStop?.[stop.stop];
    const etas = filterEligibleETAs(etasMap[stop.stop] ?? [], matches);
    const hasEligibleFavoriteETA = etas.some((eta) => {
      if (!favoriteRoutes.has(eta.route)) return false;
      // Apply route filters: if filters exist, route must match one of them
      if (routeFilters.length > 0) {
        return routeFilters.some((f) => eta.route.toUpperCase().includes(f));
      }
      return true;
    });
    const hasEligibleFavoriteMatch = matches?.some((match) =>
      favoriteRoutes.has(match.route)
      && (routeFilters.length === 0
        || routeFilters.some((filter) => match.route.includes(filter))),
    ) ?? false;
    return hasEligibleFavoriteETA || hasEligibleFavoriteMatch;
  });

  // Compute count of filtered favorites
  const filteredFavoriteCount = new Set<string>();
  for (const stop of bookmarkedStops) {
    const matches = matchesByOriginStop?.[stop.stop];
    const etas = filterEligibleETAs(etasMap[stop.stop] ?? [], matches);
    for (const eta of etas) {
      if (favoriteRoutes.has(eta.route)) {
        if (routeFilters.length === 0 || routeFilters.some((f) => eta.route.toUpperCase().includes(f))) {
          filteredFavoriteCount.add(eta.route);
        }
      }
    }
    for (const match of matches ?? []) {
      if (
        favoriteRoutes.has(match.route)
        && (routeFilters.length === 0
          || routeFilters.some((filter) => match.route.includes(filter)))
      ) {
        filteredFavoriteCount.add(match.route);
      }
    }
  }

  if (bookmarkedStops.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="border-t border-[var(--divider)]" />

      {/* Header */}
      <button
        onClick={onToggleOpen}
        className="w-full py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {lang === 'en' ? 'Favourites' : '我的最愛'}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
            {filteredFavoriteCount.size}
          </span>
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-[var(--muted)] transition-transform duration-300',
            isOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Content */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="space-y-4 pb-4">
          {bookmarkedStops.map((stop) => {
            const matches = matchesByOriginStop?.[stop.stop];
            const etas = filterEligibleETAs(etasMap[stop.stop] ?? [], matches);
            const favouriteEtas = etas.filter((eta) => favoriteRoutes.has(eta.route));
            const favouriteMatches = matches?.filter((match) => favoriteRoutes.has(match.route));
            if (favouriteEtas.length === 0 && (!favouriteMatches || favouriteMatches.length === 0)) return null;
            return (
              <StopCard
                key={stop.stop}
                stop={stop}
                etas={favouriteEtas}
                routeFilters={routeFilters}
                etasLoading={false}
                destinationMatches={favouriteMatches}
                destinationStopNames={destinationStopNames}
              />
            );
          })}
        </div>
        <div className="border-b border-[var(--divider)]" />
      </div>
    </div>
  );
}
