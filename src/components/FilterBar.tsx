'use client';
import { useId, useRef, type KeyboardEvent } from 'react';
import { Search, X, Plus, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';

interface FilterBarProps {
  filters: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  showRoutesWithoutETA: boolean;
  onShowRoutesWithoutETAChange: (value: boolean) => void;
  onAdd: (route: string) => void;
  onRemove: (route: string) => void;
  onClear: () => void;
  // Destination props
  destinationActive: boolean;
  destinationLabel: string | null;
  destinationDistanceM: number | null;
  onOpenDestinationModal: () => void;
  onClearDestination: () => void;
}

export function FilterBar({
  filters,
  inputValue,
  onInputChange,
  showRoutesWithoutETA,
  onShowRoutesWithoutETAChange,
  onAdd,
  onRemove,
  onClear,
  destinationActive,
  destinationLabel,
  destinationDistanceM,
  onOpenDestinationModal,
  onClearDestination,
}: FilterBarProps) {
  const { lang } = useLang();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const val = inputValue.trim().toUpperCase();
    if (val && !filters.includes(val)) {
      onAdd(val);
    }
    onInputChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit();
    }
  };

  const destinationDistanceLabel = destinationDistanceM != null
    ? destinationDistanceM >= 1000
      ? `${(destinationDistanceM / 1000).toFixed(1)} km ${lang === 'en' ? 'away' : '外'}`
      : `${destinationDistanceM} m ${lang === 'en' ? 'away' : '外'}`
    : lang === 'en' ? 'selected' : '已選';

  return (
    <div className="border-b border-[var(--card-border)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <form
            className="flex min-w-0 grow basis-60 items-center gap-2 sm:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              commit();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                name="route-number"
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                aria-label={lang === 'en' ? 'Filter by route number' : '按路線號碼篩選'}
                aria-describedby={hintId}
                placeholder={lang === 'en' ? 'Route number, e.g. 74B' : '路線號碼，例如 74B'}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 pl-9 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:text-sm"
              />
            </div>
            <span id={hintId} className="sr-only">
              {lang === 'en' ? 'Press Enter or Add to apply the route filter.' : '按 Enter 或「加入」套用路線篩選。'}
            </span>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              aria-label={lang === 'en' ? 'Add filter' : '新增篩選'}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-2.5 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:opacity-65"
            >
              <Plus className="size-4" aria-hidden="true" />
              {lang === 'en' ? 'Add' : '加入'}
            </button>
          </form>

          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              onOpenDestinationModal();
            }}
            aria-label={lang === 'en' ? 'Find by destination' : '按目的地查找'}
            className={clsx(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
              destinationActive && 'bg-[var(--brand-surface)]',
            )}
          >
            <MapPin className="size-4" aria-hidden="true" />
            {lang === 'en' ? 'Destination' : '目的地'}
          </button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
            <span className="relative flex shrink-0 items-center">
              <input
                type="checkbox"
                role="switch"
                checked={showRoutesWithoutETA}
                onChange={(event) => onShowRoutesWithoutETAChange(event.target.checked)}
                className="peer sr-only"
              />
              <span aria-hidden="true" className="h-5 w-9 rounded-full border border-[var(--muted)] bg-[var(--card-bg)] transition-colors peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brand)]" />
              <span aria-hidden="true" className="pointer-events-none absolute left-1 size-3 rounded-full bg-[var(--muted)] transition-transform motion-reduce:transition-none peer-checked:translate-x-4 peer-checked:bg-[var(--card-bg)]" />
            </span>
            {lang === 'en' ? 'Show routes without ETA' : '顯示沒有到站時間的路線'}
          </label>
        </div>

        {(filters.length > 0 || destinationActive) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  onRemove(filter);
                  inputRef.current?.focus();
                }}
                aria-label={lang === 'en' ? `Remove filter ${filter}` : `移除篩選 ${filter}`}
                className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg bg-[var(--brand-surface)] px-2.5 text-sm font-semibold break-all text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                {filter}<X className="size-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
            {filters.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  inputRef.current?.focus();
                }}
                className="min-h-11 rounded-lg px-2 text-sm text-[var(--muted)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                {lang === 'en' ? 'Clear all' : '全部清除'}
              </button>
            )}
            {destinationActive && (
              <button
                type="button"
                onClick={() => {
                  onClearDestination();
                  inputRef.current?.focus();
                }}
                aria-label={lang === 'en' ? 'Clear destination' : '清除目的地'}
                className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg bg-[var(--brand-surface)] px-2.5 text-left text-sm font-semibold text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {destinationLabel && <span className="break-words">{destinationLabel}</span>}
                <span className="shrink-0">{destinationDistanceLabel}</span>
                <X className="size-4 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
