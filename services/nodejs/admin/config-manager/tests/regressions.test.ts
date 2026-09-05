import assert from "node:assert/strict";
import { H3 } from "h3";
import { setImmediate } from "node:timers/promises";
import { registerWebhookRoutes } from "../src/plugins/service-betterportal-config-manager/webhooks.js";
import { Plugin as ConfigManagerPlugin } from "../src/plugins/service-betterportal-config-manager/index.js";
import { test } from "node:test";
import * as av from "anyvali";
import { BetterPortalConfigSchema, generateKeyPair, publicKeyToJwk, uuidv7, type BetterPortalConfig, type JsonValue } from "@betterportal/framework";
import { groupVisualRoutes, render as renderRoutes } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_renderer.bootstrap5/GET.js";
import { apiRoutePath, appRoutePatternKey } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";
import { applyVerifiedServiceOrigin, servicePluginIdsMatch } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";
import { analyzeOperationDependencies, deriveRolePermissions, getCachedManifestForService, getManifestCache, hydrateManifestCache, reconcileServiceRegistry, registerSyncEndpoint, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { approveM2MConnections, buildM2MConnectionModel, revokeM2MConnection } from "../src/plugins/service-betterportal-config-manager/m2mConnections.js";
import { BaseStorage, getAvailableServiceInstanceIdsForApp, getServicePluginId, migrateAuthViewIds, migrateOfficialPluginIds, migrateRouteOperations, migrateRouteParamSyntax } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { render as renderTenants } from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/_renderer.bootstrap5/GET.js";
import { render as renderServices } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_renderer.bootstrap5/GET.js";
import { render as renderAuth } from "../src/plugins/service-betterportal-config-manager/bp-routes/auth/_renderer.bootstrap5/GET.js";
import { render as renderPreviewEnvironments } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/GET.js";
import { render as renderPreviewConfigEditor } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/config.GET.js";
import { resolvePreviewConfigSchemas } from "../src/plugins/service-betterportal-config-manager/previewEnvironmentManagement.js";
import { PostgresStorage } from "../src/plugins/service-betterportal-config-manager/storage/postgres.js";
import { purgeServiceReferences, renderConfigClientShell, validateFixedParamValue } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
import { buildDefaultAdminRoutes } from "../src/plugins/service-betterportal-config-manager/bootstrapEndpoint.js";
import { registerFragmentsEditorRoutes } from "../src/plugins/service-betterportal-config-manager/fragmentsEditor.js";
import { registerMenuEditorRoutes } from "../src/plugins/service-betterportal-config-manager/menuEditor.js";
import { registerPreviewDeploymentApi } from "../src/plugins/service-betterportal-config-manager/previewApi.js";
import {
  createPreviewGroup,
  deleteExpiredPreviewDeployments,
  provisionPreviewDeployment,
  reconcilePreviewService,
  visibleAdminConfig
} from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import * as adminAuthView from "../src/plugins/service-betterportal-config-manager/bp-routes/auth/GET.js";
import * as adminConfigView from "../src/plugins/service-betterportal-config-manager/bp-routes/config/GET.js";
import * as adminFragmentsView from "../src/plugins/service-betterportal-config-manager/bp-routes/fragments/GET.js";
import * as adminMenuView from "../src/plugins/service-betterportal-config-manager/bp-routes/menu/GET.js";
import * as adminPreviewView from "../src/plugins/service-betterportal-config-manager/bp-routes/preview/GET.js";
import * as adminRoutesView from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/GET.js";
import * as adminServicesView from "../src/plugins/service-betterportal-config-manager/bp-routes/services/GET.js";
import * as adminTenantsDelete from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/DELETE.js";
import * as adminTenantsView from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/GET.js";
import * as adminTenantsCreate from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/POST.js";
import * as adminTenantsUpdate from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/PUT.js";
import * as authLoginView from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/login/GET.js";
import * as authLogin from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/login/POST.js";
import * as authLogoutView from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/logout/GET.js";
import * as authLogout from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/logout/POST.js";
import * as authRefresh from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/refresh/POST.js";
import * as authRegisterView from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/register/GET.js";
import * as authRegister from "../../../auth-default/src/plugins/service-betterportal-auth-default/bp-routes/register/POST.js";
import {
  BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY,
  PROVIDER_ROLE_AUTHORITY_CAPABILITY,
  resolveRoleAuthority,
  resolveRoleSyncUrl
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
  canonicalize(): BetterPortalConfig {
    this.value = this.canonicalizeConfig(this.value);
    return this.value;
  }
}

test("fixed route parameters use the published AnyVali schema", () => {
  const schema = av.exportSchema(av.object({
    accountId: av.string().format("uuid")
  }), "portable") as unknown as Record<string, JsonValue>;

  assert.equal(validateFixedParamValue("accountId", "c3f6025d-08fd-4ce7-b50c-43f4435f2e89", schema), undefined);
  assert.match(validateFixedParamValue("accountId", "not-a-uuid", schema) ?? "", /uuid/i);
});

test("root bootstrap mounts every page action with its generated permissions", () => {
  const configManagerServiceId = uuidv7();
  const authServiceId = uuidv7();
  const routes = buildDefaultAdminRoutes(configManagerServiceId, authServiceId);
  type BootstrapOperation = {
    operationId: string;
    auth: { required: boolean; permissions: ReadonlyArray<unknown> };
    dependencies?: ReadonlyArray<{ operationId: string; method: string; serviceId?: string }>;
  };
  const operationModules = new Map<string, ReadonlyArray<BootstrapOperation>>([
    [configManagerServiceId + ":services.index", [adminServicesView]],
    [configManagerServiceId + ":tenants.index", [adminTenantsView, adminTenantsCreate, adminTenantsUpdate, adminTenantsDelete]],
    [configManagerServiceId + ":routes.index", [adminRoutesView]],
    [configManagerServiceId + ":menu.index", [adminMenuView]],
    [configManagerServiceId + ":fragments.index", [adminFragmentsView]],
    [configManagerServiceId + ":preview.index", [adminPreviewView]],
    [configManagerServiceId + ":auth.index", [adminAuthView]],
    [configManagerServiceId + ":config.index", [adminConfigView]],
    [authServiceId + ":login.index", [authLoginView, authLogin]],
    [authServiceId + ":logout.index", [authLogoutView, authLogout]],
    [authServiceId + ":refresh.index", [authRefresh]],
    [authServiceId + ":register.index", [authRegisterView, authRegister]]
  ]);

  for (const route of routes.filter((candidate) => candidate.kind === "page")) {
    const declaredOperations = operationModules.get(route.serviceId + ":" + route.viewId);
    assert.ok(declaredOperations, "bootstrap page " + route.viewId + " must declare its method operations");
    const generatedOperations = declaredOperations.map((operation) => operation.operationId).sort();
    const mountedOperations = routes
      .filter((candidate) => candidate.serviceId === route.serviceId && candidate.viewId === route.viewId)
      .flatMap((candidate) => candidate.operations)
      .sort();
    assert.deepEqual(mountedOperations, generatedOperations, "bootstrap page " + route.viewId + " must mount every generated method operation");
  }

  const expectedOperations = [
    "admin.auth.view",
    "admin.config.view",
    "admin.fragments.view",
    "admin.menu.view",
    "admin.preview.view",
    "admin.routes.view",
    "admin.services.view",
    "admin.tenants.create",
    "admin.tenants.delete",
    "admin.tenants.update",
    "admin.tenants.view",
    "auth.login",
    "auth.login.view",
    "auth.logout",
    "auth.logout.view",
    "auth.refresh",
    "auth.register",
    "auth.register.view"
  ];
  assert.deepEqual(routes.flatMap((route) => route.operations).sort(), expectedOperations);
  const pluginIdByService = new Map([
    [configManagerServiceId, "org.betterportal.config-manager"],
    [authServiceId, "org.betterportal.auth.default"]
  ]);
  for (const route of routes.filter((candidate) => candidate.kind === "api")) {
    assert.ok(route.targetPath, "bootstrap API operation " + route.operations[0] + " must have a service target path");
    assert.equal(
      route.path,
      apiRoutePath(pluginIdByService.get(route.serviceId)!, route.targetPath),
      "bootstrap API operation " + route.operations[0] + " must use the canonical BP service route"
    );
  }

  const configManagerOperations = [...operationModules.entries()]
    .filter(([key]) => key.startsWith(configManagerServiceId + ":"))
    .flatMap(([, operations]) => operations);
  for (const operationId of expectedOperations.filter((candidate) => candidate.startsWith("admin."))) {
    const operation = configManagerOperations.find((candidate) => candidate.operationId === operationId);
    assert.ok(operation, operationId + " must be generated");
    assert.equal(operation.auth.required, true, operationId + " must require authentication");
    assert.ok(operation.auth.permissions.length > 0, operationId + " must declare an automated permission requirement");
  }

  assert.deepEqual(adminTenantsView.dependencies.map((dependency) => dependency.operationId).sort(), [
    "admin.tenants.create", "admin.tenants.delete", "admin.tenants.update"
  ]);
  assert.ok(authLoginView.dependencies.some((dependency) => dependency.operationId === "auth.login" && dependency.method === "POST"));
  assert.ok(authLogoutView.dependencies.some((dependency) => dependency.operationId === "auth.logout" && dependency.method === "POST"));
  assert.ok(authRegisterView.dependencies.some((dependency) => dependency.operationId === "auth.register" && dependency.method === "POST"));
});

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

test("Postgres config reads reuse an isolated validated snapshot until invalidated", async () => {
  const config = BetterPortalConfigSchema.parse({});
  let reads = 0;
  const storage = new PostgresStorage({ connectionString: "postgres://unused" });
  Object.assign(storage as object, {
    schemaReady: Promise.resolve(),
    pool: {
      query: async (sql: string) => {
        if (sql.includes("last_seen_at")) return { rows: [] };
        reads++;
        return { rows: [{ config, revision: 1 }] };
      }
    }
  });

  const [first, second] = await Promise.all([storage.loadConfig(), storage.loadConfig()]);
  first.apps.push({} as never);
  assert.equal(second.apps.length, 0);
  assert.equal(reads, 1);

  storage.invalidate();
  await storage.loadConfig();
  assert.equal(reads, 2);
});

test("Postgres conflicts invalidate stale snapshots and action completion is fenced in the config transaction", async () => {
  const config = BetterPortalConfigSchema.parse({});
  let revision = 1;
  let leaseValid = true;
  const statements: string[] = [];
  const query = async (sql: string, params?: unknown[]) => {
    statements.push(sql);
    if (sql.includes("select config")) return { rows: [{ config, revision }] };
    if (sql.includes("select revision")) return { rows: [{ revision }] };
    if (sql.includes("set status = 'completed'")) return { rows: [], rowCount: leaseValid ? 1 : 0 };
    if (sql.includes("set config =")) revision = Number(params?.[2]);
    return { rows: [], rowCount: 1 };
  };
  const storage = new PostgresStorage({ connectionString: "postgres://unused" });
  Object.assign(storage, { schemaReady: Promise.resolve(), pool: { query, connect: async () => ({ query, release() {} }) } });
  const stale = await storage.loadConfig();
  revision = 2;
  await assert.rejects(storage.saveConfig(stale), /revision/i);
  const fresh = await storage.loadConfig();
  statements.length = 0;
  await storage.touchServiceActivity("service", "lastSeenAt");
  assert.equal(revision, 2);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /_activity/);
  statements.length = 0;
  const action = { kind: "setup" as const, key: "key", owner: "request-owner", result: { apiKey: "test" } };
  await storage.completePendingAction(action, fresh);
  assert.equal(statements[0], "begin");
  assert.match(statements[1], /lease_owner = \$4[\s\S]*lease_until > now\(\)/);
  assert.ok(statements.some(sql => sql.includes("_outbox")));
  assert.equal(statements.at(-1), "commit");
  leaseValid = false;
  statements.length = 0;
  await assert.rejects(storage.completePendingAction(action, fresh), /lease was lost/);
  assert.equal(statements.at(-1), "rollback");
  assert.equal(statements.some(sql => sql.includes("set config =")), false);
  statements.length = 0;
  await storage.saveConfig(await storage.loadConfig(), { notify: false });
  assert.ok(statements.some(sql => sql.includes("_outbox")), "all config revisions must reach replicas");
});

