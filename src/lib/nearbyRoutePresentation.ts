import type { ETAEntry } from './types';
import { etaDisplayText } from './etaPresentation';

export interface NearbyRouteVariant {
  route: string;
  bound: 'I' | 'O';
  serviceType: string;
  boardingStopId: string;
  boardingSeq: number;
  isSpecial: boolean;
  etas: ETAEntry[];
  alightingStopIds: string[];
}

export interface NearbyRouteContainer {
  key: string;
  variants: NearbyRouteVariant[];
}

export function nearbyVariantKey(variant: NearbyRouteVariant): string {
  return JSON.stringify([variant.route, variant.bound, variant.serviceType, variant.boardingStopId, variant.boardingSeq]);
}

function routeAtStopKey(variant: NearbyRouteVariant): string {
  return JSON.stringify([variant.boardingStopId, variant.route, variant.bound]);
}

function destinationKey(eta: ETAEntry): string {
  return JSON.stringify([etaDisplayText(eta.dest_en), etaDisplayText(eta.dest_tc), etaDisplayText(eta.dest_sc)]);
}

function hasValidDisplayFields(eta: ETAEntry): boolean {
  return [eta.dest_en, eta.dest_tc, eta.dest_sc, eta.rmk_en, eta.rmk_tc, eta.rmk_sc]
    .every((value) => value === undefined || typeof value === 'string');
}

/** Stable display identity; ETA values never determine the route container key. */
export function groupNearbyRouteVariants(variants: NearbyRouteVariant[]): NearbyRouteContainer[] {
  const occurrences = new Map<string, Map<string, number>>();
  for (const variant of variants) {
    const key = routeAtStopKey(variant);
    const services = occurrences.get(key) ?? new Map<string, number>();
    services.set(variant.serviceType, (services.get(variant.serviceType) ?? 0) + 1);
    occurrences.set(key, services);
  }

  const containers = new Map<string, NearbyRouteContainer>();
  for (const variant of variants) {
    const first = variant.etas[0];
    const repeatedStop = [...occurrences.get(routeAtStopKey(variant))!.values()].some((count) => count > 1);
    const destination = first ? destinationKey(first) : null;
    const knownDestination = first && (etaDisplayText(first.dest_en) || etaDisplayText(first.dest_tc) || etaDisplayText(first.dest_sc));
    const consistentIdentity = first && knownDestination && etaDisplayText(first.co) && variant.etas.every((eta) => (
      hasValidDisplayFields(eta) && destinationKey(eta) === destination && eta.co === first.co
    ));
    // Sequence numbers belong to each service type. Multiple occurrences within
    // one type are ambiguous, so keep the entire route at that stop separate.
    const key = !repeatedStop && consistentIdentity
      ? JSON.stringify(['route', routeAtStopKey(variant), first.co, destination])
      : JSON.stringify(['variant', nearbyVariantKey(variant)]);
    const container = containers.get(key) ?? { key, variants: [] };
    container.variants.push(variant);
    containers.set(key, container);
  }
  return [...containers.values()].map((container) => ({
    ...container,
    variants: [...container.variants].sort((a, b) => a.serviceType.localeCompare(b.serviceType, 'en', { numeric: true })),
  }));
}

function forecastSignature(etas: ETAEntry[], nowMs: number): string | null {
  let hasCurrentPrediction = false;
  const records = [...etas].sort((a, b) => a.eta_seq - b.eta_seq).map((eta) => {
    if (!hasValidDisplayFields(eta)) return null;
    const timestamp = eta.eta === null ? null : Date.parse(eta.eta);
    if (timestamp !== null && !Number.isFinite(timestamp)) return null;
    if (timestamp !== null && timestamp >= nowMs - 60_000) hasCurrentPrediction = true;
    return [timestamp, etaDisplayText(eta.rmk_en), etaDisplayText(eta.rmk_tc), etaDisplayText(eta.rmk_sc), destinationKey(eta), eta.co];
  });
  if (!hasCurrentPrediction || records.some((record) => record === null)) return null;
  // Preserve every record and its multiplicity, including null-time notices.
  // Service type, boarding sequence and refresh timestamps remain source metadata.
  return JSON.stringify(records);
}

/** Share only an identical full prediction list inside an already scoped container. */
export function groupIdenticalForecasts(variants: NearbyRouteVariant[], nowMs: number): NearbyRouteVariant[][] {
  const groups = new Map<string, NearbyRouteVariant[]>();
  for (const variant of variants) {
    const signature = forecastSignature(variant.etas, nowMs);
    const key = JSON.stringify(signature === null ? ['variant', nearbyVariantKey(variant)] : ['forecast', signature]);
    const group = groups.get(key) ?? [];
    group.push(variant);
    groups.set(key, group);
  }
  return [...groups.values()];
}
