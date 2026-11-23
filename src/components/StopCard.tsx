'use client';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { ETARow } from './ETARow';
import { NearbyRouteGroup } from './NearbyRouteGroup';
import { StopLocationModal } from './StopLocationModal';
import { filterEligibleETAs } from '@/lib/etaEligibility';
import { isSpecialService } from '@/lib/routeVariants';
import type { StopETAStateWithFreshness } from '@/hooks/useStopETAs';
import { getNearbyStopETAStatus, matchesNearbyRouteFilter, nearbyStopAnchor, showNearbyStopCard } from '@/lib/nearbyStopStatus';
import { getMinutesUntil } from '@/lib/etaTime';
import { getETAPredictions } from '@/lib/etaPresentation';
import { groupNearbyRouteVariants, nearbyVariantKey, type NearbyRouteVariant } from '@/lib/nearbyRoutePresentation';
import type { DirectRouteMatch, DestinationStopNames, NearbyStop, ETAEntry, Stop } from '@/lib/types';

interface StopCardProps {
  stop: NearbyStop;
  etas: ETAEntry[];
  routeFilters: string[];
  etasLoading?: boolean;
  showRoutesWithoutETA?: boolean;
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
  etasLoading = false,
  showRoutesWithoutETA = true,
  destinationMatches,
  destinationStopNames,
  destinationStops,
  etaStates = {},
}: StopCardProps) {
  const { lang } = useLang();
  const [mapStop, setMapStop] = useState<Stop | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState(false);
  const name = lang === 'en' ? stop.name_en : stop.name_tc;
  const status = getNearbyStopETAStatus(stop, etaStates);
  const { freshness: stopFreshness, lastSuccessfulAt: stopLastSuccessfulAt, loading: stopETALoading, hasProblem: hasETAProblem } = status;

  if (!showNearbyStopCard(
    matchesNearbyRouteFilter(routeFilters, etas, destinationMatches),
    destinationMatches !== undefined,
    { ...status, loading: status.loading || etasLoading },
  )) return null;

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

  // Filter exact variants before grouping and applying the five-route limit.
  const canShowPredictions = stopFreshness !== 'very-stale' && stopFreshness !== 'unavailable';
  const variants = visibleKeys.map((key) => grouped.get(key)!)
    .filter((variant) => showRoutesWithoutETA || (canShowPredictions && getETAPredictions(variant.etas).length > 0));
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
  const extraRoutes = rankedContainers.length - 5;

  const distanceLabel = stop.distanceM < 1000
    ? `${stop.distanceM} m`
    : `${(stop.distanceM / 1000).toFixed(1)} km`;

  return (
    <>
      <article id={nearbyStopAnchor(stop.stop)} tabIndex={-1} className="scroll-mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
        <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-[var(--card-border)] bg-[var(--brand-surface)] py-1 pr-2 pl-3 sm:pl-4">
          <h3 className="min-w-0 flex-1 text-sm leading-snug font-bold text-[var(--foreground)] sm:text-base">{name}</h3>
          <span className="shrink-0 text-xs font-semibold text-[var(--brand)] tabular-nums">{distanceLabel}</span>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              setMapStop(stop);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--card-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] max-sm:min-w-11 max-sm:justify-center"
            aria-label={lang === 'en' ? 'View on map' : '在地圖上查看'}
          >
            <MapPin className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{lang === 'en' ? 'Map' : '地圖'}</span>
          </button>
        </div>

        <div className="divide-y divide-[var(--divider)] px-3 sm:px-4">
          {(etasLoading || stopETALoading) && finalContainers.length === 0 ? (
            /* Skeleton rows while first ETA fetch is in-flight */
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 animate-pulse motion-reduce:animate-none">
                <div className="h-5 w-16 rounded-lg bg-[var(--card-border)]" />
                <div className="flex-1 h-4 rounded bg-[var(--card-border)]" />
                <div className="h-5 w-14 rounded-full bg-[var(--card-border)]" />
              </div>
            ))
          ) : finalContainers.length === 0 ? (
            <p className="py-3 text-sm text-[var(--muted)]">
              {hasETAProblem
                ? lang === 'en' ? 'ETA unavailable' : '暫未能取得到站時間'
                : !showRoutesWithoutETA
                  ? lang === 'en' ? 'No routes with ETA available' : '暫無提供到站時間的路線'
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
          {limitRoutes && extraRoutes > 0 && (
            <button
              type="button"
              aria-expanded={expandedRoutes}
              onClick={() => setExpandedRoutes((current) => !current)}
              className="min-h-11 w-full rounded-lg text-center text-sm font-semibold text-[var(--brand)] hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {expandedRoutes
                ? lang === 'en' ? 'Show fewer routes' : '收起路線'
                : lang === 'en' ? `Show ${extraRoutes} more routes` : `顯示其餘 ${extraRoutes} 條路線`}
            </button>
          )}
        </div>
      </article>

      <StopLocationModal isOpen={mapStop !== null} onClose={() => setMapStop(null)} stop={mapStop ?? stop} />
    </>
  );
}
