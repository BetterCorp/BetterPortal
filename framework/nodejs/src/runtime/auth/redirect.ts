import type { RouteResolver } from "../../contracts/routing.js";

export type AppAuthRedirectKind = "afterLogin" | "afterLogout";

function normalizeRedirect(raw: string | undefined): string | undefined {
  const redirect = raw?.trim();
  if (!redirect) return undefined;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(redirect)) return undefined;
  const path = redirect.startsWith("/") ? redirect : `/${redirect}`;
  // This value can come from ?next= and is sent in HX-Redirect after sign-in.
  // Browsers interpret leading double slashes and backslashes as external URLs.
  if (path.startsWith("//") || path.includes("\\")) return undefined;
  for (const char of path) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return undefined;
  }
  const base = "https://betterportal.invalid";
  try {
    if (new URL(path, base).origin !== base) return undefined;
  } catch { return undefined; }
  return path;
}

export function resolveAppAuthRedirect(
  ctx: { app: { defaultRoute: string; auth?: { redirects?: Partial<Record<AppAuthRedirectKind, { viewId: string; serviceId: string }>> } }; route?: RouteResolver },
  kind: AppAuthRedirectKind,
  requested?: string
): string {
  const explicit = normalizeRedirect(requested);
  if (explicit) return explicit;

  const target = ctx.app.auth?.redirects?.[kind];
  const configured = target
    ? ctx.route?.({ viewId: target.viewId, serviceId: target.serviceId })?.uiPath
    : null;
  return configured ?? normalizeRedirect(ctx.app.defaultRoute) ?? "/";
}
