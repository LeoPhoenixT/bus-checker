'use client';
import { useState, useEffect, useRef } from 'react';
import { getCachedStops } from '@/lib/clientStops';
import { filterNearby } from '@/lib/geo';
import type { NearbyStop } from '@/lib/types';

export function useNearbyStops(
  lat: number | null,
  lon: number | null,
  radiusM: number = 100,
  destinationLat?: number | null,
  destinationLon?: number | null,
  destinationRadiusM?: number,
): { stops: NearbyStop[]; destinationStops: NearbyStop[]; loading: boolean; error: string | null } {
  const [stops, setStops] = useState<NearbyStop[]>([]);
  const [destinationStops, setDestinationStops] = useState<NearbyStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coordsRef = useRef({ lat, lon });
  coordsRef.current = { lat, lon };

  useEffect(() => {
    if (lat == null || lon == null) return;
    setLoading(true);
    setError(null);

    getCachedStops()
      .then((allStops) => {
        // Use the latest coords in case position updated while fetching
        const { lat: curLat, lon: curLon } = coordsRef.current;
        if (curLat != null && curLon != null) {
          setStops(filterNearby(allStops, curLat, curLon, radiusM));
        }
        // Also filter stops near destination if provided
        if (destinationLat != null && destinationLon != null) {
          setDestinationStops(
            filterNearby(allStops, destinationLat, destinationLon, destinationRadiusM ?? 500),
          );
        } else {
          setDestinationStops([]);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load stops'),
      )
      .finally(() => setLoading(false));
  // Only re-run when coordinates meaningfully change (rounded to 5 dp ≈ 1 m precision)
  // Also re-run when radius or destination changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lat != null ? Math.round(lat * 1e4) : null,
    lon != null ? Math.round(lon * 1e4) : null,
    radiusM,
    destinationLat != null ? Math.round(destinationLat * 1e4) : null,
    destinationLon != null ? Math.round(destinationLon * 1e4) : null,
    destinationRadiusM,
  ]);

  return { stops, destinationStops, loading, error };
}
