'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import type { DestinationStopNames, ETAEntry, Stop } from '@/lib/types';
import type { ETAFreshness } from '@/lib/etaFreshness';
import { getETAAgeSeconds } from '@/lib/etaFreshness';
import { kmbRouteHref } from '@/lib/routeUrls';
import { etaDisplayText, formatETAMinutes, getETAPredictions, getNullETAMessage } from '@/lib/etaPresentation';

interface ETARowProps {
  route: string;
  bound: 'I' | 'O';
  serviceType: string;
  boardingStopId: string;
  boardingSeq: number;
  showBoardingSeq?: boolean;
  isSpecial?: boolean;
  etas: ETAEntry[];
  alightingStopIds?: string[];
  destinationStopNames?: DestinationStopNames;
  destinationStops?: Record<string, Stop>;
  onViewAlightingStop?: (stop: Stop) => void;
  freshness?: ETAFreshness;
  lastSuccessfulAt?: Date | null;
  etaLoading?: boolean;
  identityMode?: 'link' | 'label';
  variantLabel?: string;
}

export { getMinutesUntil } from '@/lib/etaTime';

export function ETARow({
  route,
  bound,
  serviceType,
  boardingStopId,
  boardingSeq,
  showBoardingSeq = false,
  isSpecial = false,
  etas,
  alightingStopIds = [],
  destinationStopNames = {},
  destinationStops = {},
  onViewAlightingStop,
  freshness = 'fresh',
  lastSuccessfulAt = null,
  etaLoading = false,
  identityMode = 'link',
  variantLabel,
}: ETARowProps) {
  const { lang } = useLang();

  const first = etas[0];
  const dest = first ? (lang === 'en' ? first.dest_en : first.dest_tc) : '';
  const destPrefix = lang === 'en' ? 'To ' : '往 ';
  const routeDetailHref = kmbRouteHref({ route, bound, serviceType }, { stopId: boardingStopId, boardingSeq });
  const routeDetailLabel = (lang === 'en'
    ? `View ${route}${isSpecial ? ' special service' : ''} route details`
    : `查看${route}${isSpecial ? '特別班' : ''}路線詳情`) + (showBoardingSeq ? (lang === 'en' ? ` (stop ${boardingSeq})` : `（第 ${boardingSeq} 站）`) : '');
  const alightingStops = alightingStopIds.map((stopId) => ({
    id: stopId,
    name: destinationStopNames[stopId]?.[lang] ?? stopId,
    stop: destinationStops[stopId],
  }));

  // Compute minutes for each upcoming bus; filter out clearly departed
  const times = getETAPredictions(etas).map(({ eta, minutes }) => ({ ...eta, minutes }));
  const nullEtaMessage = getNullETAMessage(etas, lang);

  const [nearest, ...later] = times.slice(0, 3);
  const nearestRemark = nearest ? etaDisplayText(lang === 'en' ? nearest.rmk_en : nearest.rmk_tc) : '';

  // Format time unit based on language
  const timeUnit = lang === 'en' ? 'min' : '分';
  const arrivingNow = lang === 'en' ? 'Arriving' : '即將到達';
  const departed = lang === 'en' ? 'Departed' : '已離站';
  const ageSeconds = getETAAgeSeconds(lastSuccessfulAt);
  const ageLabel = ageSeconds === null
    ? null
    : ageSeconds < 60
      ? (lang === 'en' ? `${ageSeconds}s ago` : `${ageSeconds} 秒前`)
      : (lang === 'en' ? `${Math.floor(ageSeconds / 60)} min ago` : `${Math.floor(ageSeconds / 60)} 分鐘前`);
  const hidesLiveETA = freshness === 'very-stale' || freshness === 'unavailable';

  const freshnessNotice = etaLoading && lastSuccessfulAt === null
    ? (lang === 'en' ? 'Loading ETA…' : '正在載入到站時間…')
    : freshness === 'slightly-old'
    ? (lang === 'en' ? `Updated ${ageLabel}` : `${ageLabel}更新`)
    : freshness === 'stale'
      ? (lang === 'en' ? `ETA may be outdated · Updated ${ageLabel}` : `到站時間可能已過時 · ${ageLabel}更新`)
      : freshness === 'very-stale'
        ? (lang === 'en'
          ? `ETA unavailable${ageLabel ? ` · Last updated ${ageLabel}` : ''}`
          : `暫未能提供到站時間${ageLabel ? ` · 最後更新於 ${ageLabel}` : ''}`)
        : freshness === 'unavailable'
          ? (lang === 'en' ? 'ETA unavailable' : '暫未能提供到站時間')
          : null;

  const initialLoading = etaLoading && lastSuccessfulAt === null;
  const showLater = !hidesLiveETA && !initialLoading && later.length > 0;
  const primaryClass = 'text-sm font-semibold';
  const renderNextArrival = () => {
    if (initialLoading) return <span className="text-sm text-[var(--muted)]">…</span>;
    if (hidesLiveETA) return <span className={clsx(primaryClass, 'text-[var(--muted)]')}>{lang === 'en' ? 'Unavailable' : '暫未能提供'}</span>;
    if (!nearest) return null;
    if (nearest.minutes < 0) return <span className={clsx(primaryClass, 'text-[var(--muted)]')}>{departed}</span>;

    const urgent = nearest.minutes <= 2 && freshness !== 'stale';
    const colour = freshness === 'stale' ? 'text-[var(--muted)]' : urgent ? 'text-[var(--eta-soon)]' : 'text-[var(--foreground)]';
    if (nearest.minutes === 0) return <span className={clsx(primaryClass, colour)}>{arrivingNow}</span>;

    return (
      <span className={clsx('text-xl leading-none font-bold break-words tabular-nums sm:text-2xl', colour)}>
        {nearest.minutes} {timeUnit}
      </span>
    );
  };

  return (
    <div className="nearby-columns grid min-h-14 items-center gap-x-3 py-2">
      {/* Route number */}
      <div className="min-w-0">
        {identityMode === 'link' ? <Link
          href={routeDetailHref}
          aria-label={routeDetailLabel}
          title={routeDetailLabel}
          className="inline-flex min-h-11 max-w-full items-center rounded-sm text-lg leading-tight font-bold tracking-tight break-all text-[var(--foreground)] underline decoration-[var(--input-border)] underline-offset-4 tabular-nums hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          {route}
        </Link> : <span className="block text-lg leading-tight font-bold tracking-tight break-all tabular-nums">{route}</span>}
      </div>

      {/* Destination with direction prefix */}
      <div className="min-w-0">
        {showBoardingSeq && <p className="text-xs text-[var(--muted)]">{lang === 'en' ? `Board at stop ${boardingSeq}` : `於第 ${boardingSeq} 站上車`}</p>}
        {first ? (
          <p className="text-sm leading-snug font-semibold break-words text-[var(--foreground)]">
            <span className="text-[var(--muted)] font-normal">{destPrefix}</span>
            {dest || '—'}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">{lang === 'en' ? 'No live arrivals' : '暫無班次資料'}</p>
        )}
        {variantLabel && <p className="mt-0.5 text-xs text-[var(--muted)]">{variantLabel}</p>}
        {!hidesLiveETA && !initialLoading && !nearest && nullEtaMessage && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{nullEtaMessage}</p>
        )}
        {!hidesLiveETA && !initialLoading && nearestRemark && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{nearestRemark}</p>
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
                    onClick={(event) => {
                      event.currentTarget.focus({ preventScroll: true });
                      onViewAlightingStop(stop);
                    }}
                    className="inline-flex min-h-8 items-center gap-1 rounded text-[var(--brand)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    aria-label={lang === 'en' ? `View ${name} on map` : `在地圖上查看${name}`}
                  >
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {name}
                  </button>
                ) : <span>{name}</span>}
              </Fragment>
            ))}
          </p>
        )}
        {freshnessNotice && (
          <p className={clsx(
            'mt-0.5 text-[11px] leading-snug',
            freshness === 'stale' || freshness === 'very-stale' || freshness === 'unavailable'
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-[var(--muted)]',
          )}>
            {freshnessNotice}
          </p>
        )}
        {isSpecial && (
          <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {lang === 'en' ? 'Special service' : '特別班'}
          </p>
        )}
      </div>

      {(nearest || initialLoading || hidesLiveETA) && (
        <div className="min-w-0 text-right">
          <span className="sr-only">{lang === 'en' ? 'First ETA: ' : '首筆預報：'}</span>
          {renderNextArrival()}
        </div>
      )}

      {showLater && (
        <div className="col-start-3 mt-1 flex min-w-0 flex-col gap-0.5 text-right text-xs leading-snug break-words text-[var(--muted)] tabular-nums md:col-start-4 md:mt-0">
          <span className="sr-only">{lang === 'en' ? 'Later ETAs: ' : '後續預報：'}</span>
          {later.map((prediction, index) => {
            const remark = etaDisplayText(lang === 'en' ? prediction.rmk_en : prediction.rmk_tc);
            const time = formatETAMinutes(prediction.minutes, lang);
            return <span key={index}>{time}{remark ? ` (${remark})` : ''}</span>;
          })}
        </div>
      )}
    </div>
  );
}