test("config sync shares projections, suppresses duplicates and closes revoked streams", { timeout: 5000 }, async (t) => {
  const app = new H3();
  const listeners = new Set<() => void>();
  let allowed = true;
  let projections = 0;
  const store = {
    onChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    validateApiKey: async () => allowed ? { scope: "platform", serviceId: "service", service: {} } : null,
    getScopedConfig: async () => { projections++; return { managementOrigins: [], tenants: [], apps: [] }; }
  };
  registerSyncEndpoint(app, store as never);
  const readers = await Promise.all([1, 2].map(async () => {
    const response = await app.request("/.well-known/bp/sync", { headers: { authorization: "Bearer key" } });
    const reader = response.body!.getReader();
    t.after(() => reader.cancel().catch(() => {}));
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: config/);
    return reader;
  }));
  assert.equal(projections, 1);
  for (const listener of listeners) listener();
  await setImmediate();
  assert.equal(projections, 2, "subscribers share the refreshed projection");
  const pending = readers.map(reader => reader.read());
  allowed = false;
  for (const listener of listeners) listener();
  assert.ok((await Promise.all(pending)).every(result => result.done), "no duplicate or revoked config frame");
});

test("auth cache drops removed apps and JWKS", async () => {
  const plugin = Object.create(ConfigManagerPlugin.prototype) as any;
  const config = BetterPortalConfigSchema.parse({});
  Object.assign(plugin, { storage: { loadConfig: async () => config }, authCacheGeneration: 0, authConfigCache: new Map([["tenant::app", {}]]) });
  await plugin.warmAuthCache();
  assert.equal(plugin.authConfigCache.size, 0);
  plugin.authConfigCache.set("tenant::app", {});
  await plugin.refreshAuthCache("tenant", "app");
  assert.equal(plugin.authConfigCache.size, 0);
});

test("webhooks claim only the next delivery and bound fetch lifetime", async (t) => {
  const order: string[] = [];
  let claimed = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    order.push("fetch");
    return new Response(new ReadableStream({ cancel() { order.push("cancel"); } }));
  });
  const runtime = registerWebhookRoutes(new H3(), {
    loadConfig: async () => ({ tenants: [{ id: "tenant", active: true }], webhooks: { targets: [{ id: "target", tenantId: "tenant", enabled: true, secret: "secret", url: "https://webhook.test" }] } })
  } as never, {
    claimWebhookDeliveries: async (_owner: string, count: number) => {
      assert.equal(count, 1);
      order.push("claim");
      if (claimed++ === 2) return [];
      return [{ id: String(claimed), targetId: "target", attempts: 0, maxAttempts: 3, payload: {} }];
    },
    finishWebhookDelivery: async () => { order.push("finish"); },
    cleanupWebhookDeliveries: async () => {}
  } as never);
  await runtime.drain();
  assert.deepEqual(order, ["claim", "fetch", "cancel", "finish", "claim", "fetch", "cancel", "finish", "claim"]);
});

