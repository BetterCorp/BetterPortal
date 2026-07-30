import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { buildRouteTree, flattenRouteTree } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_theme.bootstrap1/GET.js";
import { appRoutePatternKey } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";
import { applyVerifiedServiceOrigin } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";
import { getCachedManifestForService, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { BaseStorage, migrateOfficialPluginIds } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { render as renderTenants } from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/_theme.bootstrap1/GET.js";
import { render as renderServices } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_theme.bootstrap1/GET.js";
import { render as renderAuth } from "../src/plugins/service-betterportal-config-manager/bp-routes/auth/_theme.bootstrap1/GET.js";
import {
  BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY,
  PROVIDER_ROLE_AUTHORITY_CAPABILITY,
  resolveRoleAuthority
} from "../src/plugins/service-betterportal-config-manager/roleAuthority.js";

class MemoryStorage extends BaseStorage {
  constructor(private value: BetterPortalConfig) {
    super();
  }
  async loadConfig(): Promise<BetterPortalConfig> {
    return this.value;
  }
  async saveConfig(config: BetterPortalConfig): Promise<void> {
    this.value = config;
    this.notifyListeners();
  }
}

function s2sConfig(): {
  config: BetterPortalConfig;
  tenantId: string;
  appId: string;
  sourceId: string;
  targetId: string;
  bindingId: string;
} {
  const tenantId = uuidv7();
  const appId = uuidv7();
  const sourceId = uuidv7();
  const targetId = uuidv7();
  const bindingId = uuidv7();
  const createdAt = new Date().toISOString();
  const service = (id: string, name: string) => ({
    id,
    hostname: "https://" + name + ".example",
    apiKeyHash: name,
    serviceId: "org.example." + name,
    capabilities: [],
    deploymentMode: "self-hosted" as const,
    createdAt,
    enabled: true
  });
  const config = {
    configManagement: { auth: { mechanism: "none", requiredPermissions: [] } },
    platformServices: [],
    tenants: [{
      id: tenantId,
      slug: "tenant",
      title: "Tenant",
      active: true,
      branding: {},
      services: [service(sourceId, "source"), service(targetId, "target")],
      activatedPlatformServices: []
    }],
    apps: [{
      id: appId,
      tenantId,
      slug: "app",
      title: "App",
      hostnames: ["app.example"],
      originOverrides: [],
      refererOverrides: [],
      themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
      defaultRoute: "/",
      routes: [],
      menu: [],
      slots: [],
      fragments: {}
    }],
    sharedServiceCatalog: [],
    sharedServiceActivations: [],
    manifestCache: [],
    m2m: {
      bindings: [{
        id: bindingId,
        tenantId,
        appId,
        sourceServiceId: sourceId,
        requestId: "reports.read",
        contractId: "reports",
        targetServiceId: targetId,
        targetViewId: "reports.list",
        enabled: true,
        createdAt
      }],
      grants: [{
        id: uuidv7(),
        tenantId,
        appId,
        bindingId,
        methods: ["GET"],
        permissions: ["read"],
        enabled: true,
        createdAt
      }]
    },
    webhooks: { targets: [] }
  } as BetterPortalConfig;
  return { config, tenantId, appId, sourceId, targetId, bindingId };
}

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

test("official legacy plugin IDs migrate without changing external IDs", () => {
  const migrated = migrateOfficialPluginIds({
    serviceId: "service.betterportal.config-manager",
    nested: ["service.betterportal.theme.bootstrap1", "service.betterportal.robertgroups.webcalcs"]
  });
  assert.equal(migrated.serviceId, "org.betterportal.config-manager");
  assert.equal(migrated.nested[0], "org.betterportal.theme.bootstrap1");
  assert.equal(migrated.nested[1], "service.betterportal.robertgroups.webcalcs");
});

test("hostname changes require the exact instance API key", () => {
  const service = { hostname: "https://old.example" } as never;
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "other", "https://new.example"), false);
  assert.equal((service as { hostname: string }).hostname, "https://old.example");
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "expected", "https://new.example"), true);
  assert.equal((service as { hostname: string }).hostname, "https://new.example");
});

test("S2S public keys register once and mismatches require recovery", async () => {
  const value = s2sConfig();
  const store = new MemoryStorage(value.config);
  const first = generateKeyPair();
  const other = generateKeyPair();
  assert.equal(
    await store.registerServicePublicKey(value.sourceId, "tenant", value.tenantId, first.publicKeyPem, first.kid),
    "registered"
  );
  assert.equal(
    await store.registerServicePublicKey(value.sourceId, "tenant", value.tenantId, first.publicKeyPem, first.kid),
    "matched"
  );
  assert.equal(
    await store.registerServicePublicKey(value.sourceId, "tenant", value.tenantId, other.publicKeyPem, other.kid),
    "mismatch"
  );

  const scoped = await store.getScopedConfig(value.targetId, "tenant", value.tenantId);
  assert.deepEqual(scoped.m2m?.localServiceIds, [value.targetId]);
  assert.equal(scoped.m2m?.bindings[0]?.id, value.bindingId);
  assert.equal(scoped.m2m?.services.find((service) => service.id === value.sourceId)?.keyId, first.kid);

  value.config.tenants[0].services[0].enabled = false;
  const revoked = await store.getScopedConfig(value.targetId, "tenant", value.tenantId);
  assert.equal(revoked.m2m?.bindings.length, 0);
  assert.equal(revoked.m2m?.services.some((service) => service.id === value.sourceId), false);
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

test("service registration stays browser-mediated and tenant history follows the request", () => {
  const html = String(renderServices({
    title: "Service Registry",
    services: [],
    tenants: [{ id: "tenant-a", title: "Tenant A" }],
    selectedTenantId: "tenant-a",
    sharedServiceCatalog: [],
    sharedServiceActivations: [],
    apps: [],
    tenantApps: {},
    adminApiBase: "/.well-known/bp/admin"
  }));
  assert.match(html, /id="bp-services-tenant-filter"[^>]*hx-push-url="true"/);
  assert.match(html, /id="bp-tenant-service-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /id="bp-change-hostname-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /id="bp-shared-service-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /<script>\s*\(\(\) => \{/);
  assert.doesNotMatch(html, /&quot;bp-tenant-service-form&quot;/);
});

test("role edits replace the deferred form action", () => {
  const html = String(renderAuth({
    title: "Permission Manager",
    apps: [{ id: "app-a", tenantId: "tenant-a", title: "App A" }],
    selectedAppId: "app-a",
    authConfigured: true,
    servicePermissions: [],
    currentRoles: [],
    adminApiBase: "/.well-known/bp/admin",
    serviceBaseUrl: "https://config.example"
  }));
  assert.match(html, /id="bp-edit-role-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /window\.htmx\.process\(form, true\)/);
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
