import type { ETAEntry, FavouriteRouteStop, RouteVariantId } from './types';

/** Keep only ETA records for the exact route variant and selected boarding stop. */
export function filterRouteVariantETAs(
  etas: ETAEntry[],
  variant: RouteVariantId,
  stopId: string,
  boardingSeq: number,
): ETAEntry[] {
  if (!Number.isSafeInteger(boardingSeq) || boardingSeq <= 0) return [];
  const normalizedStopId = stopId.trim().toUpperCase();
  return etas
    .filter((eta) => (
      eta != null && typeof eta.route === 'string'
      && eta.route.trim().toUpperCase() === variant.route
      && eta.dir === variant.bound
      && String(eta.service_type).trim().toUpperCase() === variant.serviceType
      // KMB stop-ETA responses can contain records without a stop field.
      // Ignore malformed/non-stop records instead of crashing Route Detail.
      && typeof eta.stop === 'string'
      && eta.stop.trim().toUpperCase() === normalizedStopId
      && eta.seq === boardingSeq
    ))
    .sort((a, b) => a.eta_seq - b.eta_seq);
}

/** Keep ETA for a saved exact boarding point without relying on display metadata. */
export function filterFavouriteRouteStopETAs(etas: ETAEntry[], favourite: FavouriteRouteStop, resolvedSeq = favourite.boardingSeq): ETAEntry[] {
  if (resolvedSeq === undefined) return [];
  return filterRouteVariantETAs(etas, favourite, favourite.stopId, resolvedSeq);
}