test("dependency analysis finds disabled routes by plugin id", async () => {
  const value = s2sConfig();
  const app = value.config.apps[0]!;
  const sourceOperationId = "webcalcs.quote.read";
  const targetOperationId = "reports.view.read";
  const registry = (
    viewId: string,
    operationId: string,
    method: "GET" | "POST",
    dependencies: Array<{ serviceId?: string; operationId: string; method: "GET" | "POST" }> = []
  ) => ({
    routes: [{
      viewId,
      path: `/${viewId}`,
      paramNames: [],
      methods: [method],
      raw: true,
      methodRoutes: {
        [method]: {
          method,
          operationId,
          title: operationId,
          description: "",
          schemas: {},
          handler: () => ({}),
          auth: { required: false, permissions: [] },
          dependencies,
          cacheHints: { ttlSeconds: 0, varyBy: [] },
          demoScenarios: []
        }
      },
      renderers: {},
      schemas: {},
      robots: [],
      apiContracts: [],
      demoScenarios: []
    }]
  });

  app.routes.push({
    id: uuidv7(),
    kind: "api",
    path: "/_bp/service/org.example.source/quote",
    serviceId: value.sourceId,
    viewId: "quote",
    targetPath: "/quote",
    enabled: true,
    enablement: "enabled",
    operations: [sourceOperationId]
  });
  const storage = new MemoryStorage(value.config);
  await reconcileServiceRegistry(storage, value.targetId, registry("reports", targetOperationId, "GET") as never);
  const targetRoute = app.routes.find((route) => route.operations.includes(targetOperationId))!;
  targetRoute.enabled = false;
  targetRoute.enablement = "disabled";
  await reconcileServiceRegistry(storage, value.sourceId, registry("quote", sourceOperationId, "POST", [{
    serviceId: "org.example.target",
    operationId: targetOperationId,
    method: "GET"
  }]) as never);

  assert.equal(getServicePluginId(value.config, value.targetId), "org.example.target");
  assert.deepEqual(analyzeOperationDependencies(value.config, app), [{
    sourceRouteId: app.routes.find((route) => route.operations.includes(sourceOperationId))!.id,
    sourceOperationId,
    sourceMethod: "POST",
    targetServiceId: "org.example.target",
    targetOperationId,
    targetMethod: "GET",
    enabledRouteIds: [],
    disabledRouteIds: [targetRoute.id]
  }]);
});

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

test("role permissions derive exact operation dependencies without mutating explicit grants", () => {
  const { sourceId, targetId } = s2sConfig();
  const operation = (operationId: string, dependencies: CachedManifest["viewIndex"][string]["operations"][number]["dependencies"], permissions: CachedManifest["viewIndex"][string]["operations"][number]["permissions"]) => ({
    operationId,
    method: "GET" as const,
    title: operationId,
    description: operationId,
    renderers: [],
    renderModes: [],
    authRequired: true,
    robots: [],
    dependencies,
    permissions,
    renderable: false,
    apiContracts: [],
    demoScenarios: []
  });
  const manifest = (serviceId: string, viewId: string, item: ReturnType<typeof operation>): CachedManifest => ({
    serviceId,
    manifestVersion: "1",
    capabilities: [],
    apiContracts: [],
    m2mRequests: [],
    developerResources: [],
    viewIndex: { [viewId]: { viewId, title: viewId, description: viewId, path: `/${viewId}`, pathVariants: [], operations: [item], fragments: [] } },
    configSchemas: [],
    webhooks: [],
    fetchedAt: Date.now()
  });
  const manifests = new Map([
    [sourceId, manifest("org.example.source", "source.view", operation("source.read", [{ serviceId: "org.example.target", operationId: "target.read", method: "GET" }], [{ serviceId: "org.example.source", viewId: "source.view", permissions: ["read"] }]))],
    [targetId, manifest("org.example.target", "target.view", operation("target.read", [], [{ serviceId: "org.example.target", viewId: "target.view", permissions: ["read"] }]))]
  ]);
  const routes = [
    { id: uuidv7(), kind: "page" as const, path: "/source", serviceId: sourceId, viewId: "source.view", enabled: true, operations: ["source.read"] },
    { id: uuidv7(), kind: "api" as const, path: "/target", serviceId: targetId, viewId: "target.view", enabled: true, operations: ["target.read"] }
  ];
  const auth = {
    serviceId: sourceId,
    expectedIssuer: "https://auth.example",
    expectedAudience: "app",
    jwksUri: "https://auth.example/jwks",
    roles: [
      { id: "reader", title: "Reader", permissions: [{ serviceId: sourceId, viewId: "source.view", permissions: ["read" as const] }] },
      { id: "creator", title: "Creator", permissions: [{ serviceId: sourceId, viewId: "source.view", permissions: ["create" as const] }] }
    ]
  };

  const result = deriveRolePermissions(auth, routes, (serviceId) => manifests.get(serviceId));
  assert.equal(auth.roles[0].permissions.length, 1);
  assert.deepEqual(result.auth.roles[0].permissions[1], { serviceId: targetId, viewId: "target.view", permissions: ["read"] });
  assert.equal(result.auth.roles[1].permissions.length, 1);
  assert.deepEqual(result.derived[0]?.requiredBy, [{ serviceId: sourceId, operationId: "source.read", method: "GET" }]);
});

test("legacy route parameter syntax migrates across route and manifest paths", () => {
  const { config, sourceId } = s2sConfig();
  config.apps[0].routes.push({
    id: uuidv7(),
    kind: "page",
    path: "/plans/{planId}",
    serviceId: sourceId,
    viewId: "plans.detail",
    servicePathVariant: "/plans/{planId}",
    targetPath: "/plans/{planId}",
    resolvedServicePath: "/plans/{planId}",
    methods: ["GET"],
    enabled: true
  });
  config.manifestCache.push({
    serviceId: sourceId,
    fetchedAt: new Date().toISOString(),
    capabilities: [],
    m2mRequests: [],
    apiContracts: [],
    developerResources: [],
    configSchemas: [],
    webhooks: [],
    viewIndex: {
      "plans.detail": {
        viewId: "plans.detail",
        path: "/plans/{planId}",
        pathVariants: ["/plans/{planId}"],
        methods: ["GET"],
        renderers: [],
        dependencies: [],
        permissions: [],
        renderable: true,
        apiContracts: [],
        demoScenarios: [],
        fragments: [{ fragmentId: "summary", targetPath: "/plans/{planId}/summary" }],
        robots: []
      }
    }
  });

  const migrated = migrateRouteParamSyntax(config);
  const route = migrated.apps[0].routes[0];
  const view = migrated.manifestCache[0].viewIndex["plans.detail"];
  assert.equal(route.path, "/plans/:planId");
  assert.equal(route.servicePathVariant, "/plans/:planId");
  assert.equal(route.targetPath, "/plans/:planId");
  assert.equal(route.resolvedServicePath, "/plans/:planId");
  assert.equal(view.path, "/plans/:planId");
  assert.deepEqual(view.pathVariants, ["/plans/:planId"]);
  assert.equal(view.fragments[0].targetPath, "/plans/:planId/summary");
});

