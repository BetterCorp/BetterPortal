import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  uuidv7,
  type DemoScenario,
  type BetterPortalRouteMount,
  type CacheHints,
  type RouteHandlerContext
} from "@betterportal/framework";
import type { AppAuthConfig, AuthProviderRuntimeMetadata, AuthRoleAuthority, BetterPortalApp, BetterPortalConfig, BetterPortalThemeConfig } from "@betterportal/framework";
import { getConfigManagerRouteContext } from "./routeContext.js";
import { getCachedManifestForService } from "./syncApi.js";
import { apiRoutePath, pageRoutePath } from "./routeMounts.js";
import { resolveRoleAuthority, supportedRoleAuthorities } from "./roleAuthority.js";
import { isPreviewApp, isPreviewTenant, visibleAdminConfig } from "./previewEnvironments.js";

const RoleAuthoritySchema = av.enum_(["provider", "betterportal"] as const);

const TenantItemSchema = av.object({
  id: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  active: av.bool(),
  serviceCount: av.int().min(0)
});

const AppItemSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  hostnames: av.array(av.string()),
  shellServiceId: av.optional(av.string().minLength(1)),
  shellService: av.optional(av.string().minLength(1)),
  shellRenderer: av.optional(av.string().minLength(1)),
  authServiceId: av.optional(av.string().minLength(1)),
  roleAuthority: av.optional(RoleAuthoritySchema),
  authRedirects: av.optional(av.object({
    afterLogin: av.optional(av.object({
      serviceId: av.string().minLength(1),
      viewId: av.string().minLength(1)
    })),
    afterLogout: av.optional(av.object({
      serviceId: av.string().minLength(1),
      viewId: av.string().minLength(1)
    }))
  })),
  seo: av.object({
    visibility: av.enum_(["auto", "public", "private"] as const),
    serviceFailure: av.enum_(["known-routes", "omit-service", "error"] as const),
    serviceCache: av.enum_(["none", "1h", "24h", "7d"] as const),
    canonicalOrigin: av.optional(av.string())
  }),
  pageViews: av.array(av.object({
    serviceId: av.string().minLength(1),
    serviceTitle: av.string().minLength(1),
    viewId: av.string().minLength(1),
    title: av.string().minLength(1),
    path: av.string().minLength(1)
  })).default([]),
  routeCount: av.int().min(0)
});

const ShellServiceSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1),
  serviceId: av.optional(av.string()),
  service: av.string().minLength(1),
  renderer: av.string().minLength(1)
});

const AuthServiceSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1),
  serviceId: av.optional(av.string()),
  roleAuthorities: av.array(RoleAuthoritySchema).default(["betterportal"])
});

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  tenants: av.array(TenantItemSchema),
  apps: av.array(AppItemSchema),
  shellServices: av.array(ShellServiceSchema).default([]),
  authServices: av.array(AuthServiceSchema).default([]),
  adminApiBase: av.string().minLength(1),
  tenantsPath: av.string().minLength(1),
  serviceBaseUrl: av.optional(av.string())
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Tenants & Apps";
export const description = "Manage tenants and applications.";

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Tenants & Apps", tenants: [], apps: [], shellServices: [], authServices: [], adminApiBase: "/.well-known/bp/admin", tenantsPath: "/tenants" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => buildResponseModel(tenantsPathFromContext(ctx))
);

export const handlePost = createHandler(
  { response: ResponseSchema },
  async (ctx) => {
    const body = ctx.request;
    if (stringValue(body.entity) === "app") {
      await createApp(body);
    } else {
      await createTenant(body);
    }
    return buildResponseModel(tenantsPathFromContext(ctx));
  }
);

export const handlePut = createHandler(
  { response: ResponseSchema },
  async (ctx) => {
    const body = ctx.request;
    if (stringValue(body.entity) === "app") {
      await updateApp(body);
    } else {
      await updateTenant(body);
    }
    return buildResponseModel(tenantsPathFromContext(ctx));
  }
);

