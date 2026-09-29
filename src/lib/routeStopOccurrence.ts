import type { RouteStopOccurrence } from './types';

export function routeStopOccurrenceKey(stop: RouteStopOccurrence): string {
  return `${stop.stopId.trim().toUpperCase()}|${stop.seq}`;
}
