import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/direct-routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/direct-routes', () => {
  it('returns a successful empty result without loading topology when candidates are empty', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await POST(request({ originStops: [], destinationStops: ['DEST0001'] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ matchesByOriginStop: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distinguishes unavailable KMB data from a genuine empty result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const response = await POST(request({
      originStops: ['ORIGIN01'],
      destinationStops: ['DEST0001'],
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'KMB route data is temporarily unavailable',
    });
  });

  it('rejects malformed stop IDs', async () => {
    const response = await POST(request({
      originStops: ['../../etc/passwd'],
      destinationStops: ['DEST0001'],
    }));
    expect(response.status).toBe(400);
  });
});
