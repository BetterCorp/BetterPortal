import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, createNavigationAccess, uuidv7, type BetterPortalApp, type JwtClaims } from "@betterportal/framework";
import { Plugin } from "../src/plugins/service-betterportal-theme-embedded/index.js";

test("embedded fragment-only bindings retain permitted metadata without a page mount", () => {
  const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7();
  const fragment = { serviceId, fragmentId: "card", targetPath: "/widget", enabled: true,
    resolvedPolicy: { viewId: "widget", operationId: "widget.read", auth: { required: true, permissions: [] } } };
  const app = { id: appId, tenantId, routes: [], fragments: { embedded: [fragment] }, auth: { serviceId,
    expectedIssuer: "https://auth.test", expectedAudience: "app", jwksUri: "https://auth.test/keys", roleClaimPath: "roles",
    roles: [{ id: "reader", title: "Reader", permissions: [{ serviceId, viewId: "widget", permissions: ["read"] }] }] } } as unknown as BetterPortalApp;
  const context = { app, tenant: { id: tenantId, services: [{ id: serviceId, enabled: true, hostname: "https://service.test", serviceId: "org.example.widgets" }], activatedPlatformServices: [] } };
  const config = { sharedServiceActivations: [], sharedServiceCatalog: [], platformServices: [], manifestCache: [] };
  const plugin = Object.create(Plugin.prototype) as any;
  const links = () => plugin.buildRouteLinks(config, context, "/", "https://app.test", createNavigationAccess(app, { tenantId, appId, roles: ["reader"] } as JwtClaims));
  assert.deepEqual(links(), [{ id: "fragment:card", href: "/widget", requestUrl: "https://service.test/widget", serviceId, active: false }]);
  assert.equal(app.routes.length, 0);
  assert.deepEqual(plugin.buildRouteLinks(config, context, "/", "https://app.test", createNavigationAccess(app, undefined)), []);
  delete app.fragments.embedded[0].resolvedPolicy;
  assert.deepEqual(links(), []);
});


test("an unknown navigation snapshot returns a retryable response", async () => {
  const tenantId = uuidv7(), appId = uuidv7(), shellId = uuidv7();
  const config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "t", title: "Tenant", services: [
    { id: shellId, serviceId: "org.betterportal.theme-embedded", hostname: "https://theme.test", createdAt: new Date().toISOString() }
  ] }], apps: [{ id: appId, tenantId, slug: "a", title: "App", hostnames: ["app.test"], shell: { serviceId: shellId } }],
    manifestCache: [{ serviceId: shellId, manifestVersion: "1", fetchedAt: new Date().toISOString(), shell: { service: "embedded", renderer: "bootstrap5", fragments: [] } }] });
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
