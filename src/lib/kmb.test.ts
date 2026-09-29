import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFavouriteRouteStopMetadata, fetchRouteDetail, RouteDetailRequestError } from './kmb';
import type { FavouriteRouteStop } from './types';

afterEach(() => vi.restoreAllMocks());

const favourites: FavouriteRouteStop[] = Array.from({ length: 101 }, (_, index) => ({
  route: String(index + 1), bound: 'O', serviceType: '1', stopId: `STOP${index}`,
}));

describe('fetchFavouriteRouteStopMetadata', () => {
  it('keeps sequence-specific favourites in order across 100-item batches', async () => {
    const items = favourites.map((favourite, index) => ({ ...favourite, boardingSeq: index + 1 }));
    const sizes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      const body = JSON.parse(String(options?.body)) as { items: FavouriteRouteStop[] };
      sizes.push(body.items.length);
      return Response.json({ items: body.items.map((favourite) => ({ favourite, status: 'missing' })) });
    });
    expect((await fetchFavouriteRouteStopMetadata(items)).map((item) => item.favourite)).toEqual(items);
    expect(sizes).toEqual([100, 1]);
  });

  it('rejects incomplete metadata batches instead of silently dropping favourites', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ items: [] }));
    await expect(fetchFavouriteRouteStopMetadata([favourites[0]])).rejects.toThrow('Invalid favourites metadata response');
  });
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

describe('fetchRouteDetail', () => {
  it('keeps status and Retry-After for client handling without using response error text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Internal upstream detail' }),
      { status: 503, headers: { 'Retry-After': '42' } },
    ));
    await expect(fetchRouteDetail('87D', 'I', '1')).rejects.toMatchObject({
      name: 'RouteDetailRequestError', status: 503, retryAfterSeconds: 42,
    } satisfies Partial<RouteDetailRequestError>);
    expect(fetchMock).toHaveBeenCalledWith('/api/routes/87D?bound=I&serviceType=1', { signal: undefined });
  });

  it('ignores a malformed Retry-After header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503, headers: { 'Retry-After': 'later' } }));
    await expect(fetchRouteDetail('87D', 'I', '1')).rejects.toMatchObject({ retryAfterSeconds: null });
  });
});
