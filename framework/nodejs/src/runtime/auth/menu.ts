import type { AppAuthConfig, JwtClaims } from "../../contracts/auth.js";
import type { BetterPortalApp, BetterPortalMenuItem, BetterPortalRouteMount } from "../../contracts/platformConfig.js";
import { createStaticJwksVerifier } from "./verifier.js";

/** Request-scoped identity for shell rendering; never inferred from unverified JWT data. */
export interface ThemeAuthContext {
  readonly status: "unknown" | "anonymous" | "authenticated";
  readonly user?: JwtClaims;
  readonly permissions: ReadonlyArray<{ serviceId: string; viewId: string; permissions: ReadonlyArray<string> }>;
}

/** Resolve shell identity using only synced keys. Initial browser navigation remains unknown. */
export async function resolveThemeAuth(
  app: Pick<BetterPortalApp, "id" | "tenantId" | "auth">,
  headers: Headers
): Promise<ThemeAuthContext> {
  const anonymous: ThemeAuthContext = { status: "anonymous", permissions: [] };
  const authorization = headers.get("authorization");
  if (!authorization) return headers.get("hx-request") || headers.get("x-bp-auth-resolved") === "true"
    ? anonymous : { status: "unknown", permissions: [] };
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token || !app.auth?.publicKeys) return { status: "unknown", permissions: [] };
  try {
    const user = await createStaticJwksVerifier({
      jwks: app.auth.publicKeys,
      expectedIssuer: app.auth.expectedIssuer,
      expectedAudience: app.auth.expectedAudience,
      expectedTokenType: "access"
    }).verify(token, { tenantId: app.tenantId, appId: app.id });
    if (user.tenantId !== app.tenantId || user.appId !== app.id) return anonymous;
    return { status: "authenticated", user, permissions: rolePermissions(user.roles, app.auth) };
  } catch { return anonymous; }
}

export function rolePermissions(roles: readonly string[], auth?: AppAuthConfig): ThemeAuthContext["permissions"] {
  return (auth?.roles ?? []).filter(role => roles.includes(role.id)).flatMap(role => role.permissions);
}

/** Evaluate presentation only. Service request authorization remains authoritative. */
export function menuItemVisible(
  item: Pick<BetterPortalMenuItem, "authStatus" | "rolesAnyOf">,
  route: BetterPortalRouteMount | undefined,
  auth: ThemeAuthContext,
  aliases: Readonly<Record<string, string>> = {},
  platformRoot = false
): boolean {
  if (route?.menu === false) return false;
  if (item.rolesAnyOf?.length && (!auth.user || !item.rolesAnyOf.some(role => auth.user!.roles.includes(role)))) return false;
  if (item.authStatus === "show-unauthenticated") return auth.status === "anonymous";
  if (item.authStatus === "hide-unauthenticated") return auth.status === "authenticated";
  const automatic = !item.authStatus || item.authStatus === "auto";
  if (automatic && !route) return true;
  if (automatic && route?.authRequired === false) return true;
  if (automatic && (route?.authRequired === undefined || route?.menuPermissions === undefined)) return false;
  if (!automatic && item.authStatus !== "hide-unauthorized") return true;
  if (auth.status !== "authenticated") return false;
  if (platformRoot && auth.user?.roles.includes("*")) return true;
  // Missing manifest metadata is unknown, not a declaration of public access.
  if (route && route.menuPermissions === undefined) return false;
  return (route?.menuPermissions ?? []).every(requirement => requirement.permissions.every(action =>
    auth.permissions.some(grant => (grant.serviceId === requirement.serviceId
      || aliases[grant.serviceId] === requirement.serviceId || aliases[requirement.serviceId] === grant.serviceId)
      && grant.viewId === requirement.viewId && grant.permissions.includes(action))));
}

/** Filter a configured menu recursively, including parent conditions and empty groups. */
export function filterThemeMenu(
  app: Pick<BetterPortalApp, "menu" | "routes">,
  auth: ThemeAuthContext,
  aliases: Readonly<Record<string, string>> = {},
  platformRoot = false
): BetterPortalMenuItem[] {
  const routes = new Map(app.routes.map(route => [route.id, route]));
  const visit = (items: BetterPortalMenuItem[]): BetterPortalMenuItem[] => items.flatMap(item => {
    const route = item.routeId ? routes.get(item.routeId) : undefined;
    if (!item.enabled || !menuItemVisible(item, route, auth, aliases, platformRoot)) return [];
    const children = visit(item.children ?? []);
    if (item.type === "group" && !children.length) return [];
    return [{ ...item, children }];
  });
  return visit(app.menu);
}
