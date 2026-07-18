import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRouteTree, flattenRouteTree } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_theme.bootstrap1/GET.js";
import { appRoutePatternKey } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";
import { applyVerifiedServiceOrigin } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";
import { getCachedManifestForService, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { render as renderTenants } from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/_theme.bootstrap1/GET.js";
import {
  BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY,
  PROVIDER_ROLE_AUTHORITY_CAPABILITY,
  resolveRoleAuthority
} from "../src/plugins/service-betterportal-config-manager/roleAuthority.js";

test("visual routes include the root mount", () => {
  const route = {
    id: "root-route",
    path: "/",
    serviceId: "service.example",
    viewId: "home",
    title: "Home",
    enabled: true
  };
  const rows = flattenRouteTree(buildRouteTree([route]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.path, "/");
  assert.equal(rows[0]?.route?.id, "root-route");
});

test("duplicate route keys follow runtime route matching", () => {
  assert.equal(appRoutePatternKey("/"), appRoutePatternKey("//"));
  assert.equal(appRoutePatternKey("/users/:id"), appRoutePatternKey("/users/{userId}/"));
  assert.notEqual(appRoutePatternKey("/users/new"), appRoutePatternKey("/users/:id"));
});

test("hostname changes require the exact instance API key", () => {
  const service = { hostname: "https://old.example" } as never;
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "other", "https://new.example"), false);
  assert.equal((service as { hostname: string }).hostname, "https://old.example");
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "expected", "https://new.example"), true);
  assert.equal((service as { hostname: string }).hostname, "https://new.example");
});

test("shared activation manifest lookup falls back to its shared service", () => {
  const manifest = { serviceId: "service.example" } as CachedManifest;
  const cache = new Map([["shared-service", manifest]]);
  const config = {
    sharedServiceActivations: [{ id: "activation", sharedServiceId: "shared-service" }],
    sharedServiceCatalog: [{ id: "shared-service", serviceId: "service.example" }],
    tenants: [],
    platformServices: []
  } as never;
  assert.equal(getCachedManifestForService(config, "activation", cache), manifest);
});

test("tenant edit script targets the active checkbox, not its hidden fallback", () => {
  const html = String(renderTenants({
    title: "Tenants & Apps",
    tenants: [],
    apps: [],
    shellServices: [],
    authServices: [],
    adminApiBase: "/.well-known/bp/admin",
    tenantsPath: "/tenants"
  }));
  assert.match(html, /input\[type=checkbox\]\[name=active\]/);
});

test("provider role management is the default when advertised", () => {
  const capabilities = [
    PROVIDER_ROLE_AUTHORITY_CAPABILITY,
    BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY
  ];
  assert.equal(resolveRoleAuthority(capabilities), "provider");
  assert.equal(resolveRoleAuthority(capabilities, "betterportal"), "betterportal");
  assert.equal(resolveRoleAuthority(["auth.roles.sync"]), "provider");
  assert.equal(resolveRoleAuthority([], "provider"), "betterportal");
});
