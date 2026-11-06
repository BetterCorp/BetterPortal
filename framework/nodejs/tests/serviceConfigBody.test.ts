import assert from "node:assert/strict";
import { test } from "node:test";
import { createBetterPortalApp } from "../src/runtime/h3.js";
import { registerServiceConfigRoutes } from "../src/runtime/serviceConfig.js";

test("config write ticket cannot make a service parse an oversized streamed body", async () => {
  const app = createBetterPortalApp();
  let writes = 0;
  registerServiceConfigRoutes({
    app, serviceId: "org.example.service", mode: "bp-managed", configSchemas: [],
    validateTicket: async () => ({
      iss: "control-plane", aud: "service", sub: "test", exp: 9999999999,
      iat: 1, jti: "ticket", realm: "control-plane", tenantId: "tenant-a",
      serviceId: "org.example.service", actions: ["config.write"]
    }),
    writeConfig: async () => { writes++; return { tenant: {}, app: {} }; }
  });
  const payload = new TextEncoder().encode(JSON.stringify({ tenantId: "tenant-a", values: { data: "x".repeat(2 * 1024 * 1024) } }));
  const request = new Request("https://service.example/.well-known/bp/config", {
    method: "POST", headers: { authorization: "Bearer ticket", "content-type": "application/json" },
    body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(payload); controller.close(); } }),
    duplex: "half"
  } as RequestInit & { duplex: "half" });
  assert.equal(request.headers.get("content-length"), null);
  assert.equal((await app.fetch(request)).status, 413);
  assert.equal(writes, 0);
});
