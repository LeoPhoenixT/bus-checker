'use client';
import { useState, useEffect, useId } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { getETAFreshness } from '@/lib/etaFreshness';
import clsx from 'clsx';

interface RefreshIndicatorProps {
  lastRefreshed: Date | null;
  lastAttemptAt?: Date | null;
  failedStopCount?: number;
  loading: boolean;
  inline?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function RefreshIndicator({
  lastRefreshed,
  lastAttemptAt = null,
  failedStopCount = 0,
  loading,
  inline = false,
  onRefresh,
}: RefreshIndicatorProps) {
  const { lang } = useLang();
  const statusId = useId();
  const [now, setNow] = useState(() => Date.now());

  const handleRefresh = async () => {
    if (loading || !onRefresh) return;
    await onRefresh();
  };

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [lastRefreshed, lastAttemptAt]);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((now - lastRefreshed.getTime()) / 1_000)) : null;
  const updatedAge = secondsAgo === null
    ? null
    : secondsAgo >= 60
      ? (lang === 'en' ? `${Math.floor(secondsAgo / 60)}m ago` : `${Math.floor(secondsAgo / 60)} 分鐘前`)
      : (lang === 'en' ? `${secondsAgo}s ago` : `${secondsAgo} 秒前`);
  const isPartialFailure = failedStopCount > 0 && lastRefreshed !== null;
  const isUnavailable = failedStopCount > 0 && lastRefreshed === null;
  const freshness = getETAFreshness(lastRefreshed, now);
  const isOld = freshness === 'stale' || freshness === 'very-stale';
  const statusText = isUnavailable
    ? (lang === 'en' ? 'Unable to update · Retry' : '暫未能更新 · 重試')
    : isPartialFailure && isOld
      ? (lang === 'en' ? `Some ETA data could not be refreshed · Retry` : '部分到站時間未能更新 · 重試')
      : isOld
        ? (lang === 'en' ? `ETA may be outdated · Updated ${updatedAge}` : `到站時間可能已過時 · ${updatedAge}更新`)
        : (lang === 'en'
          ? `Updated ${updatedAge ?? '—'}${isPartialFailure ? ' · Retry' : ''}`
          : `${updatedAge ? `${updatedAge}更新` : '尚未更新'}${isPartialFailure ? ' · 重試' : ''}`);

  // One transient failed refresh should not turn a recently updated UI amber.
  const statusIsWarning = isUnavailable || isOld;

  const statusColour = statusIsWarning ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--muted)]';

  if (inline) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs">
        <span id={statusId} className={statusColour}>{statusText}</span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          aria-describedby={statusId}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={clsx('size-4', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
          {lang === 'en' ? 'Refresh ETA' : '更新到站時間'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      type="button"
      className={clsx(
        'flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60',
        'fixed right-4 bottom-20 z-30 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 shadow-lg sm:bottom-4',
      )}
      aria-label={lang === 'en' ? 'Refresh bus data' : '刷新巴士資料'}
    >
      <RefreshCw
        aria-hidden="true"
        className={clsx('h-3 w-3', loading ? 'text-[var(--brand)] motion-safe:animate-spin' : 'text-[var(--muted)]')}
      />
      <span className={clsx(
        'hidden sm:inline',
        statusIsWarning ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--foreground)]',
      )}>{statusText}</span>
      <span className={clsx(
        'sm:hidden',
        statusIsWarning ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--foreground)]',
      )}>{statusIsWarning ? '⚠' : updatedAge ?? '—'}</span>
    </button>
  );
}
