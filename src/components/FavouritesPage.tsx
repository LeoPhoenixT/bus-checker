'use client';

import Link from 'next/link';
import { Bus, Heart, RefreshCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useFavourites } from '@/contexts/FavouriteContext';
import { useLang } from '@/contexts/LanguageContext';
import { useStopETAs } from '@/hooks/useStopETAs';
import { fetchFavouriteRouteStopMetadata } from '@/lib/kmb';
import { favouriteRouteStopKey } from '@/lib/favourites';
import { getETAAgeSeconds } from '@/lib/etaFreshness';
import { getMinutesUntil } from '@/lib/etaTime';
import { filterFavouriteRouteStopETAs } from '@/lib/routeEta';
import type { ETAFreshness } from '@/lib/etaFreshness';
import type { FavouriteRouteStop, FavouriteRouteStopMetadata } from '@/lib/types';
import { LanguageToggle } from './LanguageToggle';
import { PrimaryNavigation } from './PrimaryNavigation';
import { RefreshIndicator } from './RefreshIndicator';
import { ThemeToggle } from './ThemeToggle';

function routeDetailHref(favourite: FavouriteRouteStop): string {
  const params = new URLSearchParams({ bound: favourite.bound, serviceType: favourite.serviceType, stop: favourite.stopId });
  return `/routes/${encodeURIComponent(favourite.route)}?${params}`;
}

function ageLabel(date: Date | null, lang: 'en' | 'tc'): string | null {
  const seconds = getETAAgeSeconds(date);
  if (seconds === null) return null;
  return seconds < 60
    ? (lang === 'en' ? `${seconds}s ago` : `${seconds} 秒前`)
    : (lang === 'en' ? `${Math.floor(seconds / 60)} min ago` : `${Math.floor(seconds / 60)} 分鐘前`);
}

function metadataName(metadata: FavouriteRouteStopMetadata, lang: 'en' | 'tc'): { stop: string; destination: string } | null {
  if (metadata.status !== 'resolved' || !metadata.stop || !metadata.variant) return null;
  return lang === 'en'
    ? { stop: metadata.stop.nameEn || metadata.stop.nameTc, destination: metadata.variant.destinationEn || metadata.variant.destinationTc }
    : { stop: metadata.stop.nameTc || metadata.stop.nameEn, destination: metadata.variant.destinationTc || metadata.variant.destinationEn };
}

