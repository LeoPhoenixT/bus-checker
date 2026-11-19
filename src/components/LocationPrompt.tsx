'use client';
import Link from 'next/link';
import { MapPin, AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

interface LocationPromptProps {
  loading: boolean;
  error: GeolocationPositionError | null;
  supported: boolean;
  onRetry: () => void;
}

function errorMessage(error: GeolocationPositionError, lang: 'en' | 'tc'): string {
  if (lang === 'tc') {
    switch (error.code) {
      case 1: return '位置存取被拒絕。請在瀏覽器的網站設定中允許此網站存取位置，然後重新載入頁面。';
      case 2: return '無法確定您的目前位置。請檢查 GPS 或網絡連接。';
      case 3: return '定位請求逾時。';
      default: return '發生未知的位置錯誤。';
    }
  }
  switch (error.code) {
    case 1:
      return 'Location access was denied. Allow location access for this site in your browser’s site settings, then reload the page.';
    case 2:
      return 'Your current location could not be determined. Check your GPS or network connection.';
    case 3:
      return 'The location request timed out.';
    default:
      return 'An unknown location error occurred.';
  }
}

export function LocationPrompt({ loading, error, supported, onRetry }: LocationPromptProps) {
  const { lang } = useLang();
  const tc = lang === 'tc';

  if (!supported || error) {
    const Icon = supported ? AlertCircle : WifiOff;
    const retryable = supported && (error?.code === 2 || error?.code === 3);
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center sm:py-32">
        <Icon className={supported ? 'h-12 w-12 text-amber-500' : 'h-12 w-12 text-red-500'} />
        <p className="text-xl font-semibold text-[var(--foreground)]">{
          supported ? (tc ? '位置錯誤' : 'Location error') : (tc ? '不支援定位功能' : 'Geolocation not supported')
        }</p>
        <p className="max-w-xs text-sm text-[var(--muted)]">
          {error ? errorMessage(error, lang) : tc ? '您的瀏覽器無法提供目前位置。' : 'Your browser cannot provide your current location.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {retryable && (
            <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">
              {tc ? '重試定位' : 'Retry location'}
            </button>
          )}
          <Link href="/routes" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-border)] focus-visible:ring-2 focus-visible:ring-blue-500">
            {tc ? '搜尋路線' : 'Search routes'}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-xl font-semibold text-[var(--foreground)]">{tc ? '正在偵測您的位置…' : 'Detecting your location…'}</p>
        <p className="text-sm text-[var(--muted)]">
          {tc ? '當瀏覽器提示時，請允許存取位置。' : 'Please allow location access when prompted by your browser.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <MapPin className="h-12 w-12 text-blue-500" />
      <p className="text-xl font-semibold text-[var(--foreground)]">{tc ? '正在尋找附近巴士站…' : 'Finding nearby stops…'}</p>
    </div>
  );
}
