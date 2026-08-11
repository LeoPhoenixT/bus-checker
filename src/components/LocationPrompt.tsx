'use client';
import { MapPin, AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

interface LocationPromptProps {
  loading: boolean;
  error: GeolocationPositionError | null;
  supported: boolean;
}

function errorMessage(error: GeolocationPositionError, lang: 'en' | 'tc'): string {
  if (lang === 'tc') {
    switch (error.code) {
      case 1: return '位置存取被拒絕。請在瀏覽器設定中啟用位置權限並重新載入。';
      case 2: return '無法確定您的目前位置。請檢查 GPS 或網絡連接。';
      case 3: return '位置請求逾時。請重新載入並再試一次。';
      default: return '發生未知的位置錯誤。';
    }
  }
  switch (error.code) {
    case 1:
      return 'Location access was denied. Please enable location permission in your browser settings and reload.';
    case 2:
      return 'Your current location could not be determined. Check your GPS or network connection.';
    case 3:
      return 'Location request timed out. Please reload and try again.';
    default:
      return 'An unknown location error occurred.';
  }
}

export function LocationPrompt({ loading, error, supported }: LocationPromptProps) {
  const { lang } = useLang();
  const tc = lang === 'tc';

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <WifiOff className="h-12 w-12 text-red-500" />
        <p className="text-xl font-semibold text-[var(--foreground)]">{tc ? '不支援定位功能' : 'Geolocation not supported'}</p>
        <p className="max-w-xs text-sm text-[var(--muted)]">
          {tc ? '您的瀏覽器不支援 GPS。請嘗試在流動設備上使用現代瀏覽器。' : 'Your browser does not support GPS. Try using a modern browser on a mobile device.'}
        </p>
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <p className="text-xl font-semibold text-[var(--foreground)]">{tc ? '位置錯誤' : 'Location error'}</p>
        <p className="max-w-xs text-sm text-[var(--muted)]">{errorMessage(error, lang)}</p>
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
