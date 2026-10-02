import {
  createStaticJwksVerifier,
  eventHeaders,
  jsonResponse,
  resolveEmbeddedRequestContext,
  type BetterPortalApp,
  type BetterPortalConfig,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type PlatformConfigStore
} from "@betterportal/framework";
import type { CpBootstrapState } from "./cpBootstrap.js";
import { verifyBootstrapAdminToken } from "./bootstrapAccess.js";

const ADMIN = "/.well-known/bp/admin";
const MANAGE = "/.well-known/bp/manage";
const CONFIG_MANAGER_ID = "org.betterportal.config-manager";
type Action = "read" | "create" | "update" | "delete";

function bearer(event: BetterPortalEvent): string | undefined {
  return /^Bearer\s+(\S+)$/i.exec(event.req.headers.get("authorization") ?? "")?.[1];
}

function inTree(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function ownsServiceAuthorization(path: string, method: string): boolean {
  return (method === "PUT" && path === `${ADMIN}/services/self-mutation`)
    || (method === "PUT" && /^\/\.well-known\/bp\/admin\/apps\/[^/]+\/auth\/roles\/sync$/.test(path));
}

function bootstrapRoute(path: string, method: string, appId: string): boolean {
  return method === "POST" && (path === `${ADMIN}/services/begin-install`
    || path === `${ADMIN}/apps/${encodeURIComponent(appId)}/auth/roles`);
}

async function allowedBootstrapRequest(config: BetterPortalConfig, app: BetterPortalApp, path: string, event: BetterPortalEvent): Promise<boolean> {
  const body = await event.req.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (path !== `${ADMIN}/services/begin-install`) return body.id === "admin";
  if (body.tenantId !== app.tenantId || body.appId !== app.id || body.reconfigure === true || body.instanceId !== undefined) return false;
  const sharedServiceId = body.sharedServiceId;
  if (sharedServiceId !== "org.betterportal.auth.default" && sharedServiceId !== "org.betterportal.theme.bootstrap1") return false;
  const service = config.sharedServiceCatalog.find(candidate => candidate.id === sharedServiceId);
  const activation = config.sharedServiceActivations.find(candidate => candidate.tenantId === app.tenantId
    && candidate.sharedServiceId === sharedServiceId && candidate.enabled);
  return !!service && !!activation && service.enabled && !service.apiKeyHash
    && typeof body.serviceUrl === "string"
    && body.serviceUrl.replace(/\/+$/, "") === service.baseUrl.replace(/\/+$/, "");
}

function currentApp(config: BetterPortalConfig, event: BetterPortalEvent): BetterPortalApp | undefined {
  const url = new URL(event.req.url, "http://betterportal.invalid");
  const appId = url.searchParams.get("appId") ?? event.req.headers.get("x-bp-app-id");
  const app = appId
    ? config.apps.find(candidate => candidate.id === appId)
    : resolveEmbeddedRequestContext(config, eventHeaders(event))?.app;
  return app && config.tenants.some(tenant => tenant.id === app.tenantId && tenant.active) ? app : undefined;
}

function permissionForManage(path: string, method: string): { viewId: string; action: Action } | undefined {
  if (path === `${MANAGE}/current`) return undefined;
  const suffix = path.slice(MANAGE.length + 1);
  const resource = suffix.split("/", 1)[0];
  const viewId = resource === "services" || resource === "webhooks" ? "services.index"
    : resource === "routes" ? "routes.index"
      : resource === "fragments" ? "fragments.index"
        : resource === "theme" ? "config.index"
          : undefined;
  if (!viewId) return undefined;
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return undefined;
  const action: Action = method === "GET" ? "read" : method === "DELETE" ? "delete"
    : method === "PUT" || method === "PATCH" || (method === "POST" && (resource === "theme" || suffix === "services/activate"))
      ? "update" : "create";
  return { viewId, action };
}

async function permissionForAdmin(path: string, method: string, event: BetterPortalEvent): Promise<{ viewId: string; action: Action } | undefined> {
  const suffix = path.slice(ADMIN.length + 1);
  const action: Action | undefined = method === "GET" ? "read" : method === "POST" ? "create"
    : method === "PUT" || method === "PATCH" ? "update" : method === "DELETE" ? "delete" : undefined;
  if (!action) return undefined;

  const menuReads = ["menu-editor", "menu-editor/item", "menu-editor/views", "menu-editor/default-target"];
  if (method === "GET" && menuReads.includes(suffix)) return { viewId: "menu.index", action: "read" };
  const menuAction = /^menu-editor\/(save-visibility|save-title|save-link|save-external|add|remove|toggle|toggle-expanded|move-up|move-down|move-in|move-after|move-out)$/.exec(suffix)?.[1];
  if (method === "POST" && menuAction) return { viewId: "menu.index", action: menuAction === "add" ? "create" : menuAction === "remove" ? "delete" : "update" };

  if (method === "GET" && suffix === "fragments-editor") return { viewId: "fragments.index", action: "read" };
  const fragmentAction = /^fragments-editor\/(set-mode|set-override|add|remove|move-up|move-down)$/.exec(suffix)?.[1];
  if (method === "POST" && fragmentAction) return { viewId: "fragments.index", action: fragmentAction === "add" ? "create" : fragmentAction === "remove" ? "delete" : "update" };

  const appResource = /^apps\/[^/]+\/(routes(?:\/[^/]+)?|menu|auth\/roles(?:\/[^/]+)?|m2m\/connections(?:\/[^/]+)?|theme-config\/bootstrap1)$/.exec(suffix)?.[1];
  if (appResource) return { viewId: appResource.startsWith("routes") ? "routes.index"
    : appResource === "menu" ? "menu.index"
      : appResource.startsWith("auth/") ? "auth.index"
        : appResource.startsWith("m2m/") ? "services.index" : "config.index",
    action: appResource === "theme-config/bootstrap1" ? "update" : action };

  if (suffix === "platform-services" || /^shared-services(?:\/[^/]+(?:\/activations(?:\/purge)?)?)?$/.test(suffix)
    || /^tenants\/[^/]+\/(?:services(?:\/[^/]+(?:\/(?:purge|migrate-to-shared(?:\/preview)?))?)?|activate\/[^/]+)$/.test(suffix)) {
    return { viewId: "services.index", action: suffix.endsWith("/purge") ? "delete" : suffix.endsWith("/migrate-to-shared") ? "update" : action };
  }
  if (suffix === "services/begin-install" && method === "POST") return { viewId: "services.index", action: "create" };
  if (suffix === "services/begin-hostname-change" && method === "POST") return { viewId: "services.index", action: "update" };
  if ((suffix === "wizard/step1" || suffix === "configure") && method === "GET"
    || suffix === "wizard/verify" && method === "POST") return { viewId: "services.index", action: "read" };
  if (suffix === "wizard/register" && method === "POST") return { viewId: "services.index", action: "create" };
  if (suffix === "wizard/cleanup-provisional-service" && method === "POST") return { viewId: "services.index", action: "delete" };
  if (suffix === "config-ticket" && method === "POST") {
    const body = await event.req.clone().json().catch(() => null) as { actions?: unknown } | null;
    return { viewId: "services.index", action: Array.isArray(body?.actions) && body.actions.includes("config.write") ? "update" : "read" };
  }
  return undefined;
}

function hasPermission(config: BetterPortalConfig, app: BetterPortalApp, roleIds: string[], viewId: string, action: Action): boolean {
  const ids = new Set([CONFIG_MANAGER_ID]);
  const tenant = config.tenants.find(candidate => candidate.id === app.tenantId);
  for (const service of tenant?.services ?? []) {
    if (service.serviceId === CONFIG_MANAGER_ID) ids.add(service.id);
  }
  for (const activation of config.sharedServiceActivations) {
    if (activation.tenantId !== app.tenantId || !activation.enabled) continue;
    const shared = config.sharedServiceCatalog.find(service => service.id === activation.sharedServiceId);
    if (shared?.serviceId === CONFIG_MANAGER_ID) ids.add(activation.id);
  }
  return (app.auth?.roles ?? []).some(role => roleIds.includes(role.id)
    && role.permissions.some(grant => ids.has(grant.serviceId) && grant.viewId === viewId && grant.permissions.includes(action)));
}

/** Raw H3 routes do not pass through the framework's registered-route authorization. */
export function registerRawManagementAccessControl(app: BetterPortalH3App, store: PlatformConfigStore, cpState: CpBootstrapState): void {
  app.use("/.well-known/bp/**", async (event) => {
    const path = event.url.pathname;
    const method = event.req.method;
    const admin = inTree(path, ADMIN);
    const manage = inTree(path, MANAGE);
    if (!admin && !manage) return;
    if (method === "OPTIONS") return;
    if (admin && ownsServiceAuthorization(path, method)) return;

    event.res.headers.set("Cache-Control", "no-store");
    const token = bearer(event);
    if (!token) return jsonResponse({ error: "Management authorization required" }, 401);
    const config = await store.loadConfig();
    const target = admin
      ? config.apps.find(candidate => candidate.id === config.configManagement.managementAppId
        && candidate.tenantId === config.configManagement.adminTenantId)
      : currentApp(config, event);
    if (!target) return jsonResponse({ error: "Management app unavailable" }, 503);

    if (admin && bootstrapRoute(path, method, target.id)) {
      try {
        const scope = await verifyBootstrapAdminToken(cpState, token);
        if (scope.tenantId === target.tenantId && scope.appId === target.id) {
          return await allowedBootstrapRequest(config, target, path, event)
            ? undefined : jsonResponse({ error: "Bootstrap operation is outside its setup scope" }, 403);
        }
      } catch { /* A normal management user token may still authorize this request. */ }
    }

    const auth = target.auth;
    if (!auth?.publicKeys?.keys.length) return jsonResponse({ error: "Management authentication unavailable" }, 503);
    let claims;
    try {
      claims = await createStaticJwksVerifier({
        jwks: auth.publicKeys,
        expectedIssuer: auth.expectedIssuer,
        expectedAudience: auth.expectedAudience,
        expectedTokenType: "access"
      }).verify(token, { tenantId: target.tenantId, appId: target.id });
    } catch {
      return jsonResponse({ error: "Invalid management token" }, 401);
    }
    if (claims.tenantId !== target.tenantId || claims.appId !== target.id || claims.tokenType !== "access") {
      return jsonResponse({ error: "Management token scope mismatch" }, 401);
    }
    const root = target.id === config.configManagement.managementAppId
      && target.tenantId === config.configManagement.adminTenantId && claims.roles.includes("*");
    if (admin) {
      if (root) return;
      const policy = await permissionForAdmin(path, method, event);
      return policy && hasPermission(config, target, claims.roles, policy.viewId, policy.action)
        ? undefined : jsonResponse({ error: "Platform management permission required" }, 403);
    }
    if (root) return;
    if (path === `${MANAGE}/current`) return;
    const policy = permissionForManage(path, method);
    if (!policy || !hasPermission(config, target, claims.roles, policy.viewId, policy.action)) {
      return jsonResponse({ error: "Management permission required" }, 403);
    }
  });
}
