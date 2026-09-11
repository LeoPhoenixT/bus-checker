'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bus, ChevronRight, Search, X } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { normalizeRouteQuery } from '@/lib/routeVariants';
import { searchRoutes } from '@/lib/kmb';
import type { RouteVariant } from '@/lib/types';
import { LanguageToggle } from './LanguageToggle';
import { PrimaryNavigation } from './PrimaryNavigation';
import { ThemeToggle } from './ThemeToggle';

function routeDetailHref(route: RouteVariant): string {
  const params = new URLSearchParams({ bound: route.bound, serviceType: route.serviceType });
  return `/routes/${encodeURIComponent(route.route)}?${params}`;
}

function variantName(variant: RouteVariant, lang: 'en' | 'tc'): { origin: string; destination: string } {
  return lang === 'en'
    ? { origin: variant.originEn || variant.originTc, destination: variant.destinationEn || variant.destinationTc }
    : { origin: variant.originTc || variant.originEn, destination: variant.destinationTc || variant.destinationEn };
}

export function RouteSearchPage() {
  const { lang } = useLang();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RouteVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchRoutes(query, { signal: controller.signal })
        .then((routes) => {
          if (!controller.signal.aborted) setResults(routes);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setError(lang === 'en' ? 'Route search is temporarily unavailable.' : '暫時無法搜尋路線。');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lang, query]);

  const onChange = (value: string) => setQuery(normalizeRouteQuery(value));

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none tracking-tight text-white">Bus Checker</h1>
                <p className="mt-0.5 text-[11px] text-blue-100">{lang === 'en' ? 'KMB route lookup' : '九巴路線查詢'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <PrimaryNavigation />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 sm:pb-6">
        <h2 className="text-xl font-bold text-[var(--foreground)]">{lang === 'en' ? 'Route search' : '路線搜尋'}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {lang === 'en' ? 'Search a KMB route number to view its stops.' : '輸入九巴路線號碼以查看站序。'}
        </p>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => onChange(event.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={lang === 'en' ? 'Search route number' : '搜尋路線號碼'}
            placeholder={lang === 'en' ? 'e.g. 87D' : '例如：87D'}
            className="h-14 w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pl-12 pr-12 text-xl font-semibold uppercase text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
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

        {!query ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400"><Search className="h-6 w-6" /></div>
            <p className="max-w-xs text-sm text-[var(--muted)]">
              {lang === 'en' ? 'Enter a route number such as 1, 87D, or A21.' : '輸入路線號碼，例如 1、87D 或 A21。'}
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-2 pt-5" aria-label={lang === 'en' ? 'Searching routes' : '正在搜尋路線'}>
            {[0, 1, 2].map((index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]" />)}
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">{error}</p>
        ) : results.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            {lang === 'en' ? `No KMB routes found for “${query}”.` : `找不到「${query}」的九巴路線。`}
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            {results.map((route) => {
              const names = variantName(route, lang);
              return (
                <Link
                  key={`${route.route}|${route.bound}|${route.serviceType}`}
                  href={routeDetailHref(route)}
                  className="flex items-center gap-3 border-b border-[var(--divider)] px-4 py-4 transition last:border-b-0 hover:bg-blue-500/5 focus:bg-blue-500/5 focus:outline-none"
                >
                  <span className="w-16 shrink-0 text-lg font-bold tabular-nums text-[var(--foreground)]">{route.route}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--foreground)]">
                      <span>{lang === 'en' ? `To ${names.destination}` : `往 ${names.destination}`}</span>
                      {route.isSpecial && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{lang === 'en' ? 'Special' : '特別班'}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{lang === 'en' ? `From ${names.origin}` : `${names.origin}開出`}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)]" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