test("operation-aware manifest caches backfill missing view labels", () => {
  const { config, sourceId } = s2sConfig();
  const raw = structuredClone(config) as unknown as { manifestCache: unknown[] };
  raw.manifestCache.push({
    serviceId: sourceId,
    manifestVersion: "10.1.61",
    fetchedAt: new Date().toISOString(),
    capabilities: [],
    m2mRequests: [],
    apiContracts: [],
    developerResources: [],
    configSchemas: [],
    webhooks: [],
    viewIndex: {
      "fragments.index": {
        viewId: "fragments.index",
        path: "/fragments",
        pathVariants: [],
        operations: [{
          operationId: "admin.fragments.read",
          method: "GET",
          title: "Fragments",
          description: "Manage application fragments.",
          renderers: ["bootstrap5"],
          authRequired: true,
          robots: [],
          dependencies: [],
          permissions: [],
          renderable: true,
          apiContracts: [],
          demoScenarios: []
        }],
        fragments: [{ fragmentId: "summary", targetPath: "/fragments/summary" }]
      }
    }
  });

  const parsed = BetterPortalConfigSchema.parse(migrateRouteOperations(raw));
  const view = parsed.manifestCache[0].viewIndex["fragments.index"];
  assert.equal(view.title, "Fragments");
  assert.equal(view.description, "Manage application fragments.");
  assert.deepEqual(view.fragments[0], {
    fragmentId: "summary",
    targetPath: "/fragments/summary",
    operationId: "admin.fragments.read",
    method: "GET"
  });
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

test("a replica hydrates shared activation manifest aliases from persisted config", () => {
  hydrateManifestCache({
    manifestCache: [{ serviceId: "shared-service", title: "CRM", viewIndex: {} }],
    sharedServiceCatalog: [{ id: "shared-service", serviceId: "org.example.crm" }],
    sharedServiceActivations: [{ id: "activation", sharedServiceId: "shared-service", enabled: true }],
    tenants: [],
    platformServices: []
  } as never);
  assert.equal(getManifestCache().get("activation")?.title, "CRM");
  hydrateManifestCache({ manifestCache: [], sharedServiceCatalog: [], sharedServiceActivations: [], tenants: [], platformServices: [] } as never);
});

test("preview config schema falls back from an unsynced preview to its shared production service", () => {
  const activationId = uuidv7();
  const appId = uuidv7();
  const tenantId = uuidv7();
  const groupId = uuidv7();
  const previewInstanceId = uuidv7();
  const config = {
    tenants: [{ id: tenantId, services: [], activatedPlatformServices: [] }],
    apps: [{ id: appId, tenantId, routes: [{ serviceId: activationId }], fragments: {}, slots: [], shellFragments: {} }],
    platformServices: [],
    sharedServiceActivations: [{ id: activationId, tenantId, appId, sharedServiceId: "shared-crm", enabled: true }],
    sharedServiceCatalog: [{ id: "shared-crm", serviceId: "za.co.robertgroup.one.crm", baseUrl: "https://crm.example", enabled: true }],
    previewEnvironmentDeployments: [{ groupId, services: [{ serviceId: "za.co.robertgroup.one.crm", instanceId: previewInstanceId }] }],
    manifestCache: [
      { serviceId: previewInstanceId, configSchemas: [] },
      { serviceId: "shared-crm", configSchemas: [{ id: "crm", title: "CRM", description: "CRM", scope: "tenant", jsonSchema: {}, fields: [{ key: "region", title: "Region", description: "Region", scope: "tenant", visibility: "public", ownership: "bp", sourceOfTruth: "bp", defaultValue: "za", required: false }] }] }
    ]
  };
  const group = { id: groupId, sourceTenantId: tenantId, sourceAppId: appId };
  assert.equal(resolvePreviewConfigSchemas(config as never, group as never, "za.co.robertgroup.one.crm")?.[0]?.fields[0]?.key, "region");
});

test("service replacement requires the same external plugin id", () => {
  assert.equal(servicePluginIdsMatch("org.example.crm", "org.example.crm"), true);
  assert.equal(servicePluginIdsMatch("org.example.crm", "org.example.billing"), false);
  assert.equal(servicePluginIdsMatch(undefined, "org.example.crm"), false);
});

test("menu editing disables drag and optionally follows an assigned view route", async () => {
  const handlers = new Map<string, (event: unknown) => Response | Promise<Response>>();
  registerMenuEditorRoutes({
    get: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`GET ${path}`, handler); },
    post: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`POST ${path}`, handler); }
  } as never, {
    loadConfig: async () => ({
      tenants: [{ id: "tenant-a", services: [{ id: "service-a", title: "Service A", enabled: true }] }],
      platformServices: [],
      apps: [{
        id: "app-a",
        tenantId: "tenant-a",
        menu: [{ id: "item-a", type: "link", routeId: "route-old", enabled: true }],
        routes: [
          { id: "route-old", kind: "page", path: "/old", title: "Existing route title", serviceId: "service-a", viewId: "old.index" },
          { id: "route-new", kind: "page", path: "/new-public", targetPath: "/new-target", serviceId: "service-a", viewId: "new.index" }
        ]
      }]
    }),
    saveConfig: async () => undefined
  } as never);
  const invoke = async (path: string, query: string) => {
    const handler = handlers.get(`GET ${path}`);
    assert.ok(handler);
    return (await handler({ req: new Request(`https://admin.example${path}?${query}`) })).text();
  };

  const edit = await invoke("/.well-known/bp/admin/menu-editor/item", "appId=app-a&itemId=item-a&mode=edit-link");
  assert.match(edit, /draggable="false"[^>]*data-bp-menu-editing/);
  assert.match(edit, /name="autoSetPaths"[^>]*checked/);

  const titleEdit = await invoke("/.well-known/bp/admin/menu-editor/item", "appId=app-a&itemId=item-a&mode=edit-title");
  assert.match(titleEdit, /<form[^>]*id="bp-menu-title-item-a"[^>]*data-bp-menu-editing/);
  assert.match(titleEdit, /name="title"[^>]*value="Existing route title"/);
  assert.match(titleEdit, /mode=display-title/);
  assert.doesNotMatch(titleEdit, /<li\b/);

  const titleDisplay = await invoke("/.well-known/bp/admin/menu-editor/item", "appId=app-a&itemId=item-a&mode=display-title");
  assert.match(titleDisplay, /<button[^>]*id="bp-menu-title-item-a"/);
  assert.match(titleDisplay, /Existing route title/);
  assert.doesNotMatch(titleDisplay, /<li\b/);

  const automatic = await invoke("/.well-known/bp/admin/menu-editor/default-target", "appId=app-a&itemId=item-a&serviceId=service-a&viewId=new.index&autoSetPaths=true&path=%2Fold&targetPath=%2Fold-target");
  assert.match(automatic, /name="path"[^>]*value="\/new-public"/);
  assert.match(automatic, /name="targetPath"[^>]*value="\/new-target"/);

  const manual = await invoke("/.well-known/bp/admin/menu-editor/default-target", "appId=app-a&itemId=item-a&serviceId=service-a&viewId=new.index&path=%2Fcustom&targetPath=%2Fcustom-target");
  assert.match(manual, /name="path"[^>]*value="\/custom"/);
  assert.match(manual, /name="targetPath"[^>]*value="\/custom-target"/);
});

