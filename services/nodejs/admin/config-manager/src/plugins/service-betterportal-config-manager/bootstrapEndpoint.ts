import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jsonResponse, type BetterPortalEvent, type BetterPortalH3App } from "@betterportal/framework/lib/runtime/h3.js";
import { uuidv7, type BetterPortalRouteMount, type PlatformConfigStore } from "@betterportal/framework";
import type { Observable } from "@bsb/base";
import type { CpBootstrapState } from "./cpBootstrap.js";
import { renderBootstrapWizardHtml } from "./bootstrapWizardHtml.js";
import { apiRoutePath } from "./routeMounts.js";
import type { PostgresStorage } from "./storage/postgres.js";

/**
 * Default admin app route mounts - points each menu entry at a config-manager view.
 * Service paths are placeholders; the framework's manifest cache + resolvedServicePath
 * injection fills the real service-side path at sync delivery time.
 */
/**
 * serviceId values are the UUIDv7 of the tenant.services entry (pre-assigned at
 * commit time, registered via /redeem with the same instanceId). Never pluginId.
 */
export function buildDefaultAdminRoutes(cmInstanceId: string, authServiceInstanceId: string): BetterPortalRouteMount[] {
  return [
    { id: uuidv7(), kind: "page", path: "/", serviceId: cmInstanceId, viewId: "services.index", title: "Services", icon: "grid", enabled: true, operations: ["admin.services.view"] },
    { id: uuidv7(), kind: "page", path: "/tenants", serviceId: cmInstanceId, viewId: "tenants.index", title: "Tenants & Apps", icon: "building", enabled: true, operations: ["admin.tenants.view"] },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.config-manager", "/tenants"), serviceId: cmInstanceId, viewId: "tenants.index", title: "Create tenant or app", enabled: true, operations: ["admin.tenants.create"], targetPath: "/tenants" },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.config-manager", "/tenants"), serviceId: cmInstanceId, viewId: "tenants.index", title: "Update tenant or app", enabled: true, operations: ["admin.tenants.update"], targetPath: "/tenants" },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.config-manager", "/tenants"), serviceId: cmInstanceId, viewId: "tenants.index", title: "Delete tenant or app", enabled: true, operations: ["admin.tenants.delete"], targetPath: "/tenants" },
    { id: uuidv7(), kind: "page", path: "/routes", serviceId: cmInstanceId, viewId: "routes.index", title: "Routes", icon: "map", enabled: true, operations: ["admin.routes.view"] },
    { id: uuidv7(), kind: "page", path: "/menu", serviceId: cmInstanceId, viewId: "menu.index", title: "Menu", icon: "list", enabled: true, operations: ["admin.menu.view"] },
    { id: uuidv7(), kind: "page", path: "/fragments", serviceId: cmInstanceId, viewId: "fragments.index", title: "Fragments", icon: "puzzle", enabled: true, operations: ["admin.fragments.view"] },
    { id: uuidv7(), kind: "page", path: "/preview", serviceId: cmInstanceId, viewId: "preview.index", title: "Preview", icon: "eye", enabled: true, operations: ["admin.preview.view"] },
    { id: uuidv7(), kind: "page", path: "/auth", serviceId: cmInstanceId, viewId: "auth.index", title: "Permissions", icon: "shield", enabled: true, operations: ["admin.auth.view"] },
    { id: uuidv7(), kind: "page", path: "/config", serviceId: cmInstanceId, viewId: "config.index", title: "Config", icon: "settings", enabled: true, operations: ["admin.config.view"] },
    // Login page (unauthenticated landing) - required for the /login redirect to land somewhere.
    { id: uuidv7(), kind: "page", path: "/login", serviceId: authServiceInstanceId, viewId: "login.index", title: "Sign In", enabled: true, operations: ["auth.login.view"] },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.auth.default", "/login"), serviceId: authServiceInstanceId, viewId: "login.index", title: "Sign In", enabled: true, operations: ["auth.login"], targetPath: "/login" },
    { id: uuidv7(), kind: "page", path: "/logout", serviceId: authServiceInstanceId, viewId: "logout.index", title: "Sign Out", enabled: true, operations: ["auth.logout.view"] },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.auth.default", "/logout"), serviceId: authServiceInstanceId, viewId: "logout.index", title: "Sign Out", enabled: true, operations: ["auth.logout"], targetPath: "/logout" },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.auth.default", "/refresh"), serviceId: authServiceInstanceId, viewId: "refresh.index", title: "Refresh Session", enabled: true, operations: ["auth.refresh"], targetPath: "/refresh" },
    // First-admin registration page. Only renders a form while the auth service
    // has zero users; once any user exists it redirects to /login.
    { id: uuidv7(), kind: "page", path: "/register", serviceId: authServiceInstanceId, viewId: "register.index", title: "Create First Admin", enabled: true, operations: ["auth.register.view"] },
    { id: uuidv7(), kind: "api", path: apiRoutePath("org.betterportal.auth.default", "/register"), serviceId: authServiceInstanceId, viewId: "register.index", title: "Create First Admin", enabled: true, operations: ["auth.register"], targetPath: "/register" }
  ];
}

