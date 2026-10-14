import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { CitybusError } from '@/lib/server/citybus';

const getETA = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/citybusEta', () => ({ getCitybusRouteETA: getETA }));
afterEach(() => getETA.mockReset());
const context = { params: Promise.resolve({ route: '1' }) };

describe('Citybus route ETA API', () => {
  it('accepts zero-padded stop IDs and disables HTTP caching', async () => {
    getETA.mockResolvedValue({ generated_timestamp: '', data: [] });
    const response = await GET(new Request('http://localhost/api/citybus/routes/1/eta?stop=000001&bound=O&seq=3'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getETA).toHaveBeenCalledWith('1', 'O', '000001', 3);
  });
  it.each(['stop=1&bound=O&seq=1', 'stop=000001&bound=X&seq=1', 'stop=000001&bound=O&seq=0', 'stop=000001&bound=O&seq=1.5'])('rejects invalid boarding point %s', async (query) => {
    const response = await GET(new Request(`http://localhost/api/citybus/routes/1/eta?${query}`), context);
    expect(response.status).toBe(400);
    expect(getETA).not.toHaveBeenCalled();
  });
  it('distinguishes membership failure from upstream failure and propagates backoff', async () => {
    const request = new Request('http://localhost/api/citybus/routes/1/eta?stop=000001&bound=O&seq=3');
    getETA.mockRejectedValueOnce(new CitybusError('not a member', 404));
    expect((await GET(request, context)).status).toBe(404);
    getETA.mockRejectedValueOnce(new CitybusError('unavailable', 503, 60));
    const response = await GET(request, context);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
