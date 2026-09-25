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
