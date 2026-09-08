import assert from "node:assert/strict";
import test from "node:test";
import { ScopedServiceConfigSchema } from "../src/contracts/scopedConfig.js";

const tenantId = "01900000-0000-7000-8000-000000000001";
const appId = "01900000-0000-7000-8000-000000000002";
const serviceId = "01900000-0000-7000-8000-000000000003";

test("scoped wire projection preserves defaults, redacts registration credentials and keeps scope indexes distinct", () => {
  const input = {
    managementOrigins: [],
    tenants: [{ id: tenantId, slug: "test", title: "Test", services: [{
      id: serviceId, hostname: "https://service.example", apiKeyHash: "must-not-leave-cp",
      createdAt: "2026-09-05T00:00:00.000Z", source: "shared", sharedServiceId: "com.example.service"
    }] }],
    apps: [{ id: appId, tenantId, slug: "app", title: "App", hostnames: ["app.example"],
      shell: { serviceId, service: "bootstrap1", renderer: "bootstrap5" }, appRoutes: [], appFragments: {} }],
    configApps: [{ id: serviceId, tenantId, title: "Management only" }],
    previewConfig: { revision: "1", tenant: { nested: [null, true, { value: 1 }] }, app: {} }
  };
  const parsed = ScopedServiceConfigSchema.parse(input) as typeof input & {
    apps: Array<{ routes: unknown[]; defaultRoute: string }>;
  };
  assert.equal("apiKeyHash" in parsed.tenants[0].services[0], false);
  assert.equal(parsed.tenants[0].services[0].source, "shared");
  assert.deepEqual(parsed.apps[0].shell, input.apps[0].shell);
  assert.deepEqual(parsed.apps[0].routes, []);
  assert.equal(parsed.apps[0].defaultRoute, "/");
  assert.deepEqual(parsed.configApps, input.configApps);
  assert.deepEqual(parsed.previewConfig, input.previewConfig);
  assert.equal(ScopedServiceConfigSchema.safeParse({ ...input, apps: [{ ...input.apps[0], tenantId: "not-a-uuid" }] }).success, false);
  assert.equal(ScopedServiceConfigSchema.safeParse({ ...input, serviceIdentity: null }).success, false);
});