export const handleDelete = createHandler(
  { response: ResponseSchema },
  async (ctx) => {
    const entity = stringValue(ctx.query.entity);
    const id = stringValue(ctx.query.id);
    if (entity === "app") {
      await deleteApp(id);
    } else {
      await deleteTenant(id);
    }
    return buildResponseModel(tenantsPathFromContext(ctx));
  }
);

function tenantsPathFromContext(ctx: Pick<RouteHandlerContext, "routeUrl">): string {
  return ctx.routeUrl?.("tenants.index", { absolute: true })
    ?? ctx.routeUrl?.("tenants.index")
    ?? "/tenants";
}

async function buildResponseModel(tenantsPath = "/tenants"): Promise<ResponseData> {
  const routeContext = getConfigManagerRouteContext();
  const config = visibleAdminConfig(await routeContext.storage.loadConfig());
  const authServices = config.tenants.flatMap((tenant) => authServicesForTenant(config, tenant.id));
  return {
    title: "Tenants & Apps",
    tenants: config.tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      active: t.active,
      serviceCount: t.services.length + config.sharedServiceActivations.filter((activation) => activation.enabled && activation.tenantId === t.id).length
    })),
    apps: config.apps.map((a) => {
      const shell = a.shell ? getCachedManifestForService(config, a.shell.serviceId)?.shell : undefined;
      return {
      id: a.id,
      tenantId: a.tenantId,
      slug: a.slug,
      title: a.title,
      hostnames: a.hostnames,
      shellServiceId: a.shell?.serviceId,
      shellService: shell?.service,
      shellRenderer: shell?.renderer,
      authServiceId: a.auth?.serviceId,
      authRedirects: a.auth?.redirects,
      seo: {
        visibility: a.seo?.visibility ?? "auto",
        serviceFailure: a.seo?.serviceFailure ?? "omit-service",
        serviceCache: a.seo?.serviceCache ?? "24h",
        canonicalOrigin: a.seo?.canonicalOrigin
      },
      pageViews: selectableAppPageViews(config, a),
      roleAuthority: a.auth
        ? resolveRoleAuthority(
            authServices.find((service) => service.id === a.auth?.serviceId)?.capabilities ?? [],
            a.auth.roleAuthority
          )
        : undefined,
      routeCount: a.routes.length
      };
    }),
    shellServices: config.tenants.flatMap((tenant) => shellServicesForTenant(config, tenant.id)),
    authServices,
    adminApiBase: "/.well-known/bp/admin",
    tenantsPath,
    serviceBaseUrl: routeContext.serviceBaseUrl
  };
}

async function createTenant(body: Record<string, unknown>): Promise<void> {
  const title = stringValue(body.title);
  if (!title) return;

  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  const id = uuidv7();
  config.tenants.push({
    id,
    slug: stringValue(body.slug) || id,
    title,
    active: true,
    branding: {},
    services: [],
    activatedPlatformServices: []
  });
  await routeContext.storage.saveConfig(config);
}

async function updateTenant(body: Record<string, unknown>): Promise<void> {
  const id = stringValue(body.tenantId);
  if (!id) return;

  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  if (isPreviewTenant(config, id)) return;
  const tenant = config.tenants.find((t) => t.id === id);
  if (!tenant) return;

  const title = stringValue(body.title);
  const slug = stringValue(body.slug);
  if (title) tenant.title = title;
  if (slug) tenant.slug = slug;
  tenant.active = boolValue(body.active);

  await routeContext.storage.saveConfig(config);
}

async function deleteTenant(id: string): Promise<void> {
  if (!id) return;
  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  if (isPreviewTenant(config, id)) return;
  config.tenants = config.tenants.filter((tenant) => tenant.id !== id);
  config.apps = config.apps.filter((app) => app.tenantId !== id);
  await routeContext.storage.saveConfig(config);
}

