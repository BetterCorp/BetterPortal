import assert from "node:assert/strict";
import { test } from "node:test";
import { BetterPortalConfigSchema, createBetterPortalApp, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage, ConfigRevisionConflictError } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
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
    if (this.conflict) {
      this.conflict();
      throw new ConfigRevisionConflictError(1, 2);
    }
    this.current = structuredClone(candidate);
    this.cached = undefined;
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
  return { storage, call, serviceId };
}

test("route update reloads stale snapshots and preserves concurrent config edits", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.tenants[0].title = "Concurrent tenant edit";
    storage.current.apps[0].routes[0].path = "/concurrent";
    storage.conflict = undefined;
  };
  assert.equal((await call("put", { title: "Updated" })).status, 200);
  assert.equal(storage.saves, 2);
  assert.equal(storage.current.tenants[0].title, "Concurrent tenant edit");
  assert.equal(storage.current.apps[0].routes[0].path, "/concurrent");
  assert.equal(storage.current.apps[0].routes[0].title, "Updated");
});

test("route update does not resurrect a concurrently deleted route", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => { storage.current.apps[0].routes = []; storage.conflict = undefined; };
  assert.equal((await call("put", { title: "Updated" })).status, 404);
  assert.equal(storage.saves, 1);
});

test("route deletion rechecks newly added menu references", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.apps[0].menu = [{ id: uuidv7(), title: "Home", routeId: storage.current.apps[0].routes[0].id }];
    storage.conflict = undefined;
  };
  assert.equal((await call("delete")).status, 409);
  assert.equal(storage.current.apps[0].routes.length, 1);
  assert.equal(storage.saves, 1);
});

test("route creation retries without duplicates and reads the request body once", async () => {
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

for (const html of [false, true]) test(`persistent route contention returns bounded retry response (html=${html})`, async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {};
  const response = await call("put", { title: "Updated" }, html);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "1");
  assert.equal(storage.saves, 5);
  assert.equal(storage.current.apps[0].routes[0].title, "Home");
});

test("unrelated storage errors are not retried", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => { throw new Error("database unavailable"); };
  await assert.rejects(call("put", { title: "Updated" }), /database unavailable/);
  assert.equal(storage.saves, 1);
});

test("changing /login to an already mounted service view succeeds after a conflict", async () => {
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
  assert.equal(storage.saves, 2);
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
