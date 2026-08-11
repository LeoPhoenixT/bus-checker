import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useGeolocation', () => {
  it('reads the location once on mount and again only when manually refreshed', () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useGeolocation());

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('keeps the last coordinates visible if a manual refresh fails', () => {
    const coords = { latitude: 22.3, longitude: 114.2 } as GeolocationCoordinates;
    const error = { code: 2, message: 'Position unavailable' } as GeolocationPositionError;
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((success: PositionCallback) => success({ coords } as GeolocationPosition))
      .mockImplementationOnce((_success: PositionCallback, failure: PositionErrorCallback) => failure(error));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.coords).toBe(coords);

    act(() => result.current.refresh());
    expect(result.current.coords).toBe(coords);
    expect(result.current.error).toBe(error);
  });
});
