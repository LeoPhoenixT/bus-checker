'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bus, ChevronDown, ChevronUp, RefreshCw, Route as RouteIcon } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { useStopETAs } from '@/hooks/useStopETAs';
import { fetchRouteDetail } from '@/lib/kmb';
import { getETAAgeSeconds } from '@/lib/etaFreshness';
import { filterRouteVariantETAs } from '@/lib/routeEta';
import { getMinutesUntil } from '@/lib/etaTime';
import type { ETAEntry, RouteDetail, RouteDetailStop, RouteVariant } from '@/lib/types';
import { LanguageToggle } from './LanguageToggle';
import { PrimaryNavigation } from './PrimaryNavigation';
import { RefreshIndicator } from './RefreshIndicator';
import { ThemeToggle } from './ThemeToggle';

interface RouteDetailPageProps {
  route: string;
  bound: 'I' | 'O';
  serviceType: string;
}

function routeDetailHref(variant: RouteVariant): string {
  const params = new URLSearchParams({ bound: variant.bound, serviceType: variant.serviceType });
  return `/routes/${encodeURIComponent(variant.route)}?${params}`;
}

function names(variant: RouteVariant, lang: 'en' | 'tc'): { origin: string; destination: string } {
  return lang === 'en'
    ? { origin: variant.originEn || variant.originTc, destination: variant.destinationEn || variant.destinationTc }
    : { origin: variant.originTc || variant.originEn, destination: variant.destinationTc || variant.destinationEn };
}

function stopName(stop: RouteDetailStop, lang: 'en' | 'tc'): string {
  return lang === 'en' ? stop.nameEn || stop.nameTc : stop.nameTc || stop.nameEn;
}

function ageLabel(date: Date | null, lang: 'en' | 'tc'): string | null {
  const seconds = getETAAgeSeconds(date);
  if (seconds === null) return null;
  return seconds < 60
    ? (lang === 'en' ? `${seconds}s ago` : `${seconds} 秒前`)
    : (lang === 'en' ? `${Math.floor(seconds / 60)} min ago` : `${Math.floor(seconds / 60)} 分鐘前`);
}

function SelectedStopETA({
  detail,
  stop,
  etas,
  loading,
  freshness,
  lastSuccessfulAt,
}: {
  detail: RouteDetail;
  stop: RouteDetailStop;
  etas: ETAEntry[];
  loading: boolean;
  freshness: ReturnType<typeof useStopETAs>['etaStates'][string]['freshness'] | 'unavailable';
  lastSuccessfulAt: Date | null;
}) {
  const { lang } = useLang();
  const liveETAs = filterRouteVariantETAs(etas, detail.variant, stop.stopId);
  const shouldHideTimes = freshness === 'very-stale' || freshness === 'unavailable';
  const arrivals = liveETAs
    .map((eta) => ({ eta, minutes: eta.eta ? getMinutesUntil(eta.eta) : null }))
    .filter((item) => item.minutes === null || item.minutes >= -1)
    .filter((item, index, all) => item.minutes === null || all.findIndex((candidate) => candidate.minutes === item.minutes) === index)
    .slice(0, 3);
  const updated = ageLabel(lastSuccessfulAt, lang);
  const status = loading && lastSuccessfulAt === null
    ? (lang === 'en' ? 'Loading ETA…' : '正在載入到站時間…')
    : freshness === 'stale'
      ? (lang === 'en' ? `ETA may be outdated · Updated ${updated}` : `到站時間可能已過時 · ${updated}更新`)
      : freshness === 'very-stale'
        ? (lang === 'en' ? `ETA unavailable${updated ? ` · Last updated ${updated}` : ''}` : `暫未能提供到站時間${updated ? ` · 最後更新於 ${updated}` : ''}`)
        : freshness === 'unavailable'
          ? (lang === 'en' ? 'ETA unavailable' : '暫未能提供到站時間')
          : freshness === 'slightly-old'
            ? (lang === 'en' ? `Updated ${updated}` : `${updated}更新`)
            : null;

  return (
    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
        {detail.variant.route} {lang === 'en' ? `to ${names(detail.variant, lang).destination}` : `往 ${names(detail.variant, lang).destination}`}
      </p>
      {loading && lastSuccessfulAt === null ? (
        <div className="mt-3 flex gap-2" aria-label={status ?? undefined}>
          {[0, 1, 2].map((item) => <span key={item} className="h-8 w-14 animate-pulse rounded-lg bg-blue-500/15" />)}
        </div>
      ) : shouldHideTimes ? (
        <p className="mt-2 text-sm font-medium text-[var(--muted)]">{lang === 'en' ? 'No live arrival time' : '暫未能提供即時到站時間'}</p>
      ) : arrivals.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{lang === 'en' ? 'No arrivals available' : '暫無班次資料'}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {arrivals.map(({ eta, minutes }, index) => (
            <span
              key={`${eta.eta_seq}-${eta.eta}-${index}`}
              className={clsx(
                'rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums',
                freshness === 'stale'
                  ? 'border-[var(--divider)] bg-[var(--card-bg)] text-[var(--muted)]'
                  : 'border-blue-500/25 bg-[var(--card-bg)] text-blue-700 dark:text-blue-300',
              )}
            >
              {minutes === null ? '—' : minutes <= 0 ? (lang === 'en' ? 'Arriving' : '即將到達') : `${minutes} ${lang === 'en' ? 'min' : '分'}`}
            </span>
          ))}
        </div>
      )}
      {status && <p className={clsx('mt-2 text-[11px]', freshness === 'stale' || freshness === 'very-stale' || freshness === 'unavailable' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--muted)]')}>{status}</p>}
    </div>
  );
}

