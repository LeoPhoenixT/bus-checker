'use client';
import { useState, useMemo } from 'react';
import { Bus, Navigation, Heart, RotateCw } from 'lucide-react';
import { getDistance } from 'geolib';
import { APP_CONFIG } from '@/config';
import { LanguageProvider, useLang } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { BookmarkProvider, useBookmarks } from '@/contexts/BookmarkContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyStops } from '@/hooks/useNearbyStops';
import { useStopETAs } from '@/hooks/useStopETAs';
import { useDirectRoutes } from '@/hooks/useDirectRoutes';
import { filterEligibleETAs } from '@/lib/etaEligibility';
import { getDestinationCandidates, getDestinationPoint } from '@/lib/destination';
import { getStopIds } from '@/lib/stopGroups';
import { FilterBar } from '@/components/FilterBar';
import { StopCard } from '@/components/StopCard';
import { FavoriteSidebar } from '@/components/FavoriteSidebar';
import { LocationPrompt } from '@/components/LocationPrompt';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { StopCardSkeleton } from '@/components/LoadingSkeleton';
import { RadiusSelector } from '@/components/RadiusSelector';
import { DestinationModal } from '@/components/DestinationModal';
import type { DestinationSelection, Stop } from '@/lib/types';

function BusCheckerApp() {
  const { lang } = useLang();
  const [routeFilters, setRouteFilters] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(APP_CONFIG.DEFAULT_SEARCH_RADIUS_M);

  // Destination state
  const [destination, setDestination] = useState<DestinationSelection | null>(null);
  const [destRadius, setDestRadius] = useState<number>(APP_CONFIG.DESTINATION_DEFAULT_RADIUS_M);
  const [showDestModal, setShowDestModal] = useState(false);

  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { favoriteRoutes } = useBookmarks();

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

  const { etasMap, lastRefreshed, loading: etaLoading, refresh } = useStopETAs(stopIds);
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

  const filteredStopCount = useMemo(() => {
    if (routeFilters.length === 0 && !favouritesOnly) return visibleStops.length;
    return visibleStops.filter((s) => {
      const matches = destinationActive ? groupedMatchesByOriginStop[s.stop] ?? [] : undefined;
      const etas = filterEligibleETAs(groupedEtasMap[s.stop] ?? [], matches);
      const routes = new Set([
        ...etas.map((eta) => eta.route.toUpperCase()),
        ...(matches ?? []).map((match) => match.route.toUpperCase()),
      ]);
      return [...routes].some((route) =>
        (routeFilters.length === 0 || routeFilters.some((filter) => route.includes(filter)))
        && (!favouritesOnly || favoriteRoutes.has(route)),
      );
    }).length;
  }, [destinationActive, visibleStops, groupedEtasMap, groupedMatchesByOriginStop, routeFilters, favouritesOnly, favoriteRoutes]);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 flex-shrink-0">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none text-white tracking-tight">
                  Bus Checker
                </h1>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-blue-100">
                  <Navigation className="h-3 w-3" />
                  {lang === 'en' ? `KMB · ${radius} m radius` : `九巴 · 半徑 ${radius} 米`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <LanguageToggle />
              <ThemeToggle />
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
                aria-label={lang === 'en' ? 'My Favourites' : '我的最愛'}
              >
                <Heart className="h-4 w-4" />
              </button>
            </div>
          </div>
          {hasCoords && !geoError && (
            <div className="flex items-center gap-3">
              <RadiusSelector radius={radius} onChangeRadius={setRadius} />
              <button
                type="button"
                onClick={refreshLocation}
                disabled={geoLoading}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-wait disabled:opacity-60"
                aria-label={lang === 'en' ? 'Refresh current location' : '重新載入目前位置'}
                title={lang === 'en' ? 'Refresh current location' : '重新載入目前位置'}
              >
                <RotateCw className={`h-4 w-4 ${geoLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {lang === 'en' ? 'Reload location' : '重新定位'}
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Sticky Filter Bar (only when we have location) ── */}
      {hasCoords && !geoError && (
        <FilterBar
          filters={routeFilters}
          onAdd={addFilter}
          onRemove={removeFilter}
          onClear={clearFilters}
          destinationActive={destinationActive}
          destinationLabel={destinationLabel}
          destinationDistanceM={destDistanceM}
          onOpenDestinationModal={() => setShowDestModal(true)}
          onClearDestination={() => {
            setDestination(null);
          }}
          favouritesOnly={favouritesOnly}
          onToggleFavouritesOnly={() => setFavouritesOnly((value) => !value)}
        />
      )}

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        {showPrompt ? (
          <LocationPrompt loading={geoLoading} error={geoError} supported={supported} />
        ) : stopsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <StopCardSkeleton key={i} />
            ))}
          </div>
        ) : stopsError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">{lang === 'en' ? 'Failed to load stops' : '無法載入巴士站'}</p>
            <p className="max-w-xs text-sm text-[var(--muted)]">{stopsError}</p>
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
            <p className="max-w-xs text-sm text-[var(--muted)]">{directRoutesError}</p>
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
        ) : favouritesOnly && filteredStopCount === 0 && !(etaLoading && lastRefreshed === null) ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <p className="text-xl font-semibold">
              {favoriteRoutes.size === 0
                ? lang === 'en' ? 'No favourite routes saved.' : '尚未收藏任何路線。'
                : lang === 'en' ? 'No favourite routes match the current filters.' : '沒有收藏路線符合目前的篩選條件。'}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-[var(--muted)]">
              {favouritesOnly
                ? lang === 'en'
                  ? `${filteredStopCount} of ${stops.length} nearby stops match active filters`
                  : `${stops.length} 個附近巴士站中有 ${filteredStopCount} 個符合篩選條件`
                : destinationActive
                ? lang === 'en'
                  ? `${visibleStops.length} of ${stops.length} stops have routes to destination${routeFilters.length > 0 ? ` · ${filteredStopCount} match filters` : ''}`
                  : `${stops.length} 個巴士站中有 ${visibleStops.length} 個有前往目的地的路線${routeFilters.length > 0 ? ` · ${filteredStopCount} 個符合篩選` : ''}`
                : lang === 'en'
                  ? `${stops.length} stop${stops.length !== 1 ? 's' : ''} within ${radius} m${routeFilters.length > 0 ? ` · ${filteredStopCount} match${filteredStopCount !== 1 ? 'es' : ''} active filters` : ''}`
                  : `${radius} 米內共 ${stops.length} 個巴士站${routeFilters.length > 0 ? ` · ${filteredStopCount} 個符合篩選條件` : ''}`}
            </p>

            {/* Main results */}
            <div className="space-y-4">
              {visibleStops.map((stop) => (
                <StopCard
                  key={stop.stop}
                  stop={stop}
                  etas={groupedEtasMap[stop.stop] ?? []}
                  routeFilters={routeFilters}
                  etasLoading={etaLoading && lastRefreshed === null}
                  destinationMatches={destinationActive ? groupedMatchesByOriginStop[stop.stop] ?? [] : undefined}
                  destinationStopNames={destinationStopNames}
                  destinationStops={destinationStopsById}
                  favouriteRoutes={favoriteRoutes}
                  favouritesOnly={favouritesOnly}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Refresh Indicator ── */}
      {hasCoords && !geoError && (
        <RefreshIndicator lastRefreshed={lastRefreshed} loading={etaLoading} onRefresh={refresh} />
      )}

      {/* ── Favourite Sidebar ── */}
      <FavoriteSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Destination Modal ── */}
      <DestinationModal
        isOpen={showDestModal}
        onClose={() => setShowDestModal(false)}
        onConfirm={(selection) => {
          setDestination(selection);
          setShowDestModal(false);
        }}
        currentDestination={destination}
        userLat={lat}
        userLon={lon}
        destinationRadius={destRadius}
        onChangeRadius={setDestRadius}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BookmarkProvider>
          <BusCheckerApp />
        </BookmarkProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
