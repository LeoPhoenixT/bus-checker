'use client';
import { useState, useMemo } from 'react';
import { Bus, RotateCw } from 'lucide-react';
import { getDistance } from 'geolib';
import { APP_CONFIG } from '@/config';
import { useLang } from '@/contexts/LanguageContext';
import { useSearchState } from '@/contexts/SearchStateContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyStops } from '@/hooks/useNearbyStops';
import { useStopETAs } from '@/hooks/useStopETAs';
import { useDirectRoutes } from '@/hooks/useDirectRoutes';
import { getNearbyStopETAStatus, matchesNearbyRouteFilter, nearbyStopAnchor, nearbyStopDistance, nearbyStopName, showNearbyStopCard } from '@/lib/nearbyStopStatus';
import { getDestinationCandidates, getDestinationPoint } from '@/lib/destination';
import { getStopIds } from '@/lib/stopGroups';
import { FilterBar } from '@/components/FilterBar';
import { StopCard } from '@/components/StopCard';
import { LocationPrompt } from '@/components/LocationPrompt';
import { PageHeader } from '@/components/PageHeader';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { StopCardSkeleton } from '@/components/LoadingSkeleton';
import { RadiusSelector } from '@/components/RadiusSelector';
import { DestinationModal } from '@/components/DestinationModal';
import type { DestinationSelection, Stop } from '@/lib/types';