export function RouteDetailPage({ route, bound, serviceType }: RouteDetailPageProps) {
  const { lang } = useLang();
  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [error, setError] = useState<'not-found' | 'unavailable' | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    setSelectedStopId(null);
    void fetchRouteDetail(route, bound, serviceType, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setDetail(response);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        const message = caught instanceof Error ? caught.message : '';
        setError(message.includes(': 404') ? 'not-found' : 'unavailable');
      });
    return () => controller.abort();
  }, [bound, route, serviceType]);

  const selectedStop = useMemo(
    () => detail?.stops.find((stop) => stop.stopId === selectedStopId) ?? null,
    [detail, selectedStopId],
  );
  const {
    etasMap, etaStates, lastRefreshed, lastAttemptAt, failedStopCount, loading: etaLoading, refresh,
  } = useStopETAs(selectedStop ? [selectedStop.stopId] : []);
  const selectedState = selectedStop ? etaStates[selectedStop.stopId] : undefined;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/routes" className="flex min-w-0 items-center gap-2.5 text-white transition-opacity hover:opacity-85">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><ArrowLeft className="h-5 w-5" /></span>
              <span>
                <span className="block text-lg font-bold leading-none tracking-tight">{route}</span>
                <span className="mt-0.5 block text-[11px] text-blue-100">{lang === 'en' ? 'Route detail' : '路線詳情'}</span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
          </div>
          <PrimaryNavigation />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 sm:pb-6">
        {!detail && !error && (
          <div className="space-y-4" aria-label={lang === 'en' ? 'Loading route detail' : '正在載入路線詳情'}>
            <div className="h-20 animate-pulse rounded-2xl bg-[var(--card-border)]" />
            <div className="h-12 animate-pulse rounded-xl bg-[var(--card-border)]" />
            <div className="h-80 animate-pulse rounded-2xl bg-[var(--card-border)]" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-28 text-center">
            <RouteIcon className="h-8 w-8 text-[var(--muted)]" />
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {error === 'not-found'
                ? (lang === 'en' ? 'Route variant not found' : '找不到此路線班次')
                : (lang === 'en' ? 'Route data is temporarily unavailable' : '暫時無法載入路線資料')}
            </p>
            <Link href="/routes" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">{lang === 'en' ? 'Back to route search' : '返回路線搜尋'}</Link>
          </div>
        )}
        {detail && (
          <>
            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{detail.variant.route}</h1>
                {detail.variant.isSpecial && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Special' : '特別班'}</span>}
              </div>
              <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{names(detail.variant, lang).origin} <span className="px-1 text-[var(--muted)]">→</span> {names(detail.variant, lang).destination}</p>
              {detail.reverseVariants.length === 1 ? (
                <Link href={routeDetailHref(detail.reverseVariants[0])} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300">
                  <RefreshCw className="h-4 w-4" />{lang === 'en' ? 'View reverse direction' : '查看反方向'}
                </Link>
              ) : detail.reverseVariants.length > 1 ? (
                <details className="group mt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300">
                    <RefreshCw className="h-4 w-4" />{lang === 'en' ? 'View reverse direction' : '查看反方向'}<ChevronDown className="ml-auto h-4 w-4 group-open:hidden" /><ChevronUp className="ml-auto hidden h-4 w-4 group-open:block" />
                  </summary>
                  <div className="mt-2 overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--popover-bg)]">
                    {detail.reverseVariants.map((variant) => (
                      <Link key={`${variant.route}|${variant.bound}|${variant.serviceType}`} href={routeDetailHref(variant)} className="block border-b border-[var(--divider)] px-3 py-3 text-sm last:border-b-0 hover:bg-blue-500/5">
                        <span className="font-semibold text-[var(--foreground)]">{names(variant, lang).origin} → {names(variant, lang).destination}</span>
                        {variant.isSpecial && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Special' : '特別班'}</span>}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>

            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--foreground)]"><Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" />{lang === 'en' ? 'Stops' : '站序'}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{lang === 'en' ? 'Select a stop to check its live ETA.' : '點選巴士站以查看即時到站時間。'}</p>
              <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
                {detail.stops.map((stop) => {
                  const selected = selectedStopId === stop.stopId;
                  return (
                    <li key={`${stop.seq}-${stop.stopId}`} className="border-b border-[var(--divider)] last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSelectedStopId((current) => current === stop.stopId ? null : stop.stopId)}
                        aria-expanded={selected}
                        className={clsx('flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-blue-500/5 focus:bg-blue-500/5 focus:outline-none', selected && 'bg-blue-500/5')}
                      >
                        <span className={clsx('w-8 shrink-0 text-sm font-bold tabular-nums', selected ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--muted)]')}>{String(stop.seq).padStart(2, '0')}</span>
                        <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">{stopName(stop, lang)}</span>
                        {selected ? <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="h-4 w-4 text-[var(--muted)]" />}
                      </button>
                      {selected && (
                        <div className="px-4 pb-4 pl-[4.75rem]">
                          <SelectedStopETA
                            detail={detail}
                            stop={stop}
                            etas={etasMap[stop.stopId] ?? []}
                            loading={selectedState === undefined || selectedState.attemptStatus === 'loading'}
                            freshness={selectedState?.freshness ?? 'unavailable'}
                            lastSuccessfulAt={selectedState?.lastSuccessfulAt ?? null}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
      </main>
      {selectedStop && (
        <RefreshIndicator
          lastRefreshed={lastRefreshed}
          lastAttemptAt={lastAttemptAt}
          failedStopCount={failedStopCount}
          loading={etaLoading}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
