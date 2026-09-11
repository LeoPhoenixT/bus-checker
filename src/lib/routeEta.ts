import type { ETAEntry, RouteVariant } from './types';

/** Keep only ETA records for the exact route variant and selected boarding stop. */
export function filterRouteVariantETAs(
  etas: ETAEntry[],
  variant: RouteVariant,
  stopId: string,
): ETAEntry[] {
  const normalizedStopId = stopId.trim().toUpperCase();
  return etas
    .filter((eta) => (
      typeof eta.route === 'string'
      && eta.route.trim().toUpperCase() === variant.route
      && eta.dir === variant.bound
      && String(eta.service_type).trim().toUpperCase() === variant.serviceType
      // KMB stop-ETA responses can contain records without a stop field.
      // Ignore malformed/non-stop records instead of crashing Route Detail.
      && typeof eta.stop === 'string'
      && eta.stop.trim().toUpperCase() === normalizedStopId
    ))
    .sort((a, b) => a.eta_seq - b.eta_seq);
}
