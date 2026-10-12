import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, ScopedServiceConfigSchema, menuItemVisible, createBetterPortalApp, uuidv7 } from "@betterportal/framework";
import { getManifestCache, injectResolvedServicePaths, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { registerMenuEditorRoutes } from "../src/plugins/service-betterportal-config-manager/menuEditor.js";
import { isMenuRouteExcluded } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";

const serviceId = uuidv7();
const routeId = uuidv7();
const cached = {
  serviceId: "org.example.auth", viewIndex: { login: { viewId: "login", title: "Login", path: "/login", pathVariants: [], operations: [
    { operationId: "login.get", method: "GET", renderModes: ["page"], menu: false, authRequired: false, robots: [], permissions: [], dependencies: [] }
  ] } }
} as unknown as CachedManifest;

test("service menu exclusion overrides app configuration and changes with the manifest", () => {
  const route = { serviceId, viewId: "login", operations: ["login.get"], menu: true };
  assert.equal(isMenuRouteExcluded(route, new Map([[serviceId, cached]])), true);
  const allowed = structuredClone(cached);
  delete allowed.viewIndex.login.operations[0].menu;
  assert.equal(isMenuRouteExcluded({ ...route, menu: false }, new Map([[serviceId, allowed]])), false);
});

test("menu editor rejects excluded routes and offers visible audience controls without manual role input", async () => {
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
    const html = await response.text();
    assert.match(html, /Only signed out/);
    assert.match(html, /type="radio"[^>]*name="authStatus"/);
    assert.doesNotMatch(html, /name="rolesAnyOf"|<details><summary[^>]*>Visibility/);
    assert.equal((await post("save-visibility", { itemId: groupId, authStatus: "hide-unauthorized", rolesAnyOf: "staff, manager,staff" })).status, 200);
    assert.equal(config.apps[0].menu[0].rolesAnyOf, undefined, "manual roles are not accepted by the editor");
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


test("theme scopes include only activated enabled platform aliases and never service credentials", async () => {
  const { BaseStorage } = await import("../src/plugins/service-betterportal-config-manager/storage/core.js");
  const tenantId = uuidv7(), appId = uuidv7(), shellId = uuidv7(), platformId = uuidv7(), disabledId = uuidv7(), otherId = uuidv7();
  const createdAt = new Date().toISOString();
  const config = BetterPortalConfigSchema.parse({
    platformServices: [platformId, disabledId, otherId].map((id, index) => ({ id, title: "Platform", serviceId: `org.example.platform${index}`, hostname: `https://platform${index}.test`, apiKeyHash: "DO-NOT-SYNC", enabled: id !== disabledId, createdAt })),
    tenants: [{ id: tenantId, slug: "tenant", title: "Tenant", branding: {}, activatedPlatformServices: [platformId, disabledId], services: [
      { id: shellId, serviceId: "org.example.shell", hostname: "https://shell.test", apiKeyHash: "DO-NOT-SYNC", createdAt }
    ] }], apps: [{ id: appId, tenantId, slug: "app", title: "App", hostnames: ["app.test"], shell: { serviceId: shellId } }]
  });
  class Store extends BaseStorage {
    async loadConfig() { return config; }
    async saveConfig() {}
  }
  const scoped = await new Store().getScopedConfig(shellId, "tenant", tenantId);
  const services = scoped.tenants[0].services;
  const aliases = Object.fromEntries(services.map(service => [service.id, service.serviceId ?? service.id]));
  assert.equal(aliases[platformId], "org.example.platform0");
  assert.equal(aliases[disabledId], undefined);
  assert.equal(aliases[otherId], undefined);
  assert.equal(services.find(service => service.id === platformId)?.source, "platform");
  assert.ok(!JSON.stringify(scoped).includes("DO-NOT-SYNC"));
  const route = { id: routeId, kind: "page" as const, path: "/platform", serviceId: platformId, viewId: "platform", enabled: true, operations: ["platform.get"], authRequired: true,
    menuPermissions: [{ serviceId: "org.example.platform0", viewId: "platform", permissions: ["read"] }] };
  assert.equal(menuItemVisible({ authStatus: "auto" }, route, { status: "authenticated", permissions: [{ serviceId: platformId, viewId: "platform", permissions: ["read"] }] }, aliases), true);
});

test("saving a group audience cascades through all descendants and enforces route permissions", async () => {
  const tenantId = uuidv7(), appId = uuidv7(), groupId = uuidv7();
  const { filterThemeMenu } = await import("@betterportal/framework");
  let config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "t", title: "Tenant" }],
    apps: [{ id: appId, tenantId, slug: "a", title: "App", hostnames: ["app.test"], routes: [
      { id: routeId, serviceId, viewId: "accounts", path: "/accounts", operations: ["accounts.get"], authRequired: true,
        menuPermissions: [{ serviceId, viewId: "accounts", permissions: ["read"] }] }
    ], menu: [{ id: groupId, type: "group", authStatus: "hide-unauthorized", children: [
      { id: uuidv7(), type: "group", children: [
        { id: uuidv7(), type: "link", routeId, authStatus: "show", serviceStatus: "hide", enabled: false },
        { id: uuidv7(), type: "link", routeId, authStatus: "show" }
      ] }, { id: uuidv7(), type: "external", href: "https://example.com", authStatus: "show" }
    ] }, { id: uuidv7(), type: "external", href: "https://example.com", authStatus: "show" }] }]
  });
  const app = createBetterPortalApp();
  registerMenuEditorRoutes(app, { loadConfig: async () => structuredClone(config), saveConfig: async next => { config = next; } });
  const routes = structuredClone(config.apps[0].routes);
  for (const authStatus of ["hide-unauthorized", "show-unauthenticated", "show", "hide-unauthenticated", "auto"]) {
    const response = await app.fetch(new Request("https://config.test/.well-known/bp/admin/menu-editor/save-visibility", {
      method: "POST", body: new URLSearchParams({ appId, itemId: groupId, authStatus })
    }));
    assert.equal(response.status, 200);
    const group = config.apps[0].menu[0];
    assert.equal(group.authStatus, authStatus);
    assert.equal(group.children[0].authStatus, authStatus);
    assert.ok(group.children[0].children.every(child => child.authStatus === authStatus));
    assert.equal(group.children[1].authStatus, authStatus);
    assert.equal(config.apps[0].menu[1].authStatus, "show");
    assert.equal(group.children[0].children[0].enabled, false);
    assert.equal(group.children[0].children[0].serviceStatus, "hide");
    assert.deepEqual(config.apps[0].routes, routes);
    if (authStatus === "hide-unauthorized") {
      for (const status of ["anonymous", "unknown"] as const) {
        assert.deepEqual(filterThemeMenu(config.apps[0], { status, permissions: [] }).map(item => item.id), [config.apps[0].menu[1].id]);
      }
      const denied = filterThemeMenu(config.apps[0], { status: "authenticated", permissions: [] });
      assert.equal(denied[0].children.length, 1, "nested group disappears when all route children are unauthorized");
      const allowed = filterThemeMenu(config.apps[0], { status: "authenticated", permissions: [{ serviceId, viewId: "accounts", permissions: ["read"] }] });
      assert.equal(allowed[0].children[0].children.length, 1);
    }
  }
});
