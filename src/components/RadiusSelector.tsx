'use client';

import { ChevronDown, Locate } from 'lucide-react';
import { RADIUS_PRESETS } from '@/config';
import { useLang } from '@/contexts/LanguageContext';

interface RadiusSelectorProps {
  radius: number;
  onChangeRadius: (radius: number) => void;
}

export function RadiusSelector({ radius, onChangeRadius }: RadiusSelectorProps) {
  const { lang } = useLang();
  return (
    <div className="relative inline-flex shrink-0 items-center">
      <Locate className="pointer-events-none absolute left-3 size-4 text-[var(--muted)]" aria-hidden="true" />
      <select
        name="nearby-radius"
        aria-label={lang === 'en' ? 'Nearby search radius' : '附近搜尋範圍'}
        value={radius}
        onChange={(event) => onChangeRadius(Number(event.target.value))}
        className="min-h-11 appearance-none rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] pr-8 pl-9 text-base font-medium text-[var(--foreground)] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:text-sm"
      >
        {RADIUS_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-[var(--muted)]" aria-hidden="true" />
    </div>
  );
}
