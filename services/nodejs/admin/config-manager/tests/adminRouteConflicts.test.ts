import assert from "node:assert/strict";
import { test } from "node:test";
import { BetterPortalConfigSchema, createBetterPortalApp, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage, ConfigRevisionConflictError, hashApiKey } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { registerAdminApiRoutes } from "../src/plugins/service-betterportal-config-manager/adminApi.js";

import { getManifestCache, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";

class ConflictStorage extends BaseStorage {
  cached?: BetterPortalConfig;
  saves = 0;
  conflict?: () => void;
  constructor(public current: BetterPortalConfig) { super(); }
  async loadConfig() { return structuredClone(this.cached ??= structuredClone(this.current)); }
  async saveConfig(candidate: BetterPortalConfig) {
    this.saves++;
    this.current = structuredClone(candidate);
    this.cached = undefined;
  }
  async mutateApp<T>(_appId: string, update: (config: BetterPortalConfig) => Promise<T>): Promise<T> {
    this.conflict?.();
    const config = structuredClone(this.current);
    const result = await update(config);
    await this.saveConfig(config);
    return result;
  }
  override invalidate() { this.cached = undefined; super.invalidate(); }
}

function fixture() {
  const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7(), routeId = uuidv7();
  const storage = new ConflictStorage(BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "tenant", title: "Tenant", services: [{
      id: serviceId, hostname: "https://service.example", apiKeyHash: "hash", createdAt: new Date().toISOString()
    }] }],
    apps: [{ id: appId, tenantId, slug: "app", title: "App", hostnames: ["app.example"], routes: [{
      id: routeId, kind: "page", path: "/", serviceId, viewId: "home", operations: ["home.view"], title: "Home", enabled: true
    }] }]
  }));
  const handlers = new Map<string, (event: never) => Promise<Response>>();
  registerAdminApiRoutes(Object.fromEntries(["use", "get", "post", "put", "delete"].map(method => [method,
    (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`${method} ${path}`, handler)
  ])) as never, storage, {} as never);
  function call(method: string, body?: Record<string, unknown>, html = false) {
    const path = `/.well-known/bp/admin/apps/:appId/routes${method === "post" ? "" : "/:routeId"}`;
    return handlers.get(`${method} ${path}`)!({
      context: { params: { appId, routeId } },
      req: new Request("https://config.example/routes", { method: method.toUpperCase(), headers: {
        "content-type": "application/json", ...(html ? { "hx-request": "true" } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) })
    } as never);
  }
  return { storage, call, serviceId, handlers, appId, tenantId };
}

test("route update reads current rows inside its transaction and preserves concurrent config edits", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.tenants[0].title = "Concurrent tenant edit";
    storage.current.apps[0].routes[0].path = "/concurrent";
    storage.conflict = undefined;
  };
  assert.equal((await call("put", { title: "Updated" })).status, 200);
  assert.equal(storage.saves, 1);
  assert.equal(storage.current.tenants[0].title, "Concurrent tenant edit");
  assert.equal(storage.current.apps[0].routes[0].path, "/concurrent");
  assert.equal(storage.current.apps[0].routes[0].title, "Updated");
});

test("route update does not resurrect a concurrently deleted route", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => { storage.current.apps[0].routes = []; storage.conflict = undefined; };
  assert.equal((await call("put", { title: "Updated" })).status, 404);
  assert.equal(storage.saves, 0);
});

test("route deletion rechecks newly added menu references", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.apps[0].menu = [{ id: uuidv7(), title: "Home", routeId: storage.current.apps[0].routes[0].id }];
    storage.conflict = undefined;
  };
  assert.equal((await call("delete")).status, 409);
  assert.equal(storage.current.apps[0].routes.length, 1);
  assert.equal(storage.saves, 0);
});

