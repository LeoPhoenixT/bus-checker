'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { fetchCitybusRouteDetail } from '@/lib/routes';
import { RouteDetailRequestError } from '@/lib/client/http';
import { citybusRouteHref } from '@/lib/routeUrls';
import { routeSearchHref, type RouteOperatorFilter } from '@/lib/routeSearch';
import { routeStopOccurrenceKey } from '@/lib/routeStopOccurrence';
import { formatETAMinutes, getETAPredictions, getNullETAMessage } from '@/lib/etaPresentation';
import { getETAAgeSeconds } from '@/lib/etaFreshness';
import { useCitybusRouteETA } from '@/hooks/useCitybusRouteETA';
import type { CitybusBound, CitybusRouteDetail } from '@/lib/citybusTypes';
import { PageHeader } from './PageHeader';
import { RouteMap } from './RouteMap';

interface Props {
  route: string;
  bound?: CitybusBound;
  searchQuery?: string;
  searchFilter?: RouteOperatorFilter;
  initialStopId?: string;
  initialStopSeq?: number;
}

export function CitybusRouteDetailPage({ route, bound, searchQuery = '', searchFilter = 'all', initialStopId, initialStopSeq }: Props) {
  const { lang } = useLang();
  const requestKey = `${route}|${bound ?? ''}`;
  const [result, setResult] = useState<{ key: string; detail: CitybusRouteDetail | null }>({ key: '', detail: null });
  const [error, setError] = useState<'missing' | 'unavailable' | null>(null);
  const [retry, setRetry] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scrollSelection, setScrollSelection] = useState(0);
  const selectedRef = useRef<HTMLLIElement>(null);
  const detail = result.key === requestKey ? result.detail : null;
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key: requestKey, detail: null });
    setError(null);
    setSelectedKey(null);
    setRetryAt(0);
    void fetchCitybusRouteDetail(route, bound, controller.signal).then((detail) => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, detail });
      setRetryAt(Date.now() + (detail.retryAfterSeconds ?? 0) * 1000);
      const occurrences = detail.stops.map((item) => item.status === 'resolved' ? item.stop : item).filter((item) => item.stopId === initialStopId);
      const initial = initialStopSeq === undefined ? (occurrences.length === 1 ? occurrences[0] : undefined) : occurrences.find((item) => item.seq === initialStopSeq);
      setSelectedKey(initial ? routeStopOccurrenceKey(initial) : null);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(error instanceof RouteDetailRequestError && error.status === 404 ? 'missing' : 'unavailable');
      setRetryAt(Date.now() + (error instanceof RouteDetailRequestError ? error.retryAfterSeconds ?? 0 : 0) * 1000);
    });
    return () => controller.abort();
  }, [route, bound, requestKey, retry, initialStopId, initialStopSeq]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (scrollSelection) selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [scrollSelection]);
  const mapStops = useMemo(() => detail?.stops.flatMap((item) => item.status === 'resolved' ? [item.stop] : []) ?? [], [detail]);
  const occurrences = detail?.stops.map((item) => item.status === 'resolved' ? item.stop : item) ?? [];
  const selectedStop = occurrences.find((item) => routeStopOccurrenceKey(item) === selectedKey) ?? null;
  const eta = useCitybusRouteETA(route, detail?.variant.bound, selectedStop);
  const arrivals = getETAPredictions(eta.data).slice(0, 3);
  const notice = getNullETAMessage(eta.data, lang);
  const hidesTimes = eta.freshness === 'very-stale' || eta.freshness === 'unavailable';
  const age = getETAAgeSeconds(eta.dataTime, clock);
  const ageText = age === null ? (lang === 'en' ? 'Data age unknown' : '資料時間未知')
    : lang === 'en' ? `Data updated ${age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} ago`
      : `資料於 ${age < 60 ? `${age} 秒` : `${Math.floor(age / 60)} 分鐘`}前更新`;
  const missingMetadata = detail?.stops.some((item) => item.status !== 'resolved');
  const retrySeconds = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  const directionHref = (direction: CitybusBound) => citybusRouteHref(route, direction, { searchQuery, searchFilter });

  return <div className="min-h-screen">
    <PageHeader>
      <Link href={routeSearchHref(searchQuery, searchFilter)} className="flex items-center gap-2.5 text-white">
        <ArrowLeft className="h-5 w-5" /><span><span className="block text-lg font-bold">{route}</span><span className="text-xs">{lang === 'en' ? 'Citybus · Route detail' : '城巴 · 路線詳情'}</span></span>
      </Link>
    </PageHeader>
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      {!detail && !error && <p role="status" className="py-16 text-center text-[var(--muted)]">{lang === 'en' ? 'Loading Citybus route…' : '正在載入城巴路線…'}</p>}
      {error && <div className="space-y-4 py-16 text-center">
        <p>{error === 'missing' ? (lang === 'en' ? 'Route direction has no available stops.' : '此路線方向沒有可用站序。') : (lang === 'en' ? 'Citybus route data is temporarily unavailable.' : '暫時無法載入城巴路線資料。')}</p>
        {error === 'unavailable' && <button type="button" disabled={retrySeconds > 0} onClick={() => setRetry((value) => value + 1)} className="min-h-11 rounded-xl border border-blue-500/30 px-4 py-2 disabled:opacity-50">{retrySeconds ? (lang === 'en' ? `Retry in ${retrySeconds}s` : `${retrySeconds} 秒後重試`) : (lang === 'en' ? 'Retry' : '重試')}</button>}
      </div>}
      {detail && <>
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{route}</h1><span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs">{lang === 'en' ? 'Citybus' : '城巴'}</span></div>
          <p className="mt-2 font-semibold">{lang === 'en' ? detail.variant.originEn || detail.variant.originTc : detail.variant.originTc || detail.variant.originEn} → {lang === 'en' ? detail.variant.destinationEn || detail.variant.destinationTc : detail.variant.destinationTc || detail.variant.destinationEn}</p>
          <div className="mt-4 flex gap-2">
            {detail.directions.map((direction) => direction.status === 'available' ? <Link key={direction.bound} href={directionHref(direction.bound)} aria-current={direction.bound === detail.variant.bound ? 'page' : undefined} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${direction.bound === detail.variant.bound ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--card-border)]'}`}>{direction.bound === 'O' ? (lang === 'en' ? 'Outbound' : '去程') : (lang === 'en' ? 'Inbound' : '回程')}</Link> : direction.status === 'unavailable' ? <span key={direction.bound} className="text-sm text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Other direction unavailable' : '暫未能確認另一方向'}</span> : null)}
          </div>
          {(missingMetadata || detail.directions.some((item) => item.status === 'unavailable')) && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <p>{lang === 'en' ? 'Some route data could not be loaded.' : '部分路線資料未能載入。'}</p>
            <button type="button" disabled={retrySeconds > 0} onClick={() => setRetry((value) => value + 1)} className="min-h-11 px-3 font-semibold underline disabled:opacity-50">{retrySeconds ? (lang === 'en' ? `Retry in ${retrySeconds}s` : `${retrySeconds} 秒後重試`) : (lang === 'en' ? 'Retry route data' : '重試路線資料')}</button>
          </div>}
        </section>
        <RouteMap stops={mapStops} selectedStopKey={selectedKey} lang={lang} onSelectStop={(stop) => { setSelectedKey(routeStopOccurrenceKey(stop)); setScrollSelection((value) => value + 1); }} />
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bus className="h-5 w-5" />{lang === 'en' ? 'Stops' : '站序'}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{lang === 'en' ? 'Select a stop to check its live ETA.' : '點選巴士站以查看即時到站時間。'}</p>
          <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            {detail.stops.map((item) => {
              const stop = item.status === 'resolved' ? item.stop : item;
              const key = routeStopOccurrenceKey(stop);
              const selected = selectedKey === key;
              return <li key={key} ref={selected ? selectedRef : undefined} className="border-b border-[var(--divider)] last:border-b-0">
                <button type="button" aria-expanded={selected} onClick={() => setSelectedKey(selected ? null : key)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left ${selected ? 'bg-blue-500/10' : 'hover:bg-blue-500/5'}`}>
                  <span className="w-8 shrink-0 font-bold tabular-nums text-[var(--muted)]">{String(stop.seq).padStart(2, '0')}</span>
                  <span className="flex-1 text-sm font-semibold">{item.status === 'resolved' ? (lang === 'en' ? item.stop.nameEn || item.stop.nameTc : item.stop.nameTc || item.stop.nameEn) : `${stop.stopId} · ${lang === 'en' ? 'Stop data could not be loaded' : '站點資料未能載入'}`}</span>
                  {selected ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {selected && <div className="space-y-2 px-4 pb-4 sm:pl-16" aria-live="polite">
                  {eta.loading && !eta.lastSuccessfulAt ? <p>{lang === 'en' ? 'Loading ETA…' : '正在載入到站時間…'}</p> : <>
                    {(eta.error || hidesTimes || eta.freshness === 'stale') && <p className="text-sm text-amber-700 dark:text-amber-300">{eta.error ? (lang === 'en' ? 'Unable to refresh ETA.' : '暫未能更新到站時間。') : hidesTimes ? (lang === 'en' ? 'Live ETA unavailable.' : '暫未能提供即時到站時間。') : (lang === 'en' ? 'ETA may be outdated.' : '到站時間可能已過時。')}</p>}
                    {!hidesTimes && arrivals.map(({ eta: row, minutes }) => <p key={row.eta_seq} className="font-semibold"><span className="text-xl tabular-nums text-blue-700 dark:text-blue-300">{formatETAMinutes(minutes, lang)}</span>{' '}{lang === 'en' ? row.rmk_en : row.rmk_tc}</p>)}
                    {notice && <p className="text-sm">{notice}</p>}
                    {!arrivals.length && !notice && !hidesTimes && <p className="text-sm">{lang === 'en' ? 'No live prediction' : '暫無即時預報'}</p>}
                    {eta.lastSuccessfulAt && <p className="text-xs text-[var(--muted)]">{ageText}</p>}
                  </>}
                  <button type="button" disabled={eta.loading} onClick={() => void eta.refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-500/30 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${eta.loading ? 'animate-spin' : ''}`} />{lang === 'en' ? 'Refresh ETA' : '刷新到站時間'}</button>
                </div>}
              </li>;
            })}
          </ol>
        </section>
      </>}
      <p className="mt-6 text-xs text-[var(--muted)]">{lang === 'en' ? 'Citybus data provided by Citybus Limited via ' : '城巴資料由城巴有限公司提供，經 '}
        <a href="https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta" className="underline">DATA.GOV.HK</a>{lang === 'en' ? '. Data intellectual property belongs to Citybus Limited.' : ' 發布；資料知識產權屬城巴有限公司。'}</p>
    </main>
  </div>;
}
