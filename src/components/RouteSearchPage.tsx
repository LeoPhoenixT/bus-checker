'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bus, ChevronRight, Search, X } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { normalizeRouteQuery } from '@/lib/routeVariants';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { isRouteOperatorFilter, routeLookupHref, routeLookupKey, routeSearchHref, type RouteLookup, type RouteOperator, type RouteOperatorFilter } from '@/lib/routeSearch';
import { PageHeader } from './PageHeader';

function variantName(variant: RouteLookup, lang: 'en' | 'tc'): { origin: string; destination: string } {
  return lang === 'en'
    ? { origin: variant.originEn || variant.originTc, destination: variant.destinationEn || variant.destinationTc }
    : { origin: variant.originTc || variant.originEn, destination: variant.destinationTc || variant.destinationEn };
}

export function RouteSearchPage({ initialQuery = '', initialFilter = 'all' }: { initialQuery?: string; initialFilter?: RouteOperatorFilter }) {
  const { lang } = useLang();
  const [query, setQuery] = useState(() => normalizeRouteQuery(initialQuery));
  const [filter, setFilter] = useState<RouteOperatorFilter>(initialFilter);
  const { routes: results, truncated, loading, complete, sources } = useRouteSearch(query, filter);
  useEffect(() => {
    window.history.replaceState(window.history.state, '', routeSearchHref(query, filter));
  }, [query, filter]);
  useEffect(() => {
    const restore = () => {
      const params = new URL(window.location.href).searchParams;
      setQuery(normalizeRouteQuery(params.get('q') ?? ''));
      const operator = params.get('operator');
      setFilter(isRouteOperatorFilter(operator) ? operator : 'all');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const operatorName = (operator: RouteOperator) => operator === 'KMB' ? (lang === 'en' ? 'KMB' : '九巴') : (lang === 'en' ? 'Citybus' : '城巴');

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Bus className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight text-white">Bus Checker</h1>
            <p className="mt-0.5 text-[11px] text-blue-100">{lang === 'en' ? 'KMB & Citybus route lookup' : '九巴及城巴路線查詢'}</p>
          </div>
        </div>
      </PageHeader>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 sm:pb-6">
        <h2 className="text-xl font-bold text-[var(--foreground)]">{lang === 'en' ? 'Route search' : '路線搜尋'}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {lang === 'en' ? 'Search a KMB or Citybus route number to view its stops and arrivals.' : '輸入九巴或城巴路線號碼以查看站序及到站時間。'}
        </p>

        <div className="mt-4 flex gap-2" role="group" aria-label={lang === 'en' ? 'Bus operator' : '巴士公司'}>
          {(['all', 'KMB', 'CTB'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
              className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${filter === value ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-[var(--card-border)] text-[var(--muted)]'}`}>
              {value === 'all' ? (lang === 'en' ? 'All' : '全部') : operatorName(value)}
            </button>
          ))}
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(normalizeRouteQuery(event.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={lang === 'en' ? 'Search route number' : '搜尋路線號碼'}
            placeholder={lang === 'en' ? 'e.g. 87D' : '例如：87D'}
            className="h-14 w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pl-12 pr-12 text-xl font-semibold uppercase text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] dark:hover:bg-white/10"
              aria-label={lang === 'en' ? 'Clear route search' : '清除路線搜尋'}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {query && <div className="mt-4 space-y-2" aria-live="polite">
          {(['KMB', 'CTB'] as const).map((operator) => {
            const source = sources[operator];
            return source.status === 'loading' ? <p key={operator} className="text-sm text-[var(--muted)]">{operatorName(operator)} · {lang === 'en' ? 'Searching…' : '搜尋中…'}</p>
              : source.status === 'error' ? <div key={operator} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
                <div><span className="font-semibold">{operatorName(operator)}</span><p>{lang === 'en' ? 'Route search is temporarily unavailable.' : '暫時無法搜尋路線。'}</p></div>
                <button type="button" onClick={source.retry} className="min-h-11 rounded-lg px-3 font-semibold text-blue-700 dark:text-blue-300">{lang === 'en' ? 'Retry' : '重試'}</button>
              </div> : null;
          })}
        </div>}
        {!query ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400"><Search className="h-6 w-6" /></div>
            <p className="max-w-xs text-sm text-[var(--muted)]">
              {lang === 'en' ? 'Enter a route number such as 1, 87D, or B1.' : '輸入路線號碼，例如 1、87D 或 B1。'}
            </p>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="space-y-2 pt-5" aria-label={lang === 'en' ? 'Searching routes' : '正在搜尋路線'}>
            {[0, 1, 2].map((index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]" />)}
          </div>
        ) : results.length === 0 && complete ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            {lang === 'en' ? `No routes found for “${query}”.` : `找不到「${query}」的路線。`}
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            {results.map((route) => {
              const names = variantName(route, lang);
              return (
                <Link
                  key={routeLookupKey(route)}
                  href={routeLookupHref(route, query, filter)}
                  className="flex items-center gap-3 border-b border-[var(--divider)] px-4 py-4 transition last:border-b-0 hover:bg-blue-500/5 focus:bg-blue-500/5 focus:outline-none"
                >
                  <span className="w-16 shrink-0 text-lg font-bold tabular-nums text-[var(--foreground)]">{route.route}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--foreground)]">
                      <span>{lang === 'en' ? `To ${names.destination}` : `往 ${names.destination}`}</span>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px]">{operatorName(route.operator)}</span>
                      {route.operator === 'KMB' && route.isSpecial && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Special' : '特別班'}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{lang === 'en' ? `From ${names.origin}` : `${names.origin}開出`}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)]" />
                </Link>
              );
            })}
          </div>
        )}
        {results.length > 0 && truncated && (
          <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
            {lang === 'en' ? 'Showing the first 50 results. Enter more characters to narrow your search.' : '只顯示首 50 個結果，請輸入更多字元縮小搜尋範圍。'}
          </p>
        )}
        <p className="mt-6 text-xs text-[var(--muted)]">{lang === 'en' ? 'Citybus data provided by Citybus Limited via ' : '城巴資料由城巴有限公司提供，經 '}
          <a href="https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta" className="underline">DATA.GOV.HK</a>{lang === 'en' ? '. Data intellectual property belongs to Citybus Limited.' : ' 發布；資料知識產權屬城巴有限公司。'}</p>
      </main>
    </div>
  );
}