test("route creation uses one transaction without duplicates and reads the request body once", async () => {
  const { storage, call, serviceId } = fixture();
  storage.conflict = () => { storage.current.tenants[0].title = "Concurrent"; storage.conflict = undefined; };
  (getManifestCache() as Map<string, CachedManifest>).set(serviceId, {
    serviceId, viewIndex: { new: { path: "/new", pathVariants: [], operations: [{
      operationId: "new.view", method: "GET", renderModes: ["page"], dependencies: []
    }] } }
  } as unknown as CachedManifest);
  const response = await call("post", { path: "/new", serviceId, viewId: "new", operationId: "new.view", title: "New" });
  assert.equal(response.status, 201, await response.text());
  assert.equal(storage.current.apps[0].routes.length, 2);
  assert.equal(storage.current.tenants[0].title, "Concurrent");
});

test("native route forms accept untyped variant parameters and partial edits retain saved fixed values", async t => {
  const { storage, handlers, serviceId, appId } = fixture();
  const cache = getManifestCache();
  t.after(() => cache.delete(serviceId));
  cache.set(serviceId, { serviceId, viewIndex: { "crm.manage": {
    path: "/manage", pathVariants: ["/manage", "/manage/:section"], paramsSchema: {}, operations: [{
      operationId: "crm.management.read", method: "GET", renderModes: ["page"], dependencies: []
    }]
  } } } as unknown as CachedManifest);
  const send = (method: string, values: Record<string, string>, routeId?: string) => handlers.get(
    `${method} /.well-known/bp/admin/apps/:appId/routes${routeId ? "/:routeId" : ""}`
  )!({ context: { params: { appId, routeId } }, req: new Request("https://config.example/routes", {
    method: method.toUpperCase(), headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "hx-request": "true" },
    body: new URLSearchParams(values)
  }) } as never);
  const created = await send("post", { serviceId, viewId: "crm.manage", operationId: "crm.management.read", path: "/crm/users",
    servicePathVariant: "/manage/:section", "fixedParam.section": "users", title: "Users", query: "" });
  assert.equal(created.status, 200, await created.text());
  const mounted = storage.current.apps[0].routes.find(route => route.path === "/crm/users")!;
  assert.deepEqual(mounted.fixedParams, { section: "users" });
  for (const values of [{ enabled: "false" }, { title: "People" }, { query: "tab=roles" }]) {
    const changed = await send("put", values, mounted.id);
    assert.equal(changed.status, 200, await changed.text());
    assert.deepEqual(storage.current.apps[0].routes.find(route => route.id === mounted.id)?.fixedParams, { section: "users" });
  }
  const invalid = await send("put", { "fixedParam.section": "" }, mounted.id);
  assert.equal(invalid.status, 400);
  assert.match(await invalid.text(), /must appear in the app path or have a fixed value/);
});

