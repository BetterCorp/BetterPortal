import { createSse } from "../nodejs/lib/runtime/sse.js";
import { string } from "anyvali";
import assert from "node:assert/strict";

export async function sseProbe() {
  const route = createSse({ input: string(), event: string() }, (value, context) => value + context.suffix);
  const other = createSse({ input: string(), event: string() }, (value, context) => value + context.suffix);
  const scope = (tenant, app) => ({ tenant: { id: tenant }, app: { id: app } });
  const scopes = [scope("tenant", "app"), scope("tenant", "other"), scope("other", "app")];
  const abort = new AbortController();
  const streams = [], results = {};
  function subscribe(target, scope, suffix = "") {
    const stream = target.handler({ ...scope, suffix, signal: abort.signal })[Symbol.asyncIterator]();
    streams.push(stream);
    return stream;
  }
  try {
    const first = subscribe(route, scopes[0], "-one"), second = subscribe(route, scopes[0], "-two");
    const app = subscribe(route, scopes[1]), tenant = subscribe(route, scopes[2]), view = subscribe(other, scopes[0]);
    const initial = [first.next(), second.next(), app.next(), tenant.next(), view.next()];
    route.publish(scopes[0], "own"); route.publish(scopes[1], "app"); route.publish(scopes[2], "tenant"); other.publish(scopes[0], "view");
    assert.deepEqual((await Promise.all(initial)).map(value => value.value), ["own-one", "own-two", "app", "tenant", "view"]);
    results["scope-route-fanout"] = true;
    for (let index = 0; index < 257; index++) route.publish(scopes[0], String(index));
    await assert.rejects(first.next(), /pending event limit/);
    results.overflow = true;
    route.publish(scopes[1], "still-active");
    assert.equal((await app.next()).value, "still-active");
    results["overflow-isolated"] = true;
    const fresh = subscribe(route, scopes[0]);
    const next = fresh.next(); route.publish(scopes[0], "fresh");
    assert.equal((await next).value, "fresh");
    results["no-history"] = true;
    assert.throws(() => route.publish(scopes[0], 1));
    results["input-validation"] = true;
    const invalid = createSse({ input: string(), event: string() }, () => 42);
    const invalidStream = subscribe(invalid, scopes[0]);
    const invalidValue = invalidStream.next(); invalid.publish(scopes[0], "value");
    await assert.rejects(invalidValue);
    results["event-validation"] = true;
    const idle = subscribe(route, scopes[1]);
    const waiting = idle.next(); abort.abort();
    assert.equal((await waiting).done, true);
    results["idle-cancel"] = true;
    return results;
  } finally {
    abort.abort();
    await Promise.allSettled(streams.map(stream => stream.return()));
  }
}
