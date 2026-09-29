import type { ETAEntry, Lang } from './types';

/** Prefer the operator's local-language remark when ETA rows have no time. */
export function getNullETAMessage(etas: ETAEntry[], lang: Lang): string | null {
  let hasNullETA = false;
  for (const eta of etas) {
    if (eta.eta !== null) continue;
    hasNullETA = true;
    const remark = (lang === 'en' ? eta.rmk_en : eta.rmk_tc).trim();
    if (remark) return remark;
  }
  return hasNullETA ? (lang === 'en' ? 'No live prediction' : '暫無即時預報') : null;
}
