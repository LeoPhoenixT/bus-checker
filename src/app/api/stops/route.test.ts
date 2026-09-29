import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchKmbStopsMock = vi.hoisted(() => vi.fn());
const getKmbRetryAfterSecondsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/kmbRoutes', () => ({
  fetchKmbStops: fetchKmbStopsMock,
  getKmbRetryAfterSeconds: getKmbRetryAfterSecondsMock,
  KmbRoutesError: class KmbRoutesError extends Error {},
}));

import { KmbRoutesError } from '@/lib/server/kmbRoutes';
import { GET } from './route';

afterEach(() => vi.resetAllMocks());

describe('GET /api/stops', () => {
  it('uses the same normalized stop snapshot as route details', async () => {
    const stop = { stop: 'STOP1', name_en: 'Stop', name_tc: '站', name_sc: '站', lat: 22.3, long: 114.1, data_timestamp: '' };
    fetchKmbStopsMock.mockResolvedValue([stop]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchKmbStopsMock).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ type: 'StopList', data: [stop] });
  });

  it('returns only a generic error and the remaining retry time', async () => {
    fetchKmbStopsMock.mockRejectedValue(new KmbRoutesError('KMB stop service returned HTTP 403'));
    getKmbRetryAfterSecondsMock.mockReturnValue(30);

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({ error: 'KMB stop data is temporarily unavailable' });
  });
});
