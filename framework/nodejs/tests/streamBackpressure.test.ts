import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import * as av from "anyvali";
import { driveStream, ndjsonStreamResponse } from "../src/runtime/stream.js";
import { createSse } from "../src/runtime/sse.js";

test("stream cancellation suppresses advancement and terminal callbacks", async () => {
  for (const stage of ["before", "next", "item", "summary"]) {
    const abort = new AbortController();
    const calls: string[] = [];
    if (stage === "before") abort.abort();
    await driveStream({
      itemSchema: av.int(), summarySchema: av.int(),
      async *run() {
        calls.push("next");
        if (stage === "next") abort.abort();
        if (stage === "item") { yield 1; calls.push("advanced"); }
        return 2;
      }
    } as never, { signal: abort.signal } as never, {
      onItem() { calls.push("item"); abort.abort(); },
      onSummary() { calls.push("summary"); abort.abort(); },
      onEnd() { calls.push("end"); },
      onError() { calls.push("error"); }
    });
    assert.deepEqual(calls, stage === "before" ? [] : stage === "next" ? ["next"] : ["next", stage]);
  }
});

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

test("abort settles the driver during pending producer I/O and queues cleanup without late callbacks", async () => {
  for (const rejectLate of [false, true]) {
    const abort = new AbortController();
    const work = Promise.withResolvers<void>();
    let cleaned = false, returnCalled = false, settled = false;
    const generator = (async function* () { try { await work.promise; yield 1; } finally { cleaned = true; } })();
    const originalReturn = generator.return.bind(generator);
    generator.return = value => { returnCalled = true; return originalReturn(value); };
    const unexpected = () => assert.fail("callback after cancellation");
    const driver = driveStream({ run: () => generator, itemSchema: av.int() } as never, { signal: abort.signal } as never,
      { onItem: unexpected, onSummary: unexpected, onError: unexpected, onEnd: unexpected }).then(() => { settled = true; });
    await setImmediate();
    abort.abort();
    await setImmediate();
    assert.equal(settled, true);
    assert.equal(returnCalled, true);
    assert.equal(cleaned, false, "abort-unaware I/O cannot be forcibly interrupted by an async generator return");
    if (rejectLate) work.reject(new Error("late failure")); else work.resolve();
    await driver;
    await setImmediate();
    assert.equal(cleaned, true);
  }
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
