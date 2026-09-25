import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

function context(stopId: string) {
  return { params: Promise.resolve({ stopId }) };
}

afterEach(() => vi.restoreAllMocks());

describe('GET /api/stop-eta/[stopId]', () => {
  it('restores the endpoint stop ID only when a valid KMB ETA row omits it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      type: 'ETA',
      data: [
        { route: '87D', dir: 'O', service_type: '1', eta_seq: 1, eta: '2026-09-11T16:35:00+08:00' },
        { route: '87D', dir: 'O', service_type: '1', stop: 'OTHER_STOP', eta_seq: 2, eta: '2026-09-11T16:45:00+08:00' },
      ],
    }), { status: 200 }));

    const response = await GET(new Request('http://localhost/api/stop-eta/8cfd0daaa2d9b47e'), context('8cfd0daaa2d9b47e'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        { stop: '8CFD0DAAA2D9B47E' },
        { stop: 'OTHER_STOP' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/stop-eta/8CFD0DAAA2D9B47E'),
      { cache: 'no-store' },
    );
  });

  it('rejects an invalid stop ID without calling KMB', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await GET(new Request('http://localhost/api/stop-eta/nope'), context('nope'));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { data: null },
    { data: [null] },
    { data: [{ route: '87D', dir: 'O', service_type: '1', eta: '2026-09-11T16:35:00+08:00', dest_tc: {} }] },
    { data: [{ route: '87D', dir: 'O', service_type: '1', eta: 'invalid-date' }] },
  ])('rejects a malformed upstream payload as a failed ETA request: %j', async (payload) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const response = await GET(new Request('http://localhost/api/stop-eta/8CFD0DAAA2D9B47E'), context('8CFD0DAAA2D9B47E'));
    expect(response.status).toBe(502);
  });

  it('accepts an empty ETA list as a valid response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ type: 'ETA', data: [] }), { status: 200 }));
    const response = await GET(new Request('http://localhost/api/stop-eta/8CFD0DAAA2D9B47E'), context('8CFD0DAAA2D9B47E'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: [] });
  });
});
