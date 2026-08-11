import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.restoreAllMocks());

describe('GET /api/location-search', () => {
  it('validates the query', async () => {
    expect((await GET(new Request('http://localhost/api/location-search'))).status).toBe(400);
  });

  it('normalizes and limits Map Service results', async () => {
    const source = Array.from({ length: 10 }, (_, index) => ({
      x: 836694.05 + index,
      y: 819069.8 + index,
      nameEN: `Place ${index}`,
      nameZH: `地點 ${index}`,
      addressEN: 'Hong Kong',
      addressZH: '香港',
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(source), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const response = await GET(new Request('http://localhost/api/location-search?q=central'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(8);
    expect(body.results[0]).toMatchObject({
      labelEn: 'Place 0 - Hong Kong',
      labelTc: '地點 0 - 香港',
    });
    expect(body.results[0].lat).toBeCloseTo(22.312, 2);
    expect(body.results[0].lon).toBeCloseTo(114.179, 2);
  });

  it('keeps malformed upstream data distinct from no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const response = await GET(new Request('http://localhost/api/location-search?q=test'));
    expect(response.status).toBe(502);
  });
});
