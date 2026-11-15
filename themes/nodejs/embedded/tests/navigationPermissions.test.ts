import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationAccess, uuidv7, type BetterPortalApp, type JwtClaims } from "@betterportal/framework";
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
