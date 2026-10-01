'use client';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { ETARow } from './ETARow';
import { NearbyRouteGroup } from './NearbyRouteGroup';
import { StopLocationModal } from './StopLocationModal';
import { filterEligibleETAs } from '@/lib/etaEligibility';
import { isSpecialService } from '@/lib/routeVariants';
import type { ETAFreshness } from '@/lib/etaFreshness';
import type { StopETAStateWithFreshness } from '@/hooks/useStopETAs';
import { getStopIds } from '@/lib/stopGroups';
import { getMinutesUntil } from '@/lib/etaTime';
import { groupNearbyRouteVariants, nearbyVariantKey, type NearbyRouteVariant } from '@/lib/nearbyRoutePresentation';
import type { DirectRouteMatch, DestinationStopNames, NearbyStop, ETAEntry, Stop } from '@/lib/types';

interface StopCardProps {
  stop: NearbyStop;
  etas: ETAEntry[];
  routeFilters: string[];
  etasLoading: boolean;
  destinationMatches?: DirectRouteMatch[];
  destinationStopNames?: DestinationStopNames;
  destinationStops?: Record<string, Stop>;
  etaStates?: Record<string, StopETAStateWithFreshness>;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function routeGroupKey(route: string, bound: string, serviceType: string | number, boardingStopId: string, boardingSeq: number): string {
  return `${normalize(route)}|${normalize(bound)}|${normalize(serviceType)}|${normalize(boardingStopId)}|${boardingSeq}`;
}

export function StopCard({
  stop,
  etas,
  routeFilters,
  etasLoading,
  destinationMatches,
  destinationStopNames,
  destinationStops,
  etaStates = {},
}: StopCardProps) {
  const { lang } = useLang();
  const [mapStop, setMapStop] = useState<Stop | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState(false);
  const name = lang === 'en' ? stop.name_en : stop.name_tc;
  const stopStates = getStopIds(stop)
    .map((stopId) => etaStates[stopId.trim().toUpperCase()])
    .filter((state): state is StopETAStateWithFreshness => Boolean(state));

  const freshnessPriority: Record<ETAFreshness, number> = {
    fresh: 0,
    'slightly-old': 1,
    stale: 2,
    'very-stale': 3,
    unavailable: 4,
  };
  const statesWithSuccessfulData = stopStates.filter((state) => state.lastSuccessfulAt !== null);
  const stopFreshness = statesWithSuccessfulData.length === 0
    ? stopStates.length === 0 ? 'fresh' : 'unavailable'
    : statesWithSuccessfulData.reduce<ETAFreshness>((leastFresh, state) => (
      freshnessPriority[state.freshness] > freshnessPriority[leastFresh] ? state.freshness : leastFresh
    ), 'fresh');
  const stopLastSuccessfulAt = stopStates.reduce<Date | null>((oldest, state) => {
    if (!state.lastSuccessfulAt) return oldest;
    if (!oldest || state.lastSuccessfulAt < oldest) return state.lastSuccessfulAt;
    return oldest;
  }, null);
  const stopETALoading = stopStates.some(
    (state) => state.attemptStatus === 'loading' && state.lastSuccessfulAt === null,
  );
  const stopETAUnavailable = stopStates.length > 0
    && statesWithSuccessfulData.length === 0
    && !stopETALoading;

  // Keep exact variant identities before constructing any display containers.
  const grouped = new Map<string, NearbyRouteVariant>();
  for (const match of destinationMatches ?? []) {
    const key = routeGroupKey(match.route, match.bound, match.serviceType, match.boardingStop, match.boardingSeq);
    const group = grouped.get(key) ?? {
      route: normalize(match.route),
      bound: match.bound,
      serviceType: normalize(match.serviceType),
      boardingStopId: normalize(match.boardingStop),
      boardingSeq: match.boardingSeq,
      isSpecial: isSpecialService(normalize(match.serviceType)),
      etas: [],
      alightingStopIds: [],
    };
    if (!group.alightingStopIds.includes(match.alightingStop)) {
      group.alightingStopIds.push(match.alightingStop);
    }
    grouped.set(key, group);
  }
  const eligibleEtas = filterEligibleETAs(etas, destinationMatches);
  for (const eta of eligibleEtas) {
    const boardingStopId = normalize(eta.stop);
    if (!boardingStopId || !Number.isSafeInteger(eta.seq) || eta.seq <= 0) continue;
    const key = routeGroupKey(eta.route, eta.dir, eta.service_type, boardingStopId, eta.seq);
    const group = grouped.get(key) ?? {
      route: normalize(eta.route),
      bound: eta.dir,
      serviceType: normalize(eta.service_type),
      boardingStopId,
      boardingSeq: eta.seq,
      isSpecial: isSpecialService(normalize(eta.service_type)),
      etas: [],
      alightingStopIds: [],
    };
    group.etas.push(eta);
    grouped.set(key, group);
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

  const variants = visibleKeys.map((key) => grouped.get(key)!);
  const containers = destinationMatches === undefined
    ? groupNearbyRouteVariants(variants)
    : variants.map((variant) => ({ key: nearbyVariantKey(variant), variants: [variant] }));
  const earliestArrival = (variants: NearbyRouteVariant[]) => variants.flatMap((variant) => variant.etas).reduce((earliest, eta) => {
    if (!eta.eta) return earliest;
    const minutes = getMinutesUntil(eta.eta);
    return minutes >= -1 ? Math.min(earliest, minutes) : earliest;
  }, Number.POSITIVE_INFINITY);
  const rankedContainers = routeFilters.length > 0 || destinationMatches !== undefined
    ? containers
    : [...containers].sort((a, b) => earliestArrival(a.variants) - earliestArrival(b.variants));
  const limitRoutes = routeFilters.length === 0 && destinationMatches === undefined;
  const finalContainers = limitRoutes && !expandedRoutes ? rankedContainers.slice(0, 5) : rankedContainers;
  const hiddenRouteCount = limitRoutes ? rankedContainers.length - finalContainers.length : 0;

  /* Route filtering may hide a card. Destination-valid cards remain visible without live ETA. */
  const matchingRouteWithoutETA = destinationMatches?.some((match) =>
    (routeFilters.length === 0 || routeFilters.some((filter) => match.route.toUpperCase().includes(filter)))
  ) ?? false;
  if (
    routeFilters.length > 0
    && finalContainers.length === 0
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
            {stop.stop}
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
          onClick={() => setMapStop(stop)}
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
        ) : finalContainers.length === 0 ? (
          <p className="py-3 text-sm text-[var(--muted)] text-center">
            {stopETAUnavailable
              ? lang === 'en' ? 'ETA unavailable' : '暫未能取得到站時間'
              : lang === 'en' ? 'No arrivals available' : '暫無班次資料'}
          </p>
        ) : (
          finalContainers.map((container) => {
            const group = container.variants[0];
            const hasAnotherOccurrence = [...grouped.values()].some((other) => (
              other.route === group.route && other.bound === group.bound
              && other.serviceType === group.serviceType
              && other.boardingStopId === group.boardingStopId
              && other.boardingSeq !== group.boardingSeq
            ));
            if (destinationMatches === undefined) {
              return <NearbyRouteGroup key={container.key} container={container} showBoardingSeq={hasAnotherOccurrence} freshness={stopFreshness} lastSuccessfulAt={stopLastSuccessfulAt} etaLoading={stopETALoading} />;
            }
            return (
              <ETARow
                key={container.key}
                route={group.route}
                bound={group.bound}
                serviceType={group.serviceType}
                boardingStopId={group.boardingStopId}
                boardingSeq={group.boardingSeq}
                showBoardingSeq={hasAnotherOccurrence}
                isSpecial={group.isSpecial}
                etas={group.etas}
                alightingStopIds={group.alightingStopIds}
                destinationStopNames={destinationStopNames}
                destinationStops={destinationStops}
                onViewAlightingStop={setMapStop}
                freshness={stopFreshness}
                lastSuccessfulAt={stopLastSuccessfulAt}
                etaLoading={stopETALoading}
              />
            );
          })
        )}
        {hiddenRouteCount > 0 && (
          <button type="button" onClick={() => setExpandedRoutes(true)} className="w-full py-3 text-center text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
            {lang === 'en' ? `Show ${hiddenRouteCount} more routes` : `顯示其餘 ${hiddenRouteCount} 條路線`}
          </button>
        )}
        {limitRoutes && expandedRoutes && rankedContainers.length > 5 && (
          <button type="button" onClick={() => setExpandedRoutes(false)} className="w-full py-3 text-center text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
            {lang === 'en' ? 'Show fewer routes' : '收起路線'}
          </button>
        )}
      </div>
    </article>

    {/* Stop location map modal */}
    <StopLocationModal isOpen={mapStop !== null} onClose={() => setMapStop(null)} stop={mapStop ?? stop} />
    </>
  );
}
