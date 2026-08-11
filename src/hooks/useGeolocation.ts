'use client';
import { useCallback, useEffect, useState } from 'react';

interface GeoState {
  coords: GeolocationCoordinates | null;
  error: GeolocationPositionError | null;
  loading: boolean;
  supported: boolean;
}

interface UseGeolocationResult extends GeoState {
  refresh: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeoState>({
    coords: null,
    error: null,
    loading: true,
    supported: true,
  });

  const refresh = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coords: null, error: null, loading: false, supported: false });
      return;
    }

    setState((current) => ({ ...current, error: null, loading: true, supported: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({ coords: pos.coords, error: null, loading: false, supported: true }),
      (err) =>
        setState((current) => ({ ...current, error: err, loading: false, supported: true })),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
