'use client';
import { useState, useRef, type KeyboardEvent } from 'react';
import { Search, X, Plus, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';

interface FilterBarProps {
  filters: string[];
  onAdd: (route: string) => void;
  onRemove: (route: string) => void;
  onClear: () => void;
  // Destination props
  destinationActive: boolean;
  destinationDistanceM: number | null;
  onOpenDestinationModal: () => void;
  onClearDestination: () => void;
  favouritesOnly: boolean;
  onToggleFavouritesOnly: () => void;
}

export function FilterBar({
  filters,
  onAdd,
  onRemove,
  onClear,
  destinationActive,
  destinationDistanceM,
  onOpenDestinationModal,
  onClearDestination,
  favouritesOnly,
  onToggleFavouritesOnly,
}: FilterBarProps) {
  const { lang } = useLang();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const val = inputValue.trim().toUpperCase();
    if (val && !filters.includes(val)) {
      onAdd(val);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div className="sticky top-0 z-10 border-b border-[var(--card-border)] bg-[var(--background)]/95 backdrop-blur-md px-4 py-3 shadow-sm">
      <div className="mx-auto max-w-2xl">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'en' ? 'Route number… (e.g. 74B)' : '路線號碼… (例如 74B)'}
              className={clsx(
                'w-full rounded-xl border bg-[var(--input-bg)] border-[var(--input-border)] py-2.5 pl-10 pr-3',
                'text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50',
                'transition duration-150',
              )}
            />
          </div>
          <button
            onClick={commit}
            disabled={!inputValue.trim()}
            aria-label={lang === 'en' ? 'Add filter' : '新增篩選'}
            className={clsx(
              'flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
              inputValue.trim()
                ? 'border-blue-500/50 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 dark:text-blue-400'
                : 'border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--muted)] cursor-not-allowed',
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onOpenDestinationModal}
            aria-label={lang === 'en' ? 'Find by destination' : '按目的地查找'}
            title={lang === 'en' ? 'Find by destination' : '按目的地查找'}
            className={clsx(
              'flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
              destinationActive
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--muted)] hover:border-emerald-500/50 hover:text-emerald-600',
            )}
          >
            <MapPin className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          aria-pressed={favouritesOnly}
          onClick={onToggleFavouritesOnly}
          className={clsx(
            'mt-2.5 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition',
            favouritesOnly
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--muted)] hover:border-amber-500/40 hover:text-amber-600',
          )}
        >
          {favouritesOnly ? '★' : '☆'}&nbsp;
          {lang === 'en' ? 'Favourite routes only' : '只顯示收藏路線'}
        </button>

        {filters.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted)]">{lang === 'en' ? 'Filtering:' : '篩選：'}</span>
            {filters.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-300"
              >
                {f}
                <button
                  onClick={() => onRemove(f)}
                  aria-label={lang === 'en' ? `Remove filter ${f}` : `移除篩選 ${f}`}
                  className="ml-0.5 rounded-full hover:text-blue-400 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={onClear}
              className="text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)] transition"
            >
              {lang === 'en' ? 'Clear all' : '全部清除'}
            </button>
          </div>
        )}

        {destinationActive && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">
              {lang === 'en' ? 'Destination:' : '目的地：'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <MapPin className="h-3 w-3" />
              {destinationDistanceM != null
                ? destinationDistanceM >= 1000
                  ? `${(destinationDistanceM / 1000).toFixed(1)} km ${lang === 'en' ? 'away' : '外'}`
                  : `${destinationDistanceM} m ${lang === 'en' ? 'away' : '外'}`
                : lang === 'en' ? 'selected' : '已選'}
              <button
                onClick={onClearDestination}
                aria-label={lang === 'en' ? 'Clear destination' : '清除目的地'}
                className="ml-0.5 rounded-full hover:text-emerald-500 transition"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
