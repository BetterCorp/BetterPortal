import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BetterPortalConfigSchema, ScopedServiceConfigSchema, TenantServiceRegistrationSchema, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { registerAdminApiRoutes } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
import { getManifestCache, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { Plugin } from "../src/plugins/service-betterportal-config-manager/index.js";
import { handlePost as createTenantOrApp } from "../src/plugins/service-betterportal-config-manager/tenantManagement.js";
import { setConfigManagerRouteContext } from "../src/plugins/service-betterportal-config-manager/routeContext.js";

class Storage extends BaseStorage {
  constructor(public current: BetterPortalConfig) { super(); }
  async loadConfig() { return structuredClone(this.current); }
  async saveConfig(config: BetterPortalConfig) {
    this.validateConfigReferences(config);
    this.current = structuredClone(config);
  }
}

function fixture(t: TestContext) {
  const tenantId = uuidv7(), otherTenantId = uuidv7(), appId = uuidv7(), siblingAppId = uuidv7(), otherAppId = uuidv7(), platformId = uuidv7();
  const pluginId = "cloud.betterportal.frame";
  const sharedId = pluginId;
  const current = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "tenant", title: "Tenant" }, { id: otherTenantId, slug: "other", title: "Other" }],
    apps: [appId, siblingAppId, otherAppId].map((id, index) => ({ id, tenantId: index === 2 ? otherTenantId : tenantId,
      slug: `app-${index}`, title: `App ${index}`, hostnames: [`app${index}.example`] })),
    sharedServiceCatalog: [{ id: sharedId, serviceId: pluginId, title: "BetterFrame", baseUrl: "https://frame.example", enabled: true }],
    platformServices: [{ id: platformId, serviceId: pluginId, title: "BetterFrame", hostname: "https://frame.example", apiKeyHash: "test-only", createdAt: new Date().toISOString() }],
    manifestCache: [{ serviceId: sharedId, manifestVersion: "0.1.0", fetchedAt: new Date().toISOString(), title: "BetterFrame", viewIndex: {
      "frame.kiosks": { viewId: "frame.kiosks", title: "Kiosks", description: "List kiosks", path: "/kiosks", pathVariants: [], operations: [{
        operationId: "frame.kiosks.read", method: "GET", title: "Kiosks", description: "List kiosks", authRequired: true,
        renderable: true, renderModes: ["page"], dependencies: [{ operationId: "frame.kiosks.pair.post", method: "POST" }]
      }] },
      "frame.kiosks.pair": { viewId: "frame.kiosks.pair", title: "Pair kiosk", description: "Pair kiosk", path: "/kiosks/pair", pathVariants: [], operations: [{
        operationId: "frame.kiosks.pair.post", method: "POST", title: "Pair kiosk", description: "Pair kiosk", authRequired: true,
        renderable: true, renderModes: ["page"], dependencies: []
      }] },
      "frame.stats": { viewId: "frame.stats", title: "Stats", description: "Stats fragment", path: "/stats", pathVariants: [], operations: [{
        operationId: "frame.stats.read", method: "GET", title: "Stats", description: "Stats fragment", authRequired: true,
        renderable: true, renderModes: ["fragment"], dependencies: []
      }] },
      "frame.data": { viewId: "frame.data", title: "Data", description: "JSON data", path: "/data", pathVariants: [], operations: [{
        operationId: "frame.data.read", method: "GET", title: "Data", description: "JSON data", authRequired: true,
        renderable: false, renderModes: [], dependencies: []
      }] }
    } }]
  });
  const storage = new Storage(current);
  const cache = getManifestCache() as Map<string, CachedManifest>;
  const original = new Map(cache);
  cache.clear();
  t.after(() => { cache.clear(); for (const [key, value] of original) cache.set(key, value); });
  const handlers = new Map<string, (event: never) => Promise<Response>>();
  registerAdminApiRoutes(Object.fromEntries(["use", "get", "post", "put", "delete"].map(method => [method,
    (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`${method} ${path}`, handler)
  ])) as never, storage, {} as never);
  const call = (path: string, params: Record<string, string>, body?: Record<string, unknown>, headers: Record<string, string> = {}) => handlers.get(`post ${path}`)!({
    context: { params }, req: new Request("https://config.example" + path.replace(":appId", appId), {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body ?? {})
    })
  } as never);
  return { storage, call, cache, tenantId, appId, siblingAppId, otherAppId, platformId, sharedId };
}

function assertApiMounts(config: BetterPortalConfig, appId: string, serviceId: string) {
  const routes = config.apps.find(app => app.id === appId)!.routes.filter(route => route.serviceId === serviceId);
  assert.deepEqual(routes.map(route => route.operations[0]).sort(), ["frame.data.read", "frame.kiosks.pair.post", "frame.stats.read"]);
  assert.ok(routes.every(route => route.kind === "api" && route.enabled === false && route.enablement === "auto"));
  return routes;
}