for (const alias of ["instance", "plugin", "shared"] as const) {
  test(`visual routes use the persisted ${alias} manifest even when the hot cache is missing or stale`, async t => {
    const { storage, call, serviceId, tenantId, appId } = fixture();
    const pluginId = "cloud.betterportal.frame";
    storage.current.tenants[0].services[0].serviceId = pluginId;
    let manifestKey = alias === "plugin" ? pluginId : serviceId;
    if (alias === "shared") {
      const sharedId = uuidv7();
      manifestKey = sharedId;
      storage.current.tenants[0].services = [];
      storage.current.sharedServiceCatalog.push({ id: sharedId, serviceId: pluginId, title: "BetterFrame",
        baseUrl: "https://frame.example", apiKeyHash: "test-only", enabled: true, tags: [] });
      storage.current.sharedServiceActivations.push({ id: serviceId, sharedServiceId: sharedId, tenantId, appId,
        enabled: true, activatedAt: new Date().toISOString() });
    }
    storage.current.manifestCache.push({ serviceId: manifestKey, manifestVersion: "2", fetchedAt: new Date().toISOString(), viewIndex: {
      "frame.kiosks": { viewId: "frame.kiosks", title: "Kiosks", path: "/kiosks", pathVariants: [], operations: [{
        operationId: "frame.kiosks.read", method: "GET", title: "Kiosks", description: "List kiosks", authRequired: true, renderable: true, renderModes: ["page"],
        dependencies: [{ operationId: "frame.kiosks.pair.post", method: "POST" }]
      }] },
      "frame.kiosks.pair": { viewId: "frame.kiosks.pair", title: "Pair kiosk", path: "/kiosks/pair", pathVariants: [], operations: [{
        operationId: "frame.kiosks.pair.post", method: "POST", title: "Pair kiosk", description: "Pair kiosk", authRequired: true, renderable: true, renderModes: ["page"], dependencies: []
      }] }
    } } as never);
    const cache = getManifestCache() as Map<string, CachedManifest>;
    const original = cache.get(serviceId);
    t.after(() => { if (original) cache.set(serviceId, original); else cache.delete(serviceId); });

    for (const stale of [false, true]) {
      if (stale) cache.set(serviceId, { serviceId, manifestVersion: "1", fetchedAt: 0,
        viewIndex: { "frame.kiosks": { operations: [{ operationId: "frame.kiosks.read", method: "GET", renderModes: [] }] } }
      } as unknown as CachedManifest);
      else cache.delete(serviceId);
      const path = stale ? "/frame/kiosks-alias" : "/frame/kiosks";
      const response = await call("post", { serviceId, viewId: "frame.kiosks", operationId: "frame.kiosks.read",
        path, servicePathVariant: "/kiosks", title: "Kiosks", query: "status=online" });
      assert.equal(response.status, 201, await response.text());
      const mounted = storage.current.apps[0].routes.find(route => route.path === path);
      assert.equal(mounted?.kind, "page");
      assert.equal(mounted?.targetPath, "/kiosks");
      assert.equal(mounted?.query, "status=online");
    }
    const dependency = storage.current.apps[0].routes.filter(route => route.operations.includes("frame.kiosks.pair.post"));
    assert.equal(dependency.length, 1);
    assert.equal(dependency[0].kind, "api");
    assert.equal(dependency[0].enabled, true);

    const update = await call("put", { serviceId, viewId: "frame.kiosks", operationId: "frame.kiosks.read", servicePathVariant: "/kiosks" });
    assert.equal(update.status, 200, await update.text());
    assert.equal(storage.current.apps[0].routes[0].kind, "page");
    assert.equal(storage.current.apps[0].routes[0].targetPath, "/kiosks");

    const api = await call("post", { serviceId, viewId: "frame.kiosks.pair", operationId: "frame.kiosks.pair.post",
      path: "/frame/pair", title: "Pair kiosk" });
    assert.equal(api.status, 400);
    assert.equal((await api.json()).error, "Service/API routes are created by service manifest sync.");
  });
}

test("a missing service manifest reports missing sync rather than classifying a page as API-only", async t => {
  const { call, serviceId } = fixture();
  const cache = getManifestCache() as Map<string, CachedManifest>;
  const original = cache.get(serviceId);
  cache.delete(serviceId);
  t.after(() => { if (original) cache.set(serviceId, original); });
  const response = await call("post", { serviceId, viewId: "frame.kiosks", operationId: "frame.kiosks.read", path: "/frame/kiosks", title: "Kiosks" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Service manifest is not synced yet/);
});

test("unrelated storage errors are not retried", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => { throw new Error("database unavailable"); };
  await assert.rejects(call("put", { title: "Updated" }), /database unavailable/);
  assert.equal(storage.saves, 0);
});

test("changing /login to an already mounted service view uses the current transaction state", async () => {
  const { storage, call } = fixture();
  const serviceId = uuidv7();
  storage.current.tenants[0].services.push({ ...storage.current.tenants[0].services[0], id: serviceId });
  storage.current.apps[0].routes[0].path = "/login";
  storage.current.apps[0].routes.push({ ...storage.current.apps[0].routes[0],
    id: uuidv7(), path: "/sign-in", serviceId, viewId: "login", operations: ["login.view"], targetPath: "/session/login"
  });
  (getManifestCache() as Map<string, CachedManifest>).set(serviceId, {
    serviceId, viewIndex: { login: { path: "/session/login", pathVariants: [], operations: [{
      operationId: "login.view", method: "GET", renderModes: ["page"], dependencies: []
    }] } }
  } as unknown as CachedManifest);
  storage.conflict = () => { storage.current.tenants[0].title = "Concurrent"; storage.conflict = undefined; };
  const response = await call("put", { serviceId, viewId: "login", operationId: "login.view" });
  assert.equal(response.status, 200, await response.text());
  const [login, alias] = storage.current.apps[0].routes;
  assert.equal(login.path, "/login");
  assert.equal(login.serviceId, alias.serviceId);
  assert.equal(login.viewId, alias.viewId);
  assert.equal(login.targetPath, alias.targetPath);
  assert.equal(alias.path, "/sign-in");
  assert.equal(storage.saves, 1);
});

