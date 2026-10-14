import { jsonResponse, type BetterPortalEvent } from "@betterportal/framework";

const MAX_PUBLIC_JSON_BYTES = 128 * 1024;

/** Bound unauthenticated setup requests even when Content-Length is absent. */
export async function readPublicJsonBody(event: BetterPortalEvent): Promise<Record<string, unknown> | Response> {
  const length = event.req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_PUBLIC_JSON_BYTES)) {
    void event.req.body?.cancel().catch(() => undefined);
    return /^\d+$/.test(length)
      ? jsonResponse({ error: "Request body too large" }, 413)
      : jsonResponse({ error: "Invalid Content-Length" }, 400);
  }

  const reader = event.req.body?.getReader();
  if (!reader) return jsonResponse({ error: "JSON object required" }, 400);
  const buffer = new Uint8Array(MAX_PUBLIC_JSON_BYTES);
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_PUBLIC_JSON_BYTES - used) {
        void reader.cancel().catch(() => undefined);
        return jsonResponse({ error: "Request body too large" }, 413);
      }
      buffer.set(value, used);
      used += value.byteLength;
    }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used)));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Keep transport and parser details out of public responses. */ }
  finally { reader.releaseLock(); }
  return jsonResponse({ error: "JSON object required" }, 400);
}