async function createApp(body: Record<string, unknown>): Promise<void> {
  const tenantId = stringValue(body.tenantId);
  const title = stringValue(body.title);
  if (!tenantId || !title) return;

  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  if (isPreviewTenant(config, tenantId)) return;
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  if (!tenant) return;

  const shellServiceId = stringValue(body.shellServiceId);
  if (shellServiceId && !isShellServiceForTenant(config, tenantId, shellServiceId)) return;
  const authServiceId = stringValue(body.authServiceId);
  if (authServiceId && !isAuthServiceForTenant(config, tenantId, authServiceId)) return;

  const id = uuidv7();
  const app: BetterPortalApp = {
    id,
    tenantId,
    slug: stringValue(body.slug) || id,
    title,
    hostnames: hostnamesFromBody(body),
    originOverrides: [],
    refererOverrides: [],
    ...(shellServiceId ? { shell: { serviceId: shellServiceId } } : {}),
    themeConfig: (body.themeConfig as BetterPortalThemeConfig | undefined) ?? { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: stringValue(body.defaultRoute) || "/",
    seo: seoConfigFromBody(body),
    routes: [],
    menu: [],
    slots: [],
    fragments: {},
    shellFragments: {}
  };
  if (authServiceId) {
    app.auth = buildAppAuthConfig(config, tenantId, authServiceId, undefined, roleAuthorityValue(body.roleAuthority));
    ensureAuthRouteMounts(config, app);
  }
  config.apps.push(app);
  await routeContext.storage.saveConfig(config);
}

async function updateApp(body: Record<string, unknown>): Promise<void> {
  const id = stringValue(body.appId);
  if (!id) return;

  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  if (isPreviewApp(config, id)) return;
  const appDef = config.apps.find((app) => app.id === id);
  if (!appDef) return;

  const title = stringValue(body.title);
  const slug = stringValue(body.slug);
  if (title) appDef.title = title;
  if (slug) appDef.slug = slug;
  if (body.hostnames !== undefined || body.hostname !== undefined) {
    appDef.hostnames = hostnamesFromBody(body);
  }
  if (["seoVisibility", "seoServiceFailure", "seoServiceCache", "seoCanonicalOrigin"]
    .some((key) => body[key] !== undefined)) {
    appDef.seo = seoConfigFromBody(body);
  }

  const shellServiceId = stringValue(body.shellServiceId);
  if (shellServiceId) {
    if (isShellServiceForTenant(config, appDef.tenantId, shellServiceId)) {
      appDef.shell = { serviceId: shellServiceId };
    }
  } else {
    delete appDef.shell;
  }

  const authServiceId = stringValue(body.authServiceId);
  if (authServiceId) {
    if (isAuthServiceForTenant(config, appDef.tenantId, authServiceId)) {
      const existingRoles = appDef.auth?.roles ?? [];
      appDef.auth = {
        ...buildAppAuthConfig(config, appDef.tenantId, authServiceId, appDef.auth, roleAuthorityValue(body.roleAuthority)),
        roles: existingRoles
      };
      ensureAuthRouteMounts(config, appDef);
      updateAuthRedirects(appDef, body);
    }
  } else {
    delete appDef.auth;
  }

  await routeContext.storage.saveConfig(config);
}

async function deleteApp(id: string): Promise<void> {
  if (!id) return;
  const routeContext = getConfigManagerRouteContext();
  const config = await routeContext.storage.loadConfig();
  if (isPreviewApp(config, id)) return;
  config.apps = config.apps.filter((app) => app.id !== id);
  await routeContext.storage.saveConfig(config);
}

function shellServicesForTenant(config: BetterPortalConfig, tenantId: string): Array<{
  id: string;
  tenantId: string;
  title: string;
  serviceId?: string;
  service: string;
  renderer: string;
}> {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  const tenantServices = (tenant?.services ?? [])
    .filter((service) => service.enabled)
    .flatMap((service) => {
      const shell = getCachedManifestForService(config, service.id)?.shell;
      return shell ? [{
        id: service.id,
        tenantId,
        title: service.title ?? service.serviceId ?? service.hostname,
        serviceId: service.serviceId,
        service: shell.service,
        renderer: shell.renderer
      }] : [];
    });

  const sharedServices = config.sharedServiceActivations
    .filter((activation) => activation.enabled && activation.tenantId === tenantId)
    .map((activation) => {
      const shared = config.sharedServiceCatalog.find((service) => service.enabled && service.id === activation.sharedServiceId);
      if (!shared) return undefined;
      const shell = getCachedManifestForService(config, activation.id)?.shell;
      if (!shell) return undefined;
      return {
        id: activation.id,
        tenantId,
        title: shared.title,
        serviceId: shared.serviceId ?? shared.id,
        service: shell.service,
        renderer: shell.renderer
      };
    })
    .filter((service): service is NonNullable<typeof service> => !!service);

  return [...tenantServices, ...sharedServices];
}

function isShellServiceForTenant(config: BetterPortalConfig, tenantId: string, shellServiceId: string): boolean {
  return shellServicesForTenant(config, tenantId).some((service) => service.id === shellServiceId);
}

function authServicesForTenant(config: BetterPortalConfig, tenantId: string): Array<{
  id: string;
  tenantId: string;
  title: string;
  serviceId?: string;
  authProvider?: AuthProviderRuntimeMetadata;
  hostname: string;
  capabilities: string[];
  roleAuthorities: AuthRoleAuthority[];
}> {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  const tenantServices = (tenant?.services ?? [])
    .filter((service) => service.enabled && service.capabilities?.includes("auth"))
    .map((service) => ({
      id: service.id,
      tenantId,
      title: service.title ?? service.serviceId ?? service.hostname,
      serviceId: service.serviceId,
      authProvider: service.authProvider,
      hostname: service.hostname,
      capabilities: service.capabilities ?? [],
      roleAuthorities: supportedRoleAuthorities(service.capabilities ?? [])
    }));

  const sharedServices = config.sharedServiceActivations
    .filter((activation) => activation.enabled && activation.tenantId === tenantId)
    .map((activation) => {
      const shared = config.sharedServiceCatalog.find((service) =>
        service.enabled
        && service.id === activation.sharedServiceId
        && service.tags.includes("auth")
      );
      if (!shared) return undefined;
      return {
        id: activation.id,
        tenantId,
        title: shared.title,
        serviceId: shared.serviceId ?? shared.id,
        authProvider: shared.authProvider,
        hostname: shared.baseUrl,
        capabilities: shared.tags,
        roleAuthorities: supportedRoleAuthorities(shared.tags)
      };
    })
    .filter((service): service is NonNullable<typeof service> => !!service);

  return [...tenantServices, ...sharedServices];
}

function isAuthServiceForTenant(config: BetterPortalConfig, tenantId: string, authServiceId: string): boolean {
  return authServicesForTenant(config, tenantId).some((service) => service.id === authServiceId);
}

function buildAppAuthConfig(
  config: BetterPortalConfig,
  tenantId: string,
  authServiceId: string,
  existing?: AppAuthConfig,
  requestedRoleAuthority?: AuthRoleAuthority
): AppAuthConfig {
  const authService = authServicesForTenant(config, tenantId).find((service) => service.id === authServiceId);
  const publicKeys = authService?.authProvider?.publicKeys ?? existing?.publicKeys ?? findKnownAuthPublicKeys(config, authServiceId);
  const providerKind = authService?.serviceId === "org.betterportal.auth.authress-io"
    ? "authress.io" as const
    : "betterportal.default" as const;
  const expectedIssuer = providerKind === "authress.io" && existing?.expectedIssuer === "https://authress.io"
    ? undefined
    : existing?.expectedIssuer;
  const expectedAudience = providerKind === "authress.io" && existing?.expectedAudience === "authress"
    ? undefined
    : existing?.expectedAudience;
  return {
    serviceId: authServiceId,
    roleAuthority: resolveRoleAuthority(
      authService?.capabilities ?? [],
      requestedRoleAuthority ?? (existing?.serviceId === authServiceId ? existing.roleAuthority : undefined)
    ),
    loginViewId: existing?.loginViewId ?? "login.index",
    logoutViewId: existing?.logoutViewId ?? "logout.index",
    refreshViewId: existing?.refreshViewId ?? "refresh.index",
    ...(existing?.redirects ? { redirects: existing.redirects } : {}),
    provider: existing?.serviceId === authServiceId ? existing.provider : (
      providerKind === "authress.io"
        ? { kind: "authress.io", roleClaimPath: "roles", subjectClaimPath: "sub" }
        : { kind: "betterportal.default" }
    ),
    expectedIssuer: authService?.authProvider?.issuer ?? expectedIssuer ?? issuerFromAuthService(authService?.hostname),
    expectedAudience: authService?.authProvider?.audience ?? expectedAudience ?? "betterportal-runtime",
    jwksUri: authService?.authProvider?.jwksUri ?? existing?.jwksUri ?? `${(authService?.hostname ?? "").replace(/\/+$/, "")}/.well-known/jwks.json`,
    ...(publicKeys ? { publicKeys } : {}),
    roles: existing?.roles ?? []
  };
}

function selectableAppPageViews(config: BetterPortalConfig, app: BetterPortalApp): Array<{
  serviceId: string;
  serviceTitle: string;
  viewId: string;
  title: string;
  path: string;
}> {
  return uniqueEnabledPageViews(app)
    .map((route) => ({
      serviceId: route.serviceId,
      serviceTitle: serviceTitle(config, app.tenantId, route.serviceId),
      viewId: route.viewId,
      title: route.title?.trim() || route.viewId,
      path: route.path
    }));
}

function isEnabledPageView(route: BetterPortalRouteMount): boolean {
  return route.enabled && (route.kind ?? "page") === "page";
}

function uniqueEnabledPageViews(app: BetterPortalApp): BetterPortalRouteMount[] {
  const groups = new Map<string, BetterPortalRouteMount[]>();
  for (const route of app.routes.filter(isEnabledPageView)) {
    const key = `${route.serviceId}\0${route.viewId}`;
    const routes = groups.get(key) ?? [];
    routes.push(route);
    groups.set(key, routes);
  }
  return [...groups.values()].flatMap((routes) =>
    new Set(routes.map((route) => route.path)).size === 1 ? [routes[0]!] : []
  );
}

function serviceTitle(config: BetterPortalConfig, tenantId: string, serviceId: string): string {
  const tenantService = config.tenants
    .find((tenant) => tenant.id === tenantId)
    ?.services.find((service) => service.id === serviceId);
  if (tenantService) return tenantService.title?.trim() || tenantService.serviceId || serviceId;

  const platformService = config.platformServices.find((service) => service.id === serviceId);
  if (platformService) return platformService.title?.trim() || platformService.serviceId || serviceId;

  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId);
  const shared = activation
    ? config.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId)
    : undefined;
  return shared?.title ?? shared?.serviceId ?? serviceId;
}

