import assert from "node:assert/strict";
import { H3 } from "h3";
import { createServer } from "node:http";
import { test } from "node:test";
import { registerWebhookRoutes } from "../src/plugins/service-betterportal-config-manager/webhooks.js";
import { getManifestCache } from "../src/plugins/service-betterportal-config-manager/syncApi.js";

test("webhook test delivery cannot reach the control plane loopback interface", async (t) => {
  let hits = 0;
  let connections = 0;
  const server = createServer((_request, response) => { hits++; response.writeHead(204).end(); });
  server.on("connection", () => { connections++; });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const app = new H3();
  registerWebhookRoutes(app, {
    loadConfig: async () => ({
      apps: [{ id: "app", tenantId: "tenant", hostnames: ["cp.test"] }],
      tenants: [{ id: "tenant", active: true }],
      webhooks: { targets: [
        { id: "target", serviceId: "service", eventId: "changed", tenantId: "tenant", appId: "app", enabled: true,
          secret: "test-only", url: `http://127.0.0.1:${address.port}/internal`, maxAttempts: 1 },
        { id: "tls-target", serviceId: "service", eventId: "changed", tenantId: "tenant", appId: "app", enabled: true,
          secret: "test-only", url: `https://127.0.0.1:${address.port}/internal`, maxAttempts: 1 }
      ] }
    })
  } as never);
  const response = await app.fetch(new Request("http://cp.test/.well-known/bp/manage/webhooks/targets/target/test?appId=app", { method: "POST" }));
  assert.equal(response.status, 502);
  const tlsResponse = await app.fetch(new Request("http://cp.test/.well-known/bp/manage/webhooks/targets/tls-target/test?appId=app", { method: "POST" }));
  assert.equal(tlsResponse.status, 502);
  assert.equal(hits, 0);
  assert.equal(connections, 0, "HTTPS loopback must be rejected before opening a socket");
});

test("webhook target creation rejects private destinations and oversized streamed input", async (t) => {
  const cache = getManifestCache();
  cache.set("service", { webhooks: [{ id: "changed" }] } as never);
  t.after(() => cache.delete("service"));
  const config = {
    apps: [{ id: "app", tenantId: "tenant", hostnames: ["cp.test"] }],
    tenants: [{ id: "tenant", active: true }],
    webhooks: { targets: [] as unknown[] }
  };
  const app = new H3();
  registerWebhookRoutes(app, { loadConfig: async () => config, saveConfig: async () => {} } as never);
  const targetUrl = "http://cp.test/.well-known/bp/manage/webhooks/targets?appId=app";
  const privateTarget = await app.fetch(new Request(targetUrl, { method: "POST", body: JSON.stringify({
    serviceId: "service", eventId: "changed", url: "https://127.0.0.1/internal"
  }) }));
  assert.equal(privateTarget.status, 400);
  const body = new TextEncoder().encode(JSON.stringify({
    serviceId: "service", eventId: "changed", url: "https://webhook.example", padding: "x".repeat(2 * 1024 * 1024)
  }));
  const oversized = await app.fetch(new Request(targetUrl, { method: "POST",
    body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(body); controller.close(); } }),
    duplex: "half"
  } as RequestInit & { duplex: "half" }));
  assert.equal(oversized.status, 413);
  assert.equal(config.webhooks.targets.length, 0);
});

