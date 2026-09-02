'use client';
import { Fragment } from 'react';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/contexts/BookmarkContext';
import type { DestinationStopNames, ETAEntry, Stop } from '@/lib/types';

interface ETARowProps {
  route: string;
  etas: ETAEntry[];
  alightingStopIds?: string[];
  destinationStopNames?: DestinationStopNames;
  destinationStops?: Record<string, Stop>;
  onViewAlightingStop?: (stop: Stop) => void;
}

export function getMinutesUntil(etaIso: string): number {
  return Math.floor((new Date(etaIso).getTime() - Date.now()) / 60_000);
}

// Deterministic colour per route number — readable in both light & dark
const ROUTE_COLOURS = [
  'bg-blue-500/15 border-blue-500/25 text-blue-700 dark:text-blue-300',
  'bg-violet-500/15 border-violet-500/25 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/15 border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
  'bg-rose-500/15 border-rose-500/25 text-rose-700 dark:text-rose-300',
  'bg-amber-500/15 border-amber-500/25 text-amber-700 dark:text-amber-300',
  'bg-cyan-500/15 border-cyan-500/25 text-cyan-700 dark:text-cyan-300',
  'bg-pink-500/15 border-pink-500/25 text-pink-700 dark:text-pink-300',
  'bg-indigo-500/15 border-indigo-500/25 text-indigo-700 dark:text-indigo-300',
];

function routeColour(route: string): string {
  let h = 0;
  for (const c of route) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return ROUTE_COLOURS[h % ROUTE_COLOURS.length];
}

export function ETARow({
  route,
  etas,
  alightingStopIds = [],
  destinationStopNames = {},
  destinationStops = {},
  onViewAlightingStop,
}: ETARowProps) {
  const { lang } = useLang();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const first = etas[0];
  const dest = first ? (lang === 'en' ? first.dest_en : first.dest_tc) : '';
  const destPrefix = lang === 'en' ? 'To ' : '往 ';
  const alightingStops = alightingStopIds.map((stopId) => ({
    id: stopId,
    name: destinationStopNames[stopId]?.[lang] ?? stopId,
    stop: destinationStops[stopId],
  }));

  // Compute minutes for each upcoming bus; filter out clearly departed
  const times = etas
    .map((e) => ({ eta: e.eta, minutes: e.eta ? getMinutesUntil(e.eta) : null, rmk_en: e.rmk_en, rmk_tc: e.rmk_tc }))
    .filter((t) => t.minutes === null || t.minutes >= -1);

  // Deduplicate by arrival time — keep only unique minutes
  const seenMinutes = new Set<number | null>();
  const uniqueTimes = times.filter((t) => {
    if (seenMinutes.has(t.minutes)) return false;
    seenMinutes.add(t.minutes);
    return true;
  });

  const [nearest, ...later] = uniqueTimes;

  // Format time unit based on language
  const timeUnit = lang === 'en' ? 'min' : '分';
  const arrivingNow = lang === 'en' ? 'Arriving' : '即將到達';
  const departed = lang === 'en' ? 'Departed' : '已離站';

  // Handle bookmark toggle
  const handleBookmarkClick = () => {
    toggleBookmark(route);
  };

  // Render primary (nearest) ETA badge
  const renderPrimaryBadge = () => {
    if (!nearest) return <span className="text-xs text-[var(--muted)]">—</span>;

    if (nearest.minutes === null) {
      return <span className="text-xs text-[var(--muted)]">—</span>;
    }

    if (nearest.minutes < 0) {
      return <span className="text-xs text-[var(--muted)] tabular-nums">{departed}</span>;
    }

    if (nearest.minutes === 0) {
      return (
        <span className="animate-pulse rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-500 dark:text-red-400">
          {arrivingNow}
        </span>
      );
    }

    return (
      <span
        className={clsx(
          'rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums',
          nearest.minutes <= 2
            ? 'border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400'
            : nearest.minutes <= 5
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'border-green-500/40 bg-green-500/15 text-green-600 dark:text-green-400',
        )}
      >
        {nearest.minutes} {timeUnit}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Route badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={clsx(
            'inline-block w-16 shrink-0 rounded-lg border px-1.5 py-0.5 text-center text-xs font-bold',
            routeColour(route),
          )}
        >
          {route}
        </span>
      </div>

      {/* Destination with direction prefix */}
      <div className="min-w-0 flex-1">
        {first ? (
          <p className="truncate text-sm font-medium leading-tight text-[var(--foreground)]">
            <span className="text-[var(--muted)] font-normal">{destPrefix}</span>
            {dest || '—'}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">{lang === 'en' ? 'No live arrivals' : '暫無班次資料'}</p>
        )}
        {alightingStops.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-snug text-blue-600 dark:text-blue-400">
            <span>{lang === 'en' ? 'Alight at: ' : '落車站：'}</span>
            {alightingStops.map(({ id, name, stop }, index) => (
              <Fragment key={id}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {stop && onViewAlightingStop ? (
                  <button
                    type="button"
                    onClick={() => onViewAlightingStop(stop)}
                    className="inline-flex items-center gap-0.5 rounded underline-offset-2 hover:text-blue-800 hover:underline dark:hover:text-blue-200"
                    aria-label={lang === 'en' ? `View ${name} on map` : `在地圖上查看${name}`}
                  >
                    <MapPin className="h-3 w-3" />
                    {name}
                  </button>
                ) : <span>{name}</span>}
              </Fragment>
            ))}
          </p>
        )}
        {/* Later arrival times shown as smaller text beneath */}
        {later.length > 0 && (
          <p className="mt-0.5 flex flex-wrap gap-1.5">
            {later.map((t, i) => {
              const rmk = lang === 'en' ? t.rmk_en : t.rmk_tc;
              if (t.minutes === null) return null;

              const timeText =
                t.minutes < 0
                  ? departed
                  : t.minutes === 0
                    ? arrivingNow
                    : `${t.minutes} ${timeUnit}`;

              return (
                <span key={i} className="text-[11px] tabular-nums text-[var(--muted)]">
                  {timeText}
                  {rmk ? ` (${rmk})` : ''}
                </span>
              );
            })}
          </p>
        )}
      </div>

      {/* Nearest arrival badge */}
      <div className="shrink-0">{renderPrimaryBadge()}</div>

      {/* Bookmark star icon */}
      <button
        onClick={handleBookmarkClick}
        className="shrink-0 text-lg transition-all hover:scale-110 active:scale-95"
        aria-label={isBookmarked(route)
          ? lang === 'en' ? 'Remove bookmark' : '移除收藏'
          : lang === 'en' ? 'Add bookmark' : '加入收藏'}
      >
        {isBookmarked(route) ? '⭐' : '☆'}
      </button>
    </div>
  );
}