test("scoped snapshots accept activated shared catalog IDs without a plugin ID", async t => {
  const { storage, tenantId } = fixture(t);
  const shared = storage.current.sharedServiceCatalog[0];
  shared.id = "shared-auth-primary";
  delete shared.serviceId;
  const activationId = uuidv7();
  storage.current.sharedServiceActivations.push({
    id: activationId, tenantId, sharedServiceId: shared.id, enabled: true,
    activatedAt: new Date().toISOString()
  });
  const scoped = ScopedServiceConfigSchema.parse(await storage.getScopedConfig(activationId, "tenant", tenantId));
  const projected = scoped.tenants[0].services.find(service => service.id === activationId)!;
  assert.equal(projected.serviceId, shared.id);
  assert.equal(projected.sharedServiceId, shared.id);
  assert.equal(projected.source, "shared");
  assert.equal(TenantServiceRegistrationSchema.safeParse({ ...projected, serviceId: "org.example.auth" }).success, true);
  assert.equal(TenantServiceRegistrationSchema.safeParse(projected).success, false,
    "tenant-owned registrations retain plugin ID validation");
});

test("activating an already-synced shared service creates API mounts immediately without a cache refresh or restart", async t => {
  const { storage, call, cache, tenantId, appId, siblingAppId, otherAppId, sharedId } = fixture(t);
  const activate = () => call("/.well-known/bp/admin/shared-services/:sharedServiceId/activations", { sharedServiceId: sharedId }, { tenantId, appId });
  assert.equal((await activate()).status, 200);
  const activationId = storage.current.sharedServiceActivations[0].id;
  const routes = assertApiMounts(storage.current, appId, activationId);
  const ids = routes.map(route => route.id);
  assert.equal(storage.current.apps.find(app => app.id === siblingAppId)!.routes.length, 0);
  assert.equal(storage.current.apps.find(app => app.id === otherAppId)!.routes.length, 0);
  assert.equal((await activate()).status, 200);
  assert.deepEqual(assertApiMounts(storage.current, appId, activationId).map(route => route.id), ids);

  const plugin = Object.create(Plugin.prototype) as any;
  plugin.storage = storage;
  plugin.cpState = { issuer: "https://config.example" };
  plugin.loadRequestConfig = () => storage.loadConfig();
  const event = { req: new Request(`https://config.example/routes?appId=${appId}`) } as any;
  await plugin.populateRoutesContext(event);
  assert.equal(event.__bpResponseModel.routes.length, 3);
  assert.ok(event.__bpResponseModel.routes.every((route: { kind: string }) => route.kind === "api"));
  assert.equal(event.__bpResponseModel.availableServices[0].views.find((operation: { operationId: string }) => operation.operationId === "frame.kiosks.read").renderable, true);
  assert.equal(event.__bpResponseModel.availableServices[0].views.find((operation: { operationId: string }) => operation.operationId === "frame.kiosks.pair.post").renderable, false);

  const mounted = await call("/.well-known/bp/admin/apps/:appId/routes", { appId }, {
    serviceId: activationId, viewId: "frame.kiosks", operationId: "frame.kiosks.read", path: "/frame/kiosks", title: "Kiosks"
  });
  assert.equal(mounted.status, 201, await mounted.text());
  const pair = storage.current.apps.find(app => app.id === appId)!.routes.find(route => route.operations.includes("frame.kiosks.pair.post"))!;
  assert.equal(pair.enabled, true);
  pair.enabled = false;
  pair.enablement = "disabled";
  assert.equal((await activate()).status, 200);
  assert.equal(storage.current.apps.find(app => app.id === appId)!.routes.find(route => route.id === pair.id)?.enabled, false);
  assert.equal(cache.size, 0);
});

test("management activation refreshes a previously disabled app binding from the accepted manifest", async t => {
  const { storage, call, cache, tenantId, appId, sharedId } = fixture(t);
  const activationId = uuidv7();
  storage.current.sharedServiceActivations.push({ id: activationId, sharedServiceId: sharedId, tenantId, appId, enabled: false, activatedAt: new Date().toISOString() });
  const response = await call("/.well-known/bp/manage/services/activate", {}, { sharedServiceId: sharedId }, { "x-bp-app-id": appId });
  assert.equal(response.status, 201, await response.text());
  assert.equal(storage.current.sharedServiceActivations[0].enabled, true);
  assertApiMounts(storage.current, appId, activationId);
  assert.equal(cache.size, 0);
});

