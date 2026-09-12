import { afterEach, describe, expect, it, vi } from 'vitest';

const getKmbRouteDetailMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/kmbRoutes', () => ({
  KmbRoutesError: class KmbRoutesError extends Error {},
  KmbRouteStopsError: class KmbRouteStopsError extends Error {},
  getKmbRouteDetail: getKmbRouteDetailMock,
}));

import { GET } from './route';

function context(route: string) {
  return { params: Promise.resolve({ route }) };
}

afterEach(() => vi.clearAllMocks());

describe('GET /api/routes/[route]', () => {
  it('validates the exact route variant identity', async () => {
    const response = await GET(new Request('http://localhost/api/routes/87D?bound=O'), context('87D'));
    expect(response.status).toBe(400);
    expect(getKmbRouteDetailMock).not.toHaveBeenCalled();
  });

  it('loads the requested route, direction, and service type', async () => {
    getKmbRouteDetailMock.mockResolvedValue({ variant: { route: '87D' }, stops: [] });
    const response = await GET(new Request('http://localhost/api/routes/87d?bound=o&serviceType=3'), context('87d'));
    expect(response.status).toBe(200);
    expect(getKmbRouteDetailMock).toHaveBeenCalledWith('87D', 'O', '3');
  });

  it('keeps a missing variant distinct from a data-service failure', async () => {
    getKmbRouteDetailMock.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/routes/87D?bound=O&serviceType=1'), context('87D'));
    expect(response.status).toBe(404);
  });
});