test("fragment editor only offers fragments for the selected shell location", async () => {
  const handlers = new Map<string, (event: unknown) => Response | Promise<Response>>();
  const shellServiceId = "shell-service";
  const contentServiceId = "content-service";
  const fragments = ["critical-alerts.banner", "nav.profile", "alerts.active", "body.live"]
    .map((fragmentId) => ({ fragmentId, targetPath: "/fragments", operationId: "fragments.read", method: "GET" }));
  const config = {
    tenants: [{
      id: "tenant-a",
      services: [
        { id: shellServiceId, serviceId: "org.example.shell", title: "Shell", hostname: "https://shell.example", enabled: true },
        { id: contentServiceId, serviceId: "org.example.content", title: "Content", hostname: "https://content.example", enabled: true }
      ],
      activatedPlatformServices: []
    }],
    platformServices: [],
    sharedServiceActivations: [],
    sharedServiceCatalog: [],
    apps: [{
      id: "app-a",
      tenantId: "tenant-a",
      shell: { serviceId: shellServiceId },
      routes: [{ serviceId: contentServiceId, operations: ["fragments.read"], targetPath: "/fragments", enabled: true }],
      fragments: {},
      slots: [],
      shellFragments: {}
    }],
    manifestCache: [
      {
        serviceId: shellServiceId,
        shell: {
          service: "org.example.shell",
          renderer: "bootstrap5",
          fragments: [
            { id: "theme-selector", kind: "fragment", title: "Theme selector", description: "Theme selector", defaultItems: [] },
            { id: "critical-alerts", kind: "block", title: "Critical alerts", description: "Critical alerts", defaultItems: [] }
          ]
        },
        viewIndex: {}
      },
      {
        serviceId: contentServiceId,
        viewIndex: {
          fragments: {
            viewId: "fragments",
            title: "Fragments",
            description: "Fragments",
            path: "/fragments",
            operations: [],
            fragments
          }
        }
      }
    ]
  };
  registerFragmentsEditorRoutes({
    get: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`GET ${path}`, handler); },
    post: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`POST ${path}`, handler); }
  } as never, {
    loadConfig: async () => config,
    saveConfig: async () => undefined
  } as never);

  const get = handlers.get("GET /.well-known/bp/admin/fragments-editor");
  assert.ok(get);
  const html = await (await get({ req: new Request("https://admin.example/.well-known/bp/admin/fragments-editor?appId=app-a") })).text();
  assert.match(html, /<option[^>]*>[^<]*critical-alerts\.banner/);
  assert.doesNotMatch(html, /<option[^>]*>[^<]*(?:Theme selector|nav\.profile|alerts\.active|body\.live)/);

  const add = handlers.get("POST /.well-known/bp/admin/fragments-editor/add");
  assert.ok(add);
  const response = await add({
    req: new Request("https://admin.example/.well-known/bp/admin/fragments-editor/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        appId: "app-a",
        shellServiceId,
        fragmentId: "critical-alerts",
        source: `s:${contentServiceId}:nav.profile:%2Ffragments`
      })
    })
  });
  assert.equal(response.status, 400);
});

test("poll sync records service presence and config delivery", async () => {
  const handlers = new Map<string, (event: unknown) => Response | Promise<Response>>();
  const oldTimestamp = "2026-08-24T15:31:10.884Z";
  const service = {
    id: "service-a",
    hostname: "https://service.example",
    apiKeyHash: "hash",
    capabilities: [],
    createdAt: oldTimestamp,
    lastSeenAt: oldTimestamp,
    enabled: true
  };
  const config = {
    tenants: [{ id: "tenant-a", services: [service] }],
    platformServices: [],
    sharedServiceActivations: [],
    sharedServiceCatalog: []
  };
  let saves = 0;
  registerSyncEndpoint({
    get: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`GET ${path}`, handler); },
    post: (path: string, handler: (event: unknown) => Response | Promise<Response>) => { handlers.set(`POST ${path}`, handler); }
  } as never, {
    loadConfig: async () => config,
    saveConfig: async (_config: unknown, options?: { notify?: boolean }) => {
      assert.equal(options?.notify, false);
      saves += 1;
    },
    validateApiKey: async () => ({ scope: "tenant", serviceId: service.id, tenantId: "tenant-a", service }),
      getScopedConfig: async () => ({ managementOrigins: [], tenants: [], apps: [] }),
      onChange: () => () => {}
  } as never);

  const poll = handlers.get("GET /.well-known/bp/sync/poll");
  assert.ok(poll);
  const response = await poll({ req: new Request("https://admin.example/.well-known/bp/sync/poll", { headers: { authorization: "Bearer key" } }) });
  assert.equal(response.status, 200);
  assert.ok(Date.parse(service.lastSeenAt) > Date.parse(oldTimestamp));
  assert.ok(Date.parse(service.lastSyncAt!) > Date.parse(oldTimestamp));
  assert.equal(saves, 2);

  const html = String(renderServices({
    title: "Services",
    services: [{
      ...service,
      capabilities: [],
      lastSyncAt: service.lastSyncAt,
      syncedVersion: "10.4.0",
      scope: "tenant",
      tenantId: "tenant-a",
      pushBase: "/settings/service/service-a",
      supportsCustomUi: false,
      configManifestKnown: true,
      hasConfigurableOptions: false
    }],
    tenants: [{ id: "tenant-a", title: "Tenant A" }],
    m2mConnections: [],
    sharedServiceCatalog: [],
    sharedServiceActivations: [],
    apps: [],
    tenantApps: {},
    adminApiBase: "/.well-known/bp/admin"
  }));
  assert.match(html, /Last seen:/);
  assert.match(html, /Last sync:/);
  assert.match(html, /Synced version: 10\.4\.0/);
});

test("manifest sync preserves stale app auth redirects for repair", async () => {
  const value = s2sConfig();
  const app = value.config.apps[0]!;
  const pageRouteId = uuidv7();
  const apiRouteId = uuidv7();
  app.routes = [
    {
      id: pageRouteId,
      kind: "page",
      path: "/dashboard",
      serviceId: value.targetId,
      viewId: "dashboard.index",
      enabled: true,
      methods: ["GET"]
    },
    {
      id: apiRouteId,
      kind: "api",
      path: `/_bp/service/${value.targetId}/dashboard-data`,
      serviceId: value.targetId,
      viewId: "dashboard.data",
      enabled: true,
      methods: ["GET"]
    }
  ];
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
  await reconcileServiceRegistry(storage, value.targetId, { routes: [] } as never);
  assert.equal(app.routes.find((route) => route.id === pageRouteId)?.enabled, false);
  assert.equal(app.routes.some((route) => route.id === apiRouteId), false);
  assert.deepEqual(app.auth.redirects?.afterLogin, {
    serviceId: value.targetId,
    viewId: "dashboard.index"
  });
  storage.assertValid();
  app.auth.redirects!.afterLogin!.serviceId = uuidv7();
  assert.throws(() => storage.assertValid(), /auth\.redirects\.afterLogin references unavailable service instance/);
});

test("manifest sync owns API mounts and moves newly renderable views to visual routes", async () => {
  const value = s2sConfig();
  const app = value.config.apps[0]!;
  const movedRouteId = uuidv7();
  app.routes = [
    {
      id: uuidv7(),
      kind: "page",
      path: "/dashboard",
      serviceId: value.targetId,
      viewId: "dashboard.index",
      enabled: true,
      methods: ["GET", "POST"]
    },
    {
      id: movedRouteId,
      kind: "api",
      path: "/_bp/service/org.example.target/moved",
      serviceId: value.targetId,
      viewId: "moved.index",
      enabled: true,
      methods: ["GET"]
    }
  ];
  const registryRoute = (viewId: string, path: string, raw: boolean, dependencies: Array<{ operationId: string; method: "GET" }> = [], postRenderer = false) => {
    const methodRoutes: Record<string, unknown> = {
      GET: {
        method: "GET",
        operationId: viewId,
        title: viewId,
        description: "",
        schemas: {},
        handler: () => ({}),
        raw,
        auth: { required: false, permissions: [] },
        dependencies,
        cacheHints: { ttlSeconds: 0, varyBy: [] },
        demoScenarios: []
      }
    };
    if (postRenderer) {
      methodRoutes.POST = {
        method: "POST",
        operationId: `${viewId}.submit`,
        title: `${viewId} submit`,
        description: "",
        schemas: {},
        handler: () => ({}),
        auth: { required: false, permissions: [] },
        dependencies: [],
        cacheHints: { ttlSeconds: 0, varyBy: [] },
        demoScenarios: []
      };
    }
    return {
      viewId,
      path,
      paramNames: [],
      methods: postRenderer ? ["GET", "POST"] : ["GET"],
      raw,
      methodRoutes,
      renderers: raw ? {} : { bootstrap5: { pages: postRenderer ? [{ method: "GET" }, { method: "POST" }] : [{ method: "GET" }], components: [], fragments: [] } },
      auth: { required: false, permissions: [] },
      schemas: {},
      robots: [],
      dependencies,
      apiContracts: [],
      demoScenarios: []
    };
  };

  await reconcileServiceRegistry(new MemoryStorage(value.config), value.targetId, {
    routes: [
      registryRoute("dashboard.index", "/dashboard", false, [{ operationId: "dashboard.data", method: "GET" }], true),
      registryRoute("dashboard.data", "/dashboard-data", true),
      registryRoute("jobs.run", "/jobs/run", true),
      registryRoute("moved.index", "/moved", false)
    ]
  } as never);

  const dependency = app.routes.find((route) => route.viewId === "dashboard.data");
  assert.equal(dependency?.kind, "api");
  assert.equal(dependency?.enabled, true);
  assert.equal(app.routes.find((route) => route.viewId === "jobs.run")?.enabled, false);
  const dashboardSubmit = app.routes.find((route) => route.operations?.includes("dashboard.index.submit"));
  assert.equal(dashboardSubmit?.kind, "api");
  assert.equal(dashboardSubmit?.enabled, false);
  assert.deepEqual(app.routes.find((route) => route.viewId === "dashboard.index" && route.kind === "page")?.operations, ["dashboard.index"]);
  const moved = app.routes.find((route) => route.id === movedRouteId);
  assert.equal(moved?.kind, "page");
  assert.equal(moved?.enabled, false);
  assert.equal(moved?.path, `/${value.targetId}/moved`);
});

