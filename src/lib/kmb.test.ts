import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFavouriteRouteStopMetadata } from './kmb';
import type { FavouriteRouteStop } from './types';

afterEach(() => vi.restoreAllMocks());

const favourites: FavouriteRouteStop[] = Array.from({ length: 101 }, (_, index) => ({
  route: String(index + 1), bound: 'O', serviceType: '1', stopId: `STOP${index}`,
}));

describe('fetchFavouriteRouteStopMetadata', () => {
  it('sends 101 favourites in API-sized batches and preserves all ordered results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { items } = JSON.parse(String(init?.body)) as { items: FavouriteRouteStop[] };
      expect(items.length).toBeLessThanOrEqual(100);
      return new Response(JSON.stringify({ items: items.map((favourite) => ({ favourite, status: 'missing' })) }));
    });
    const result = await fetchFavouriteRouteStopMetadata(favourites);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.favourite)).toEqual(favourites);
  });

  it('stops after an aborted batch instead of submitting the remaining favourites', async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { items } = JSON.parse(String(init?.body)) as { items: FavouriteRouteStop[] };
      controller.abort();
      return new Response(JSON.stringify({ items: items.map((favourite) => ({ favourite, status: 'missing' })) }));
    });
    await expect(fetchFavouriteRouteStopMetadata(favourites, { signal: controller.signal })).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects a failed later batch without returning incomplete metadata', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: favourites.slice(0, 100).map((favourite) => ({ favourite, status: 'missing' })) })))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(fetchFavouriteRouteStopMetadata(favourites)).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