test("creating another frontend path for an existing view succeeds", async () => {
  const { storage, call, serviceId } = fixture();
  storage.current.apps[0].routes[0].targetPath = "/home";
  (getManifestCache() as Map<string, CachedManifest>).set(serviceId, {
    serviceId, viewIndex: { home: { path: "/home", pathVariants: [], operations: [{
      operationId: "home.view", method: "GET", renderModes: ["page"], dependencies: []
    }] } }
  } as unknown as CachedManifest);
  const response = await call("post", { path: "/alias", serviceId, viewId: "home", operationId: "home.view", title: "Alias" });
  assert.equal(response.status, 201, await response.text());
  assert.deepEqual(storage.current.apps[0].routes.map(route => route.path), ["/", "/alias"]);
});

test("editing a route still rejects a duplicate frontend path", async () => {
  const { storage, call } = fixture();
  storage.current.apps[0].routes.push({ ...storage.current.apps[0].routes[0], id: uuidv7(), path: "/taken" });
  assert.equal((await call("put", { path: "/taken" })).status, 400);
  assert.equal(storage.saves, 0);
});


test("unrecovered same-entity conflicts are HTTP 409 through the framework", async () => {
  const app = createBetterPortalApp();
  app.get("/conflict", () => { throw new ConfigRevisionConflictError(1, 2, "app/test"); });
  assert.equal((await app.fetch(new Request("https://config.example/conflict"))).status, 409);
});

for (const endpoint of ["roles/sync", "self-mutation"]) test(`${endpoint} authenticates before its transaction and checks current ownership`, async () => {
  const { storage, handlers, appId, tenantId, serviceId } = fixture();
  storage.current.tenants[0].services[0].apiKeyHash = hashApiKey("test-key");
  storage.current.apps[0].auth = { serviceId, expectedIssuer: "issuer", expectedAudience: "app",
    jwksUri: "https://service.example/jwks", roles: [] };
  let inTransaction = false, validations = 0;
  const validate = storage.validateApiKey.bind(storage), mutate = storage.mutateApp.bind(storage);
  storage.validateApiKey = async key => {
    assert.equal(inTransaction, false, "authentication must not acquire a second client inside the transaction");
    validations++;
    return validate(key);
  };
  storage.mutateApp = async (id, update) => {
    inTransaction = true;
    try { return await mutate(id, update); } finally { inTransaction = false; }
  };
  const path = endpoint === "roles/sync" ? "apps/:appId/auth/roles/sync" : "services/self-mutation";
  const roles = [{ id: "reader", title: "Reader", permissions: [{ serviceId, viewId: "home", permissions: ["read"] }] }];
  const call = (key = "test-key") => handlers.get(`put /.well-known/bp/admin/${path}`)!({
    context: { params: { appId } }, req: new Request("https://config.example/sync", {
      method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(endpoint === "roles/sync" ? { roles } : { tenantId, appId, type: "auth", mutation: { roles } })
    })
  } as never);
  assert.equal((await call()).status, 200);
  assert.equal(validations, 1);
  assert.equal(storage.saves, 1);
  storage.conflict = () => { storage.current.apps[0].auth!.serviceId = uuidv7(); };
  assert.equal((await call()).status, 403, "ownership must use the fresh transaction snapshot");
  assert.equal((await call("invalid-key")).status, 403);
  assert.equal(storage.saves, 1);
});
