import { afterEach, describe, expect, it, vi } from 'vitest';

const searchKmbRouteVariantsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/kmbRoutes', () => ({
  KmbRoutesError: class KmbRoutesError extends Error {},
  searchKmbRouteVariants: searchKmbRouteVariantsMock,
}));

import { GET } from './route';

afterEach(() => vi.clearAllMocks());

describe('GET /api/routes', () => {
  it('normalizes valid route queries before searching', async () => {
    searchKmbRouteVariantsMock.mockResolvedValue([{ route: '87D' }]);
    const response = await GET(new Request('http://localhost/api/routes?q=%2087%20d%20'));
    expect(response.status).toBe(200);
    expect(searchKmbRouteVariantsMock).toHaveBeenCalledWith('87D', 50);
    await expect(response.json()).resolves.toEqual({ routes: [{ route: '87D' }] });
  });

  it('rejects arbitrary query text', async () => {
    const response = await GET(new Request('http://localhost/api/routes?q=87D%2F..'));
    expect(response.status).toBe(400);
    expect(searchKmbRouteVariantsMock).not.toHaveBeenCalled();
  });
});
