import { afterEach, describe, expect, it, vi } from 'vitest';

const getKmbFavouriteRouteStopMetadataMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/kmbRoutes', () => ({
  KmbRoutesError: class KmbRoutesError extends Error {},
  KmbRouteStopsError: class KmbRouteStopsError extends Error {},
  getKmbFavouriteRouteStopMetadata: getKmbFavouriteRouteStopMetadataMock,
}));

import { POST } from './route';
import { fetchFavouriteRouteStopMetadata } from '@/lib/kmb';
import type { FavouriteRouteStop } from '@/lib/types';

afterEach(() => vi.clearAllMocks());

describe('POST /api/favourite-route-stops', () => {
  it('accepts only exact normalized route-stop identities', async () => {
    getKmbFavouriteRouteStopMetadataMock.mockResolvedValue([]);
    const response = await POST(new Request('http://localhost/api/favourite-route-stops', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ route: ' 87d ', bound: 'o', serviceType: '03', stopId: ' stop1 ' }] }),
    }));
    expect(response.status).toBe(200);
    expect(getKmbFavouriteRouteStopMetadataMock).toHaveBeenCalledWith([
      { route: '87D', bound: 'O', serviceType: '3', stopId: 'STOP1' },
    ]);
  });

  it('rejects the old route-only shape instead of guessing a stop', async () => {
    const response = await POST(new Request('http://localhost/api/favourite-route-stops', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ route: '87D' }] }),
    }));
    expect(response.status).toBe(400);
    expect(getKmbFavouriteRouteStopMetadataMock).not.toHaveBeenCalled();
  });

  it('resolves 101 stored favourites through the client and actual API limit', async () => {
    const favourites: FavouriteRouteStop[] = Array.from({ length: 101 }, (_, index) => ({
      route: '87D', bound: 'O', serviceType: '1', stopId: `STOP${String(index).padStart(4, '0')}`,
    }));
    getKmbFavouriteRouteStopMetadataMock.mockImplementation(async (items: FavouriteRouteStop[]) => (
      items.map((favourite) => ({ favourite, status: 'missing' }))
    ));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => POST(new Request('http://localhost/api/favourite-route-stops', init)));

    const metadata = await fetchFavouriteRouteStopMetadata(favourites);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getKmbFavouriteRouteStopMetadataMock).toHaveBeenCalledTimes(2);
    expect(metadata.map((item) => item.favourite)).toEqual(favourites);
    fetchMock.mockRestore();
  });
});
