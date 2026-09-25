import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllStops } from './kmb';
import type { Stop } from './types';

vi.mock('./kmb', () => ({ fetchAllStops: vi.fn() }));

const stop = (id: string): Stop => ({ stop: id, name_en: id, name_tc: id, name_sc: id, lat: 22, long: 114, data_timestamp: '' });

let getCachedStops: typeof import('./clientStops').getCachedStops;
beforeEach(async () => {
  vi.resetModules();
  ({ getCachedStops } = await import('./clientStops'));
});
afterEach(() => vi.clearAllMocks());

describe('getCachedStops', () => {
  it('keeps KMB platforms with identical coordinates as distinct source records', async () => {
    const platformA = stop('PLATFORM_A');
    const platformB = stop('PLATFORM_B');
    vi.mocked(fetchAllStops).mockResolvedValueOnce({ type: 'Stop', version: '1', generated_timestamp: '', data: [platformA, platformB] });
    await expect(getCachedStops()).resolves.toEqual([platformA, platformB]);
  });

  it('refreshes at 05:10 HKT while sharing concurrent requests within each service day', async () => {
    vi.mocked(fetchAllStops)
      .mockResolvedValueOnce({ type: 'Stop', version: '1', generated_timestamp: '', data: [stop('OLD')] })
      .mockResolvedValueOnce({ type: 'Stop', version: '1', generated_timestamp: '', data: [stop('NEW')] });
    const oldTime = new Date('2026-08-04T21:09:59.999Z');
    const newTime = new Date('2026-08-04T21:10:00.000Z');
    const [oldA, oldB] = await Promise.all([getCachedStops(oldTime), getCachedStops(oldTime)]);
    expect(oldB).toBe(oldA);
    expect(await getCachedStops(newTime)).toEqual([stop('NEW')]);
    expect(fetchAllStops).toHaveBeenCalledTimes(2);
  });

  it('does not let a late old-day request replace a new-day snapshot', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const old = new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; });
    vi.mocked(fetchAllStops).mockReturnValueOnce(old).mockResolvedValueOnce(response('NEW'));
    const oldRequest = getCachedStops(new Date('2026-08-04T21:09:59.999Z'));
    const newRequest = getCachedStops(new Date('2026-08-04T21:10:00.000Z'));
    expect(await newRequest).toEqual([stop('NEW')]);
    resolveOld(response('OLD'));
    await oldRequest;
    expect(await getCachedStops(new Date('2026-08-04T22:00:00.000Z'))).toEqual([stop('NEW')]);
    expect(fetchAllStops).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed refresh on the same service day', async () => {
    vi.mocked(fetchAllStops).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('RECOVERED'));
    const now = new Date('2026-08-04T21:10:00.000Z');
    await expect(getCachedStops(now)).rejects.toThrow('offline');
    await expect(getCachedStops(now)).resolves.toEqual([stop('RECOVERED')]);
    expect(fetchAllStops).toHaveBeenCalledTimes(2);
  });
});

function response(id: string) {
  return { type: 'Stop', version: '1', generated_timestamp: '', data: [stop(id)] };
}
