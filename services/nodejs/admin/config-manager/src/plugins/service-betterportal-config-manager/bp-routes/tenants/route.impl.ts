import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  uuidv7,
  type DemoScenario,
  type ApiAuthRequirement,
  type BetterPortalRouteMount,
  type CacheHints,
  type RouteHandlerContext
} from "@betterportal/framework";
import type { AppAuthConfig, BetterPortalApp, BetterPortalConfig, BetterPortalThemeConfig } from "@betterportal/framework";
import { getConfigManagerRouteContext } from "../../routeContext.js";
import { getManifestCache } from "../../syncApi.js";
import { apiRoutePath } from "../../routeMounts.js";

const TenantItemSchema = av.object({
  id: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  active: av.bool(),
  serviceCount: av.int().min(0)
}, { unknownKeys: "strip" });

const AppItemSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  hostnames: av.array(av.string()),
  shellServiceId: av.optional(av.string().minLength(1)),
  authServiceId: av.optional(av.string().minLength(1)),
  routeCount: av.int().min(0)
}, { unknownKeys: "strip" });

const ShellServiceSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1),
  serviceId: av.optional(av.string())
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  tenants: av.array(TenantItemSchema),
  apps: av.array(AppItemSchema),
  shellServices: av.array(ShellServiceSchema).default([]),
  authServices: av.array(ShellServiceSchema).default([]),
  adminApiBase: av.string().minLength(1),
  tenantsPath: av.string().minLength(1),
  serviceBaseUrl: av.optional(av.string())
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Tenants & Apps";
export const description = "Manage tenants and applications.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "tenants.index", permissions: ["read","create","update","delete"] }
  ]
};

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
  const config = await routeContext.storage.loadConfig();
  return {
    title: "Tenants & Apps",
    tenants: config.tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      active: t.active,
      serviceCount: t.services.length + config.sharedServiceActivations.filter((activation) => activation.enabled && activation.tenantId === t.id).length
    })),
    apps: config.apps.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      slug: a.slug,
      title: a.title,
      hostnames: a.hostnames,
      shellServiceId: a.shell?.serviceId,
      authServiceId: a.auth?.serviceId,
      routeCount: a.routes.length
    })),
    shellServices: config.tenants.flatMap((tenant) => themeShellServicesForTenant(config, tenant.id)),
    authServices: config.tenants.flatMap((tenant) => authServicesForTenant(config, tenant.id)),
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
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  if (!tenant) return;

  const shellServiceId = stringValue(body.shellServiceId);
  if (shellServiceId && !isThemeShellServiceForTenant(config, tenantId, shellServiceId)) return;
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
    routes: [],
    menu: [],
    slots: [],
    fragments: {}
  };
  if (authServiceId) {
    app.auth = buildAppAuthConfig(config, tenantId, authServiceId);
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
  const appDef = config.apps.find((app) => app.id === id);
  if (!appDef) return;

  const title = stringValue(body.title);
  const slug = stringValue(body.slug);
  if (title) appDef.title = title;
  if (slug) appDef.slug = slug;
  if (body.hostnames !== undefined || body.hostname !== undefined) {
    appDef.hostnames = hostnamesFromBody(body);
  }

  const shellServiceId = stringValue(body.shellServiceId);
  if (shellServiceId) {
    if (isThemeShellServiceForTenant(config, appDef.tenantId, shellServiceId)) {
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
        ...buildAppAuthConfig(config, appDef.tenantId, authServiceId, appDef.auth),
        roles: existingRoles
      };
      ensureAuthRouteMounts(config, appDef);
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
  config.apps = config.apps.filter((app) => app.id !== id);
  await routeContext.storage.saveConfig(config);
}

function themeShellServicesForTenant(config: BetterPortalConfig, tenantId: string): Array<{
  id: string;
  tenantId: string;
  title: string;
  serviceId?: string;
}> {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  const tenantServices = (tenant?.services ?? [])
    .filter((service) => service.enabled && service.capabilities?.includes("theme"))
    .map((service) => ({
      id: service.id,
      tenantId,
      title: service.title ?? service.serviceId ?? service.hostname,
      serviceId: service.serviceId
    }));

  const sharedServices = config.sharedServiceActivations
    .filter((activation) => activation.enabled && activation.tenantId === tenantId)
    .map((activation) => {
      const shared = config.sharedServiceCatalog.find((service) =>
        service.enabled
        && service.id === activation.sharedServiceId
        && service.tags.includes("theme")
      );
      if (!shared) return undefined;
      return {
        id: activation.id,
        tenantId,
        title: shared.title,
        serviceId: shared.serviceId ?? shared.id
      };
    })
    .filter((service): service is NonNullable<typeof service> => !!service);

  return [...tenantServices, ...sharedServices];
}

function isThemeShellServiceForTenant(config: BetterPortalConfig, tenantId: string, shellServiceId: string): boolean {
  return themeShellServicesForTenant(config, tenantId).some((service) => service.id === shellServiceId);
}

function authServicesForTenant(config: BetterPortalConfig, tenantId: string): Array<{
  id: string;
  tenantId: string;
  title: string;
  serviceId?: string;
  hostname: string;
}> {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  const tenantServices = (tenant?.services ?? [])
    .filter((service) => service.enabled && service.capabilities?.includes("auth"))
    .map((service) => ({
      id: service.id,
      tenantId,
      title: service.title ?? service.serviceId ?? service.hostname,
      serviceId: service.serviceId,
      hostname: service.hostname
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
        hostname: shared.baseUrl
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
  existing?: AppAuthConfig
): AppAuthConfig {
  const authService = authServicesForTenant(config, tenantId).find((service) => service.id === authServiceId);
  const publicKeys = existing?.publicKeys ?? findKnownAuthPublicKeys(config, authServiceId);
  const providerKind = authService?.serviceId === "service.betterportal.auth.authress-io"
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
    loginViewId: existing?.loginViewId ?? "/login",
    logoutViewId: existing?.logoutViewId ?? "/logout",
    refreshViewId: existing?.refreshViewId ?? "/refresh",
    provider: existing?.provider ?? (
      providerKind === "authress.io"
        ? { kind: "authress.io", roleClaimPath: "roles", subjectClaimPath: "sub" }
        : { kind: "betterportal.default" }
    ),
    expectedIssuer: expectedIssuer ?? issuerFromAuthService(authService?.hostname),
    expectedAudience: expectedAudience ?? "betterportal-runtime",
    jwksUri: existing?.jwksUri ?? `${(authService?.hostname ?? "").replace(/\/+$/, "")}/.well-known/jwks.json`,
    ...(publicKeys ? { publicKeys } : {}),
    roles: existing?.roles ?? []
  };
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

function numberedPath(basePath: string, usedPaths: Set<string>): string {
  const normalized = basePath.startsWith("/") ? basePath : `/${basePath}`;
  if (!usedPaths.has(normalized)) return normalized;
  let i = 2;
  while (usedPaths.has(`${normalized}-${i}`)) i += 1;
  return `${normalized}-${i}`;
}

function ensureAuthRouteMounts(config: BetterPortalConfig, appDef: BetterPortalApp): void {
  const authServiceId = appDef.auth?.serviceId;
  if (!authServiceId) return;
  const manifest = getManifestCache().get(authServiceId);
  if (!manifest) return;

  const desiredViewIds = ["login.index", "logout.index", "refresh.index", "register.index"];
  const usedPaths = new Set(appDef.routes.map((route) => route.path));
  for (const viewId of desiredViewIds) {
    const view = manifest.viewIndex[viewId];
    if (!view) continue;
    if (appDef.routes.some((route) => route.serviceId === authServiceId && route.viewId === viewId)) continue;

    const renderable = view.renderable !== false;
    const path = renderable ? numberedPath(view.path, usedPaths) : apiRoutePath(manifest.serviceId, view.path);
    const methods = view.methods.filter((method): method is BetterPortalRouteMount["methods"][number] =>
      method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" || method === "OPTIONS"
    );
    usedPaths.add(path);
    appDef.routes.push({
      id: uuidv7(),
      kind: renderable ? "page" : "api",
      path,
      serviceId: authServiceId,
      viewId,
      targetPath: view.path,
      title: viewId.replace(".index", "").replace(/^\w/, (char) => char.toUpperCase()),
      enabled: true,
      methods: methods.length ? methods : ["GET"]
    });
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === "on";
}
