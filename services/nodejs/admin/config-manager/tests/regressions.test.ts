import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { groupVisualRoutes, render as renderRoutes } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_renderer.bootstrap5/GET.js";
import { appRoutePatternKey } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";
import { applyVerifiedServiceOrigin } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";
import { getCachedManifestForService, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { approveM2MConnections, buildM2MConnectionModel, revokeM2MConnection } from "../src/plugins/service-betterportal-config-manager/m2mConnections.js";
import { BaseStorage, getAvailableServiceInstanceIdsForApp, migrateAuthViewIds, migrateOfficialPluginIds } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { render as renderTenants } from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/_renderer.bootstrap5/GET.js";
import { render as renderServices } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_renderer.bootstrap5/GET.js";
import { render as renderAuth } from "../src/plugins/service-betterportal-config-manager/bp-routes/auth/_renderer.bootstrap5/GET.js";
import { purgeServiceReferences } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
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
  assertValid(): void {
    this.validateConfigReferences(this.value);
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
        mode: "service",
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

test("visual route groups preserve duplicate records", () => {
  const route = (id: string, path: string) => ({
    id,
    kind: "page" as const,
    path,
    serviceId: "service.example",
    viewId: "home",
    methods: [],
    title: id,
    renderable: true,
    enabled: true
  });
  const groups = groupVisualRoutes([
    route("root-a", "/"),
    route("root-b", "/"),
    route("investment", "/calculators/investment"),
    route("quotes", "/calculators/quotes")
  ]);
  assert.deepEqual(groups.flatMap((group) => group.routes.map((item) => item.id)).sort(), ["investment", "quotes", "root-a", "root-b"]);
  assert.deepEqual(groups.find((group) => group.pathPrefix === "/")?.routes.map((item) => item.id), ["root-a", "root-b"]);
  assert.equal(groups.find((group) => group.pathPrefix === "/calculators")?.synthetic, true);
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

test("service connections require approval and revoked connections receive fresh ids", () => {
  const value = s2sConfig();
  value.config.m2m.bindings = [];
  value.config.m2m.grants = [];
  const manifest = (serviceId: string, values: Partial<CachedManifest>): CachedManifest => ({
    serviceId,
    manifestVersion: "1",
    capabilities: [],
    apiContracts: [],
    m2mRequests: [],
    developerResources: [],
    viewIndex: {},
    configSchemas: [],
    webhooks: [],
    fetchedAt: Date.now(),
    ...values
  });
  const cache = new Map<string, CachedManifest>([
    [value.sourceId, manifest("org.example.source", {
      m2mRequests: [
        { id: "reports.read", title: "Read reports", contractId: "reports", version: "1", methods: ["GET"], permissions: ["read"], mode: "service" },
        { id: "reports.update", title: "Update reports", contractId: "reports.update", version: "1", methods: ["POST"], permissions: ["update"], mode: "delegated" }
      ]
    })],
    [value.targetId, manifest("org.example.target", {
      apiContracts: [
        { id: "reports", title: "Reports", version: "1", viewId: "reports.list", methods: ["GET"], capabilities: [], permissions: ["read"], modes: ["service"] },
        { id: "reports.update", title: "Update report", version: "1", viewId: "reports.update", methods: ["POST"], capabilities: [], permissions: ["update"], modes: ["delegated"] }
      ]
    })]
  ]);

  const approved = approveM2MConnections(value.config, value.appId, [
    { sourceServiceId: value.sourceId, requestId: "reports.read" },
    { sourceServiceId: value.sourceId, requestId: "reports.update" }
  ], cache);
  assert.equal(approved.created.length, 2);
  assert.equal(value.config.m2m.bindings.length, 2);
  assert.equal(value.config.m2m.grants.length, 2);
  assert.deepEqual(buildM2MConnectionModel(value.config, value.appId, cache).map((row) => row.status), ["connected", "connected"]);

  const revokedId = approved.created[0];
  assert.equal(revokeM2MConnection(value.config, value.appId, revokedId), true);
  assert.equal(buildM2MConnectionModel(value.config, value.appId, cache).find((row) => row.requestId === "reports.read")?.status, "pending");
  const reapproved = approveM2MConnections(value.config, value.appId, [
    { sourceServiceId: value.sourceId, requestId: "reports.read" }
  ], cache);
  assert.notEqual(reapproved.created[0], revokedId);
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

test("app auth redirects require one enabled GET page mount", () => {
  const value = s2sConfig();
  const app = value.config.apps[0]!;
  app.routes = [{
    id: uuidv7(),
    kind: "page",
    path: "/dashboard",
    serviceId: value.targetId,
    viewId: "dashboard.index",
    enabled: true,
    methods: ["GET"]
  }];
  app.auth = {
    serviceId: value.sourceId,
    expectedIssuer: "https://auth.example",
    expectedAudience: "app",
    jwksUri: "https://auth.example/.well-known/jwks.json",
    roles: [],
    redirects: {
      afterLogin: { serviceId: value.targetId, viewId: "dashboard.index" }
    }
  };

  const storage = new MemoryStorage(value.config);
  storage.assertValid();
  app.routes[0]!.enabled = false;
  assert.throws(() => storage.assertValid(), /auth\.redirects\.afterLogin must reference exactly one enabled GET page view/);
});

test("legacy auth paths migrate to mounted view IDs", () => {
  const { config, appId, sourceId } = s2sConfig();
  const app = config.apps.find((candidate) => candidate.id === appId)!;
  app.routes.push(
    { id: uuidv7(), kind: "page", path: "/sign-in", serviceId: sourceId, viewId: "login.index", targetPath: "/login", enabled: true, methods: ["GET"] },
    { id: uuidv7(), kind: "page", path: "/sign-out", serviceId: sourceId, viewId: "logout.index", resolvedServicePath: "/logout", enabled: true, methods: ["GET", "POST"] },
    { id: uuidv7(), kind: "api", path: `/_bp/service/${sourceId}/refresh`, serviceId: sourceId, viewId: "refresh.index", targetPath: "/refresh", enabled: true, methods: ["POST"] }
  );
  app.auth = {
    serviceId: sourceId,
    loginViewId: "/login",
    logoutViewId: "/logout",
    refreshViewId: "/refresh",
    expectedIssuer: "https://auth.example",
    expectedAudience: "app",
    jwksUri: "https://auth.example/.well-known/jwks.json",
    roles: []
  };

  migrateAuthViewIds(config);

  assert.equal(app.auth.loginViewId, "login.index");
  assert.equal(app.auth.logoutViewId, "logout.index");
  assert.equal(app.auth.refreshViewId, "refresh.index");
});

test("ordinary service scopes include separate application route and fragment indexes", async () => {
  const { config, tenantId, sourceId, targetId } = s2sConfig();
  const app = config.apps[0];
  app.routes = [
    { id: uuidv7(), kind: "page", path: "/source", serviceId: sourceId, viewId: "source.index", enabled: true, methods: ["GET"] },
    { id: uuidv7(), kind: "page", path: "/target", serviceId: targetId, viewId: "target.index", enabled: true, methods: ["GET"] }
  ];
  app.fragments = {
    nav: [
      { serviceId: sourceId, fragmentId: "source", targetPath: "/source", enabled: true },
      { serviceId: targetId, fragmentId: "target", targetPath: "/target", enabled: true }
    ]
  };

  const scoped = await new MemoryStorage(config).getScopedConfig("org.example.source", "tenant", tenantId);
  const scopedApp = scoped.apps[0];
  assert.deepEqual(scopedApp.routes.map((route) => route.serviceId), [sourceId]);
  assert.deepEqual(scopedApp.appRoutes?.map((route) => route.serviceId), [sourceId, targetId]);
  assert.deepEqual(scopedApp.fragments.nav?.map((fragment) => fragment.serviceId), [sourceId]);
  assert.deepEqual(scopedApp.appFragments?.nav?.map((fragment) => fragment.serviceId), [sourceId, targetId]);
});

test("shared activation purge removes every linked reference", () => {
  const value = s2sConfig();
  const activationId = value.sourceId;
  const app = value.config.apps[0];
  const routeId = uuidv7();
  const keepRouteId = uuidv7();
  const webhookId = uuidv7();
  const now = new Date().toISOString();

  value.config.tenants[0].services = value.config.tenants[0].services.filter((service) => service.id !== activationId);
  value.config.sharedServiceCatalog.push({
    id: "org.example.shared",
    title: "Shared service",
    baseUrl: "https://shared.example",
    supportedDeploymentModes: ["self-hosted"],
    owner: "bp",
    tags: [],
    enabled: true
  });
  value.config.sharedServiceActivations.push({
    id: activationId,
    tenantId: value.tenantId,
    sharedServiceId: "org.example.shared",
    activatedAt: now,
    enabled: true
  });
  app.shell = { serviceId: activationId };
  app.routes = [
    { id: routeId, kind: "page", path: "/shared", serviceId: activationId, viewId: "shared.index", enabled: true, methods: ["GET"] },
    { id: keepRouteId, kind: "page", path: "/keep", serviceId: value.targetId, viewId: "keep.index", enabled: true, methods: ["GET"] }
  ];
  app.menu = [
    { id: uuidv7(), type: "link", title: "Shared", routeId, enabled: true, authStatus: "show", serviceStatus: "show", children: [] },
    { id: uuidv7(), type: "link", title: "Keep", routeId: keepRouteId, enabled: true, authStatus: "show", serviceStatus: "show", children: [] }
  ];
  app.slots = [{ slotId: "main", serviceId: activationId, viewId: "shared.index", enabled: true }];
  app.fragments = { nav: [{ serviceId: activationId, fragmentId: "profile", targetPath: "/profile", enabled: true }] };
  app.auth = {
    serviceId: value.targetId,
    roles: [{
      id: "admin",
      title: "Admin",
      permissions: [{ serviceId: activationId, viewId: "shared.index", permissions: ["read"] }]
    }]
  } as BetterPortalConfig["apps"][number]["auth"];
  value.config.webhooks.targets.push({
    id: webhookId,
    tenantId: value.tenantId,
    appId: value.appId,
    serviceId: activationId,
    eventId: "shared.changed",
    url: "https://listener.example/hook",
    secret: "secret",
    createdAt: now,
    enabled: true,
    maxAttempts: 10
  });

  const summary = purgeServiceReferences(value.config, value.tenantId, activationId);
  value.config.sharedServiceActivations = value.config.sharedServiceActivations.filter((activation) => activation.id !== activationId);

  assert.deepEqual(summary, {
    routesRemoved: 1,
    menuItemsRemoved: 1,
    slotsRemoved: 1,
    fragmentsRemoved: 1,
    roleGrantsRemoved: 1,
    shellCleared: 1,
    authCleared: 0,
    m2mBindingsRemoved: 1,
    m2mGrantsRemoved: 1,
    webhooksRemoved: 1
  });
  assert.equal(app.routes[0]?.id, keepRouteId);
  assert.equal(app.menu[0]?.routeId, keepRouteId);
  assert.equal(app.shell, undefined);
  assert.deepEqual(app.slots, []);
  assert.deepEqual(app.fragments, {});
  assert.deepEqual(app.auth?.roles[0]?.permissions, []);
  assert.deepEqual(value.config.m2m, { bindings: [], grants: [] });
  assert.deepEqual(value.config.webhooks.targets, []);
  new MemoryStorage(value.config).assertValid();
});

test("route designer exposes conflicts, stale views, and service identity", () => {
  const route = (id: string, path: string, serviceId: string, viewId: string, kind: "page" | "api" = "page") => ({
    id,
    kind,
    path,
    serviceId,
    viewId,
    methods: ["GET"],
    title: viewId,
    renderable: kind === "page",
    enabled: id !== "stale"
  });
  const html = String(renderRoutes({
    title: "Route Designer",
    apps: [{ id: "app-a", title: "App A", tenantId: "tenant-a" }],
    selectedAppId: "app-a",
    routes: [
      route("root-a", "/", "service-a", "welcome.index"),
      route("root-b", "/", "service-a", "welcome.index"),
      route("stale", "/calculators/investment", "service-a", "retirement.index"),
      route("api-a", "/_bp/service/crm/a", "service-a", "crm.api", "api"),
      route("api-b", "/_bp/service/theme/b", "service-b", "theme.api", "api")
    ],
    availableServices: [
      { id: "service-a", title: "TRG One Theme", hostname: "https://crm.example", serviceId: "service.trg-one.crm", manifestLoaded: true, views: [] },
      { id: "service-b", title: "TRG One Theme", hostname: "https://theme.example", serviceId: "service.trg-one.theme", manifestLoaded: true, views: [] }
    ],
    adminApiBase: "/.well-known/bp/admin",
    serviceBaseUrl: "https://config.example"
  }));
  assert.match(html, /data-bp-route-id="root-a"/);
  assert.match(html, /data-bp-route-id="root-b"/);
  assert.match(html, /Conflict: 2 route records use this mount path/);
  assert.match(html, /data-bp-path-group="\/calculators"/);
  assert.match(html, /retirement\.index — unavailable in current manifest/);
  assert.match(html, /Manifest view unavailable/);
  assert.match(html, /TRG One Theme · service\.trg-one\.crm/);
  assert.match(html, /bp-api-routes-service-a/);
  assert.match(html, /bp-api-routes-service-b/);
  assert.doesNotMatch(html, /└─/);
});

test("app permissions only list available service instances", () => {
  const config = {
    tenants: [
      {
        id: "tenant-a",
        services: [
          { id: "tenant-service", enabled: true },
          { id: "tenant-service-disabled", enabled: false }
        ],
        activatedPlatformServices: ["platform-service", "platform-service-disabled"]
      },
      {
        id: "tenant-b",
        services: [{ id: "foreign-tenant-service", enabled: true }],
        activatedPlatformServices: []
      }
    ],
    platformServices: [
      { id: "platform-service", enabled: true },
      { id: "platform-service-unactivated", enabled: true },
      { id: "platform-service-disabled", enabled: false }
    ],
    sharedServiceCatalog: [
      { id: "shared-service", enabled: true },
      { id: "shared-service-disabled", enabled: false }
    ],
    sharedServiceActivations: [
      { id: "shared-global", tenantId: "tenant-a", sharedServiceId: "shared-service", enabled: true },
      { id: "shared-app", tenantId: "tenant-a", appId: "app-a", sharedServiceId: "shared-service", enabled: true },
      { id: "shared-other-app", tenantId: "tenant-a", appId: "app-b", sharedServiceId: "shared-service", enabled: true },
      { id: "shared-other-tenant", tenantId: "tenant-b", sharedServiceId: "shared-service", enabled: true },
      { id: "shared-disabled", tenantId: "tenant-a", sharedServiceId: "shared-service-disabled", enabled: true }
    ]
  } as BetterPortalConfig;
  const app = { id: "app-a", tenantId: "tenant-a" } as BetterPortalConfig["apps"][number];
  assert.deepEqual(
    getAvailableServiceInstanceIdsForApp(config, app),
    new Set(["tenant-service", "platform-service", "shared-global", "shared-app"])
  );
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
  assert.match(html, /name="afterLoginServiceId"/);
  assert.match(html, /name="afterLogoutViewId"/);
});

test("service registration stays browser-mediated and tenant history follows the request", () => {
  const html = String(renderServices({
    title: "Service Registry",
    services: [],
    tenants: [{ id: "tenant-a", title: "Tenant A" }],
    selectedTenantId: "tenant-a",
    selectedAppId: "app-a",
    m2mConnections: [{
      sourceServiceId: "source-a",
      sourceServiceTitle: "Source",
      sourceServiceType: "org.example.source",
      requestId: "crm.update",
      title: "Update CRM",
      contractId: "crm.update",
      mode: "delegated",
      methods: ["POST"],
      permissions: ["update"],
      optional: false,
      status: "pending",
      message: "Ready for approval",
      candidates: [{ targetServiceId: "target-a", targetServiceTitle: "CRM", targetServiceType: "org.example.crm", targetViewId: "crm.update" }]
    }],
    sharedServiceCatalog: [{
      id: "org.example.shared",
      title: "Shared",
      baseUrl: "https://shared.example",
      tags: [],
      installed: true,
      enabled: true
    }],
    sharedServiceActivations: [{
      id: "activation-a",
      tenantId: "tenant-a",
      sharedServiceId: "org.example.shared",
      activatedAt: new Date().toISOString(),
      enabled: true
    }],
    apps: [{ id: "app-a", tenantId: "tenant-a", title: "App A" }],
    tenantApps: { "tenant-a": [{ id: "app-a", title: "App A" }] },
    adminApiBase: "/.well-known/bp/admin"
  }));
  assert.match(html, /id="bp-services-tenant-filter"[^>]*hx-push-url="true"/);
  assert.match(html, /id="bp-services-app-filter"/);
  assert.match(html, /\/apps\/app-a\/m2m\/connections/);
  assert.match(html, /Connect CRM \/ org\.example\.crm/);
  assert.match(html, /id="bp-tenant-service-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /id="bp-change-hostname-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /id="bp-shared-service-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /shared-services\/org\.example\.shared\/activations\?tenantId=tenant-a[^>]*data-bp-error-modal=""/);
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
  assert.match(html, /<input[^>]*name="grant"[^>]*value=""/);
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
