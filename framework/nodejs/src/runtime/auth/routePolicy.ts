import type { ScopedApp } from "../../contracts/controlPlane.js";
import type { ThemeAuthContext } from "./menu.js";
import type { RegisteredRoute } from "../../contracts/registry.js";
import { routeMountServicePath } from "../configProvider.js";
import type { ApiAuthRequirement } from "../../contracts/route.js";
import type { AppAuthConfig, AppAuthPermissionAction, JwtClaims } from "../../contracts/auth.js";
import type { HttpMethod } from "../../contracts/common.js";
import type { BetterPortalApp, BetterPortalRouteMount } from "../../contracts/platformConfig.js";

/** Baseline action of an HTTP operation. CORS preflight is handled before authorization. */
export function routePermissionAction(method: HttpMethod): AppAuthPermissionAction {
  switch (method) {
    case "POST": return "create";
    case "PUT": case "PATCH": return "update";
    case "DELETE": return "delete";
    default: return "read";
  }
}

/** Preserve authored additional requirements and add the protected operation's own grant. */
export function effectiveRouteAuth(auth: ApiAuthRequirement, serviceId: string, viewId: string, method: HttpMethod): ApiAuthRequirement {
  const required = auth.required || Boolean(auth.elevation);
  return { ...auth, required, permissions: [
    ...(required ? [{ serviceId, viewId, permissions: [routePermissionAction(method)] }] : []),
    ...(auth.permissions ?? [])
  ] };
}

/** Evaluate verified user claims against current app grants, including the scoped management root. */
export function hasRoutePermissions(
  claims: JwtClaims, auth: ApiAuthRequirement, appAuth: AppAuthConfig | undefined,
  aliases: Readonly<Record<string, string>> = {}, root?: { tenantId?: string; appId?: string }
): boolean {
  if (claims.roles.includes("*") && root?.tenantId === claims.tenantId && root?.appId === claims.appId) return true;
  const grants = (appAuth?.roles ?? []).filter(role => claims.roles.includes(role.id)).flatMap(role => role.permissions);
  const matches = (granted: string, requested: string) => granted === requested
    || aliases[granted] === requested || aliases[requested] === granted;
  return auth.permissions.every(item => item.permissions.every(action => grants.some(grant =>
    matches(grant.serviceId, item.serviceId) && grant.viewId === item.viewId && grant.permissions.includes(action))));
}

export interface NavigationAccess extends ThemeAuthContext {
  readonly user?: JwtClaims;
  canAccess(route: BetterPortalRouteMount, method?: HttpMethod): boolean;
}

/** Build a per-request projection evaluator. Only pass claims verified for this app and tenant. */
export function createNavigationAccess(
  app: BetterPortalApp, user: JwtClaims | undefined, aliases: Readonly<Record<string, string>> = {},
  root?: { tenantId?: string; appId?: string }
): NavigationAccess {
  const scopedUser = user?.tenantId === app.tenantId && user?.appId === app.id ? user : undefined;
  return {
    status: scopedUser ? "authenticated" : "anonymous",
    permissions: (app.auth?.roles ?? []).filter(role => scopedUser?.roles.includes(role.id)).flatMap(role => role.permissions),
    user: scopedUser,
    canAccess(route, method = "GET") {
      if (!route.enabled) return false;
      const operation = route.resolvedAuth?.find(item => item.method === method && route.operations.includes(item.operationId));
      // A route without a synced policy must not be disclosed as public.
      if (!operation || !(operation.auth.callers ?? ["user"]).includes("user")) return false;
      const auth = effectiveRouteAuth(operation.auth, route.serviceId, route.viewId, method);
      if (!auth.required) return true;
      return Boolean(scopedUser && hasRoutePermissions(scopedUser, auth, app.auth, aliases, root));
    }
  };
}

/** Resolve an authored plugin reference only when its concrete installation is unique. */
export function resolvePermissionServiceId(reference: string, aliases: Readonly<Record<string, string>> = {}): string | undefined {
  if (!reference) return undefined;
  if (Object.hasOwn(aliases, reference)) return reference;
  const owners = Object.keys(aliases).filter(id => aliases[id] === reference);
  return owners.length === 1 ? owners[0] : owners.length > 1 ? undefined : reference;
}

/** Resolve authority using the registered operation, matched service path and trusted host identity. */
export function resolveRequestPermissionServiceId(
  app: Pick<ScopedApp, "routes" | "slots" | "fragments"> | undefined, route: RegisteredRoute, requestMethod: string, pathname: string,
  localIds: ReadonlySet<string>, identityId?: string
): string | null {
  const method = requestMethod === "HEAD" ? "GET" : requestMethod;
  const unique = (ids: Set<string>): string | null => identityId
    ? ids.has(identityId) ? identityId : null
    : ids.size === 1 ? [...ids][0] : null;
  if (route.path.startsWith("/.well-known/")) return unique(new Set(localIds));
  if (!app) return null;
  const operation = route.methodRoutes?.[method as HttpMethod]?.operationId;
  const path = route.sse ? pathname.replace(/\/__sse\/?$/, "") : pathname;
  const matches = (pattern: string): boolean => {
    const parts = (value: string) => value.split(/[?#]/, 1)[0].replace(/\/+$/, "").split("/");
    const template = parts(pattern), actual = parts(path);
    if (template.length !== actual.length) return false;
    return template.every((part, index) => {
      if (part.startsWith(":") || /^\{[^}]+\}$/.test(part)) return Boolean(actual[index]);
      try { return decodeURIComponent(part) === decodeURIComponent(actual[index]); } catch { return false; }
    });
  };
  const owners = new Set(app.routes.filter(mount => mount.enabled !== false && localIds.has(mount.serviceId)
    && mount.viewId === route.viewId && (operation && mount.operations.includes(operation)
      || mount.operations.includes(`legacy:${route.viewId}:${method}`))
    && matches(routeMountServicePath(mount) ?? route.path)).map(mount => mount.serviceId));
  if (method === "GET") {
    for (const slot of app.slots ?? []) if (slot.enabled !== false && slot.viewId === route.viewId && localIds.has(slot.serviceId)) owners.add(slot.serviceId);
    for (const fragment of Object.values(app.fragments ?? {}).flat()) {
      if (fragment.enabled !== false && localIds.has(fragment.serviceId) && matches(fragment.targetPath)) owners.add(fragment.serviceId);
    }
  }
  return unique(owners);
}
