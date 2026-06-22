import type {
  RegisteredRoute,
  RegisteredThemeRenderer,
  StatusRenderersByKind
} from "../contracts/registry.js";

export type StatusRendererKind = "page" | "component" | "fragment";

/**
 * Resolve a renderer for an HTTP status code on a route.
 *
 * Resolution order:
 * 1. route.statusRenderers[themeId][code] matching the requested kind and id
 * 2. (caller falls back to default renderer or no-body response)
 *
 * For 2xx success codes the caller may choose to fall back to the default
 * success renderer. For 4xx/5xx the caller may return no body.
 */
export function resolveStatusRenderer(
  route: RegisteredRoute,
  themeId: string,
  statusCode: number,
  kind: StatusRendererKind,
  rendererKey?: string
): RegisteredThemeRenderer | undefined {
  const bucket: StatusRenderersByKind | undefined = route.statusRenderers?.[themeId]?.[statusCode];
  if (!bucket) return undefined;

  switch (kind) {
    case "page":
      return bucket.page;
    case "component":
      return rendererKey ? bucket.components?.[rendererKey] : undefined;
    case "fragment":
      return rendererKey ? bucket.fragments?.[rendererKey] : undefined;
  }
}

/**
 * Status code policy:
 * - 200, 201, 202 (and other 2xx): success - fall back to default renderer if no specific one.
 * - 204, 205, 206: no body (HTTP forbids body or strongly discourages).
 * - 1xx, 3xx: no body emitted by framework.
 * - 4xx, 5xx: try specific renderer; if absent, return status with empty body.
 */
export function shouldFallThroughToDefaultRenderer(statusCode: number): boolean {
  if (statusCode === 200 || statusCode === 201 || statusCode === 202) return true;
  // Other 2xx that allow a body (203, 207, 208, 226) - fall through too.
  if (statusCode >= 200 && statusCode <= 299 && ![204, 205, 206].includes(statusCode)) return true;
  return false;
}

export function statusForbidsBody(statusCode: number): boolean {
  if (statusCode === 204 || statusCode === 205 || statusCode === 206) return true;
  if (statusCode >= 100 && statusCode <= 199) return true;
  if (statusCode >= 300 && statusCode <= 399) return true;
  return false;
}
