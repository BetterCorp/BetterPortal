import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppServiceOrigins, resolveServiceForTenant, resolveServiceViewTitle } from "../src/runtime/configProvider.js";

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

test("shared view labels use the catalog manifest and respect activation scope", () => {
  const activation = { id: "activation", sharedServiceId: "catalog", tenantId: "tenant", appId: "app", enabled: true };
  const config = {
    platformServices: [],
    sharedServiceActivations: [activation],
    sharedServiceCatalog: [{ id: "catalog", serviceId: "org.example.shared", baseUrl: "https://shared.test", enabled: true }],
    manifestCache: [
      { serviceId: "org.example.shared", viewIndex: { detail: { title: "Package default" } } },
      { serviceId: "activation", viewIndex: { detail: { title: "Wrong activation cache" } } },
      { serviceId: "catalog", viewIndex: { detail: { title: "Catalog view" } } }
    ]
  } as any;
  const context = { tenant: { id: "tenant", services: [], activatedPlatformServices: [] }, app: { id: "app" } } as any;
  assert.equal(resolveServiceViewTitle(config, "activation", "detail", context), "Catalog view");
  assert.equal(resolveServiceViewTitle(config, "activation", "missing", context), undefined);
  for (const changes of [{ enabled: false }, { tenantId: "other" }, { appId: "other" }]) {
    config.sharedServiceActivations = [{ ...activation, ...changes }];
    assert.equal(resolveServiceViewTitle(config, "activation", "detail", context), undefined);
  }
});

test("concrete service view labels take precedence over package defaults", () => {
  const config = { sharedServiceActivations: [], platformServices: [], manifestCache: [
    { serviceId: "org.example.service", viewIndex: { detail: { title: "Package default" } } },
    { serviceId: "first", viewIndex: { detail: { title: "First instance" } } },
    { serviceId: "second", viewIndex: { detail: { title: "Second instance" } } }
  ] } as any;
  const context = { tenant: { services: ["first", "second"].map(id => ({ id, serviceId: "org.example.service", enabled: true })), activatedPlatformServices: [] }, app: {} } as any;
  assert.equal(resolveServiceViewTitle(config, "second", "detail", context), "Second instance");
  config.manifestCache = config.manifestCache.filter((entry: { serviceId: string }) => entry.serviceId !== "second");
  assert.equal(resolveServiceViewTitle(config, "second", "detail", context), "Package default");
});
