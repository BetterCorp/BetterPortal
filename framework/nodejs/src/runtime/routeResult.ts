import type { ResolvedRoute, RouteInput, RouteResolver } from "../contracts/routing.js";
import type { HttpMethod } from "../contracts/common.js";

export type RouteAccess = "ok" | "unknown" | "noauth" | "noperm";
export interface RouteDetails {
  serviceId?: string;
  method?: HttpMethod;
  access?: RouteAccess;
}
const details = new WeakMap<ResolvedRoute, RouteDetails>();
export const routeDetails = (route: ResolvedRoute): RouteDetails => details.get(route) ?? {};

/** Keep methods out of the portable six-field destination document. */
export function createRouteResult(
  paths: Pick<ResolvedRoute, "apiPath" | "viewPath" | "uiPath" | "absoluteApiPath" | "absoluteViewPath" | "absoluteUiPath">,
  resolve: RouteResolver,
  input: RouteInput,
  field: "apiPath" | "viewPath" = "apiPath",
  metadata: RouteDetails = {}
): ResolvedRoute {
  const snapshot = { ...input, ...(input.params ? { params: { ...input.params } } : {}), ...(input.query ? { query: { ...input.query } } : {}) };
  const result = { ...paths } as ResolvedRoute;
  Object.defineProperties(result, {
    toString: { value: () => result[field] },
    component: { value: (id: string) => typeof id === "string" && id.trim() ? resolve({ ...snapshot, component: id, fragment: undefined }) : null },
    fragment: { value: (id: string) => typeof id === "string" && id.trim() ? resolve({ ...snapshot, fragment: id, component: undefined }) : null }
  });
  details.set(result, metadata);
  return Object.freeze(result);
}

/** Rebind string conversion and chained resolution to the renderer context. */
export function viewRouteResolver(resolve: RouteResolver): RouteResolver {
  const view: RouteResolver = (input = {}) => {
    const destination = resolve(input);
    return destination ? createRouteResult(destination, view, input, "viewPath", routeDetails(destination)) : null;
  };
  return view;
}
