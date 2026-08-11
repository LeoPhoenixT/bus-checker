import type { DestinationSelection, Stop } from './types';

export function getDestinationCandidates(
  selection: DestinationSelection | null,
  radiusStops: Stop[],
): Stop[] {
  return selection?.kind === 'stop' ? [selection.stop] : radiusStops;
}

export function getDestinationPoint(
  selection: DestinationSelection | null,
): { lat: number; lon: number } | null {
  if (!selection) return null;
  return selection.kind === 'stop'
    ? { lat: Number(selection.stop.lat), lon: Number(selection.stop.long) }
    : { lat: selection.lat, lon: selection.lon };
}