test("auth provider sync persists public JWKS and repairs later app bindings", async () => {
  const value = s2sConfig();
  const pair = generateKeyPair();
  const publicKeys = { keys: [publicKeyToJwk(pair.publicKeyPem, pair.kid)] };
  value.config.tenants[0]!.services[0]!.title = "Stale service title";
  const app = value.config.apps[0]!;
  app.auth = {
    serviceId: value.sourceId,
    expectedIssuer: "https://auth.example.invalid",
    expectedAudience: "app",
    jwksUri: "https://auth.example.invalid/.well-known/jwks.json",
    roles: []
  };
  const storage = new MemoryStorage(value.config);

  await reconcileServiceRegistry(storage, value.sourceId, { routes: [] } as never, {
    title: "Current manifest title",
    authProvider: {
      issuer: "https://auth.example.invalid",
      audience: "app",
      jwksUri: "https://auth.example.invalid/.well-known/jwks.json",
      publicKeys
    }
  });

  assert.deepEqual(value.config.tenants[0]!.services[0]!.authProvider?.publicKeys, publicKeys);
  assert.equal(value.config.tenants[0]!.services[0]!.title, "Current manifest title");
  assert.deepEqual(app.auth.publicKeys, publicKeys);

  delete app.auth.publicKeys;
  const canonicalized = storage.canonicalize();
  assert.deepEqual(canonicalized.apps[0]!.auth?.publicKeys, publicKeys);
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
    targetPath: path,
    operations: [`${viewId}.read`],
    methods: ["GET"],
    title: viewId,
    renderable: kind === "page",
    enabled: id !== "stale"
  });
  const html = String(renderRoutes({
    title: "Route Designer",
    apps: [{ id: "app-a", title: "App A", tenantId: "tenant-a" }],
    selectedAppId: "app-a",
    openApiServiceId: "service-b",
    routes: [
      route("root-a", "/", "service-a", "welcome.index"),
      route("root-b", "/", "service-a", "welcome.index"),
      route("reports", "/reports/:reportId", "service-a", "reports.view"),
      route("stale", "/calculators/investment", "service-a", "retirement.index"),
      route("api-a", "/_bp/service/crm/a", "service-a", "crm.api", "api"),
      route("api-b", "/_bp/service/theme/b", "service-b", "theme.api", "api")
    ],
    availableServices: [
      {
        id: "service-a",
        title: "TRG One Theme",
        hostname: "https://crm.example",
        serviceId: "service.trg-one.crm",
        manifestLoaded: true,
        views: [{
          viewId: "reports.view",
          operationId: "reports.view.read",
          title: "Report",
          description: "Read report",
          path: "/reports/:reportId",
          pathVariants: [],
          method: "GET",
          renderable: true,
          dependencies: []
        }, {
          viewId: "reports.view.pdf",
          operationId: "reports.view.pdf.create",
          title: "Report PDF",
          description: "Create report PDF",
          path: "/reports/:reportId/pdf",
          pathVariants: [],
          method: "POST",
          renderable: true,
          dependencies: []
        }]
      },
      { id: "service-b", title: "TRG One Theme", hostname: "https://theme.example", serviceId: "service.trg-one.theme", manifestLoaded: true, views: [] }
    ],
    dependencyIssues: [{
      message: "POST webcalcs.quote.calculate requires exactly one GET service.trg-one.reports:reports.view.read; found 0, possible 1.",
      found: 0,
      possibleRoutes: [{ id: "stale", path: "/calculators/investment", serviceId: "service-a" }]
    }],
    adminApiBase: "/.well-known/bp/admin",
    serviceBaseUrl: "https://config.example"
  }));
  assert.match(html, /data-bp-route-id="root-a"/);
  assert.match(html, /data-bp-route-id="root-b"/);
  assert.match(html, /Conflict: 2 route records use this mount path/);
  assert.match(html, /data-bp-path-group="\/calculators"/);
  assert.match(html, /retirement\.index — unavailable in current manifest/);
  assert.match(html, /Manifest operation unavailable/);
  assert.match(html, /data-bp-route-conflict/);
  assert.match(html, /This service view and path are already mounted in this app/);
  assert.match(html, /\/reports\/:reportId\/pdf/);
  assert.match(html, /data-bp-add-route-submit/);
  assert.doesNotMatch(html, /wantedPath \+ .*unavailable/);
  assert.match(html, /TRG One Theme · service\.trg-one\.crm/);
  assert.match(html, /bp-api-routes-service-a/);
  assert.match(html, /id="bp-api-routes-service-b" class="accordion-collapse collapse show"/);
  assert.match(html, /data-bs-target="#bp-api-routes-service-a" aria-expanded="false"/);
  assert.doesNotMatch(html, /Delete API route/);
  assert.match(html, /found 0, possible 1/);
  assert.match(html, /Quick fix/);
  assert.match(html, /apps\/app-a\/routes\/stale/);
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
  assert.match(html, /stale targets remain visible for repair/);
  assert.match(html, /unavailable/);
});

test("service API route state is shown only by the On control", () => {
  const html = String(renderRoutes({
    title: "Route Designer",
    apps: [{ id: "app-a", title: "App A", tenantId: "tenant-a" }],
    selectedAppId: "app-a",
    routes: [{
      id: "api-a",
      kind: "api",
      path: "/_bp/service/service-a/reports",
      serviceId: "service-a",
      viewId: "reports.api",
      targetPath: "/reports",
      fixedParams: {},
      methods: ["GET"],
      title: "reports.api",
      renderable: false,
      enabled: false
    }],
    availableServices: [{
      id: "service-a",
      title: "Reports",
      hostname: "https://reports.example",
      serviceId: "service.reports",
      manifestLoaded: true,
      views: [{
        viewId: "reports.api",
        title: "Reports API",
        path: "/reports",
        pathVariants: [],
        methods: ["GET"],
        renderable: false,
        dependencies: []
      }]
    }],
    adminApiBase: "/.well-known/bp/admin",
    serviceBaseUrl: "https://config.example"
  }));
  assert.match(html, />off<\/button>/);
  assert.doesNotMatch(html, />Disabled<|Manifest view unavailable/);
});

