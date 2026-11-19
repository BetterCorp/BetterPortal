import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, createNavigationAccess, uuidv7, type BetterPortalApp, type JwtClaims } from "@betterportal/framework";
import { Plugin } from "../src/plugins/service-betterportal-theme-bootstrap2/index.js";

test("server omits unauthorized menu groups and route metadata before rendering", () => {
  const serviceId = uuidv7(), tenantId = uuidv7(), appId = uuidv7();
  const route = { id: uuidv7(), path: "/batches", serviceId, viewId: "batches", title: "Private batches", kind: "page" as const,
    enabled: true, operations: ["batches.read"], resolvedMethods: ["GET" as const], resolvedServicePath: "/batches",
    resolvedAuth: [{ operationId: "batches.read", method: "GET" as const, auth: { required: true, callers: ["user" as const], permissions: [] } }] };
  const app = { id: appId, tenantId, routes: [route], menu: [{ id: uuidv7(), type: "group", title: "Private group", enabled: true, children: [
    { id: uuidv7(), type: "link", enabled: true, routeId: route.id, authStatus: "hide-unauthorized" }
  ] }], auth: { serviceId, expectedIssuer: "https://auth.test", expectedAudience: "app", jwksUri: "https://auth.test/jwks", roleClaimPath: "roles",
    roles: [{ id: "reader", title: "Reader", permissions: [{ serviceId, viewId: "batches", permissions: ["read"] }] }] } } as unknown as BetterPortalApp;
  const context = { app, tenant: { id: tenantId, services: [{ id: serviceId, enabled: true, hostname: "https://service.test", serviceId: "org.example.batches" }], activatedPlatformServices: [] } };
  const config = { sharedServiceActivations: [], sharedServiceCatalog: [], platformServices: [], manifestCache: [] };
  const plugin = Object.create(Plugin.prototype) as any;
  const anonymous = createNavigationAccess(app, undefined);
  assert.deepEqual(plugin.buildAppNavItems(config, context, "/", "https://app.test", anonymous), []);
  assert.deepEqual(plugin.buildRouteLinks(config, context, "/", "https://app.test", anonymous), []);
  const claims = { tenantId, appId, roles: ["reader"] } as JwtClaims;
  const allowed = createNavigationAccess(app, claims);
  const nav = plugin.buildAppNavItems(config, context, "/", "https://app.test", allowed);
  assert.equal(nav[0].items[0].route.title, "Private batches");
  const links = plugin.buildRouteLinks(config, context, "/", "https://app.test", allowed);
  assert.equal(links[0].href, "/batches");
  assert.equal(links[0].servicePath, "/batches");
  assert.deepEqual(links[0].methods, ["GET"]);
  app.menu = [];
  assert.equal(plugin.buildRouteLinks(config, context, "/", "https://app.test", allowed)[0].href, "/batches", "allowed non-menu routes retain their routing metadata");
  app.auth!.roles = [];
  const revoked = createNavigationAccess(app, claims);
  assert.deepEqual(plugin.buildAppNavItems(config, context, "/", "https://app.test", revoked), []);
  assert.deepEqual(plugin.buildRouteLinks(config, context, "/", "https://app.test", revoked), []);
});


test("an unknown navigation snapshot returns a retryable response", async () => {
  const tenantId = uuidv7(), appId = uuidv7(), shellId = uuidv7();
  const config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "t", title: "Tenant", services: [
    { id: shellId, serviceId: "org.betterportal.theme-bootstrap2", hostname: "https://theme.test", createdAt: new Date().toISOString() }
  ] }], apps: [{ id: appId, tenantId, slug: "a", title: "App", hostnames: ["app.test"], shell: { serviceId: shellId } }],
    manifestCache: [{ serviceId: shellId, manifestVersion: "1", fetchedAt: new Date().toISOString(), shell: { service: "bootstrap2", renderer: "bootstrap5", fragments: [] } }] });
  const plugin = Object.create(Plugin.prototype) as any;
  plugin.requirePortalConfig = () => config;
  plugin.headerTrustOptions = () => ({});
  plugin.tagRequestContext = () => {};
  plugin.navigationAccess = async () => ({ status: "unknown", permissions: [], canAccess: () => false, canAccessFragment: () => false });
  const url = new URL("https://app.test/.well-known/bp/theme/navigation");
  const response = await plugin.handleThemeNavigation({ url, context: {}, req: new Request(url, {
    headers: { Origin: "https://app.test", Host: "app.test", "HX-Current-URL": "https://app.test/" }
  }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
