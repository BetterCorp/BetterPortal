import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, ScopedServiceConfigSchema, createBetterPortalApp, uuidv7 } from "@betterportal/framework";
import { getManifestCache, injectResolvedServicePaths, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { registerMenuEditorRoutes } from "../src/plugins/service-betterportal-config-manager/menuEditor.js";
import { isMenuRouteExcluded } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";

const serviceId = uuidv7();
const routeId = uuidv7();
const cached = {
  serviceId: "org.example.auth", viewIndex: { login: { viewId: "login", title: "Login", path: "/login", operations: [
    { operationId: "login.get", method: "GET", renderModes: ["page"], menu: false }
  ] } }
} as unknown as CachedManifest;

test("service menu exclusion overrides app configuration and changes with the manifest", () => {
  const route = { serviceId, viewId: "login", operations: ["login.get"], menu: true };
  assert.equal(isMenuRouteExcluded(route, new Map([[serviceId, cached]])), true);
  const allowed = structuredClone(cached);
  delete allowed.viewIndex.login.operations[0].menu;
  assert.equal(isMenuRouteExcluded({ ...route, menu: false }, new Map([[serviceId, allowed]])), false);
});

test("menu editor rejects excluded routes and persists public-only and role visibility", async () => {
  const tenantId = uuidv7(), appId = uuidv7(), groupId = uuidv7();
  let config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "t", title: "Tenant", branding: {}, services: [] }],
    apps: [{ id: appId, tenantId, slug: "a", title: "App", hostnames: ["app.test"], routes: [
      { id: routeId, kind: "page", serviceId, viewId: "login", path: "/login", operations: ["login.get"] }
    ], menu: [{ id: groupId, type: "group", title: "Public" }] }]
  });
  getManifestCache().set(serviceId, cached);
  const app = createBetterPortalApp();
  registerMenuEditorRoutes(app, { loadConfig: async () => structuredClone(config), saveConfig: async next => { config = next; } });
  const post = (path: string, values: Record<string, string>) => app.fetch(new Request(`https://config.test/.well-known/bp/admin/menu-editor/${path}`, {
    method: "POST", body: new URLSearchParams({ appId, ...values })
  }));
  try {
    assert.equal((await post("add", { type: "link", routeId })).status, 400);
    assert.equal(config.apps[0].menu.length, 1);
    assert.equal(config.apps[0].routes.length, 1, "excluded route remains mounted");
    const response = await post("save-visibility", { itemId: groupId, authStatus: "show-unauthenticated", rolesAnyOf: "" });
    assert.equal(response.status, 200);
    assert.equal(config.apps[0].menu[0].authStatus, "show-unauthenticated");
    assert.match(await response.text(), /Only signed out/);
    assert.equal((await post("save-visibility", { itemId: groupId, authStatus: "hide-unauthorized", rolesAnyOf: "staff, manager,staff" })).status, 200);
    assert.deepEqual(config.apps[0].menu[0].rolesAnyOf, ["staff", "manager"]);
  } finally { getManifestCache().delete(serviceId); }
});

test("preview reconciliation uses automatic visibility and removes newly excluded entries", async () => {
  const { createPreviewGroup, provisionPreviewDeployment, reconcilePreviewService } = await import("../src/plugins/service-betterportal-config-manager/previewEnvironments.js");
  const tenantId = uuidv7(), appId = uuidv7();
  const config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services: [] }],
    apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["source.test"] }] });
  const { group } = createPreviewGroup(config, { name: "Preview", sourceTenantId: tenantId, sourceAppId: appId, expiresInDays: 7 });
  const { deployment } = provisionPreviewDeployment(config, group.id, { key: "menu", hostname: "preview.test", services: [{ serviceId: "org.example.auth", url: "https://auth.preview.test" }] }, "https://config.test");
  const manifest = { ...structuredClone(cached), manifestVersion: "1", capabilities: [], apiContracts: [], m2mRequests: [], developerResources: [], configSchemas: [], webhooks: [], fetchedAt: Date.now() };
  const view = manifest.viewIndex.login;
  Object.assign(view, { description: "Login", pathVariants: [], fragments: [] });
  Object.assign(view.operations[0], { menu: true, title: "Login", description: "Login", renderers: ["bootstrap5"], authRequired: true, robots: [], dependencies: [], permissions: [], renderable: true, apiContracts: [], demoScenarios: [] });
  reconcilePreviewService(config, deployment.services[0].instanceId, manifest);
  const app = config.apps.find(app => app.id === deployment.appId)!;
  assert.equal(app.menu[0].authStatus, "auto");
  assert.equal(app.menu[0].children[0].authStatus, "auto");
  view.operations[0].menu = false;
  reconcilePreviewService(config, deployment.services[0].instanceId, manifest);
  assert.equal(app.menu.length, 0);
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].enabled, true);
});


test("scoped config carries authoritative menu requirements and updates them on manifest changes", () => {
  const tenantId = uuidv7(), appId = uuidv7();
  const config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services: [
    { id: serviceId, serviceId: "org.example.auth", hostname: "https://auth.test", apiKeyHash: "test-only", createdAt: new Date().toISOString() }
  ] }], apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["app.test"], routes: [
    { id: routeId, serviceId, viewId: "login", path: "/login", operations: ["login.get"], menu: true }
  ] }] });
  const scoped = ScopedServiceConfigSchema.parse({ managementOrigins: [], tenants: config.tenants, apps: config.apps });
  const manifest = structuredClone(cached);
  Object.assign(manifest.viewIndex.login, { pathVariants: [] });
  Object.assign(manifest.viewIndex.login.operations[0], { authRequired: true, robots: [], permissions: [
    { serviceId: "org.example.auth", viewId: "accounts", permissions: ["read"] }
  ] });
  getManifestCache().set(serviceId, manifest);
  try {
    const projected = injectResolvedServicePaths(scoped).apps[0].routes[0];
    assert.equal(projected.menu, false);
    assert.equal(projected.authRequired, true);
    assert.deepEqual(projected.menuPermissions, [{ serviceId, viewId: "accounts", permissions: ["read"] }]);
    manifest.viewIndex.login.operations[0].menu = true;
    manifest.viewIndex.login.operations[0].permissions = [];
    const updated = injectResolvedServicePaths(scoped).apps[0].routes[0];
    assert.equal(updated.menu, true);
    assert.deepEqual(updated.menuPermissions, []);
  } finally { getManifestCache().delete(serviceId); }
});
