import { getDistance } from 'geolib';
import { APP_CONFIG } from '@/config';
import type { Stop, NearbyStop } from './types';

export function filterNearby(
  stops: Stop[],
  lat: number,
  lon: number,
  radiusM: number = APP_CONFIG.DEFAULT_SEARCH_RADIUS_M,
): NearbyStop[] {
  const result: NearbyStop[] = [];
  for (const stop of stops) {
    const dist = getDistance(
      { latitude: lat, longitude: lon },
      { latitude: Number(stop.lat), longitude: Number(stop.long) },
    );
    if (dist <= radiusM) {
      result.push({ ...stop, distanceM: dist });
    }
  }
  return result.sort((a, b) => a.distanceM - b.distanceM);
}
