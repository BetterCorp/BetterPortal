import type { RouteUrlResolver } from "../../contracts/routeUrl.js";

export type AppAuthRedirectKind = "afterLogin" | "afterLogout";

function normalizeRedirect(raw: string | undefined): string | undefined {
  const redirect = raw?.trim();
  if (!redirect) return undefined;
  if (redirect.startsWith("http://") || redirect.startsWith("https://")) return redirect;
  return redirect.startsWith("/") ? redirect : `/${redirect}`;
}

export function resolveAppAuthRedirect(
  ctx: { app: { defaultRoute: string; auth?: { redirects?: Partial<Record<AppAuthRedirectKind, { viewId: string; serviceId: string }>> } }; routeUrl?: RouteUrlResolver },
  kind: AppAuthRedirectKind,
  requested?: string
): string {
  const explicit = normalizeRedirect(requested);
  if (explicit) return explicit;

  const target = ctx.app.auth?.redirects?.[kind];
  const configured = target
    ? ctx.routeUrl?.({ viewId: target.viewId, serviceId: target.serviceId })?.uiPath
    : null;
  return configured ?? normalizeRedirect(ctx.app.defaultRoute) ?? "/";
}
