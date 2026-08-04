import type { RouteHandlerContext } from "../../contracts/route.js";

export type AppAuthRedirectKind = "afterLogin" | "afterLogout";

function normalizeRedirect(raw: string | undefined): string | undefined {
  const redirect = raw?.trim();
  if (!redirect) return undefined;
  if (redirect.startsWith("http://") || redirect.startsWith("https://")) return redirect;
  return redirect.startsWith("/") ? redirect : `/${redirect}`;
}

export function resolveAppAuthRedirect(
  ctx: Pick<RouteHandlerContext, "app" | "uiRouteUrl">,
  kind: AppAuthRedirectKind,
  requested?: string
): string {
  const explicit = normalizeRedirect(requested);
  if (explicit) return explicit;

  const target = ctx.app.auth?.redirects?.[kind];
  const configured = target
    ? ctx.uiRouteUrl?.(target.viewId, { serviceId: target.serviceId })
    : null;
  return configured ?? normalizeRedirect(ctx.app.defaultRoute) ?? "/";
}
