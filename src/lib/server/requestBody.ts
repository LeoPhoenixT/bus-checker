const MAX_REQUEST_BYTES = 512_000;

export class RequestBodyTooLargeError extends Error {}

export async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new RequestBodyTooLargeError('Request body is too large');
  }
  if (!request.body) throw new SyntaxError('Missing request body');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        // Do not wait for an untrusted stream's cancellation to complete.
        void reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError('Request body is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