test("reactivation refreshes existing API mounts and removes obsolete operations while retaining explicit enablement", async t => {
  const { storage, call, cache, tenantId, appId, sharedId } = fixture(t);
  const activate = () => call("/.well-known/bp/admin/shared-services/:sharedServiceId/activations", { sharedServiceId: sharedId }, { tenantId, appId });
  assert.equal((await activate()).status, 200);
  const activation = storage.current.sharedServiceActivations[0];
  activation.enabled = false;
  const app = storage.current.apps.find(app => app.id === appId)!;
  const pair = app.routes.find(route => route.operations.includes("frame.kiosks.pair.post"))!;
  pair.enablement = "disabled";
  pair.enabled = false;
  pair.query = "obsolete=true";
  const pairId = pair.id;
  const manifest = storage.current.manifestCache[0];
  const view = manifest.viewIndex["frame.kiosks.pair"];
  delete manifest.viewIndex["frame.kiosks.pair"];
  delete manifest.viewIndex["frame.stats"];
  manifest.viewIndex["frame.kiosks.pair.v2"] = {
    ...view, viewId: "frame.kiosks.pair.v2", path: "/kiosks/pair-v2",
    operations: view.operations.map(operation => ({ ...operation, title: "Pair kiosk v2" }))
  };
  assert.equal((await activate()).status, 200);
  const updated = storage.current.apps.find(app => app.id === appId)!;
  const route = updated.routes.find(route => route.id === pairId)!;
  assert.equal(route.viewId, "frame.kiosks.pair.v2");
  assert.equal(route.targetPath, "/kiosks/pair-v2");
  assert.equal(route.path, "/_bp/service/cloud.betterportal.frame/kiosks/pair-v2");
  assert.equal(route.title, "Pair kiosk v2");
  assert.equal(route.query, undefined);
  assert.equal(route.enabled, false);
  assert.equal(route.enablement, "disabled");
  assert.equal(updated.routes.some(route => route.operations.includes("frame.stats.read")), false);
  assert.equal(cache.size, 0);
});

test("persisted raw GET operations with page renderers stay in API routes and cannot be added as visual routes", async t => {
  const { storage, call, tenantId, appId, sharedId } = fixture(t);
  storage.current.manifestCache[0].viewIndex["frame.download"] = {
    viewId: "frame.download", title: "Download", description: "Download file", path: "/download", pathVariants: [], fragments: [],
    operations: [{ operationId: "frame.download.read", method: "GET", title: "Download", description: "Download file",
      raw: true, renderable: true, renderModes: ["page"], renderers: ["bootstrap5"], authRequired: true,
      dependencies: [], permissions: [], robots: [], apiContracts: [], demoScenarios: [] }]
  };
  assert.equal((await call("/.well-known/bp/admin/shared-services/:sharedServiceId/activations", { sharedServiceId: sharedId }, { tenantId, appId })).status, 200);
  const activationId = storage.current.sharedServiceActivations[0].id;
  const raw = storage.current.apps.find(app => app.id === appId)!.routes.find(route => route.operations.includes("frame.download.read"))!;
  assert.equal(raw.kind, "api");
  const plugin = Object.create(Plugin.prototype) as any;
  Object.assign(plugin, { storage, cpState: { issuer: "https://config.example" }, loadRequestConfig: () => storage.loadConfig() });
  const event = { req: new Request(`https://config.example/routes?appId=${appId}`) } as any;
  await plugin.populateRoutesContext(event);
  assert.equal(event.__bpResponseModel.availableServices[0].views.find((operation: { operationId: string }) => operation.operationId === "frame.download.read").renderable, false);
  assert.equal(event.__bpResponseModel.routes.find((route: { id: string }) => route.id === raw.id).kind, "api");
  const response = await call("/.well-known/bp/admin/apps/:appId/routes", { appId }, {
    serviceId: activationId, viewId: "frame.download", operationId: "frame.download.read", path: "/download"
  });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Service\/API routes are created by service manifest sync/);
});

test("platform activation and later app creation immediately project existing manifest APIs", async t => {
  const { storage, call, cache, tenantId, appId, siblingAppId, otherAppId, platformId } = fixture(t);
  const response = await call("/.well-known/bp/admin/tenants/:tenantId/activate/:platformServiceId", { tenantId, platformServiceId: platformId });
  assert.equal(response.status, 200, await response.text());
  assertApiMounts(storage.current, appId, platformId);
  assertApiMounts(storage.current, siblingAppId, platformId);
  assert.equal(storage.current.apps.find(app => app.id === otherAppId)!.routes.length, 0);
  setConfigManagerRouteContext({ storage, cpState: {} as never, serviceBaseUrl: "https://config.example" });
  await createTenantOrApp({ request: { entity: "app", tenantId, title: "Later app", hostnames: "later.example" } } as never);
  const later = storage.current.apps.find(app => app.title === "Later app")!;
  assert.ok(later);
  assertApiMounts(storage.current, later.id, platformId);
  assert.equal(cache.size, 0);
});
