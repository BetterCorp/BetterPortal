import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { BPService } from "../src/service.js";

function serviceFixture() {
  const service = Object.create(BPService.prototype) as any;
  Object.assign(service, {
    resolvedCpUrl: "https://config.test", resolvedApiKey: "test-key",
    requireBetterPortalConfigSource: true,
    manifest: { pluginId: "org.example.test", views: [] },
    scopedConfigCache: { write() {} }, seoProbeCache: new Map(), server: { listening: false },
    applyPreviewConfig() {}, updateS2SIdentityState() {}, logScopedConfigDebug() {}
  });
  return service;
}
const obs = { log: { info() {}, warn() {} } };

test("control-plane credentials require HTTPS or exact HTTP loopback and reject unsafe URLs before fetch", async t => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected request"); });
  for (const url of ["http://config.test", "http://localhost.attacker.test", "http://127.0.0.1.attacker.test", "ftp://localhost", "https://user:pass@config.test", "https://config.test?key=secret", "https://config.test#fragment", "//config.test", "bad-url"]) {
    const service = serviceFixture();
    service.resolvedCpUrl = url;
    assert.throws(() => service.connectToControlPlane(obs), /Control-plane URL/);
    assert.throws(() => service.controlPlaneCredentials(), /Control-plane URL/);
    await service.dispose();
  }
  assert.equal(fetchMock.mock.callCount(), 0);
  for (const url of ["https://config.test", "https://config.test:443/prefix", "http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"]) {
    const service = serviceFixture();
    service.resolvedCpUrl = url;
    assert.deepEqual(service.controlPlaneCredentials(), { url, apiKey: "test-key" });
  }
});

test("manifest failures retry without opening SSE or claiming readiness; disposal cancels retries", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const service = serviceFixture();
  t.after(() => service.dispose());
  let posts = 0;
  let streams = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.redirect, "error", "neither poll nor SSE may follow redirects");
    if (init.method === "POST") {
      posts++;
      return posts === 1 ? new Response("Conflict", { status: 409 })
        : Response.json({ tenants: [], apps: [], managementOrigins: [] });
    }
    streams++;
    return new Response(new ReadableStream({ start(controller) {
      init.signal?.addEventListener("abort", () => controller.error(new DOMException("Disposed", "AbortError")), { once: true });
    } }));
  });
  assert.equal(await service.connectToControlPlane(obs), false);
  assert.equal(streams, 0);
  assert.equal(service.manifestSync.state, "retrying");
  assert.equal(service.renderHealth().status, 503);
  t.mock.timers.tick(5000);
  await setImmediate();
  assert.equal(posts, 2);
  assert.equal(streams, 1);
  assert.equal(service.manifestSync.state, "synced");
  assert.equal(service.renderHealth().status, 200);
  await service.dispose();
  t.mock.timers.tick(10000);
  await setImmediate();
  assert.equal(posts, 2);
});

test("disposal while a manifest submission is pending cannot open a stream", async t => {
  const service = serviceFixture();
  let finish!: (response: Response) => void;
  let requests = 0;
  t.mock.method(globalThis, "fetch", () => {
    requests++;
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  const pending = service.connectToControlPlane(obs);
  await service.dispose();
  finish(Response.json({ tenants: [], apps: [] }));
  assert.equal(await pending, false);
  assert.equal(requests, 1);
  assert.equal(service.scopedConfig, undefined);
});
