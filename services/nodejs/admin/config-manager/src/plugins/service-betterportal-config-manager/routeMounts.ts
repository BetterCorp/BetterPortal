export function serviceRouteSlug(serviceId: string): string {
  const base = serviceId.replace(/^service\./, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "service";
}

export function normalizeServicePath(path: string): string {
  const cleaned = path.trim();
  if (!cleaned) return "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

export function apiRoutePath(serviceId: string, servicePath: string): string {
  const normalizedServicePath = normalizeServicePath(servicePath);
  return `/_bp/service/${serviceRouteSlug(serviceId)}${normalizedServicePath === "/" ? "" : normalizedServicePath}`;
}

export function isApiRoute(route: { kind?: "page" | "api"; path: string }, renderable?: boolean): boolean {
  return route.kind === "api" || renderable === false || route.path.startsWith("/_bp/service/");
}