function updateAuthRedirects(app: BetterPortalApp, body: Record<string, unknown>): void {
  if (!app.auth) return;
  const redirects = { ...app.auth.redirects };
  for (const [kind, prefix] of [["afterLogin", "afterLogin"], ["afterLogout", "afterLogout"]] as const) {
    if (body[`${prefix}ServiceId`] === undefined || body[`${prefix}ViewId`] === undefined) continue;
    const serviceId = stringValue(body[`${prefix}ServiceId`]);
    const viewId = stringValue(body[`${prefix}ViewId`]);
    const paths = new Set(serviceId && viewId
      ? app.routes
        .filter((route) => isEnabledPageView(route) && route.serviceId === serviceId && route.viewId === viewId)
        .map((route) => route.path)
      : []);
    const existing = redirects[kind];
    const preservesStaleTarget = existing?.serviceId === serviceId && existing.viewId === viewId;
    if (serviceId && viewId && (paths.size === 1 || preservesStaleTarget)) {
      redirects[kind] = { serviceId, viewId };
    } else {
      delete redirects[kind];
    }
  }
  app.auth.redirects = Object.keys(redirects).length ? redirects : undefined;
}

function issuerFromAuthService(hostname: string | undefined): string {
  const normalized = (hostname ?? "").replace(/\/+$/, "");
  if (!normalized) return "";
  try {
    return new URL(normalized).origin;
  } catch {
    return normalized;
  }
}

