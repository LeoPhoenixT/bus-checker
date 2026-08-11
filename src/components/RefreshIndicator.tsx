'use client';
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_CONFIG } from '@/config';
import { useLang } from '@/contexts/LanguageContext';
import clsx from 'clsx';

const INTERVAL_S = APP_CONFIG.REFRESH_INTERVAL_MS / 1_000;

interface RefreshIndicatorProps {
  lastRefreshed: Date | null;
  loading: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function RefreshIndicator({ lastRefreshed, loading, onRefresh }: RefreshIndicatorProps) {
  const { lang } = useLang();
  const [secondsAgo, setSecondsAgo] = useState(0);

  const handleRefresh = async () => {
    if (loading || !onRefresh) return;
    await onRefresh();
  };

  useEffect(() => {
    if (!lastRefreshed) return;
    setSecondsAgo(0);
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const progress = Math.min((secondsAgo / INTERVAL_S) * 100, 100);
  const remaining = Math.max(INTERVAL_S - secondsAgo, 0);

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 py-2 text-xs shadow-2xl backdrop-blur-md transition-opacity disabled:opacity-60 disabled:cursor-not-allowed hover:border-blue-500/50 hover:bg-blue-500/5"
      aria-label={lang === 'en' ? 'Refresh bus data' : '刷新巴士資料'}
    >
      <RefreshCw
        className={clsx('h-3 w-3', loading ? 'animate-spin text-blue-500' : 'text-[var(--muted)]')}
      />
      <span className="text-[var(--foreground)] hidden sm:inline">{lang === 'en' ? `Updated ${timeStr}` : `已更新 ${timeStr}`}</span>
      <span className="text-[var(--foreground)] sm:hidden">{timeStr}</span>
      <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-[var(--divider)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="w-5 text-right tabular-nums text-[var(--muted)]">{remaining}s</span>
    </button>
  );
}
