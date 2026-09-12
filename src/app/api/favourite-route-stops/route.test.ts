import { afterEach, describe, expect, it, vi } from 'vitest';

const getKmbFavouriteRouteStopMetadataMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/kmbRoutes', () => ({
  KmbRoutesError: class KmbRoutesError extends Error {},
  KmbRouteStopsError: class KmbRouteStopsError extends Error {},
  getKmbFavouriteRouteStopMetadata: getKmbFavouriteRouteStopMetadataMock,
}));

import { POST } from './route';

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
});
