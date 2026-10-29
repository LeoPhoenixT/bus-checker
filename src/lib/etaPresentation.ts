import { getMinutesUntil } from './etaTime';
import type { ETAEntry, Lang } from './types';

export function etaDisplayText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Prefer the operator's local-language remark when ETA rows have no time. */
export function getNullETAMessage(etas: Pick<ETAEntry, 'eta' | 'rmk_en' | 'rmk_tc'>[], lang: Lang): string | null {
  let hasNullETA = false;
  for (const eta of etas) {
    if (eta.eta !== null) continue;
    hasNullETA = true;
    const remark = etaDisplayText(lang === 'en' ? eta.rmk_en : eta.rmk_tc);
    if (remark) return remark;
  }
  return hasNullETA ? (lang === 'en' ? 'No live prediction' : '暫無即時預報') : null;
}

/** Keep individual operator predictions, including separate buses in the same minute. */
export function getETAPredictions<T extends Pick<ETAEntry, 'eta' | 'eta_seq'>>(etas: T[]) {
  return [...etas].sort((a, b) => a.eta_seq - b.eta_seq)
    .filter((eta): eta is T & { eta: string } => eta.eta !== null)
    .map((eta) => ({ eta, minutes: getMinutesUntil(eta.eta) }))
    .filter(({ minutes }) => minutes >= -1);
}

export function formatETAMinutes(minutes: number, lang: Lang): string {
  if (minutes < 0) return lang === 'en' ? 'Departed' : '已離站';
  if (minutes === 0) return lang === 'en' ? 'Arriving' : '即將到達';
  return `${minutes} ${lang === 'en' ? 'min' : '分'}`;
}
