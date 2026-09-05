import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppServiceOrigins, resolveServiceForTenant } from "../src/runtime/configProvider.js";

test("app credential destinations include enabled fragments and slots but exclude unbound services", () => {
  const context = {
    app: {
      routes: [{ serviceId: "route", enabled: true }, { serviceId: "disabled-route", enabled: false }],
      slots: [{ serviceId: "slot", enabled: true }, { serviceId: "disabled-slot", enabled: false }],
      fragments: { header: [{ serviceId: "fragment", enabled: true }, { serviceId: "disabled-fragment", enabled: false }, { serviceId: "disabled-service", enabled: true }] },
      shell: { serviceId: "shell" }, auth: { serviceId: "auth" },
      shellFragments: { shell: { header: { mode: "items", items: [{ source: "service", serviceId: "override" }] } }, other: { header: { mode: "override", item: { source: "service", serviceId: "other-shell" } } } }
    },
    tenant: {
      services: ["route", "slot", "fragment", "shell", "auth", "override", "disabled-route", "disabled-slot", "disabled-fragment", "disabled-service", "unbound", "other-shell"].map(id => ({ id, enabled: id !== "disabled-service", hostname: `https://${id}.test/path` })),
      activatedPlatformServices: []
    }
  };
  assert.deepEqual(resolveAppServiceOrigins({ platformServices: [], sharedServiceActivations: [] } as never, context as never),
    Object.fromEntries(["route", "slot", "fragment", "shell", "auth", "override"].map(id => [id, `https://${id}.test`])));
});

test("shared destinations require an enabled activation scoped to this tenant and app", () => {
  const activation = { id: "activation", sharedServiceId: "shared", tenantId: "tenant", appId: "app", enabled: true, activatedAt: "2026-09-05T00:00:00Z" };
  const shared = { id: "shared", serviceId: "org.example.shared", baseUrl: "https://shared.test/path", enabled: true };
  const config = { platformServices: [], sharedServiceCatalog: [shared], sharedServiceActivations: [activation] } as any;
  const context = { tenant: { id: "tenant", services: [], activatedPlatformServices: [] }, app: { id: "app", routes: [], slots: [], fragments: { header: [{ serviceId: activation.id, enabled: true }] }, shellFragments: {} } } as any;
  assert.deepEqual(resolveAppServiceOrigins(config, context), { activation: "https://shared.test" });
  assert.equal(resolveServiceForTenant(config, activation.id, context)?.service.id, activation.id);
  for (const changes of [{ enabled: false }, { tenantId: "other" }, { appId: "other" }]) {
    config.sharedServiceActivations = [{ ...activation, ...changes }];
    assert.deepEqual(resolveAppServiceOrigins(config, context), {});
  }
  config.sharedServiceActivations = [{ ...activation, appId: undefined }];
  assert.deepEqual(resolveAppServiceOrigins(config, context), { activation: "https://shared.test" });
  shared.enabled = false;
  assert.deepEqual(resolveAppServiceOrigins(config, context), {});
});