test("in-memory webhook idempotency survives successful delivery and rejects revoked credentials", async (t) => {
  const serviceId = "python-webhook-source";
  const cache = getManifestCache();
  cache.set(serviceId, { webhooks: [{ id: "changed" }] } as never);
  t.after(() => cache.delete(serviceId));
  let deliveries = 0;
  let revoked = false;
  const transport = async () => { deliveries++; return new Response(null, { status: 204 }); };
  const app = new H3();
  registerWebhookRoutes(app, {
    validateApiKey: async () => revoked ? null : { scope: "tenant", serviceId, tenantId: "tenant" },
    loadConfig: async () => ({ tenants: [{ id: "tenant", active: true }], webhooks: { targets: [{ id: "target", serviceId, eventId: "changed", tenantId: "tenant", enabled: true, secret: "test-only", url: "https://webhook.test", maxAttempts: 3 }] } })
  } as never, undefined, "single", transport);
  const publish = (key: string) => app.fetch(new Request("http://cp.test/.well-known/bp/webhooks/events", {
    method: "POST", headers: { authorization: "Bearer test-only", "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ eventId: "changed", tenantId: "tenant", payload: "hello" })
  }));
  assert.equal((await publish("one")).status, 202);
  assert.equal((await publish("one")).status, 202);
  assert.equal(deliveries, 1);
  assert.equal((await publish("two")).status, 202);
  assert.equal(deliveries, 2);
  revoked = true;
  assert.equal((await publish("three")).status, 403);
  assert.equal(deliveries, 2);
});

test("webhook capacity and seven-day deduplication are isolated per publisher", async (t) => {
  const services = ["capacity-source", "other-source"];
  const cache = getManifestCache();
  for (const serviceId of services) cache.set(serviceId, { webhooks: [{ id: "changed" }] } as never);
  t.after(() => { for (const serviceId of services) cache.delete(serviceId); });
  let deliveries = 0;
  const transport = async () => { deliveries++; return new Response(null, { status: 204 }); };
  const target = (id: string, serviceId: string) => ({ id, serviceId, eventId: "changed", tenantId: "tenant", enabled: true, secret: "test-only", url: "https://webhook.test", maxAttempts: 1 });
  let targets = Array.from({ length: 10_000 }, (_, i) => target(`target-${i}`, services[0]));
  const app = new H3();
  registerWebhookRoutes(app, {
    validateApiKey: async (key: string) => ({ scope: "tenant", serviceId: key, tenantId: "tenant" }),
    loadConfig: async () => ({ tenants: [{ id: "tenant", active: true }], webhooks: { targets } })
  } as never, undefined, "single", transport);
  const publish = (serviceId: string, key: string) => app.fetch(new Request("http://cp.test/.well-known/bp/webhooks/events", {
    method: "POST", headers: { authorization: `Bearer ${serviceId}`, "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ eventId: "changed", tenantId: "tenant", payload: "hello" })
  }));
  assert.equal((await publish(services[0], "one")).status, 202);
  assert.equal(deliveries, 10_000);
  targets = [target("target-0", services[0]), target("other", services[1])];
  assert.equal((await publish(services[0], "two")).status, 503);
  assert.equal((await publish(services[0], "one")).status, 202);
  assert.equal(deliveries, 10_000);
  assert.equal((await publish(services[1], "one")).status, 202);
  assert.equal(deliveries, 10_001);
  const later = Date.now() + 7 * 24 * 60 * 60 * 1000 + 1;
  t.mock.method(Date, "now", () => later);
  assert.equal((await publish(services[0], "two")).status, 202);
  assert.equal(deliveries, 10_002);
});

test("webhook publication enforces credential tenant scope and streamed body limits", async (t) => {
  const serviceId = "scoped-source";
  const cache = getManifestCache();
  cache.set(serviceId, { webhooks: [{ id: "changed" }] } as never);
  t.after(() => cache.delete(serviceId));
  let deliveries = 0;
  const transport = async () => { deliveries++; return new Response(null, { status: 204 }); };
  const app = new H3();
  registerWebhookRoutes(app, {
    validateApiKey: async (key: string) => key === "invalid" ? null : key === "platform" ? { scope: "platform", serviceId } : { scope: "tenant", serviceId, tenantId: "a" },
    loadConfig: async () => ({ tenants: [{ id: "a", active: true }, { id: "b", active: true }], webhooks: { targets: ["a", "b"].map(tenantId => ({
      id: `target-${tenantId}`, tenantId, serviceId, eventId: "changed", enabled: true, secret: "test-only", url: "https://webhook.test", maxAttempts: 1
    })) } })
  } as never, undefined, "single", transport);
  let sequence = 0;
  const publish = (body: string | ReadableStream<Uint8Array>, key: string | null = "tenant", extra: Record<string, string> = {}) => app.fetch(new Request("http://cp.test/.well-known/bp/webhooks/events", {
    method: "POST", headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "content-type": "application/json", "idempotency-key": String(++sequence), ...extra },
    body, duplex: "half"
  } as RequestInit));
  const event = (tenantId?: string) => JSON.stringify({ eventId: "changed", tenantId, payload: "hello" });
  for (const [key, status] of [[null, 401], ["invalid", 403]] as const) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    assert.equal((await publish(stream, key)).status, status);
    assert.ok(cancelled, "unauthenticated rejection must cancel the unread upload");
  }
  assert.equal((await publish(event("b"))).status, 403);
  assert.equal(deliveries, 0);
  assert.equal((await publish(event())).status, 202);
  assert.equal((await publish(event("a"))).status, 202);
  assert.equal((await publish(event("b"), "platform")).status, 202);
  assert.equal((await publish(event(), "platform")).status, 400);
  assert.equal(deliveries, 3);
  const limit = 1024 * 1024;
  for (const [length, status] of [[String(limit + 1), 413], ["invalid", 400]] as const) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    assert.equal((await publish(stream, "tenant", { "content-length": length })).status, status);
    assert.ok(cancelled, "declared-oversize or malformed length must cancel the unread body");
  }
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = false;
    let chunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { chunks++; controller.enqueue(new Uint8Array(64 * 1024)); },
      cancel() { cancelled = true; }
    });
    assert.equal((await publish(stream, "tenant", headers)).status, 413);
    assert.ok(cancelled && chunks <= 18, "oversized stream must stop reading promptly");
  }
  const exact = JSON.stringify({ eventId: "changed", payload: "" });
  const boundary = exact.replace('"payload":""', '"payload":"' + "x".repeat(limit - Buffer.byteLength(exact)) + '"');
  assert.equal(Buffer.byteLength(boundary), limit);
  assert.equal((await publish(boundary)).status, 202);
  assert.equal((await publish(boundary + " ")).status, 413);
  assert.equal((await publish("{not-json" )).status, 400);
  assert.equal(deliveries, 4);
});
