export function getMinutesUntil(etaIso: string): number {
  return Math.floor((new Date(etaIso).getTime() - Date.now()) / 60_000);
}