test("service registration stays browser-mediated and tenant history follows the request", () => {
  const html = String(renderServices({
    title: "Service Registry",
    services: [{
      id: "service-a",
      hostname: "https://service.example",
      serviceId: "org.example.service",
      capabilities: [],
      createdAt: new Date().toISOString(),
      enabled: true,
      scope: "tenant",
      tenantId: "tenant-a",
      pushBase: "/settings/service/service-a",
      supportsCustomUi: false,
      configManifestKnown: true,
      hasConfigurableOptions: false
    }],
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
  assert.match(html, /id="bp-tenant-service-preview"[^>]*aria-live="polite"/);
  assert.match(html, /bp-toast-container/);
  assert.match(html, /Toast\?\.getOrCreateInstance/);
  assert.match(html, /Offcanvas\?\.getInstance\(panel\)\?\.hide/);
  assert.match(html, /setTenantStatus\("secondary", "Installing service\.\.\."\)/);
  assert.match(html, /data-bp-reconfigure-service=""[^>]*data-bp-service-plugin-id="org\.example\.service"/);
  assert.match(html, /const needsReconnect = health\?\.setupMode === true && health\.pluginId === button\.dataset\.bpServicePluginId/);
  assert.match(html, /status\.textContent = "needs reconnect"/);
  assert.match(html, />Reconnect<\/button>/);
  assert.match(html, /reconfigure: true/);
  const script = /<script>\s*([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
  assert.match(html, /id="bp-change-hostname-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /id="bp-shared-service-form"[^>]*data-bp-config="rewrite=false"/);
  assert.match(html, /shared-services\/org\.example\.shared\/activations\?tenantId=tenant-a[^>]*data-bp-error-modal=""/);
  assert.match(html, /<script>\s*\(\(\) => \{/);
  assert.doesNotMatch(html, /&quot;bp-tenant-service-form&quot;/);
});

test("service config editor transfers scoped values and defaults the first app", () => {
  const html = renderConfigClientShell({
    hostname: "https://service.example",
    tenantId: "tenant-a",
    serviceInstanceId: "service-instance-a",
    serviceId: "org.example.service",
    serviceTitle: "Example Service",
    appId: "",
    adminApiBase: "/.well-known/bp/admin",
    tenantApps: [{ id: "app-a", title: "App A" }]
  });

  assert.match(html, /data-bp-config-export/);
  assert.match(html, /data-bp-config-import/);
  assert.match(html, /betterportal\.service-config/);
  assert.match(html, /apps\[0\]\?\.id/);
  assert.match(html, /Stored secrets were omitted/);
  assert.match(html, /Unknown config fields/);
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
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

test("role sync controls require a discovered endpoint", () => {
  const manifest = (capabilities: string[], views: Array<{ path: string; role: string; method: "GET" | "POST" }>): CachedManifest => ({
    serviceId: "org.example.auth",
    manifestVersion: "1",
    capabilities,
    apiContracts: [],
    m2mRequests: [],
    developerResources: [],
    viewIndex: Object.fromEntries(views.map((view, index) => [`view-${index}`, {
      viewId: `view-${index}`,
      title: "Role sync",
      description: "Role sync",
      path: view.path,
      pathVariants: [],
      operations: [{
        operationId: `operation-${index}`,
        method: view.method,
        title: "Role sync",
        description: "Role sync",
        renderers: [],
        renderModes: [],
        role: view.role,
        authRequired: true,
        robots: [],
        dependencies: [],
        permissions: [],
        renderable: false,
        apiContracts: [],
        demoScenarios: []
      }],
      fragments: []
    }])),
    configSchemas: [],
    webhooks: [],
    fetchedAt: Date.now()
  });

  const localAuth = manifest([BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY], []);
  assert.equal(resolveRoleSyncUrl("https://auth.example", localAuth, "betterportal", "tenant", "app"), undefined);

  const providerAuth = manifest(["auth.roles.sync"], [
    { path: "/custom/role-controls", role: "auth.roles.sync.view", method: "GET" }
  ]);
  assert.equal(
    resolveRoleSyncUrl("https://auth.example/base/", providerAuth, "provider", "tenant/a", "app b"),
    "https://auth.example/base/custom/role-controls?tenantId=tenant%2Fa&appId=app+b"
  );

  const managedAuth = manifest([BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY], [
    { path: "/custom/roles", role: "auth.roles.sync", method: "POST" }
  ]);
  assert.equal(
    resolveRoleSyncUrl("https://auth.example", managedAuth, "betterportal", "tenant", "app"),
    "https://auth.example/custom/roles?tenantId=tenant&appId=app"
  );

  const ambiguousAuth = manifest([BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY], [
    { path: "/custom/roles-a", role: "auth.roles.sync", method: "POST" },
    { path: "/custom/roles-b", role: "auth.roles.sync", method: "POST" }
  ]);
  assert.equal(resolveRoleSyncUrl("https://auth.example", ambiguousAuth, "betterportal", "tenant", "app"), undefined);
});

test("preview groups clone, reconcile, refresh and expire in isolation", () => {
  const tenantId = uuidv7();
  const appId = uuidv7();
  const serviceInstanceId = uuidv7();
  const routeId = uuidv7();
  const now = new Date("2026-01-01T00:00:00.000Z");
  const config = BetterPortalConfigSchema.parse({
    tenants: [{
      id: tenantId,
      slug: "source",
      title: "Source",
      branding: {},
      services: [{
        id: serviceInstanceId,
        hostname: "https://source-service.example",
        apiKeyHash: "source-hash",
        serviceId: "org.example.service",
        title: "Example service",
        createdAt: now.toISOString()
      }]
    }],
    apps: [{
      id: appId,
      tenantId,
      slug: "source-app",
      title: "Source app",
      hostnames: ["source.example"],
      themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: [{
        id: routeId,
        kind: "page",
        path: "/existing",
        serviceId: serviceInstanceId,
        viewId: "home",
        enabled: true,
        operations: ["home.view"]
      }]
    }]
  });

  const ambiguous = structuredClone(config);
  const secondInstanceId = uuidv7();
  ambiguous.tenants[0].services.push({
    ...ambiguous.tenants[0].services[0],
    id: secondInstanceId,
    hostname: "https://second-source-service.example"
  });
  ambiguous.apps[0].routes.push({
    ...ambiguous.apps[0].routes[0],
    id: uuidv7(),
    path: "/second",
    serviceId: secondInstanceId
  });
  const ambiguousGroup = createPreviewGroup(ambiguous, {
    name: "Ambiguous",
    sourceTenantId: tenantId,
    sourceAppId: appId,
    expiresInDays: 30
  }).group;
  assert.throws(() => provisionPreviewDeployment(ambiguous, ambiguousGroup.id, {
    key: "ambiguous",
    hostname: "ambiguous.example",
    services: [{ serviceId: "org.example.service", url: "https://service-ambiguous.example" }]
  }, "https://config.example", now), /multiple instances/);

  const { group, apiKey } = createPreviewGroup(config, {
    name: "Pull requests",
    sourceTenantId: tenantId,
    sourceAppId: appId,
    expiresInDays: 30
  }, now);
  assert.match(apiKey, /^bp_pg_/);
  assert.deepEqual(group.services, []);

  const created = provisionPreviewDeployment(config, group.id, {
    key: "123",
    name: "PR 123",
    hostname: "pr-123.example",
    expiresInDays: 7,
    services: [{ serviceId: "org.example.service", url: "https://service-pr-123.example" }]
  }, "https://config.example", now);
  assert.equal(created.created, true);
  assert.equal(created.credentials.length, 1);
  assert.deepEqual(group.services.map((service) => service.serviceId), ["org.example.service"]);
  assert.equal(created.deployment.expiresAt, "2026-01-08T00:00:00.000Z");
  assert.equal(visibleAdminConfig(config).tenants.length, 1);
  assert.equal(visibleAdminConfig(config).apps.length, 1);

  const previewApp = config.apps.find((app) => app.id === created.deployment.appId)!;
  const previewServiceId = created.deployment.services[0].instanceId;
  assert.equal(previewApp.routes[0].enabled, false);
  assert.equal(reconcilePreviewService(config, previewServiceId, {
    serviceId: "org.example.service",
    manifestVersion: "1",
    capabilities: [],
    apiContracts: [],
    m2mRequests: [],
    developerResources: [],
    configSchemas: [],
    webhooks: [],
    fetchedAt: now.getTime(),
    viewIndex: {
      home: {
        viewId: "home",
        title: "Home",
        description: "Home",
        path: "/home",
        pathVariants: [],
        operations: [{
          operationId: "home.view",
          method: "GET",
          title: "Home",
          description: "Home",
          renderers: ["bootstrap5"],
          renderModes: ["page"],
          authRequired: false,
          robots: [],
          dependencies: [],
          permissions: [],
          renderable: true,
          apiContracts: [],
          demoScenarios: []
        }],
        fragments: []
      }
    }
  }), true);
  assert.equal(previewApp.routes[0].path, "/existing");
  assert.equal(previewApp.routes[0].enabled, true);
  assert.equal(previewApp.menu.length, 1);

  const refreshed = provisionPreviewDeployment(config, group.id, {
    key: "123",
    hostname: "ignored.example",
    expiresInDays: null,
    services: [{ serviceId: "org.example.service", url: "https://service-pr-123.example" }]
  }, "https://config.example", new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(refreshed.created, false);
  assert.equal(refreshed.credentials.length, 0);
  assert.equal(refreshed.deployment.hostname, "pr-123.example");
  assert.equal(refreshed.deployment.expiresAt, "2026-01-09T00:00:00.000Z");

  assert.throws(() => provisionPreviewDeployment(config, group.id, {
    key: "123",
    hostname: "ignored.example",
    services: [{ serviceId: "org.example.other", url: "https://other-pr-123.example" }]
  }, "https://config.example", now), /exactly match the existing preview/);

  const other = provisionPreviewDeployment(config, group.id, {
    key: "456",
    hostname: "pr-456.example",
    expiresInDays: 7,
    services: [{ serviceId: "org.example.other", url: "https://other-pr-456.example" }]
  }, "https://config.example", new Date("2026-01-02T00:00:00.000Z"));
  assert.deepEqual(group.services.map((service) => service.serviceId), ["org.example.service", "org.example.other"]);

  assert.deepEqual(deleteExpiredPreviewDeployments(config, new Date("2026-01-10T00:00:00.000Z")), [created.deployment.id, other.deployment.id]);
  assert.equal(config.previewEnvironmentDeployments.length, 0);
  assert.equal(config.tenants.length, 1);
  assert.equal(config.apps.length, 1);
});

test("standalone preview API authenticates and upserts deployments by POST", async () => {
  const tenantId = uuidv7();
  const appId = uuidv7();
  const instanceId = uuidv7();
  const config = BetterPortalConfigSchema.parse({
    tenants: [{
      id: tenantId,
      slug: "source",
      title: "Source",
      branding: {},
      services: [{
        id: instanceId,
        hostname: "https://source-service.example",
        apiKeyHash: "source-hash",
        serviceId: "org.example.service",
        title: "Example service",
        createdAt: new Date().toISOString()
      }]
    }],
    apps: [{
      id: appId,
      tenantId,
      slug: "source-app",
      title: "Source app",
      hostnames: ["source.example"],
      themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: [{ id: uuidv7(), kind: "page", path: "/", serviceId: instanceId, viewId: "home", enabled: true, operations: ["home.view"] }]
    }]
  });
  const { group, apiKey } = createPreviewGroup(config, {
    name: "Pull requests",
    sourceTenantId: tenantId,
    sourceAppId: appId,
    expiresInDays: 30
  });
  const handlers = new Map<string, (event: never) => Promise<Response>>();
  registerPreviewDeploymentApi({
    app: {
      get: (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`GET ${path}`, handler),
      post: (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`POST ${path}`, handler),
      delete: (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`DELETE ${path}`, handler)
    } as never,
    storage: new MemoryStorage(config),
    controlPlaneUrl: "https://config.example",
    replayEncryptionKey: "review-test-only-replay-key"
  });
  const path = "/api/preview-groups/:groupId/deployments/:key";
  const call = (method: "GET" | "POST" | "DELETE", authorization?: string) => handlers.get(`${method} ${path}`)!({
    req: new Request("https://config.example/api/preview-groups/group/deployments/123", {
      method,
      headers: { ...(authorization ? { authorization } : {}), ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify({
        name: "PR 123",
        hostname: "pr-123.example",
        expiresInDays: 7,
        services: { "org.example.service": "https://service-pr-123.example" }
      }) } : {})
    }),
    context: { params: { groupId: group.id, key: "123" } }
  } as never);

  assert.equal((await call("POST")).status, 401);
  const created = await call("POST", `Bearer ${apiKey}`);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "no-store");
  const firstResult = await created.json() as { credentials: unknown[] };
  assert.equal(firstResult.credentials.length, 1);
  const refreshed = await call("POST", `Bearer ${apiKey}`);
  assert.equal(refreshed.status, 201);
  assert.deepEqual(await refreshed.json(), firstResult);
  assert.ok(!JSON.stringify(config).includes("BP_SERVICE_API_KEY"));
  assert.equal((await call("GET", `Bearer ${apiKey}`)).status, 200);
  assert.equal((await call("DELETE", `Bearer ${apiKey}`)).status, 204);
  assert.equal((await call("DELETE", `Bearer ${apiKey}`)).status, 204);
  assert.equal((await call("GET", `Bearer ${apiKey}`)).status, 404);
});

test("preview environment editor keeps config crypto in the browser", () => {
  const data: Parameters<typeof renderPreviewEnvironments>[0] = {
    title: "Preview Environments",
    previewPath: "/preview-environments",
    deploymentApiBase: "/api/preview-groups",
    configTicketUrl: "https://config.example/.well-known/bp/admin/config-ticket",
    sourceTenants: [],
    sourceApps: [],
    groups: [{
      id: uuidv7(),
      name: "Pull requests",
      sourceTenantId: uuidv7(),
      sourceAppId: uuidv7(),
      sourceLabel: "Source / App",
      expiresInDays: 30,
      services: [{
        serviceId: "org.example.service",
        title: "Example",
        source: { instanceId: uuidv7(), hostname: "https://service.example" },
        fields: [{
          key: "token",
          title: "Token",
          description: "Preview-only token",
          scope: "tenant",
          secret: true,
          required: true,
          options: []
        }, {
          key: "region",
          title: "Region",
          description: "Deployment region",
          scope: "tenant",
          secret: false,
          required: false,
          defaultValue: "za",
          options: []
        }],
        encryptedTenantConfig: "{}",
        encryptedAppConfig: "{}"
      }],
      deployments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    issuedCredentials: []
  };
  const page = String(renderPreviewEnvironments(data));
  const html = String(renderPreviewConfigEditor(data));
  assert.match(page, /_c=config&amp;groupId=/);
  assert.doesNotMatch(page, /click once/);
  assert.match(page, /querySelector\('form'\)/);
  assert.doesNotMatch(page, /BP_PREVIEW_CONFIG_KEY/);
  assert.doesNotMatch(page, /crypto\.subtle\.encrypt/);
  assert.match(html, /BP_PREVIEW_CONFIG_KEY/);
  assert.doesNotMatch(html, /Service plugin IDs/);
  assert.match(html, /crypto\.subtle\.encrypt/);
  assert.match(html, /Sync from prod/);
  assert.match(html, /value="za"/);
  assert.match(html, /data-secret="true"[^>]*disabled/);
  const keyInput = /<input[^>]*data-bp-preview-key=""[^>]*>/.exec(html)?.[0];
  assert.ok(keyInput);
  assert.doesNotMatch(keyInput, /\sname=/i);
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});