function buildDefaultAdminMenu(routes: Array<{ id: string; title: string }>): Array<{
  id: string;
  type: "link";
  title: string;
  routeId: string;
  enabled: boolean;
  children: never[];
}> {
  return routes.map((r) => ({
    id: uuidv7(),
    type: "link" as const,
    title: r.title,
    routeId: r.id,
    enabled: true,
    children: [] as never[]
  }));
}

function issuerFromServiceUrl(serviceUrl: string): string {
  const normalized = serviceUrl.replace(/\/+$/, "");
  try {
    return new URL(normalized).origin;
  } catch {
    return normalized;
  }
}

const BOOTSTRAP_KEY_TTL_MS = 15 * 60 * 1000;

interface BootstrapKeyState {
  key: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

/**
 * P6 + P12 - Bootstrap detection + wizard endpoint.
 *
 * On startup, checks platform config for any tenant. If none -> generates a
 * 15-min bootstrap key, logs it to stdout, and exposes:
 *   GET  /.well-known/bp/bootstrap        -> vanilla HTML wizard form
 *   POST /.well-known/bp/bootstrap/commit -> accepts {key, adminTenant, adminApp, themeUrl, authUrl}
 *
 * Once committed, the bootstrap state is consumed; endpoints return 410 Gone.
 */
export async function registerBootstrapEndpoint(input: {
  app: BetterPortalH3App;
  storage: PlatformConfigStore;
  cpState: CpBootstrapState;
  logger: Observable;
  postgres?: PostgresStorage;
  owner?: string;
}): Promise<void> {
  const config = await input.storage.loadConfig();
  const alreadyBootstrapped = config.tenants.length > 0;

  let state: BootstrapKeyState | null = null;
  if (!alreadyBootstrapped) {
    const key = `bootstrap-${randomBytes(24).toString("base64url")}`;
    const issuedAt = Date.now();
    const candidate = { key, issuedAt, expiresAt: issuedAt + BOOTSTRAP_KEY_TTL_MS, consumed: false };
    const created = input.postgres ? await input.postgres.createPendingAction({
      kind: "bootstrap",
      key: "bootstrap",
      secretHash: hashBootstrapKey(key),
      payload: {},
      expiresAt: new Date(candidate.expiresAt).toISOString()
    }) : true;
    if (created) state = candidate;
    // Log via BSB logger (writes to stdout). Wrapped in markers so it's grep-friendly.
    if (created) input.logger.log.warn(
      "**** BETTERPORTAL BOOTSTRAP REQUIRED **** key={key} validUntil={validUntil} url={url}",
      {
        key,
        validUntil: new Date(candidate.expiresAt).toISOString(),
        url: `${input.cpState.issuer}/.well-known/bp/bootstrap`
      }
    );
  }

  // GET wizard - completely silent (404, no body) once bootstrapped or expired.
  input.app.get("/.well-known/bp/bootstrap", async () => {
    const freshConfig = await input.storage.loadConfig();
    if (freshConfig.tenants.length > 0 || (!input.postgres && !state)) {
      return new Response(null, { status: 404 });
    }
    if (input.postgres && !await input.postgres.isPendingActionAvailable("bootstrap", "bootstrap")) {
      return new Response(null, { status: 404 });
    }
    if (!input.postgres && state!.expiresAt < Date.now()) {
      return new Response(null, { status: 404 });
    }
    return new Response(renderBootstrapWizardHtml({ cpIssuer: input.cpState.issuer }), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
    });
  });