function ensureAuthRouteMounts(config: BetterPortalConfig, appDef: BetterPortalApp): void {
  const authServiceId = appDef.auth?.serviceId;
  if (!authServiceId) return;
  const manifest = getCachedManifestForService(config, authServiceId);
  if (!manifest) return;

  const desiredRoles = new Set(["auth.login", "auth.logout", "auth.refresh", "auth.register"]);
  for (const view of Object.values(manifest.viewIndex)) {
    for (const operation of view.operations.filter((candidate) => candidate.role && desiredRoles.has(candidate.role))) {
      if (appDef.routes.some((route) => route.serviceId === authServiceId && route.operations.includes(operation.operationId))) continue;
      const page = operation.method === "GET" && operation.renderModes.includes("page");
      const path = page ? pageRoutePath(manifest.serviceId, view.path) : apiRoutePath(manifest.serviceId, view.path);
      appDef.routes.push({
        id: uuidv7(),
        kind: page ? "page" : "api",
        path,
        serviceId: authServiceId,
        viewId: view.viewId,
        targetPath: view.path,
        title: operation.title,
        enabled: true,
        operations: [operation.operationId]
      });
    }
  }
}

function findKnownAuthPublicKeys(config: BetterPortalConfig, authServiceId: string): AppAuthConfig["publicKeys"] | undefined {
  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === authServiceId);
  const sharedServiceId = activation?.sharedServiceId;
  for (const app of config.apps) {
    const auth = app.auth;
    if (!auth?.publicKeys) continue;
    if (auth.serviceId === authServiceId) return auth.publicKeys;
    if (sharedServiceId) {
      const appActivation = config.sharedServiceActivations.find((candidate) => candidate.id === auth.serviceId);
      if (appActivation?.sharedServiceId === sharedServiceId) return auth.publicKeys;
    }
  }
  return undefined;
}