function BusCheckerApp() {
  const { lang } = useLang();
  const {
    nearbyFilters: routeFilters, setNearbyFilters: setRouteFilters,
    nearbyDraft, setNearbyDraft, showRoutesWithoutETA, setShowRoutesWithoutETA,
  } = useSearchState();
  const [radius, setRadius] = useState<number>(APP_CONFIG.DEFAULT_SEARCH_RADIUS_M);

  // Destination state
  const [{ destination, destRadius }, setDestinationFilter] = useState<{
    destination: DestinationSelection | null;
    destRadius: number;
  }>({ destination: null, destRadius: APP_CONFIG.DESTINATION_DEFAULT_RADIUS_M });
  const [showDestModal, setShowDestModal] = useState(false);

  const addFilter = (route: string) => {
    const r = route.trim().toUpperCase();
    if (r) setRouteFilters((prev) => (prev.includes(r) ? prev : [...prev, r]));
  };
  const removeFilter = (route: string) =>
    setRouteFilters((prev) => prev.filter((f) => f !== route));
  const clearFilters = () => setRouteFilters([]);

  const {
    coords,
    error: geoError,
    loading: geoLoading,
    supported,
    refresh: refreshLocation,
  } = useGeolocation();
  const lat = coords?.latitude ?? null;
  const lon = coords?.longitude ?? null;
  const destinationPoint = getDestinationPoint(destination);

  const { stops, destinationStops, loading: stopsLoading, error: stopsError } = useNearbyStops(
    lat, lon, radius,
    destination?.kind === 'point' ? destination.lat : null,
    destination?.kind === 'point' ? destination.lon : null,
    destRadius,
  );

  const destinationActive = destination !== null;
  const destinationLabel = useMemo(() => {
    if (!destination) return null;
    if (destination.kind === 'stop') return lang === 'en' ? destination.stop.name_en : destination.stop.name_tc;
    return destination.source === 'address' ? destination.label ?? null : null;
  }, [destination, lang]);
  const originStopIds = useMemo(() => stops.flatMap(getStopIds), [stops]);
  const destinationCandidates: Stop[] = useMemo(
    () => getDestinationCandidates(destination, destinationStops),
    [destination, destinationStops],
  );
  const destinationStopIds = useMemo(
    () => destinationCandidates.flatMap(getStopIds),
    [destinationCandidates],
  );
  const destinationStopNames = useMemo(() => Object.fromEntries(
    destinationCandidates.flatMap((stop) => getStopIds(stop).map((stopId) => [
      stopId.toUpperCase(),
      { en: stop.name_en, tc: stop.name_tc },
    ])),
  ), [destinationCandidates]);
  const destinationStopsById = useMemo(() => Object.fromEntries(
    destinationCandidates.flatMap((stop) => getStopIds(stop).map((stopId) => [
      stopId.toUpperCase(),
      stop,
    ])),
  ), [destinationCandidates]);
  const {
    matchesByOriginStop,
    loading: directRoutesLoading,
    error: directRoutesError,
  } = useDirectRoutes(originStopIds, destinationStopIds, destinationActive && !stopsLoading);

  const groupedMatchesByOriginStop = useMemo(() => Object.fromEntries(
    stops.map((stop) => [
      stop.stop,
      getStopIds(stop).flatMap((stopId) => matchesByOriginStop[stopId.toUpperCase()] ?? []),
    ]),
  ), [matchesByOriginStop, stops]);

  const visibleStops = useMemo(() => {
    if (!destinationActive) return stops;
    return stops.filter((stop) => (groupedMatchesByOriginStop[stop.stop]?.length ?? 0) > 0);
  }, [destinationActive, groupedMatchesByOriginStop, stops]);

  // Destination matching uses static route topology; live ETA is needed only at boarding stops.
  const stopIds = useMemo(() => {
    if (!destinationActive) return stops.flatMap(getStopIds);
    if (directRoutesLoading || directRoutesError) return [];
    return visibleStops.flatMap(getStopIds);
  }, [destinationActive, directRoutesError, directRoutesLoading, stops, visibleStops]);

  const {
    etasMap,
    etaStates,
    lastRefreshed,
    lastAttemptAt,
    failedStopCount,
    loading: etaLoading,
    refresh,
  } = useStopETAs(stopIds);
  const groupedEtasMap = useMemo(() => Object.fromEntries(
    stops.map((stop) => [
      stop.stop,
      getStopIds(stop).flatMap((stopId) => etasMap[stopId] ?? []),
    ]),
  ), [etasMap, stops]);

  const showPrompt = geoLoading || !!geoError || !coords || !supported;
  const hasCoords = !!coords;

  // Distance from user to destination point
  const destDistanceM = useMemo(() => {
    if (lat == null || lon == null || !destinationPoint) return null;
    return getDistance(
      { latitude: lat, longitude: lon },
      { latitude: destinationPoint.lat, longitude: destinationPoint.lon },
    );
  }, [lat, lon, destinationPoint]);

  const shownStops = useMemo(() => visibleStops.filter((stop) => showNearbyStopCard(
    matchesNearbyRouteFilter(
      routeFilters,
      groupedEtasMap[stop.stop] ?? [],
      destinationActive ? groupedMatchesByOriginStop[stop.stop] ?? [] : undefined,
    ),
    destinationActive,
    getNearbyStopETAStatus(stop, etaStates),
  )), [destinationActive, etaStates, groupedEtasMap, groupedMatchesByOriginStop, routeFilters, visibleStops]);

  const boardStops = useMemo(() => {
    const labels = shownStops.map((stop) => {
      const name = nearbyStopName(stop, lang);
      const distance = nearbyStopDistance(stop.distanceM);
      return { stop, name, distance, key: JSON.stringify([name, distance]) };
    });
    const counts = new Map<string, number>();
    for (const { key } of labels) counts.set(key, (counts.get(key) ?? 0) + 1);
    return labels.map(({ stop, name, distance, key }) => ({
      stop, name, distance, showStopId: (counts.get(key) ?? 0) > 1,
    }));
  }, [lang, shownStops]);

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-[var(--brand-surface)] text-[var(--brand)]">
            <Bus className="size-5" aria-hidden="true" />
          </span>
          <span className="font-bold tracking-tight" translate="no">Bus Checker</span>
        </div>
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lang === 'en' ? 'Nearby arrivals' : '附近到站'}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{lang === 'en' ? 'KMB bus stops' : '九巴巴士站'}</p>
        </div>
        {hasCoords && !geoError && (
          <div className="flex flex-wrap items-center gap-2">
            <RadiusSelector radius={radius} onChangeRadius={setRadius} />
            <button
              type="button"
              onClick={refreshLocation}
              disabled={geoLoading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-wait disabled:opacity-60"
            >
              <RotateCw className={geoLoading ? 'size-4 motion-safe:animate-spin' : 'size-4'} aria-hidden="true" />
              {lang === 'en' ? 'Relocate' : '重新定位'}
            </button>
          </div>
        )}
      </div>

      {hasCoords && !geoError && (
        <FilterBar
          filters={routeFilters}
          inputValue={nearbyDraft}
          onInputChange={setNearbyDraft}
          showRoutesWithoutETA={showRoutesWithoutETA}
          onShowRoutesWithoutETAChange={setShowRoutesWithoutETA}
          onAdd={addFilter}
          onRemove={removeFilter}
          onClear={clearFilters}
          destinationActive={destinationActive}
          destinationLabel={destinationLabel}
          destinationDistanceM={destDistanceM}
          onOpenDestinationModal={() => setShowDestModal(true)}
          onClearDestination={() => {
            setDestinationFilter((current) => ({ ...current, destination: null }));
          }}
        />
      )}

      <main className="mx-auto max-w-6xl px-4 pt-3 pb-24 sm:px-6 sm:pb-8">
        {showPrompt ? (
          <LocationPrompt loading={geoLoading} error={geoError} supported={supported} onRetry={refreshLocation} />
        ) : stopsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <StopCardSkeleton key={i} />
            ))}
          </div>
        ) : stopsError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">{lang === 'en' ? 'Failed to load stops' : '無法載入巴士站'}</p>
            <p className="max-w-xs text-sm text-[var(--muted)]">{lang === 'en' ? 'Please try again later.' : '請稍後再試。'}</p>
          </div>
        ) : stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">{lang === 'en' ? 'No stops nearby' : '附近沒有巴士站'}</p>
            <p className="text-sm text-[var(--muted)]">
              {lang === 'en'
                ? `No KMB bus stops found within ${radius} m of your current location.`
                : `在您目前位置 ${radius} 米範圍內找不到九巴站。`}
            </p>
          </div>
        ) : destinationActive && directRoutesLoading ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-[var(--muted)]">
              {lang === 'en' ? 'Searching for direct routes…' : '正在搜尋直達路線…'}
            </p>
            {[...Array(3)].map((_, i) => <StopCardSkeleton key={i} />)}
          </div>
        ) : destinationActive && directRoutesError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">{lang === 'en' ? 'Route search unavailable' : '暫時無法搜尋路線'}</p>
            <p className="max-w-xs text-sm text-[var(--muted)]">{lang === 'en' ? 'Please try again later.' : '請稍後再試。'}</p>
          </div>
        ) : visibleStops.length === 0 && destinationActive ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">{lang === 'en' ? 'No matching routes' : '沒有符合路線'}</p>
            <p className="text-sm text-[var(--muted)]">
              {lang === 'en'
                ? `None of the ${stops.length} nearby stops have routes to your destination.`
                : `附近 ${stops.length} 個巴士站均沒有前往目的地的路線。`}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4">
              <p className="text-sm text-[var(--muted)]">
                {destinationActive
                  ? lang === 'en'
                    ? `${shownStops.length} of ${stops.length} stops with matching direct routes`
                    : `${stops.length} 個巴士站中有 ${shownStops.length} 個有符合條件的直達路線`
                  : lang === 'en'
                    ? `${shownStops.length} of ${stops.length} stops within ${radius} m`
                    : `${radius} 米內顯示 ${shownStops.length} 個巴士站（共 ${stops.length} 個）`}
              </p>
              <RefreshIndicator
                inline
                lastRefreshed={lastRefreshed}
                lastAttemptAt={lastAttemptAt}
                failedStopCount={failedStopCount}
                loading={etaLoading}
                onRefresh={refresh}
              />
            </div>
            {shownStops.length === 0 ? (
              <p role="status" className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--muted)]">
                {lang === 'en' ? 'No stops match the route filters. Clear or change the filters to see nearby stops.' : '沒有巴士站符合路線篩選。請清除或調整篩選。'}
              </p>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
                <nav
                  aria-label={lang === 'en' ? 'Jump to a nearby stop' : '跳至附近巴士站'}
                  className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2 lg:block"
                >
                  <h2 className="px-2 pt-1 pb-2 text-sm font-semibold text-[var(--muted)]">
                    {lang === 'en' ? 'Nearby stops' : '附近巴士站'}
                  </h2>
                  <ul className="space-y-0.5">
                    {boardStops.map(({ stop, name, distance, showStopId }) => (
                      <li key={stop.stop}>
                        <a
                          href={`#${nearbyStopAnchor(stop.stop)}`}
                          className="block min-h-11 rounded-lg px-2 py-2 text-sm leading-snug font-medium hover:bg-[var(--brand-surface)] hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          {name}
                          <span className="mt-0.5 block text-xs text-[var(--muted)] tabular-nums">
                            {distance}
                            {showStopId && <span className="block font-mono [overflow-wrap:anywhere]">{stop.stop}</span>}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                <section aria-label={lang === 'en' ? 'Arrival board' : '到站看板'} className="nearby-board min-w-0 space-y-3">
                  <h2 className="sr-only">{lang === 'en' ? 'Arrival board' : '到站看板'}</h2>
                  <div aria-hidden="true" className="nearby-columns hidden gap-x-3 px-4 text-xs font-semibold text-[var(--muted)] md:grid">
                    <span>{lang === 'en' ? 'Route' : '路線'}</span>
                    <span>{lang === 'en' ? 'Destination' : '目的地'}</span>
                    <span className="text-right">{lang === 'en' ? 'First ETA' : '首筆預報'}</span>
                    <span className="text-right">{lang === 'en' ? 'Later ETAs' : '後續預報'}</span>
                  </div>
                  {boardStops.map(({ stop, showStopId }) => (
                    <StopCard
                      key={stop.stop}
                      stop={stop}
                      etas={groupedEtasMap[stop.stop] ?? []}
                      routeFilters={routeFilters}
                      showRoutesWithoutETA={showRoutesWithoutETA}
                      showStopId={showStopId}
                      destinationMatches={destinationActive ? groupedMatchesByOriginStop[stop.stop] ?? [] : undefined}
                      destinationStopNames={destinationStopNames}
                      destinationStops={destinationStopsById}
                      etaStates={etaStates}
                    />
                  ))}
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Destination Modal ── */}
      <DestinationModal
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        onConfirm={(selection, nextRadius) => {
          setDestinationFilter({ destination: selection, destRadius: nextRadius });
          setShowDestModal(false);
        }}
        currentDestination={destination}
        userLat={lat}
        userLon={lon}
        destinationRadius={destRadius}
      />
    </div>
  );
}

export default function Home() {
  return <BusCheckerApp />;
}
