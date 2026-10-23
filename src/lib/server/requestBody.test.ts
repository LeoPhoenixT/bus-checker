// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readBoundedJson, RequestBodyTooLargeError } from './requestBody';

function streamedRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const cancel = vi.fn();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  const request = new Request('http://localhost', {
    method: 'POST', body, headers, duplex: 'half',
  } as RequestInit);
  return { request, cancel };
}

describe('readBoundedJson', () => {
  it('decodes UTF-8 characters across chunk boundaries', async () => {
    const bytes = new TextEncoder().encode('{"name":"香港"}');
    const { request } = streamedRequest([...bytes].map((byte) => Uint8Array.of(byte)));
    await expect(readBoundedJson(request)).resolves.toEqual({ name: '香港' });
  });

  it('accepts JSON exactly at the byte limit', async () => {
    const body = JSON.stringify('a'.repeat(511_998));
    await expect(readBoundedJson(new Request('http://localhost', { method: 'POST', body })))
      .resolves.toHaveLength(511_998);
  });

  it.each([undefined, { 'content-length': '2' }])('rejects an oversized stream regardless of the declared length: %j', async (headers) => {
    const { request, cancel } = streamedRequest([
      new Uint8Array(256_000), new Uint8Array(256_001), new Uint8Array(1),
    ], headers);
    await expect(readBoundedJson(request)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects an oversized Content-Length before reading', async () => {
    const { request, cancel } = streamedRequest([], { 'content-length': '512001' });
    await expect(readBoundedJson(request)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancel).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  it('rejects invalid JSON', async () => {
    await expect(readBoundedJson(new Request('http://localhost', { method: 'POST', body: '{' })))
      .rejects.toBeInstanceOf(SyntaxError);
  });
});