  // POST commit
  input.app.post("/.well-known/bp/bootstrap/commit", async (event) => {
    const body = await event.req.json().catch(() => null) as {
      bootstrapKey?: string;
      adminTenant?: { title: string };
      adminApp?: { title: string; hostname: string };
      themeService?: { id: string; hostname: string; title: string };
      authService?: { id: string; hostname: string; title: string };
    } | null;
    if (!body) return jsonResponse({ error: "Body must be JSON" }, 400);
    if (typeof body.bootstrapKey !== "string") return jsonResponse({ error: "Missing bootstrapKey" }, 400);

    if (!body.adminTenant?.title || !body.adminApp?.title || !body.adminApp?.hostname) {
      return jsonResponse({ error: "adminTenant.title + adminApp.title + adminApp.hostname required" }, 400);
    }
    const authHostFromBody = body.authService?.hostname?.replace(/\/+$/, "");
    const themeHostFromBody = body.themeService?.hostname?.replace(/\/+$/, "");
    if (!authHostFromBody) {
      return jsonResponse({ error: "authService.hostname is required" }, 400);
    }
    if (!themeHostFromBody) {
      return jsonResponse({ error: "themeService.hostname is required" }, 400);
    }

    const freshConfig = await input.storage.loadConfig();
    const owner = uuidv7();
    if (input.postgres) {
      const claim = await input.postgres.claimPendingAction({
        kind: "bootstrap",
        key: "bootstrap",
        secretHash: hashBootstrapKey(body.bootstrapKey),
        owner
      });
      if (claim.state === "completed") return jsonResponse((claim.action.result ?? { ok: true }) as unknown as never, 200);
      if (claim.state === "busy") return jsonResponse({ error: "Bootstrap is already being committed" }, 409);
      if (claim.state !== "claimed") return jsonResponse({ error: "Invalid or expired bootstrap key" }, 401);
      if (freshConfig.tenants.length > 0) {
        const result = existingBootstrapResult(freshConfig, input.cpState.issuer);
        await input.postgres.completePendingAction({ kind: "bootstrap", key: "bootstrap", owner, result });
        return jsonResponse(result as unknown as never, 200);
      }
    } else {
      if (!state || state.consumed || state.expiresAt < Date.now() || freshConfig.tenants.length > 0) {
        return new Response(null, { status: 404 });
      }
      const provided = Buffer.from(body.bootstrapKey);
      const expected = Buffer.from(state.key);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return jsonResponse({ error: "Invalid bootstrap key" }, 401);
      }
    }

    // Generate stable IDs (uuidv7 - time-sortable).
    const adminTenantId = uuidv7();
    const adminAppId = uuidv7();
    const adminTenantSlug = adminTenantId;
    const adminAppSlug = adminAppId;

    // Pre-allocate UUIDv7 service instance ids for every service the admin app routes to.
    // CM is a direct tenant service; auth/theme are shared-service activations.
    const cmInstanceId = uuidv7();
    const authActivationId = uuidv7();
    const themeActivationId = uuidv7();
    const authSharedServiceId = "org.betterportal.auth.default";
    const themeSharedServiceId = "org.betterportal.theme.bootstrap1";

    const defaultRoutes = buildDefaultAdminRoutes(cmInstanceId, authActivationId);
    // Auth routes are in defaultRoutes for routing, but excluded from the menu
    // (sign-in/out lives in the nav.profile fragment).
    const menuRoutes = defaultRoutes
      .filter((r): r is BetterPortalRouteMount & { title: string } =>
        typeof r.title === "string"
        && r.kind === "page"
        && !["login.index", "logout.index", "refresh.index", "register.index"].includes(r.viewId)
      );
    const defaultMenu = buildDefaultAdminMenu(menuRoutes);
    const defaultFragments = {
      nav: [
        {
          serviceId: authActivationId,
          fragmentId: "profile",
          targetPath: "/login",
          enabled: true
        }
      ]
    };

    // CM registers itself as a tenant service (self-install - no /redeem cycle).
    // serviceId carries the pluginId for lookups; id is the platform UUIDv7.
    const cmServiceRegistration = {
      id: cmInstanceId,
      hostname: input.cpState.issuer,
      apiKeyHash: "",
      serviceId: "org.betterportal.config-manager",
      capabilities: ["config"],
      title: "Config Manager",
      description: undefined,
      deploymentMode: "self-hosted" as const,
      createdAt: new Date().toISOString(),
      lastSeenAt: undefined,
      enabled: true
    };

    // Auth/theme are shared services. Browser install redeems into shared catalog entries.
    // Admin app references shared activation ids.
    const authSharedService = {
      id: authSharedServiceId,
      serviceId: authSharedServiceId,
      title: body.authService?.title ?? "Auth",
      baseUrl: authHostFromBody,
      apiKeyHash: "",
      description: undefined,
      supportedDeploymentModes: ["self-hosted" as const],
      owner: "bp" as const,
      category: "auth",
      tags: ["auth"],
      enabled: true
    };

    // Same placeholder pattern for the shell service. The shell is a BPService and
    // syncs scoped config from the CP just like auth.
    const themeSharedService = {
      id: themeSharedServiceId,
      serviceId: themeSharedServiceId,
      title: body.themeService?.title ?? "Theme",
      baseUrl: themeHostFromBody,
      apiKeyHash: "",
      description: undefined,
      supportedDeploymentModes: ["self-hosted" as const],
      owner: "bp" as const,
      category: "theme",
      tags: ["theme"],
      enabled: true
    };

    const activatedAt = new Date().toISOString();
    freshConfig.sharedServiceCatalog.push(authSharedService, themeSharedService);
    freshConfig.sharedServiceActivations.push(
      {
        id: authActivationId,
        tenantId: adminTenantId,
        appId: undefined,
        sharedServiceId: authSharedServiceId,
        activatedAt,
        enabled: true
      },
      {
        id: themeActivationId,
        tenantId: adminTenantId,
        appId: undefined,
        sharedServiceId: themeSharedServiceId,
        activatedAt,
        enabled: true
      }
    );

    freshConfig.tenants.push({
      id: adminTenantId,
      slug: adminTenantSlug,
      title: body.adminTenant.title,
      active: true,
      branding: {},
      services: [cmServiceRegistration],
      activatedPlatformServices: []
    });
    // Seed app.auth so the framework adapter can verify JWTs on protected routes.
    // Defaults assume the bootstrap auth service is the issuer; auth service exposes JWKS at /.well-known/jwks.json.
    // serviceId carries the shared activation id; consumers resolve URL via the service resolver.
    const appAuth = {
      serviceId: authActivationId,
      loginViewId: "login.index",
      logoutViewId: "logout.index",
      refreshViewId: "refresh.index",
      expectedIssuer: issuerFromServiceUrl(authHostFromBody),
      expectedAudience: "betterportal-runtime",
      jwksUri: `${authHostFromBody}/.well-known/jwks.json`,
      roles: []
    };

    freshConfig.apps.push({
      id: adminAppId,
      tenantId: adminTenantId,
      slug: adminAppSlug,
      title: body.adminApp.title,
      hostnames: [body.adminApp.hostname],
      originOverrides: [],
      refererOverrides: [],
      shell: { serviceId: themeActivationId },
      themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      defaultRoute: "/",
      routes: defaultRoutes,
      menu: defaultMenu,
      slots: [],
      fragments: defaultFragments,
      auth: appAuth
    } as unknown as typeof freshConfig.apps[number]);

    freshConfig.configManagement = {
      ...(freshConfig.configManagement ?? { auth: { mechanism: "none", requiredPermissions: [] } }),
      adminTenantId,
      managementAppId: adminAppId
    };
    const result = {
      ok: true,
      adminTenantId,
      adminAppId,
      adminAppUrl: body.adminApp.hostname,
      cpIssuer: input.cpState.issuer,
      routesCreated: defaultRoutes.length,
      cmInstanceId,
      authActivationId,
      themeActivationId,
      authSharedServiceId,
      themeSharedServiceId
    };
    if (input.postgres) await input.postgres.completePendingAction({
      kind: "bootstrap", key: "bootstrap", owner, result
    }, freshConfig);
    else {
      await input.storage.saveConfig(freshConfig);
      if (state) state.consumed = true;
    }
    input.logger.log.info("Bootstrap committed: tenant={tid} app={aid}; admin URL={adminUrl}", {
      tid: adminTenantId, aid: adminAppId, adminUrl: body.adminApp.hostname
    });
    return jsonResponse(result as unknown as never, 200);
  });

}

function hashBootstrapKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function existingBootstrapResult(config: Awaited<ReturnType<PlatformConfigStore["loadConfig"]>>, cpIssuer: string) {
  const adminTenantId = config.configManagement?.adminTenantId ?? "";
  const adminAppId = config.configManagement?.managementAppId ?? "";
  const app = config.apps.find((candidate) => candidate.id === adminAppId);
  const tenant = config.tenants.find((candidate) => candidate.id === adminTenantId);
  const activation = (sharedServiceId: string) => config.sharedServiceActivations.find((candidate) =>
    candidate.tenantId === adminTenantId && candidate.sharedServiceId === sharedServiceId
  )?.id ?? "";
  return {
    ok: true,
    adminTenantId,
    adminAppId,
    adminAppUrl: app?.hostnames[0] ?? "",
    cpIssuer,
    routesCreated: app?.routes.length ?? 0,
    cmInstanceId: tenant?.services.find((service) => service.serviceId === "org.betterportal.config-manager")?.id ?? "",
    authActivationId: activation("org.betterportal.auth.default"),
    themeActivationId: activation("org.betterportal.theme.bootstrap1"),
    authSharedServiceId: "org.betterportal.auth.default",
    themeSharedServiceId: "org.betterportal.theme.bootstrap1"
  };
}
