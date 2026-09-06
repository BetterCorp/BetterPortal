import { importSchema } from "anyvali";
import { createStreamHandler } from "../nodejs/lib/runtime/streamHandler.js";
import { driveStream, driveStreamBuffered, ndjsonStreamResponse } from "../nodejs/lib/runtime/stream.js";
import { number } from "anyvali";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function streamProbe() {
  const abort = new AbortController();
  const produced = [], terminal = [];
  let closed = false, release;
  const gate = new Promise(resolve => { release = resolve; });
  const handler = createStreamHandler({ item: number() }, async function* () {
    try { for (let index = 0; index < 3; index++) { produced.push(index); yield index; } }
    finally { closed = true; }
  });
  const work = driveStream(handler, { signal: abort.signal }, {
    onItem: () => gate, onSummary() {}, onEnd: () => terminal.push("end"), onError: () => terminal.push("error")
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(produced, [0]);
  abort.abort(); release();
  await work;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, true); assert.deepEqual(terminal, []);
  const cancel = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let finished = false;
  const pending = createStreamHandler({ item: number() }, async function* () {
    try {
      yield 1; started();
      await new Promise((resolve, reject) => cancel.signal.addEventListener("abort", () => reject(cancel.signal.reason), { once: true }));
    } finally { finished = true; }
  });
  const waiting = driveStream(pending, { signal: cancel.signal }, {
    onItem() {}, onSummary() {}, onEnd: () => terminal.push("end"), onError: () => terminal.push("error")
  });
  await ready; cancel.abort(); await waiting;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, true); assert.deepEqual(terminal, []);
  return { "backpressure-close": true, "cancel-producer": true };
}

export async function streaming(body, signal) {
  const handler = createStreamHandler({ item: importSchema(body.itemSchema),
    ...(body.summarySchema ? { summary: importSchema(body.summarySchema) } : {}) }, async function* () {
    for (const item of body.items ?? []) {
      if (body.delay) await delay(body.delay, undefined, { signal });
      yield item;
    }
    if (body.fail) throw new Error("private producer error");
    if (Object.hasOwn(body, "summary")) return body.summary;
  });
  if (body.format === "buffered") {
    try { return Response.json(await driveStreamBuffered(handler, { signal })); }
    catch { return Response.json({ error: "Stream failed" }, { status: 500 }); }
  }
  return ndjsonStreamResponse(handler, { signal });
}
