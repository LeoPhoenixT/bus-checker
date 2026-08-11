'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { getCachedStops } from '@/lib/clientStops';
import { getStopIds, getStopSearchNames } from '@/lib/stopGroups';
import { useLang } from '@/contexts/LanguageContext';
import type { AddressSearchResult, Stop } from '@/lib/types';

interface DestinationSearchProps {
  onSelectStop: (stop: Stop) => void;
  onSelectAddress: (address: AddressSearchResult) => void;
}

const MAX_STOP_RESULTS = 50;

export function DestinationSearch({ onSelectStop, onSelectAddress }: DestinationSearchProps) {
  const { lang } = useLang();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [addresses, setAddresses] = useState<AddressSearchResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  useEffect(() => {
    void getCachedStops().then(setStops).catch(() => setStops([]));
  }, []);

  const stopResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return stops.filter((stop) =>
      getStopIds(stop).some((id) => id.toLocaleLowerCase().includes(normalizedQuery))
      || getStopSearchNames(stop).some((name) =>
        name.name_en.toLocaleLowerCase().includes(normalizedQuery)
        || name.name_tc.toLocaleLowerCase().includes(normalizedQuery)
        || name.name_sc.toLocaleLowerCase().includes(normalizedQuery),
      ),
    ).slice(0, MAX_STOP_RESULTS);
  }, [normalizedQuery, stops]);

  useEffect(() => {
    const controller = new AbortController();
    if (!normalizedQuery || !open) {
      setAddresses([]);
      setAddressLoading(false);
      setAddressError(null);
      return () => controller.abort();
    }

    setAddressLoading(true);
    setAddressError(null);
    const timer = window.setTimeout(() => {
      void fetch(`/api/location-search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body: unknown = await response.json();
          if (!response.ok) throw new Error('Address search unavailable');
          if (typeof body !== 'object' || body === null || !('results' in body)) {
            throw new Error('Invalid address search response');
          }
          if (!controller.signal.aborted) {
            setAddresses((body as { results: AddressSearchResult[] }).results.slice(0, 8));
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAddresses([]);
            setAddressError(lang === 'en' ? 'Address search unavailable' : '暫時無法搜尋地址');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setAddressLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lang, normalizedQuery, open, query]);

  const hasQuery = normalizedQuery.length > 0;
  return (
    <div className="relative px-4 py-3 border-b border-[var(--divider)]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hasQuery) setOpen(true);
          }}
          placeholder={lang === 'en' ? 'Search stop or address' : '搜尋巴士站或地址'}
          aria-label={lang === 'en' ? 'Search destination' : '搜尋目的地'}
          role="combobox"
          aria-expanded={hasQuery && open}
          aria-controls="destination-search-results"
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {hasQuery && open && (
        <div
          id="destination-search-results"
          role="listbox"
          className="absolute left-4 right-4 top-[calc(100%-4px)] z-[1001] max-h-72 overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--popover-bg)] shadow-xl"
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {lang === 'en' ? 'Bus stops' : '巴士站'}
          </p>
          {stopResults.length > 0 ? stopResults.map((stop) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={stop.stop}
              onClick={() => {
                setQuery(lang === 'en' ? stop.name_en : stop.name_tc);
                setOpen(false);
                onSelectStop(stop);
              }}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-blue-500/10"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{lang === 'en' ? stop.name_en : stop.name_tc}</span>
                <span className="block font-mono text-[10px] text-[var(--muted)]">
                  {getStopIds(stop).length === 1
                    ? stop.stop
                    : lang === 'en'
                      ? `${getStopIds(stop).length} colocated entries`
                      : `${getStopIds(stop).length} 個同位置站點記錄`}
                </span>
              </span>
            </button>
          )) : (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">{lang === 'en' ? 'No matching stops' : '沒有符合的巴士站'}</p>
          )}

          <div className="border-t border-[var(--divider)]" />
          <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {lang === 'en' ? 'Addresses' : '一般地址'}
            {addressLoading && <LoaderCircle className="h-3 w-3 animate-spin" />}
          </p>
          {addressError ? (
            <p className="px-3 py-2 text-xs text-red-500">{addressError}</p>
          ) : addresses.length > 0 ? addresses.map((address) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={address.id}
              onClick={() => {
                setQuery(lang === 'en' ? address.labelEn : address.labelTc);
                setOpen(false);
                onSelectAddress(address);
              }}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-blue-500/10"
            >
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span className="line-clamp-2 text-sm">{lang === 'en' ? address.labelEn : address.labelTc}</span>
            </button>
          )) : !addressLoading ? (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">{lang === 'en' ? 'No matching addresses' : '沒有符合的地址'}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
