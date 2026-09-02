import type { DirectRouteMatch, DirectRouteMatchesByOriginStop, RouteStop } from './types';

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function variantKey(occurrence: RouteStop): string {
  return `${normalize(occurrence.route)}|${normalize(occurrence.bound)}|${normalize(occurrence.service_type)}`;
}

function normalizeIds(ids: string[]): string[] {
  return [...new Set(ids.map(normalize).filter(Boolean))].sort();
}

function isBetterMatch(candidate: DirectRouteMatch, current: DirectRouteMatch): boolean {
  if (candidate.alightingSeq !== current.alightingSeq) {
    return candidate.alightingSeq < current.alightingSeq;
  }
  if (candidate.boardingSeq !== current.boardingSeq) {
    return candidate.boardingSeq > current.boardingSeq;
  }
  return candidate.alightingStop < current.alightingStop;
}

export function matchDirectRoutes(
  routeStops: RouteStop[],
  originStopIds: string[],
  destinationStopIds: string[],
): DirectRouteMatchesByOriginStop {
  const origins = normalizeIds(originStopIds);
  const destinations = new Set(normalizeIds(destinationStopIds));
  const occurrencesByStop = new Map<string, RouteStop[]>();

  for (const occurrence of routeStops) {
    const stop = normalize(occurrence.stop);
    if (!stop) continue;
    const existing = occurrencesByStop.get(stop) ?? [];
    existing.push(occurrence);
    occurrencesByStop.set(stop, existing);
  }

  const destinationOccurrencesByVariant = new Map<string, RouteStop[]>();
  for (const destination of destinations) {
    for (const occurrence of occurrencesByStop.get(destination) ?? []) {
      const key = variantKey(occurrence);
      const existing = destinationOccurrencesByVariant.get(key) ?? [];
      existing.push(occurrence);
      destinationOccurrencesByVariant.set(key, existing);
    }
  }

  const result: DirectRouteMatchesByOriginStop = {};
  for (const origin of origins) {
    const bestByVariant = new Map<string, DirectRouteMatch>();

    for (const boarding of occurrencesByStop.get(origin) ?? []) {
      const key = variantKey(boarding);
      for (const alighting of destinationOccurrencesByVariant.get(key) ?? []) {
        if (boarding.seq >= alighting.seq) continue;
        if (normalize(boarding.stop) === normalize(alighting.stop)) continue;

        const candidate: DirectRouteMatch = {
          route: normalize(boarding.route),
          bound: normalize(boarding.bound) as 'I' | 'O',
          serviceType: normalize(boarding.service_type),
          boardingSeq: boarding.seq,
          alightingStop: normalize(alighting.stop),
          alightingSeq: alighting.seq,
        };
        const current = bestByVariant.get(key);
        if (!current || isBetterMatch(candidate, current)) bestByVariant.set(key, candidate);
      }
    }

    const matches = [...bestByVariant.values()].sort((a, b) =>
      a.route.localeCompare(b.route) ||
      a.bound.localeCompare(b.bound) ||
      a.serviceType.localeCompare(b.serviceType),
    );
    if (matches.length > 0) result[origin] = matches;
  }

  return result;
}
