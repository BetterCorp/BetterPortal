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

export function appRoutePatternKey(path: string): string {
  const normalized = normalizeServicePath(path)
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "") || "/";
  return normalized
    .split("/")
    .map((segment) => segment.startsWith(":") || /^\{[^}]+\}$/.test(segment) ? ":*" : segment)
    .join("/");
}

export function apiRoutePath(serviceId: string, servicePath: string): string {
  const normalizedServicePath = normalizeServicePath(servicePath);
  return `/_bp/service/${serviceRouteSlug(serviceId)}${normalizedServicePath === "/" ? "" : normalizedServicePath}`;
}

export function pageRoutePath(serviceId: string, servicePath: string): string {
  const normalizedServicePath = normalizeServicePath(servicePath);
  return `/${serviceRouteSlug(serviceId)}${normalizedServicePath === "/" ? "" : normalizedServicePath}`;
}

export function isApiRoute(route: { kind?: "page" | "api"; path: string }, renderable?: boolean): boolean {
  return route.kind === "api" || renderable === false || route.path.startsWith("/_bp/service/");
}

/** Service declarations take precedence over stored app menu configuration. */
export function isMenuRouteExcluded(
  route: { serviceId?: string; viewId?: string; operations?: string[]; menu?: boolean },
  cache: ReadonlyMap<string, { viewIndex: Record<string, { operations: Array<{ operationId: string; method: string; menu?: boolean; renderModes: string[] }> }> }>
): boolean {
  const operations = route.serviceId && route.viewId
    ? cache.get(route.serviceId)?.viewIndex[route.viewId]?.operations : undefined;
  const page = operations?.find(operation => route.operations?.includes(operation.operationId)
    && operation.method === "GET" && operation.renderModes.includes("page"));
  return page ? page.menu === false : route.menu === false;
}
