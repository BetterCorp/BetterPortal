import { createEventStream, getRequestURL } from "h3";
import type { HttpMethod } from "../contracts/common.js";
import type { JsonValue } from "../contracts/json.js";
import type { PluginManifest } from "../contracts/manifest.js";
import type { BetterPortalRegistry, RegisteredRoute } from "../contracts/registry.js";
import type { RouteHandlerContext } from "../contracts/route.js";
import {
  acceptHeaderFromEvent,
  htmlResponse,
  jsonResponse,
  type BetterPortalEvent,
  type BetterPortalH3App
} from "../runtime/h3.js";
import { toHtmlString } from "../runtime/http.js";
import { parseAcceptHeader, resolveRequestedRepresentation } from "../runtime/media.js";
import {
  resolveRenderer,
  type BpSchemaOutput
} from "../runtime/registry.js";

// ── Helpers ──────────────────────────────────────────────────────────

type MethodRegistrar = (path: string, handler: (event: BetterPortalEvent) => Response | Promise<Response>) => void;

const METHOD_WRITE_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"]);

function methodRegistrar(app: BetterPortalH3App, method: HttpMethod): MethodRegistrar {
  switch (method) {
    case "GET": return (p, h) => app.get(p, h);
    case "POST": return (p, h) => app.post(p, h);
    case "PUT": return (p, h) => app.put(p, h);
    case "PATCH": return (p, h) => app.patch(p, h);
    case "DELETE": return (p, h) => app.delete(p, h);
    case "OPTIONS": return (p, h) => app.options(p, h);
  }
}

function queryFromUrl(url: URL): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    result[key] = value;
  }
  return result;
}

function headersFromEvent(event: BetterPortalEvent): Record<string, string> {
  const result: Record<string, string> = {};
  const raw = event.req.headers;
  if (raw instanceof Headers) {
    raw.forEach((value, key) => { result[key] = value; });
  }
  return result;
}

/**
 * Extract the `fragment` parameter from the Accept header.
 * Format: `text/html; fragment=nav.profile`
 */
function fragmentFromAcceptHeader(headerValue?: string): string | undefined {
  const entries = parseAcceptHeader(headerValue);
  for (const entry of entries) {
    if (entry.mediaType === "text/html" && entry.parameters.fragment) {
      return entry.parameters.fragment;
    }
  }
  return undefined;
}

// ── Router registration ──────────────────────────────────────────────

/**
 * Register all routes from a BetterPortalRegistry onto an H3 app.
 *
 * For each registered route and method, the adapter:
 * 1. Parses and validates input (query, headers, body) against route schemas.
 * 2. Calls the route handler to produce response data.
 * 3. Content-negotiates the response (JSON, HTML page/fragment/component, or metadata).
 */
export function createH3Router(registry: BetterPortalRegistry, app: BetterPortalH3App): void {
  for (const route of registry.routes) {
    for (const method of route.methods) {
      const register = methodRegistrar(app, method);
      register(route.path, (event) => handleRouteRequest(route, method, event));
    }

    if (route.sse) {
      const sseHandler = route.sse.handler;
      const tickSchema = route.sse.tickSchema;
      app.get(`${route.path}/__sse`, async (event) => {
        const url = getRequestURL(event);
        const rawQuery = queryFromUrl(url);
        const query = route.schemas.query ? route.schemas.query.parse(rawQuery) : rawQuery;
        const params: Record<string, string> =
          (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};

        const result = sseHandler({ event, params, query: query as Record<string, unknown> });

        // Legacy path: handler manages its own stream → returns Promise<BodyInit> | BodyInit
        if (
          typeof result === "string"
          || result instanceof ReadableStream
          || result instanceof ArrayBuffer
          || (typeof result === "object" && result !== null && typeof (result as Promise<unknown>).then === "function")
        ) {
          return result as Promise<BodyInit> | BodyInit;
        }

        // Generator path: framework drives the stream.
        if (typeof result === "object" && result !== null && Symbol.asyncIterator in (result as object)) {
          // Resolve theme renderer if `?_f=loc.frag` provided.
          const fragmentKey = (rawQuery._f as string | undefined) ?? undefined;
          let sseRender: ((data: unknown) => unknown) | undefined;
          if (fragmentKey) {
            const dotIdx = fragmentKey.indexOf(".");
            if (dotIdx > 0) {
              const fragLocation = fragmentKey.slice(0, dotIdx);
              const fragId = fragmentKey.slice(dotIdx + 1);
              // Walk all themes for a matching fragment with sseRender
              for (const themeSet of Object.values(route.themeRenderers)) {
                const match = themeSet.fragments.find(
                  (f) => f.fragmentLocation === fragLocation && f.fragmentId === fragId,
                );
                if (match?.sseRender) {
                  sseRender = match.sseRender as (data: unknown) => unknown;
                  break;
                }
              }
            }
          }

          const stream = createEventStream(event);
          const iterable = result as AsyncIterable<unknown>;

          (async () => {
            try {
              for await (const raw of iterable) {
                const data = tickSchema ? tickSchema.parse(raw) : raw;
                const payload = sseRender
                  ? String(sseRender(data))
                  : typeof data === "string" ? data : JSON.stringify(data);
                await stream.push({ data: payload });
              }
            } catch {
              // generator errored — close stream
            }
            await stream.close().catch(() => {});
          })();

          return stream.send();
        }

        // Unknown result shape — treat as legacy
        return result as BodyInit;
      });
    }
  }
}

