import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import * as av from "anyvali";
import { ndjsonStreamResponse } from "../src/runtime/stream.js";
import { createSse } from "../src/runtime/sse.js";

test("NDJSON pauses a fast producer and cancels it when the reader leaves", async () => {
  let produced = 0;
  let finished = false;
  let signal: AbortSignal | undefined;
  const response = ndjsonStreamResponse({
    itemSchema: av.int(),
    async *run(ctx: { signal?: AbortSignal }) {
      signal = ctx.signal;
      try { while (true) yield ++produced; }
      finally { finished = true; }
    }
  } as never, {} as never);
  await setImmediate();
  assert.ok(produced <= 2, `unbounded producer: ${produced}`);
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /"data":1/);
  await reader.cancel();
  await setImmediate();
  assert.equal(signal?.aborted, true);
  assert.equal(finished, true);
});

test("SSE cancels idle subscribers and rejects overflowing subscribers", async () => {
  const sse = createSse({ input: av.int(), event: av.int() }, value => value);
  const abort = new AbortController();
  const scope = { tenant: { id: "tenant" }, app: { id: "app" } };
  const stream = sse.handler({ ...scope, signal: abort.signal } as never)[Symbol.asyncIterator]();
  const first = stream.next();
  sse.publish(scope, 1);
  assert.equal((await first).value, 1);
  for (let i = 0; i < 257; i++) sse.publish(scope, i);
  await assert.rejects(stream.next(), /pending event limit/);
  const idle = sse.handler({ ...scope, signal: abort.signal } as never)[Symbol.asyncIterator]();
  const pending = idle.next();
  abort.abort();
  assert.equal((await pending).done, true);
});