function FavouriteCard({
  favourite,
  metadata,
  metadataLoading,
  metadataUnavailable,
  etas,
  freshness,
  lastSuccessfulAt,
  loading,
  onRemove,
}: {
  favourite: FavouriteRouteStop;
  metadata?: FavouriteRouteStopMetadata;
  metadataLoading: boolean;
  metadataUnavailable: boolean;
  etas: ReturnType<typeof filterFavouriteRouteStopETAs>;
  freshness: ETAFreshness;
  lastSuccessfulAt: Date | null;
  loading: boolean;
  onRemove: () => void;
}) {
  const { lang } = useLang();
  const labels = metadata ? metadataName(metadata, lang) : null;
  const missing = metadata?.status === 'missing';
  const metadataItemUnavailable = metadata?.status === 'unavailable';
  const hideTimes = freshness === 'very-stale' || freshness === 'unavailable' || missing || metadataUnavailable || metadataItemUnavailable;
  const arrivals = etas
    .map((eta) => eta.eta ? getMinutesUntil(eta.eta) : null)
    .filter((minutes) => minutes === null || minutes >= -1)
    .filter((minutes, index, all) => minutes === null || all.indexOf(minutes) === index)
    .slice(0, 3);
  const updated = ageLabel(lastSuccessfulAt, lang);
  const stale = freshness === 'stale' || freshness === 'very-stale' || freshness === 'unavailable';

  return (
    <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Link href={routeDetailHref(favourite)} className="min-w-0 flex-1 rounded-lg outline-none transition hover:opacity-80 focus:ring-2 focus:ring-blue-500/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--foreground)]">{favourite.route}</span>
            {Number(favourite.serviceType) >= 2 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Special' : '特別班'}</span>}
            {labels && <span className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">{lang === 'en' ? `to ${labels.destination}` : `往 ${labels.destination}`}</span>}
          </div>
          {metadataLoading ? (
            <span className="mt-2 block h-4 w-40 animate-pulse rounded bg-[var(--card-border)]" />
          ) : labels ? (
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{labels.stop}</p>
          ) : (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              {missing
                ? (lang === 'en' ? 'This saved stop is no longer on this route' : '此收藏站點已不在這個路線班次上')
                : metadataUnavailable || metadataItemUnavailable
                  ? (lang === 'en' ? 'Route information is temporarily unavailable' : '暫時無法載入路線資料')
                  : (lang === 'en' ? 'Saved stop information is unavailable' : '暫未能提供收藏站點資料')}
            </p>
          )}
        </Link>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300"
          aria-label={lang === 'en' ? `Remove ${favourite.route} favourite` : `移除${favourite.route}收藏`}
          title={lang === 'en' ? 'Remove' : '移除'}
        ><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 border-t border-[var(--divider)] pt-3">
        {loading && lastSuccessfulAt === null ? (
          <div className="flex gap-2"><span className="h-7 w-14 animate-pulse rounded-lg bg-blue-500/15" /><span className="h-7 w-14 animate-pulse rounded-lg bg-blue-500/15" /></div>
        ) : hideTimes ? (
          <p className="text-sm font-medium text-[var(--muted)]">{lang === 'en' ? 'ETA unavailable' : '暫未能提供到站時間'}</p>
        ) : arrivals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{lang === 'en' ? 'No arrivals available' : '暫無班次資料'}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {arrivals.map((minutes, index) => (
              <span key={`${minutes}-${index}`} className={clsx(
                'rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums',
                stale ? 'border-[var(--divider)] bg-[var(--card-border)] text-[var(--muted)]' : 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
              )}>
                {minutes === null ? '—' : minutes <= 0 ? (lang === 'en' ? 'Arriving' : '即將到達') : `${minutes} ${lang === 'en' ? 'min' : '分'}`}
              </span>
            ))}
          </div>
        )}
        {!missing && !metadataUnavailable && !metadataItemUnavailable && updated && freshness === 'slightly-old' && <p className="mt-2 text-[11px] text-[var(--muted)]">{lang === 'en' ? `Updated ${updated}` : `${updated}更新`}</p>}
        {!missing && !metadataUnavailable && !metadataItemUnavailable && updated && freshness === 'stale' && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{lang === 'en' ? `ETA may be outdated · Updated ${updated}` : `到站時間可能已過時 · ${updated}更新`}</p>}
        {!missing && !metadataUnavailable && !metadataItemUnavailable && updated && freshness === 'very-stale' && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{lang === 'en' ? `Last updated ${updated}` : `最後更新於 ${updated}`}</p>}
      </div>
    </article>
  );
}

export function FavouritesPage() {
  const { lang } = useLang();
  const { favourites, hydrated, removeFavourite } = useFavourites();
  const [metadata, setMetadata] = useState<FavouriteRouteStopMetadata[]>([]);
  const [metadataState, setMetadataState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [metadataRetry, setMetadataRetry] = useState(0);
  const favouriteKey = favourites.map(favouriteRouteStopKey).join(',');

  useEffect(() => {
    if (!hydrated) return;
    if (favourites.length === 0) {
      setMetadata([]);
      setMetadataState('success');
      return;
    }
    const controller = new AbortController();
    setMetadataState('loading');
    void fetchFavouriteRouteStopMetadata(favourites, { signal: controller.signal })
      .then((items) => { if (!controller.signal.aborted) { setMetadata(items); setMetadataState('success'); } })
      .catch(() => { if (!controller.signal.aborted) { setMetadata([]); setMetadataState('error'); } });
    return () => controller.abort();
  }, [favouriteKey, hydrated, metadataRetry]); // favouriteKey changes only with the stable identity list.

  const metadataByKey = useMemo(() => new Map(metadata.map((item) => [favouriteRouteStopKey(item.favourite), item])), [metadata]);
  const stopIds = hydrated ? favourites.map((item) => item.stopId) : [];
  const { etasMap, etaStates, lastRefreshed, lastAttemptAt, failedStopCount, loading, refresh } = useStopETAs(stopIds);

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Heart className="h-5 w-5" /></span><div><h1 className="text-lg font-bold leading-none">{lang === 'en' ? 'Favourites' : '收藏'}</h1><p className="mt-0.5 text-[11px] text-blue-100">{lang === 'en' ? 'Your usual boarding stops' : '你常用的上車站'}</p></div></div>
            <div className="flex shrink-0 items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
          </div>
          <PrimaryNavigation />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 sm:pb-6">
        {!hydrated ? (
          <div className="space-y-4" aria-label={lang === 'en' ? 'Loading favourites' : '正在載入收藏'}><div className="h-28 animate-pulse rounded-2xl bg-[var(--card-border)]" /><div className="h-28 animate-pulse rounded-2xl bg-[var(--card-border)]" /></div>
        ) : favourites.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28 text-center"><Heart className="h-10 w-10 text-[var(--muted)]" /><div><h2 className="text-lg font-semibold text-[var(--foreground)]">{lang === 'en' ? 'No favourites yet' : '尚未有收藏'}</h2><p className="mt-2 max-w-xs text-sm text-[var(--muted)]">{lang === 'en' ? 'Open a route, select your boarding stop, then add it to favourites.' : '開啟路線，選擇你的上車站後加入收藏。'}</p></div><Link href="/routes" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">{lang === 'en' ? 'Search routes' : '搜尋路線'}</Link></div>
        ) : (
          <div className="space-y-3">
            {metadataState === 'error' && <button type="button" onClick={() => setMetadataRetry((count) => count + 1)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200" aria-label={lang === 'en' ? 'Retry route information' : '重試路線資料'}><RefreshCw className="h-4 w-4" />{lang === 'en' ? 'Route information is temporarily unavailable' : '暫時無法載入路線資料'}</button>}
            {favourites.map((favourite) => {
              const key = favouriteRouteStopKey(favourite);
              const state = etaStates[favourite.stopId];
              return <FavouriteCard key={key} favourite={favourite} metadata={metadataByKey.get(key)} metadataLoading={metadataState === 'loading'} metadataUnavailable={metadataState === 'error'} etas={filterFavouriteRouteStopETAs(etasMap[favourite.stopId] ?? [], favourite)} freshness={state?.freshness ?? 'unavailable'} lastSuccessfulAt={state?.lastSuccessfulAt ?? null} loading={state?.attemptStatus === 'loading'} onRemove={() => removeFavourite(favourite)} />;
            })}
          </div>
        )}
      </main>
      {hydrated && favourites.length > 0 && <RefreshIndicator lastRefreshed={lastRefreshed} lastAttemptAt={lastAttemptAt} failedStopCount={failedStopCount} loading={loading} onRefresh={refresh} />}
    </div>
  );
}