async function handleRouteRequest(
  route: RegisteredRoute,
  method: HttpMethod,
  event: BetterPortalEvent
): Promise<Response> {
  const handler = route.handlers[method];
  if (!handler) {
    return jsonResponse({ error: `No handler for ${method} ${route.path}` }, 405);
  }

  // ── Parse inputs ─────────────────────────────────────────────────

  const url = getRequestURL(event);
  const rawQuery = queryFromUrl(url);
  const rawHeaders = headersFromEvent(event);

  let rawBody: Record<string, unknown> = {};
  if (METHOD_WRITE_BODY.has(method)) {
    const parsed = await event.req.json().catch(() => null);
    rawBody = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : {};
  }

  // ── Validate against schemas ─────────────────────────────────────

  const query = route.schemas.query ? route.schemas.query.parse(rawQuery) : rawQuery;
  const headers = route.schemas.headers ? route.schemas.headers.parse(rawHeaders) : rawHeaders;
  const request = route.schemas.request ? route.schemas.request.parse(rawBody) : rawBody;

  // Path params — H3 populates event.context.params for `:paramName` routes
  const params: Record<string, string> = (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};

  // ── Build context and invoke handler ─────────────────────────────

  const ctx: RouteHandlerContext = {
    params,
    query: query as Record<string, unknown>,
    headers: headers as Record<string, string>,
    request: request as Record<string, unknown>,
    method,
    path: url.pathname,
    rawEvent: event
  };

  const rawData = await handler(ctx);

  // ── Validate response against schema (all representations) ──────
  const data = route.schemas.response.parse(rawData);

  // ── Content negotiation ──────────────────────────────────────────

  const acceptHeader = acceptHeaderFromEvent(event);
  const representation = resolveRequestedRepresentation(acceptHeader);

  // Metadata
  if (representation.kind === "metadata") {
    return jsonResponse({
      viewId: route.viewId,
      title: route.title,
      description: route.description,
      path: route.path,
      methods: [...route.methods],
      auth: route.auth,
      cacheHints: route.cacheHints
    } as JsonValue, 200, {
      "content-type": "application/vnd.betterportal.metadata+json; charset=utf-8"
    });
  }

  // JSON — already validated above, no redundant parse
  if (representation.kind === "json") {
    return jsonResponse(data as JsonValue);
  }

  // HTML — resolve theme from request context (hostname → app config), Accept header as fallback
  const themeId =
    (event as unknown as { __bpThemeId?: string }).__bpThemeId
    ?? representation.theme;
  if (!themeId) {
    return jsonResponse({ error: "Theme could not be resolved from app config or request" }, 406);
  }

  // Fragment request via `_f` query param or Accept header: `text/html; fragment=nav.profile`
  const fragmentKey = url.searchParams.get("_f") ?? fragmentFromAcceptHeader(acceptHeader);
  if (fragmentKey) {
    const resolved = resolveRenderer(route, themeId, "fragment", method, undefined, fragmentKey);
    if (!resolved) {
      return jsonResponse({
        error: `No fragment renderer found for fragment="${fragmentKey}" in theme "${themeId}"`
      }, 406);
    }

    const html = resolved.renderer.render(data);
    return htmlResponse(toHtmlString(html), 200, `text/html; theme=${themeId}; mode=fragment`);
  }

  // Component request via `_c` query param
  const componentId = url.searchParams.get("_c");
  if (componentId) {
    const resolved = resolveRenderer(route, themeId, "component", method, componentId);
    if (!resolved) {
      return jsonResponse({
        error: `No component renderer found for _c="${componentId}" in theme "${themeId}"`
      }, 406);
    }

    const html = resolved.renderer.render(data);
    return htmlResponse(toHtmlString(html), 200, `text/html; theme=${themeId}; mode=fragment`);
  }

  // Page request — only page renderers allowed
  const resolved = resolveRenderer(route, themeId, "page", method);
  if (!resolved) {
    return jsonResponse({
      error: `No page renderer found for theme "${themeId}"`
    }, 406);
  }

  const html = resolved.renderer.render(data);
  const mode = representation.mode ?? "page";
  return htmlResponse(toHtmlString(html), 200, `text/html; theme=${themeId}; mode=${mode}`);
}

// ── Well-known routes ────────────────────────────────────────────────

/**
 * Register BetterPortal well-known discovery and health endpoints.
 */
export function registerBpWellKnownRoutes(
  app: BetterPortalH3App,
  manifest: PluginManifest,
  bpSchema: BpSchemaOutput
): void {
  app.get("/.well-known/bp/schema.json", () => {
    return jsonResponse(bpSchema as unknown as JsonValue);
  });

  app.get("/.well-known/bp/health", () => {
    return jsonResponse({ ok: true, pluginId: manifest.pluginId });
  });

  app.get("/.well-known/bp/manifest", () => {
    return jsonResponse(manifest as unknown as JsonValue);
  });
}
