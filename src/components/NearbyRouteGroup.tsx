'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { groupIdenticalForecasts, nearbyVariantKey, type NearbyRouteContainer } from '@/lib/nearbyRoutePresentation';
import { etaDisplayText } from '@/lib/etaPresentation';
import { ETARow } from './ETARow';

type NearbyRouteGroupProps = {
  container: NearbyRouteContainer;
} & Pick<ComponentProps<typeof ETARow>, 'freshness' | 'lastSuccessfulAt' | 'etaLoading' | 'showBoardingSeq'>;

export function NearbyRouteGroup({ container, ...etaState }: NearbyRouteGroupProps) {
  const { lang } = useLang();
  const first = container.variants[0];
  if (container.variants.length === 1) return <ETARow {...first} {...etaState} />;

  const firstETA = first.etas[0];
  const destination = (lang === 'en' ? etaDisplayText(firstETA.dest_en) || etaDisplayText(firstETA.dest_tc) : etaDisplayText(firstETA.dest_tc) || etaDisplayText(firstETA.dest_en)) || etaDisplayText(firstETA.dest_sc);
  const canSharePredictions = etaState.freshness !== 'very-stale' && etaState.freshness !== 'unavailable'
    && !(etaState.etaLoading && etaState.lastSuccessfulAt == null);
  const forecasts = canSharePredictions
    ? groupIdenticalForecasts(container.variants, Date.now())
    : container.variants.map((variant) => [variant]);
  const forecastLabel = (variants: typeof container.variants) => lang === 'en'
    ? `Type ${variants.map((variant) => variant.serviceType).join(', ')}${variants.length > 1 ? ' · Shared prediction' : ''}`
    : `類型 ${variants.map((variant) => variant.serviceType).join('、')}${variants.length > 1 ? ' · 共用預報' : ''}`;
  return (
    <div className="pb-2.5" role="group" aria-label={lang === 'en' ? `${first.route} to ${destination} route variants` : `${first.route} 往 ${destination}路線版本`}>
      <div>
        {forecasts.map((variants) => (
          <ETARow key={variants.map(nearbyVariantKey).join('|')} {...variants[0]} {...etaState} identityMode="label" isSpecial={false} variantLabel={forecasts.length > 1 ? forecastLabel(variants) : undefined} />
        ))}
      </div>
      <details className="ml-[4.75rem]">
        <summary className="cursor-pointer rounded text-xs font-semibold text-blue-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300">
          {lang === 'en' ? `${container.variants.length} route variants · View details` : `${container.variants.length} 個路線版本 · 查看詳情`}
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {container.variants.map((variant) => {
            const params = new URLSearchParams({ bound: variant.bound, serviceType: variant.serviceType, stop: variant.boardingStopId, seq: String(variant.boardingSeq) });
            const label = lang === 'en' ? `Type ${variant.serviceType} · Stop ${variant.boardingSeq}` : `類型 ${variant.serviceType} · 第 ${variant.boardingSeq} 站`;
            return (
              <Link key={nearbyVariantKey(variant)} href={`/routes/${encodeURIComponent(variant.route)}?${params}`} aria-label={lang === 'en' ? `View ${variant.route} ${label} route details` : `查看${variant.route}${label}路線詳情`} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--divider)] px-3 py-2 text-xs text-[var(--foreground)] hover:bg-blue-500/10 focus-visible:ring-2 focus-visible:ring-blue-500">
                {label}
              </Link>
            );
          })}
        </div>
        {forecasts.length === 1 && forecasts[0].length > 1 && (
          <p className="mt-2 text-xs text-[var(--muted)]">{forecastLabel(forecasts[0])}</p>
        )}
      </details>
    </div>
  );
}
