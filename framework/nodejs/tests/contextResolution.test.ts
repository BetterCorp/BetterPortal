import { test } from "node:test";
import assert from "node:assert/strict";
import type { BetterPortalConfig } from "../src/contracts/platformConfig.js";
import { resolveEmbeddedRequestContext } from "../src/runtime/configProvider.js";
import { uuidv7 } from "../src/runtime/uuid.js";

test("browser context ignores standalone BP scope headers and resolves shell from the app origin", () => {
  const tenantId = uuidv7();
  const appId = uuidv7();
  const shellServiceId = uuidv7();
  const config = {
    tenants: [{ id: tenantId, active: true, services: [], activatedPlatformServices: [] }],
    apps: [{ id: appId, tenantId, hostnames: ["portal.example"], shell: { serviceId: shellServiceId } }],
    platformServices: [],
    sharedServiceCatalog: [],
    sharedServiceActivations: [],
    manifestCache: [{
      serviceId: shellServiceId,
      shell: { service: "bootstrap1", renderer: "bootstrap5", fragments: [] }
    }]
  } as unknown as BetterPortalConfig;

  assert.equal(resolveEmbeddedRequestContext(config, {
    "x-bp-tenant-id": tenantId,
    "x-bp-app-id": appId,
    host: "service.example"
  }), null);

  assert.equal(resolveEmbeddedRequestContext(config, {
    host: "portal.example"
  })?.app.id, appId);

  const resolved = resolveEmbeddedRequestContext(config, {
    origin: "https://portal.example",
    "x-bp-tenant-id": uuidv7(),
    "x-bp-app-id": uuidv7()
  });
  assert.equal(resolved?.app.id, appId);
  assert.deepEqual(resolved?.app.shell, {
    serviceId: shellServiceId,
    service: "bootstrap1",
    renderer: "bootstrap5"
  });
});