function hostnamesFromBody(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.hostnames)) {
    return body.hostnames.filter((value): value is string => typeof value === "string" && value.length > 0);
  }
  const raw = stringValue(body.hostnames) || stringValue(body.hostname);
  return raw.split(",").map((hostname) => hostname.trim()).filter(Boolean);
}

function seoConfigFromBody(body: Record<string, unknown>): NonNullable<BetterPortalApp["seo"]> {
  const visibility = body.seoVisibility === "public" || body.seoVisibility === "private"
    ? body.seoVisibility
    : "auto";
  const serviceFailure = body.seoServiceFailure === "known-routes" || body.seoServiceFailure === "error"
    ? body.seoServiceFailure
    : "omit-service";
  const serviceCache = body.seoServiceCache === "none" || body.seoServiceCache === "1h" || body.seoServiceCache === "7d"
    ? body.seoServiceCache
    : "24h";
  const canonicalOrigin = stringValue(body.seoCanonicalOrigin);
  if (canonicalOrigin) {
    const url = new URL(canonicalOrigin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== canonicalOrigin.replace(/\/+$/, "")) {
      throw new TypeError("Canonical origin must be an http(s) origin without a path.");
    }
  }
  return {
    visibility,
    serviceFailure,
    serviceCache,
    ...(canonicalOrigin ? { canonicalOrigin: canonicalOrigin.replace(/\/+$/, "") } : {})
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === "on";
}

function roleAuthorityValue(value: unknown): AuthRoleAuthority | undefined {
  return value === "provider" || value === "betterportal" ? value : undefined;
}
