import assert from "node:assert/strict";
import { H3 } from "h3";
import { test } from "node:test";
import { registerWebhookRoutes } from "../src/plugins/service-betterportal-config-manager/webhooks.js";
import { getManifestCache } from "../src/plugins/service-betterportal-config-manager/syncApi.js";

test("in-memory webhook idempotency survives successful delivery and rejects revoked credentials", async (t) => {
  const serviceId = "python-webhook-source";
  const cache = getManifestCache();
  cache.set(serviceId, { webhooks: [{ id: "changed" }] } as never);
  t.after(() => cache.delete(serviceId));
  let deliveries = 0;
  let revoked = false;
  t.mock.method(globalThis, "fetch", async () => { deliveries++; return new Response(null, { status: 204 }); });
  const app = new H3();
  registerWebhookRoutes(app, {
    validateApiKey: async () => revoked ? null : { serviceId, tenantId: "tenant" },
    loadConfig: async () => ({ tenants: [{ id: "tenant", active: true }], webhooks: { targets: [{ id: "target", serviceId, eventId: "changed", tenantId: "tenant", enabled: true, secret: "test-only", url: "https://webhook.test", maxAttempts: 3 }] } })
  } as never);
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
  t.mock.method(globalThis, "fetch", async () => { deliveries++; return new Response(null, { status: 204 }); });
  const target = (id: string, serviceId: string) => ({ id, serviceId, eventId: "changed", tenantId: "tenant", enabled: true, secret: "test-only", url: "https://webhook.test", maxAttempts: 1 });
  let targets = Array.from({ length: 10_000 }, (_, i) => target(`target-${i}`, services[0]));
  const app = new H3();
  registerWebhookRoutes(app, {
    validateApiKey: async (key: string) => ({ serviceId: key, tenantId: "tenant" }),
    loadConfig: async () => ({ tenants: [{ id: "tenant", active: true }], webhooks: { targets } })
  } as never);
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
