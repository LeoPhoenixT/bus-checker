'use client';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { ETARow } from './ETARow';
import { StopLocationModal } from './StopLocationModal';
import { filterEligibleETAs } from '@/lib/etaEligibility';
import { getStopIds } from '@/lib/stopGroups';
import type { DirectRouteMatch, DestinationStopNames, NearbyStop, ETAEntry } from '@/lib/types';

interface StopCardProps {
  stop: NearbyStop;
  etas: ETAEntry[];
  routeFilters: string[];
  etasLoading: boolean;
  destinationMatches?: DirectRouteMatch[];
  destinationStopNames?: DestinationStopNames;
}

interface RouteGroup {
  route: string;
  etas: ETAEntry[];
  alightingStopIds: string[];
}

function routeGroupKey(route: string, direction: string): string {
  return `${route.trim().toUpperCase()}|${direction.trim().toUpperCase()}`;
}

export function StopCard({
  stop,
  etas,
  routeFilters,
  etasLoading,
  destinationMatches,
  destinationStopNames,
}: StopCardProps) {
  const { lang } = useLang();
  const [showStopMap, setShowStopMap] = useState(false);
  const name = lang === 'en' ? stop.name_en : stop.name_tc;

  /* Group ETAs by route+direction (merging service types), keep up to 3 eta_seq per group */
  const grouped = new Map<string, RouteGroup>();
  for (const match of destinationMatches ?? []) {
    const key = routeGroupKey(match.route, match.bound);
    const group = grouped.get(key) ?? { route: match.route, etas: [], alightingStopIds: [] };
    if (!group.alightingStopIds.includes(match.alightingStop)) {
      group.alightingStopIds.push(match.alightingStop);
    }
    grouped.set(key, group);
  }
  const eligibleEtas = filterEligibleETAs(etas, destinationMatches);
  for (const eta of eligibleEtas) {
    const key = routeGroupKey(eta.route, eta.dir);
    const group = grouped.get(key) ?? { route: eta.route, etas: [], alightingStopIds: [] };
    if (group.etas.length < 3) {
      group.etas.push(eta);
      grouped.set(key, group);
    }
  }

  /* Apply route filter — show if any active filter matches */
  const visibleKeys =
    routeFilters.length > 0
      ? [...grouped.keys()].filter((k) =>
          routeFilters.some(
            (f) => k.toUpperCase().split('|')[0].includes(f),
          ),
        )
      : [...grouped.keys()];

  const finalKeys = visibleKeys;

  /* Route filtering may hide a card. Destination-valid cards remain visible without live ETA. */
  const matchingRouteWithoutETA = destinationMatches?.some((match) =>
    routeFilters.some((filter) => match.route.toUpperCase().includes(filter)),
  ) ?? false;
  if (
    routeFilters.length > 0
    && finalKeys.length === 0
    && !matchingRouteWithoutETA
    && !etasLoading
  ) return null;

  const distLabel =
    stop.distanceM < 1000
      ? `${stop.distanceM} m`
      : `${(stop.distanceM / 1000).toFixed(1)} km`;

  const isClose = stop.distanceM <= 50;

  return (
    <>
      <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      {/* Stop header */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base leading-snug text-[var(--foreground)]">{name}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)] tracking-wide">
            {getStopIds(stop).length === 1
              ? stop.stop
              : lang === 'en'
                ? `${getStopIds(stop).length} colocated entries`
                : `${getStopIds(stop).length} 個同位置站點記錄`}
          </p>
        </div>
        <span
          className={clsx(
            'mt-0.5 shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
            isClose
              ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
          )}
        >
          <MapPin className="h-3 w-3" />
          {distLabel}
        </span>
        <button
          onClick={() => setShowStopMap(true)}
          className={clsx(
            'mt-0.5 shrink-0 flex items-center justify-center h-7 w-7 rounded-lg transition',
            'border border-[var(--divider)] hover:border-blue-500/50 hover:bg-blue-500/10',
            'text-[var(--muted)] hover:text-blue-600 dark:hover:text-blue-400',
          )}
          aria-label={lang === 'en' ? 'View on map' : '在地圖上查看'}
        >
          <MapPin className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 divide-y divide-[var(--divider)]">
        {etasLoading && eligibleEtas.length === 0 && grouped.size === 0 ? (
          /* Skeleton rows while first ETA fetch is in-flight */
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 animate-pulse">
              <div className="h-5 w-16 rounded-lg bg-[var(--card-border)]" />
              <div className="flex-1 h-4 rounded bg-[var(--card-border)]" />
              <div className="h-5 w-14 rounded-full bg-[var(--card-border)]" />
            </div>
          ))
        ) : finalKeys.length === 0 ? (
          <p className="py-3 text-sm text-[var(--muted)] text-center">{lang === 'en' ? 'No arrivals available' : '暫無班次資料'}</p>
        ) : (
          finalKeys.map((key) => (
            <ETARow
              key={key}
              route={grouped.get(key)!.route}
              etas={grouped.get(key)!.etas}
              alightingStopIds={grouped.get(key)!.alightingStopIds}
              destinationStopNames={destinationStopNames}
            />
          ))
        )}
      </div>
    </article>

    {/* Stop location map modal */}
    <StopLocationModal isOpen={showStopMap} onClose={() => setShowStopMap(false)} stop={stop} />
    </>
  );
}
