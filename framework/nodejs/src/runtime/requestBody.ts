import { jsonResponse } from "./h3.js";

/** Read JSON from a raw endpoint without letting a caller buffer an unbounded body. */
export async function readBoundedJsonBody(request: Request, maxBytes: number): Promise<unknown | Response> {
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) {
    void request.body?.cancel().catch(() => undefined);
    return jsonResponse({ error: "Invalid Content-Length" }, 400);
  }
  if (length !== null && Number(length) > maxBytes) {
    void request.body?.cancel().catch(() => undefined);
    return jsonResponse({ error: "Request body too large" }, 413);
  }

  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maxBytes - used) {
        void reader.cancel().catch(() => undefined);
        return jsonResponse({ error: "Request body too large" }, 413);
      }
      chunks.push(value);
      used += value.byteLength;
    }
    const buffer = new Uint8Array(used);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used))) as unknown;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Check a cloned raw request without consuming the handler's copy. */
export async function checkBoundedRequestBody(request: Request, maxBytes: number): Promise<Response | undefined> {
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) {
    void request.body?.cancel().catch(() => undefined);
    return jsonResponse({ error: "Invalid Content-Length" }, 400);
  }
  if (length !== null && Number(length) > maxBytes) {
    void request.body?.cancel().catch(() => undefined);
    return jsonResponse({ error: "Request body too large" }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return undefined;
      if (value.byteLength > maxBytes - used) {
        void reader.cancel().catch(() => undefined);
        return jsonResponse({ error: "Request body too large" }, 413);
      }
      used += value.byteLength;
    }
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  } finally {
    reader.releaseLock();
  }
}
