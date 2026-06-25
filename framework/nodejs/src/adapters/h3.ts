import { createEventStream, getRequestIP, getRequestURL } from "h3";
import type { HttpMethod } from "../contracts/common.js";
import type { JsonValue } from "../contracts/json.js";
import type { PluginManifest } from "../contracts/manifest.js";
import type { BetterPortalObservability, ObservabilityAttributes } from "../contracts/observability.js";
import type { BetterPortalRegistry, RegisteredRoute } from "../contracts/registry.js";
import type {
  ApiAuthRequirement,
  FileResponseOptions,
  JwtVerifier,
  MultipartRequest,
  RawResponseBody,
  RouteHandler,
  RouteHandlerContext,
  UploadedFile,
  ValidatedUserClaims
} from "../contracts/route.js";
import type { BetterPortalApp, BetterPortalRouteChrome } from "../contracts/platformConfig.js";
import { isStreamHandler, type BpStreamHandler, type StreamShellContext } from "../contracts/streaming.js";
import { driveStream, driveStreamBuffered, ndjsonStreamResponse } from "../runtime/stream.js";
import type { AppAuthConfig, JwtClaims } from "../contracts/auth.js";
import {
  acceptHeaderFromEvent,
  eventObservability,
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
import { createBpHeadersCollector } from "../runtime/bpHeaders.js";
import {
  resolveStatusRenderer,
  shouldFallThroughToDefaultRenderer,
  statusForbidsBody
} from "../runtime/statusViews.js";

// -- Helpers ----------------------------------------------------------

type MethodRegistrar = (path: string, handler: (event: BetterPortalEvent) => Response | Promise<Response>) => void;

const METHOD_WRITE_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"]);
const MAX_BUFFERED_MULTIPART_BYTES = 25 * 1024 * 1024;

class MultipartTooLargeError extends Error {
  constructor() {
    super("Multipart payload exceeds buffered upload limit");
  }
}

export interface H3RouterObservabilityOptions {
  createRequestObservability?: (
    name: string,
    attributes: ObservabilityAttributes
  ) => BetterPortalObservability;
  /** Identifier of the service hosting this router (used by ctx.serviceId). */
  serviceId?: string;
  /** Resolve auth context for a request. Returning undefined disables auth enforcement for the request. */
  resolveAuth?: (event: BetterPortalEvent) => Promise<H3AuthContext | undefined> | H3AuthContext | undefined;
  /**
   * Validate that the resolved (tenantId, appId) is allowed to use this service.
   * Returning { allowed: false } emits 426 Upgrade Required with optional upgradeUrl.
   * Called for every request after tenant/app context is resolved.
   */
  validateTenantApp?: (tenantId: string, appId: string) => Promise<import("../contracts/auth.js").TenantAppValidation> | import("../contracts/auth.js").TenantAppValidation;
  /** Extra per-request context supplied by the host service/plugin. */
  resolveContext?: (event: BetterPortalEvent) => Promise<Partial<RouteHandlerContext>> | Partial<RouteHandlerContext>;
}

type RequiredHandlerContext =
  Omit<Partial<RouteHandlerContext>, "response" | "file">
  & Pick<RouteHandlerContext, "tenant" | "app">;
type RouteUrlOptions = NonNullable<RouteHandlerContext["routeUrl"]> extends (viewId: string, options?: infer T) => unknown ? T : never;

export interface H3AuthContext {
  readonly verifier: JwtVerifier;
  readonly tenantId: string;
  readonly appId: string;
  readonly appAuthConfig?: AppAuthConfig;
  /**
   * Service-id alias map: tenant service-instance id (UUIDv7) -> pluginId.
   * Role grants in app.auth reference instance ids; route auth requirements
   * are authored against pluginIds. The permission check accepts either.
   */
  readonly serviceIdAliases?: Readonly<Record<string, string>>;
}

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

function escapeContentDispositionValue(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}

function responseHelper(body: RawResponseBody = null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

function fileResponseHelper(body: RawResponseBody, options: FileResponseOptions = {}): Response {
  const headers = new Headers(options.headers);
  if (options.contentType && !headers.has("content-type")) headers.set("content-type", options.contentType);
  if (typeof options.size === "number" && !headers.has("content-length")) headers.set("content-length", String(options.size));
  if (options.filename && !headers.has("content-disposition")) {
    headers.set("content-disposition", `${options.disposition ?? "attachment"}; filename="${escapeContentDispositionValue(options.filename)}"`);
  }
  return new Response(body, { status: options.status ?? 200, headers });
}

async function formDataToRequest(fd: FormData): Promise<{ body: Record<string, unknown>; multipart: MultipartRequest }> {
  const body: Record<string, unknown> = {};
  const fields: MultipartRequest["fields"] = {};
  const files: MultipartRequest["files"] = {};
  let totalFileBytes = 0;

  const pushValue = <T>(target: Record<string, T | T[]>, key: string, value: T) => {
    const existing = target[key];
    if (existing === undefined) target[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else target[key] = [existing, value];
  };

  const pendingFiles: Array<Promise<void>> = [];
  fd.forEach((value, key) => {
    if (typeof value === "string") {
      body[key] = value;
      pushValue(fields, key, value);
    } else {
      body[key] = value.name;
      pendingFiles.push((async () => {
        totalFileBytes += value.size;
        if (totalFileBytes > MAX_BUFFERED_MULTIPART_BYTES) {
          throw new MultipartTooLargeError();
        }
        const file: UploadedFile = {
          fieldName: key,
          filename: value.name,
          contentType: value.type || "application/octet-stream",
          size: value.size,
          data: new Uint8Array(await value.arrayBuffer())
        };
        pushValue(files, key, file);
      })());
    }
  });
  await Promise.all(pendingFiles);

  return { body, multipart: { fields, files } };
}

async function resolveRequiredHandlerContext(
  event: BetterPortalEvent,
  routerOptions: H3RouterObservabilityOptions
): Promise<RequiredHandlerContext | null> {
  const extraContext = await routerOptions.resolveContext?.(event) ?? {};
  return extraContext.tenant && extraContext.app
    ? extraContext as RequiredHandlerContext
    : null;
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

function chromeContentTypeParams(chrome?: BetterPortalRouteChrome): string {
  if (!chrome) return "";
  const params: string[] = [];
  for (const [rawKey, value] of Object.entries(chrome)) {
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    const key = rawKey
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[_\s]+/g, "-")
      .toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(key)) continue;
    const stringValue = typeof value === "string" ? encodeURIComponent(value) : String(value);
    params.push(`bp-chrome-${key}=${stringValue}`);
  }
  return params.length ? `; ${params.join("; ")}` : "";
}

function htmlContentType(themeId: string, mode: string, chrome?: BetterPortalRouteChrome): string {
  return `text/html; theme=${themeId}; mode=${mode}${chromeContentTypeParams(chrome)}`;
}

// -- Router registration ----------------------------------------------

/**
 * Register all routes from a BetterPortalRegistry onto an H3 app.
 *
 * For each registered route and method, the adapter:
 * 1. Parses and validates input (query, headers, body) against route schemas.
 * 2. Calls the route handler to produce response data.
 * 3. Content-negotiates the response (JSON, HTML page/fragment/component, or metadata).
 */
export function createH3Router(
  registry: BetterPortalRegistry,
  app: BetterPortalH3App,
  options: H3RouterObservabilityOptions = {}
): void {
  for (const route of registry.routes) {
    for (const method of route.methods) {
      const register = methodRegistrar(app, method);
      register(route.path, async (event) => {
        const response = await withRequestObservability(event, route, method, options, (obs) =>
          handleRouteRequest(registry.routes, route, method, event, obs, options)
        );
        // h3 only merges event.res.headers into 2xx responses - error responses
        // would otherwise lose CORS and BP-SetHeader/RemoveHeader headers, which
        // makes cross-origin 4xx unreadable by the browser entirely.
        if (response instanceof Response && !response.ok) {
          event.res.headers.forEach((value, name) => {
            if (!response.headers.has(name)) response.headers.set(name, value);
          });
        }
        return response;
      });
    }

    // Streaming routes (createStreamHandler) expose their frame stream at
    // `{path}/__sse` (spec/streaming.md section 2.3). A hand-written sse.ts wins if
    // both exist.
    const streamGetHandler = route.handlers.GET;
    if (!route.sse && isStreamHandler(streamGetHandler)) {
      app.get(`${route.path}/__sse`, async (event) => {
        return withRequestObservability(
          event,
          route,
          "GET",
          options,
          (obs) => handleStreamSse(registry.routes, route, streamGetHandler, event, obs, options),
          { "bp.route.stream_sse": true }
        );
      });
    }

    if (route.sse) {
      const sseHandler = route.sse.handler;
      const tickSchema = route.sse.tickSchema;
      app.get(`${route.path}/__sse`, async (event) => {
        return withRequestObservability(event, route, "GET", options, async (obs) => {
        const url = getRequestURL(event);
        const rawQuery = queryFromUrl(url);
        const query = route.schemas.query ? route.schemas.query.parse(rawQuery) : rawQuery;
        const params: Record<string, string> =
          (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};

        const result = sseHandler({
          event,
          params,
          query: query as Record<string, unknown>,
          ...(obs ? { obs } : {})
        });

        // Legacy path: handler manages its own stream -> returns Promise<BodyInit> | BodyInit
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
          // Resolve theme renderer if `?_f=loc.frag` provided. The theme MUST be
          // disambiguated - with multiple themes registered, picking the first
          // match would silently render another theme's fragment. Prefer the
          // theme resolved from request context (__bpThemeId), then an explicit
          // `?_theme=` pin; only fall back to a cross-theme scan when exactly one
          // theme provides the fragment.
          const fragmentKey = (rawQuery._f as string | undefined) ?? undefined;
          let sseRender: ((data: unknown) => unknown) | undefined;
          if (fragmentKey) {
            const themeId =
              (event as unknown as { __bpThemeId?: string }).__bpThemeId
              ?? (rawQuery._theme as string | undefined);

            if (themeId) {
              const resolved = resolveRenderer(route, themeId, "fragment", undefined, undefined, fragmentKey);
              if (resolved?.renderer.sseRender) {
                sseRender = resolved.renderer.sseRender as (data: unknown) => unknown;
              }
            } else {
              // No theme context. Only render if the match is unambiguous across
              // themes; otherwise leave it to the JSON passthrough rather than guess.
              const matches: Array<(data: unknown) => unknown> = [];
              for (const candidateThemeId of Object.keys(route.themeRenderers)) {
                const resolved = resolveRenderer(route, candidateThemeId, "fragment", undefined, undefined, fragmentKey);
                if (resolved?.renderer.sseRender) {
                  matches.push(resolved.renderer.sseRender as (data: unknown) => unknown);
                }
              }
              if (matches.length === 1) {
                sseRender = matches[0];
              } else if (matches.length > 1) {
                obs?.logger.warn(
                  "BP SSE: ambiguous fragment '{fragmentKey}' across {count} themes and no theme context; sending raw ticks",
                  { fragmentKey, count: matches.length }
                );
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
              // generator errored - close stream
            }
            await stream.close().catch(() => {});
          })();

          return stream.send();
        }

        // Unknown result shape - treat as legacy
        return result as BodyInit;
        }, { "bp.route.sse": true });
      });
    }
  }
}

function requestAttributes(
  event: BetterPortalEvent,
  route: RegisteredRoute,
  method: HttpMethod,
  extra: ObservabilityAttributes = {}
): ObservabilityAttributes {
  const requestUrl = getRequestURL(event);
  const requestIp = getRequestIP(event, { xForwardedFor: true });

  return {
    "http.request.method": method,
    "url.full": requestUrl.toString(),
    "url.path": requestUrl.pathname,
    "network.protocol.name": requestUrl.protocol.replace(":", ""),
    "bp.route.path": route.path,
    "bp.route.view_id": route.viewId,
    ...(requestIp ? { "client.address": requestIp } : {}),
    ...extra
  };
}

function responseStatus(event: BetterPortalEvent, result: unknown): number {
  if (result instanceof Response) return result.status;
  return event.res.status || 200;
}

function roundedDuration(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}

function logRequest(
  obs: BetterPortalObservability,
  route: RegisteredRoute,
  method: HttpMethod,
  status: number,
  durationMs: number
): void {
  const attrs = {
    method,
    path: route.path,
    status,
    durationMs: roundedDuration(durationMs)
  };

  if (status >= 500) {
    obs.logger.error("BetterPortal request failed: {method} {path} -> {status} in {durationMs}ms", attrs);
    return;
  }

  if (status >= 400) {
    obs.logger.warn("BetterPortal request completed: {method} {path} -> {status} in {durationMs}ms", attrs);
    return;
  }

  obs.logger.info("BetterPortal request completed: {method} {path} -> {status} in {durationMs}ms", attrs);
}

function logNegotiationFailure(
  obs: BetterPortalObservability | undefined,
  route: RegisteredRoute,
  method: HttpMethod,
  reason: string,
  attributes: ObservabilityAttributes = {}
): void {
  if (!obs) return;
  obs.logger.warn("BetterPortal representation negotiation failed: {method} {path} -> {status} reason={reason}", {
    method,
    path: route.path,
    status: 406,
    reason,
    "bp.route.view_id": route.viewId,
    ...attributes
  });
}

function normalizeRoutePath(path: string): string {
  const bare = path.split("?")[0]?.split("#")[0] ?? "/";
  const normalized = `/${bare}`.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function routePathsMatch(left: string, right: string): boolean {
  const a = normalizeRoutePath(left).split("/").filter(Boolean);
  const b = normalizeRoutePath(right).split("/").filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((segment, index) => {
    const other = b[index];
    return segment === other || segment.startsWith(":") || other.startsWith(":");
  });
}

function routeMountServicePath(routeMount: BetterPortalApp["routes"][number]): string | undefined {
  return routeMount.resolvedServicePath ?? routeMount.targetPath;
}

function methodAllowed(methods: ReadonlyArray<string> | undefined, method: HttpMethod): boolean {
  return (methods?.length ? methods : ["GET"]).some((candidate) => candidate.toUpperCase() === method);
}

function appAllowsRoute(
  app: BetterPortalApp,
  route: RegisteredRoute,
  method: HttpMethod,
  url: URL,
  acceptHeader?: string
): { allowed: boolean; reason?: string } {
  const appRoute = app.routes.find((candidate) => {
    const servicePath = routeMountServicePath(candidate);
    return candidate.enabled !== false
      && candidate.viewId === route.viewId
      && methodAllowed(candidate.methods, method)
      && (!servicePath || routePathsMatch(servicePath, route.path));
  });
  if (appRoute) return { allowed: true };

  const fragmentKey = url.searchParams.get("_f") ?? fragmentFromAcceptHeader(acceptHeader);
  if (method === "GET" && fragmentKey) {
    const dot = fragmentKey.indexOf(".");
    const location = dot > 0 ? fragmentKey.slice(0, dot) : "";
    const fragmentId = dot > 0 ? fragmentKey.slice(dot + 1) : fragmentKey;
    const fragment = (location ? app.fragments[location] ?? [] : Object.values(app.fragments).flat()).find((candidate) =>
      candidate.enabled !== false
      && candidate.fragmentId === fragmentId
      && routePathsMatch(candidate.targetPath, route.path)
    );
    if (fragment) return { allowed: true };
  }

  if (method === "GET") {
    const slot = app.slots.find((candidate) =>
      candidate.enabled !== false
      && candidate.viewId === route.viewId
    );
    if (slot) return { allowed: true };
  }

  return { allowed: false, reason: "route_not_mounted_for_app" };
}

function pathParamName(segment: string): string | null {
  if (segment.startsWith(":") && segment.length > 1) return segment.slice(1);
  const match = segment.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  return match?.[1] ?? null;
}

function fillAppPath(path: string, params: RouteUrlOptions["params"] = {}): string {
  const [pathPart, queryPart] = path.split("?", 2);
  const resolved = pathPart.split("/").map((segment) => {
    const name = pathParamName(segment);
    const value = name ? params[name] : undefined;
    return name && value !== null && value !== undefined ? encodeURIComponent(String(value)) : segment;
  }).join("/");
  return queryPart ? `${resolved}?${queryPart}` : resolved;
}

function appOrigin(app: BetterPortalApp, override?: string): string {
  const raw = (override ?? app.hostnames[0] ?? "").replace(/\/+$/, "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function serviceOrigin(extraContext: RequiredHandlerContext, serviceId: string, override?: string): string | null {
  if (override) return appOrigin(extraContext.app, override);
  const service = extraContext.tenant.services.find((candidate) =>
    candidate.enabled && (candidate.id === serviceId || candidate.serviceId === serviceId)
  );
  return service ? service.hostname.replace(/\/+$/, "") : null;
}

function appendQuery(path: string, query: RouteUrlOptions["query"] = {}, absoluteOrigin?: string): string {
  const url = new URL(path, absoluteOrigin ?? "http://bp.local");
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return absoluteOrigin ? url.toString() : `${url.pathname}${url.search}`;
}

function createServiceRouteUrlBuilder(routes: ReadonlyArray<RegisteredRoute>, extraContext: RequiredHandlerContext, currentServiceId?: string): RouteHandlerContext["routeUrl"] {
  return (viewId, options = {}) => {
    const targetServiceId = options.serviceId ?? currentServiceId;
    const route = routes.find((candidate) => candidate.viewId === viewId);
    if (!route) return null;
    const origin = options.absolute && targetServiceId ? serviceOrigin(extraContext, targetServiceId, options.origin) : undefined;
    if (options.absolute && !origin) return null;
    return appendQuery(fillAppPath(route.path, options.params), options.query, origin ?? undefined);
  };
}

const BP_ROUTE_TOKEN_ATTRS = ["href", "action", "hx-get", "hx-post", "hx-put", "hx-patch", "hx-delete", "hx-download"] as const;

function rewriteServiceRouteTokens(
  html: string,
  routeUrl: RouteHandlerContext["routeUrl"],
  obs?: BetterPortalObservability
): string {
  let rewritten = html;
  for (const attr of BP_ROUTE_TOKEN_ATTRS) {
    const attrRe = new RegExp(`\\b${attr}=([\"'])\\{([A-Za-z0-9_$.-]+)\\}\\1`, "g");
    rewritten = rewritten.replace(attrRe, (match, quote: string, viewId: string) => {
      const resolved = routeUrl?.(viewId);
      if (!resolved) {
        obs?.logger.warn("BP route token unresolved: attr={attr} viewId={viewId}", { attr, viewId });
        return match;
      }
      return `${attr}=${quote}${resolved}${quote}`;
    });
  }
  return rewritten;
}

function createUiRouteUrlBuilder(extraContext: RequiredHandlerContext, currentServiceId?: string): RouteHandlerContext["uiRouteUrl"] {
  return (viewId, options = {}) => {
    const targetServiceId = options.serviceId ?? currentServiceId;
    if (!targetServiceId) return null;

    const serviceIds = new Set<string>([targetServiceId]);
    for (const service of extraContext.tenant.services) {
      if (service.enabled && (service.id === targetServiceId || service.serviceId === targetServiceId)) {
        serviceIds.add(service.id);
      }
    }

    const route = extraContext.app.routes.find((candidate) =>
      candidate.enabled !== false
      && candidate.viewId === viewId
      && serviceIds.has(candidate.serviceId)
    );
    if (!route) return null;

    return appendQuery(fillAppPath(route.path, options.params), options.query, options.absolute ? appOrigin(extraContext.app, options.origin) : undefined);
  };
}

function rejectUnallowedAppRoute(
  obs: BetterPortalObservability | undefined,
  route: RegisteredRoute,
  method: HttpMethod,
  extraContext: RequiredHandlerContext,
  reason: string
): Response {
  obs?.logger.warn("BP route rejected by app allowlist: tenant={tenantId} app={appId} route={viewId} method={method} reason={reason}", {
    tenantId: extraContext.tenant.id,
    appId: extraContext.app.id,
    viewId: route.viewId,
    method,
    reason,
    "bp.route.view_id": route.viewId,
    "bp.route.path": route.path,
    "bp.app.id": extraContext.app.id,
    "bp.tenant.id": extraContext.tenant.id,
    "bp.route_allowlist.reason": reason
  });
  return jsonResponse({ error: "Route not found" }, 404);
}

async function withRequestObservability<T>(
  event: BetterPortalEvent,
  route: RegisteredRoute,
  method: HttpMethod,
  options: H3RouterObservabilityOptions,
  handler: (obs?: BetterPortalObservability) => Promise<T> | T,
  extraAttributes: ObservabilityAttributes = {}
): Promise<T> {
  const startedAt = performance.now();
  const eventObs = eventObservability(event);
  const ownsObs = !eventObs;
  const obs = eventObs ?? options.createRequestObservability?.(
    "bp.http.request",
    requestAttributes(event, route, method, extraAttributes)
  );

  try {
    const result = await handler(obs);
    if (obs && ownsObs) {
      const status = responseStatus(event, result);
      const durationMs = performance.now() - startedAt;
      logRequest(obs, route, method, status, durationMs);
      obs.end({
        "http.response.status_code": status,
        "duration.ms": roundedDuration(durationMs)
      });
    }
    return result;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    if (obs) {
      const durationMs = performance.now() - startedAt;
      obs.error(normalizedError, { "error.name": normalizedError.name });
      if (ownsObs) {
        logRequest(obs, route, method, event.res.status || 500, durationMs);
        obs.end({
          "http.response.status_code": event.res.status || 500,
          "duration.ms": roundedDuration(durationMs)
        });
      }
    }
    throw error;
  }
}

async function withSpan<T>(
  obs: BetterPortalObservability | undefined,
  name: string,
  attributes: ObservabilityAttributes,
  handler: () => Promise<T> | T
): Promise<T> {
  if (!obs) return handler();
  const startedAt = performance.now();
  const span = obs.startSpan(name, attributes);
  try {
    const result = await handler();
    span.end({ "duration.ms": roundedDuration(performance.now() - startedAt) });
    return result;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    span.error(normalizedError, { "error.name": normalizedError.name });
    span.end({ "duration.ms": roundedDuration(performance.now() - startedAt) });
    throw error;
  }
}

async function handleRouteRequest(
  registryRoutes: ReadonlyArray<RegisteredRoute>,
  route: RegisteredRoute,
  method: HttpMethod,
  event: BetterPortalEvent,
  obs?: BetterPortalObservability,
  routerOptions: H3RouterObservabilityOptions = {}
): Promise<Response> {
  const methodRoute = route.methodRoutes?.[method];
  const handler = methodRoute?.handler ?? route.handlers[method];
  const schemas = methodRoute?.schemas ?? route.schemas;
  if (!handler) {
    return jsonResponse({ error: `No handler for ${method} ${route.path}` }, 405);
  }

  // -- Parse inputs -------------------------------------------------

  const url = getRequestURL(event);
  const rawQuery = queryFromUrl(url);
  const rawHeaders = headersFromEvent(event);

  let rawBody: Record<string, unknown> = {};
  let rawMultipart: MultipartRequest | undefined;
  if (METHOD_WRITE_BODY.has(method)) {
    const contentType = (event.req.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // Standard HTML form submission (incl. plain hx-post). Parse into a flat object.
      try {
        const fd = await event.req.formData();
        const parsedForm = await formDataToRequest(fd);
        rawBody = parsedForm.body;
        rawMultipart = parsedForm.multipart;
      } catch (err) {
        if (err instanceof MultipartTooLargeError) {
          return jsonResponse({ error: "Multipart payload too large" }, 413);
        }
        rawBody = {};
      }
    } else {
      const parsed = await event.req.json().catch(() => null);
      rawBody = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        ? parsed as Record<string, unknown>
        : {};
    }
  }

  // -- Validate against schemas -------------------------------------
  // RequestSchema is only enforced for methods that carry a body. GET/DELETE/OPTIONS
  // pass rawBody (empty {}) through unparsed so routes with both GET + POST handlers
  // don't fail GET because POST's RequestSchema has required fields.

  const query = schemas.query ? schemas.query.parse(rawQuery) : rawQuery;
  const headers = schemas.headers ? schemas.headers.parse(rawHeaders) : rawHeaders;
  const request = (schemas.request && METHOD_WRITE_BODY.has(method))
    ? schemas.request.parse(rawBody)
    : rawBody;
  const multipart = schemas.multipart
    ? schemas.multipart.parse(rawMultipart ?? { fields: {}, files: {} })
    : undefined;

  // Path params - H3 populates event.context.params for `:paramName` routes
  const params: Record<string, string> = (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};

  const extraContext = await resolveRequiredHandlerContext(event, routerOptions);
  if (!extraContext) {
    return jsonResponse({ error: "BetterPortal tenant/app context required" }, 400);
  }

  const routeAllowlistAcceptHeader = acceptHeaderFromEvent(event);
  const routeAllowance = appAllowsRoute(extraContext.app, route, method, url, routeAllowlistAcceptHeader);
  if (!routeAllowance.allowed) {
    return rejectUnallowedAppRoute(obs, route, method, extraContext, routeAllowance.reason ?? "route_not_mounted_for_app");
  }

  // -- Auth resolution (per spec section 0.5) ----------------------

  const apiAuth: ApiAuthRequirement = route.auth;
  const authResolved = await loadAuthContext(event, routerOptions, obs);
  const authResult = await resolveRequestAuth(apiAuth, event, authResolved, obs);
  if (authResult.error) {
    return renderAuthError(route, event, authResult.status, authResult.error);
  }

  // -- Tenant/app activation check (validateTenantApp hook -> 426) -----

  const tenantApp = readTenantAppFromEvent(event);
  if (tenantApp && routerOptions.validateTenantApp) {
    try {
      const validation = await routerOptions.validateTenantApp(tenantApp.tenantId, tenantApp.appId);
      if (!validation.allowed) {
        obs?.logger.warn("Tenant-app validation rejected: tenant={tenantId} app={appId} reason={reason}", {
          tenantId: tenantApp.tenantId,
          appId: tenantApp.appId,
          reason: validation.reason ?? "(unspecified)"
        });
        return renderUpgradeRequired(route, event, validation);
      }
    } catch (err) {
      obs?.logger.warn("validateTenantApp threw: {msg}", { msg: (err as Error).message });
      // Fail-open: validation error treated as block.
      return renderUpgradeRequired(route, event, {
        allowed: false,
        reason: "Tenant-app validation error"
      });
    }
  }

  // -- Build context and invoke handler -----------------------------

  const bpHeaders = createBpHeadersCollector();
  const ctx: RouteHandlerContext = {
    params,
    query: query as Record<string, unknown>,
    headers: headers as Record<string, string>,
    request: request as Record<string, unknown>,
    multipart: multipart as MultipartRequest | undefined,
    method,
    path: url.pathname,
    rawEvent: event,
    user: authResult.user,
    ...extraContext,
    bpHeaders,
    responseHeaders: event.res.headers,
    setStatus: (status) => { event.res.status = status; },
    serviceId: routerOptions.serviceId,
    routeUrl: createServiceRouteUrlBuilder(registryRoutes, extraContext, routerOptions.serviceId),
    uiRouteUrl: createUiRouteUrlBuilder(extraContext, routerOptions.serviceId),
    response: responseHelper,
    file: fileResponseHelper,
    ...(obs ? { obs } : {})
  };

  let rawData: unknown;
  if (isStreamHandler(handler)) {
    // Streamed representations (NDJSON, themed streaming shell) respond
    // directly; buffered representations fall through to the standard
    // negotiation over the derived { items, summary? } shape.
    const streamed = await handleStreamRepresentation(route, handler, ctx, event, url, method, obs);
    if (streamed) {
      applyBpHeadersToEvent(event, bpHeaders);
      return streamed;
    }
    rawData = await withSpan(obs, "bp.route.handler", {
      "bp.route.view_id": route.viewId,
      "bp.route.path": route.path,
      "http.request.method": method,
      "bp.route.stream_buffered": true
    }, () => driveStreamBuffered(handler, ctx));
  } else {
    rawData = await withSpan(obs, "bp.route.handler", {
      "bp.route.view_id": route.viewId,
      "bp.route.path": route.path,
      "http.request.method": method
    }, () => (handler as RouteHandler)(ctx));
  }

  // -- Emit BP-managed headers -------------------------------------

  applyBpHeadersToEvent(event, bpHeaders);

  if (rawData instanceof Response) {
    return rawData;
  }

  // -- Status decision ---------------------------------------------

  const handlerStatus = event.res.status && event.res.status !== 0 ? event.res.status : 200;

  // -- Content negotiation ------------------------------------------

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

  // For non-success status codes that forbid a body, return empty.
  if (statusForbidsBody(handlerStatus)) {
    return new Response(null, { status: handlerStatus });
  }

  // -- Validate response against schema (all representations) ------
  // Skipped when status indicates no body is expected.
  if (!schemas.response) {
    return jsonResponse({ error: `Route "${route.viewId}" has no ResponseSchema and did not return a raw Response` }, 500);
  }
  const data = schemas.response.parse(rawData);

  // NDJSON only exists for streaming views; those were handled before
  // negotiation, so reaching here means the view does not stream.
  if (representation.kind === "ndjson") {
    logNegotiationFailure(obs, route, method, "ndjson_not_streaming", {
      "http.request.accept": acceptHeader ?? "",
      "bp.representation.kind": representation.kind
    });
    return jsonResponse({ error: "NDJSON streaming is not supported by this view" }, 406);
  }

  // JSON - already validated above, no redundant parse
  if (representation.kind === "json") {
    return jsonResponse(data as JsonValue, handlerStatus);
  }

  // HTML - resolve theme from request context (hostname -> app config), Accept header as fallback
  const themeId =
    (event as unknown as { __bpThemeId?: string }).__bpThemeId
    ?? representation.theme;
  if (!themeId) {
    logNegotiationFailure(obs, route, method, "theme_not_resolved", {
      "http.request.accept": acceptHeader ?? "",
      "bp.representation.kind": representation.kind
    });
    return jsonResponse({ error: "Theme could not be resolved from app config or request" }, 406);
  }

  // Determine the renderer kind requested
  const fragmentKey = url.searchParams.get("_f") ?? fragmentFromAcceptHeader(acceptHeader);
  const componentId = url.searchParams.get("_c");
  const requestedKind: "page" | "component" | "fragment" =
    fragmentKey ? "fragment" : componentId ? "component" : "page";
  const requestedKey = fragmentKey ?? componentId ?? undefined;

  // Status-specific renderer lookup (any non-undefined status code)
  if (handlerStatus !== 200) {
    const statusRenderer = resolveStatusRenderer(route, themeId, handlerStatus, requestedKind, requestedKey, method);
    if (statusRenderer) {
      const html = await withSpan(obs, "bp.view.render", {
        "bp.route.view_id": route.viewId,
        "bp.view.theme_id": themeId,
        "bp.view.kind": requestedKind,
        "bp.view.status": handlerStatus
      }, () => statusRenderer.render(data));
      return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType(themeId, "status", route.chrome));
    }
    // No specific renderer found.
    if (!shouldFallThroughToDefaultRenderer(handlerStatus)) {
      // 4xx/5xx without a specific renderer -> empty body with status.
      return new Response(null, { status: handlerStatus });
    }
    // 2xx without specific -> fall through to default renderer, but keep handlerStatus.
  }

  // Fragment request via `_f` query param or Accept header
  if (fragmentKey) {
    const resolved = resolveRenderer(route, themeId, "fragment", method, undefined, fragmentKey);
    if (!resolved) {
      logNegotiationFailure(obs, route, method, "fragment_renderer_not_found", {
        "http.request.accept": acceptHeader ?? "",
        "bp.view.theme_id": themeId,
        "bp.view.kind": "fragment",
        "bp.view.key": fragmentKey
      });
      return jsonResponse({
        error: `No fragment renderer found for fragment="${fragmentKey}" in theme "${themeId}"`
      }, 406);
    }

    const html = await withSpan(obs, "bp.view.render", {
      "bp.route.view_id": route.viewId,
      "bp.view.theme_id": themeId,
      "bp.view.kind": "fragment",
      "bp.view.key": fragmentKey
    }, () => resolved.renderer.render(data));
    return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType(themeId, "fragment", route.chrome));
  }

  // Component request via `_c` query param
  if (componentId) {
    const resolved = resolveRenderer(route, themeId, "component", method, componentId);
    if (!resolved) {
      logNegotiationFailure(obs, route, method, "component_renderer_not_found", {
        "http.request.accept": acceptHeader ?? "",
        "bp.view.theme_id": themeId,
        "bp.view.kind": "component",
        "bp.view.key": componentId
      });
      return jsonResponse({
        error: `No component renderer found for _c="${componentId}" in theme "${themeId}"`
      }, 406);
    }

    const html = await withSpan(obs, "bp.view.render", {
      "bp.route.view_id": route.viewId,
      "bp.view.theme_id": themeId,
      "bp.view.kind": "component",
      "bp.view.key": componentId
    }, () => resolved.renderer.render(data));
    return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType(themeId, "fragment", route.chrome));
  }

  // Page request - only page renderers allowed
  const resolved = resolveRenderer(route, themeId, "page", method);
  if (!resolved) {
    logNegotiationFailure(obs, route, method, "page_renderer_not_found", {
      "http.request.accept": acceptHeader ?? "",
      "bp.view.theme_id": themeId,
      "bp.view.kind": "page"
    });
    return jsonResponse({
      error: `No page renderer found for theme "${themeId}"`
    }, 406);
  }

  const html = await withSpan(obs, "bp.view.render", {
    "bp.route.view_id": route.viewId,
    "bp.view.theme_id": themeId,
    "bp.view.kind": "page"
  }, () => resolved.renderer.render(data));
  const mode = representation.mode ?? "page";
  return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType(themeId, mode, route.chrome));
}

// -- Streaming routes (spec/streaming.md) ----------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStreamHandler = BpStreamHandler<any, any, any, any, any>;

/**
 * Handle representations that stream, returning null for buffered ones so the
 * caller falls through to standard negotiation over `{ items, summary? }`.
 */
async function handleStreamRepresentation(
  route: RegisteredRoute,
  handler: AnyStreamHandler,
  ctx: RouteHandlerContext,
  event: BetterPortalEvent,
  url: URL,
  method: HttpMethod,
  obs?: BetterPortalObservability
): Promise<Response | null> {
  const acceptHeader = acceptHeaderFromEvent(event);
  const representation = resolveRequestedRepresentation(acceptHeader);

  if (representation.kind === "ndjson") {
    return ndjsonStreamResponse(handler, ctx);
  }

  if (representation.kind !== "html") return null;

  // Fragment/component selectors render over the buffered data set.
  if (url.searchParams.get("_f") || url.searchParams.get("_c")) return null;

  const themeId =
    (event as unknown as { __bpThemeId?: string }).__bpThemeId
    ?? representation.theme;
  if (!themeId) return null;

  const streamSet = route.themeRenderers[themeId]?.stream;
  if (!streamSet) return null;

  // Full-page request with a page renderer available -> buffered render of the
  // complete data set (crawlers, no-SSE clients). Fragment swaps stream.
  if (representation.mode === "page" && resolveRenderer(route, themeId, "page", method)) {
    return null;
  }

  const shellCtx: StreamShellContext = {
    sseConnectPath: `${url.pathname}/__sse${url.search}`,
    params: ctx.params,
    query: ctx.query
  };
  const html = await withSpan(obs, "bp.view.render", {
    "bp.route.view_id": route.viewId,
    "bp.view.theme_id": themeId,
    "bp.view.kind": "stream-shell"
  }, () => streamSet.renderShell(shellCtx));
  return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), 200, htmlContentType(themeId, "fragment", route.chrome));
}

/**
 * SSE delivery of the frame stream at `{path}/__sse`. With a theme context and
 * stream renderers, event payloads are server-rendered HTML; otherwise frame
 * JSON (spec/streaming.md section 2.3, section 4.1). Runs the generator itself - no stream
 * state is shared with the shell request.
 */
async function handleStreamSse(
  registryRoutes: ReadonlyArray<RegisteredRoute>,
  route: RegisteredRoute,
  handler: AnyStreamHandler,
  event: BetterPortalEvent,
  obs: BetterPortalObservability | undefined,
  routerOptions: H3RouterObservabilityOptions
): Promise<Response | BodyInit> {
  const url = getRequestURL(event);
  const rawQuery = queryFromUrl(url);
  const sseSchemas = route.methodRoutes?.GET?.schemas ?? route.schemas;
  const query = sseSchemas.query ? sseSchemas.query.parse(rawQuery) : rawQuery;
  const params: Record<string, string> =
    (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};

  // The frame stream carries the same data as the view route - enforce the
  // same auth requirement.
  const authResolved = await loadAuthContext(event, routerOptions, obs);
  const authResult = await resolveRequestAuth(route.auth, event, authResolved, obs);
  if (authResult.error) {
    return jsonResponse({ error: authResult.error, status: authResult.status } as unknown as JsonValue, authResult.status);
  }

  const extraContext = await resolveRequiredHandlerContext(event, routerOptions);
  if (!extraContext) {
    return jsonResponse({ error: "BetterPortal tenant/app context required" }, 400);
  }

  const ctx: RouteHandlerContext = {
    params,
    query: query as Record<string, unknown>,
    headers: headersFromEvent(event),
    request: {},
    method: "GET",
    path: url.pathname,
    rawEvent: event,
    user: authResult.user,
    ...extraContext,
    serviceId: routerOptions.serviceId,
    routeUrl: createServiceRouteUrlBuilder(registryRoutes, extraContext, routerOptions.serviceId),
    uiRouteUrl: createUiRouteUrlBuilder(extraContext, routerOptions.serviceId),
    response: responseHelper,
    file: fileResponseHelper,
    ...(obs ? { obs } : {})
  };

  const themeId =
    (event as unknown as { __bpThemeId?: string }).__bpThemeId
    ?? (rawQuery._theme as string | undefined);
  const streamSet = themeId ? route.themeRenderers[themeId]?.stream : undefined;

  const stream = createEventStream(event);

  (async () => {
    try {
      await driveStream(handler, ctx, {
        onItem: async (item) => {
          await stream.push({
            event: "item",
            data: streamSet
              ? rewriteServiceRouteTokens(toHtmlString(streamSet.renderItem(item)), ctx.routeUrl, obs)
              : JSON.stringify({ kind: "item", data: item })
          });
        },
        onSummary: async (summary) => {
          if (streamSet && !streamSet.renderSummary) return;
          await stream.push({
            event: "summary",
            data: streamSet?.renderSummary
              ? rewriteServiceRouteTokens(toHtmlString(streamSet.renderSummary(summary)), ctx.routeUrl, obs)
              : JSON.stringify({ kind: "summary", data: summary })
          });
        },
        onError: async (frame) => {
          await stream.push({
            event: "error",
            data: streamSet?.renderError
              ? rewriteServiceRouteTokens(toHtmlString(streamSet.renderError(frame)), ctx.routeUrl, obs)
              : JSON.stringify(frame)
          });
        },
        onEnd: async (count) => {
          await stream.push({
            event: "end",
            data: streamSet ? "" : JSON.stringify({ kind: "end", count })
          });
        }
      });
    } catch (error) {
      // client disconnected mid-stream or push failed - nothing left to report
      obs?.logger.warn("BP stream SSE aborted: {msg}", { msg: (error as Error).message });
    }
    await stream.close().catch(() => {});
  })();

  return stream.send();
}

// -- Auth resolver ----------------------------------------------------

interface AuthResult {
  user?: ValidatedUserClaims;
  error?: string;
  status: number;
}

async function loadAuthContext(
  event: BetterPortalEvent,
  routerOptions: H3RouterObservabilityOptions,
  obs?: BetterPortalObservability
): Promise<H3AuthContext | undefined> {
  try {
    return await routerOptions.resolveAuth?.(event);
  } catch (err) {
    obs?.logger.warn("Auth resolver threw: {msg}", { msg: (err as Error).message });
    return undefined;
  }
}

/**
 * Resolve authentication and authorization per spec section 0.5.
 * Returns either a validated user (or undefined for anonymous) or an error.
 */
async function resolveRequestAuth(
  apiAuth: ApiAuthRequirement,
  event: BetterPortalEvent,
  authContext: H3AuthContext | undefined,
  obs?: BetterPortalObservability
): Promise<AuthResult> {
  const required = apiAuth.required;
  const authHeader = event.req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Step 1: no token
  if (!bearer) {
    if (required) return { status: 401, error: "Authentication required" };
    return { status: 200 };
  }

  if (!authContext) {
    if (required) return { status: 503, error: "Auth context unavailable" };
    return { status: 200 };
  }

  // Step 2-4: verify JWT (signature + double-verify happens inside verifier)
  let claims: JwtClaims;
  try {
    claims = await withSpan(obs, "bp.auth.verify_token", {
      "bp.auth.required": required,
      "bp.auth.tenant_id": authContext.tenantId,
      "bp.auth.app_id": authContext.appId
    }, () => authContext.verifier.verify(bearer, {
      tenantId: authContext.tenantId,
      appId: authContext.appId
    }));
  } catch (err) {
    obs?.logger.warn("JWT verification failed: {msg}", { msg: (err as Error).message });
    if (required) return { status: 401, error: "Invalid token" };
    return { status: 200 };
  }

  // Step 5: tenant binding
  if (claims.tenantId !== authContext.tenantId) {
    obs?.logger.warn("JWT tenantId mismatch: token={t1} request={t2}", {
      t1: claims.tenantId,
      t2: authContext.tenantId
    });
    if (required) return { status: 401, error: "Token bound to a different tenant" };
    return { status: 200 };
  }

  // Step 6: app binding
  if (claims.appId !== authContext.appId) {
    obs?.logger.warn("JWT appId mismatch: token={a1} request={a2}", {
      a1: claims.appId,
      a2: authContext.appId
    });
    if (required) return { status: 401, error: "Token bound to a different app" };
    return { status: 200 };
  }

  // Step 7: permission check against app.auth.roles
  if (apiAuth.permissions.length > 0) {
    const granted = expandRolesToPermissions(claims.roles, authContext.appAuthConfig);
    // Grants reference tenant service-instance ids; route requirements are
    // authored against pluginIds. Treat them as equal via the alias map.
    const aliases = authContext.serviceIdAliases ?? {};
    const serviceIdsMatch = (grantServiceId: string, requiredServiceId: string): boolean =>
      grantServiceId === requiredServiceId ||
      aliases[grantServiceId] === requiredServiceId ||
      aliases[requiredServiceId] === grantServiceId;
    const ok = apiAuth.permissions.every((requirement) =>
      requirement.permissions.every((action) =>
        granted.some((grant) =>
          serviceIdsMatch(grant.serviceId, requirement.serviceId) &&
          grant.viewId === requirement.viewId &&
          grant.permissions.includes(action)
        )
      )
    );
    if (!ok) {
      if (required) return { status: 403, error: "Insufficient permissions" };
      return { status: 200 };
    }
  }

  // Step 8: attach validated claims
  return { status: 200, user: claims };
}

function expandRolesToPermissions(
  roleIds: ReadonlyArray<string>,
  appAuthConfig?: AppAuthConfig
): ReadonlyArray<{ serviceId: string; viewId: string; permissions: ReadonlyArray<string> }> {
  if (!appAuthConfig) return [];
  const grants: { serviceId: string; viewId: string; permissions: string[] }[] = [];
  for (const role of appAuthConfig.roles) {
    if (!roleIds.includes(role.id)) continue;
    for (const grant of role.permissions) {
      grants.push({
        serviceId: grant.serviceId,
        viewId: grant.viewId,
        permissions: [...grant.permissions]
      });
    }
  }
  return grants;
}

function corsHeadersFromEvent(event: BetterPortalEvent): Record<string, string> {
  const out: Record<string, string> = {};
  const ev = event as unknown as { res?: { headers?: { get?: (n: string) => string | null; forEach?: (cb: (v: string, n: string) => void) => void } } };
  const headers = ev.res?.headers;
  if (!headers) return out;
  if (typeof headers.forEach === "function") {
    headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith("access-control-") || name.toLowerCase() === "vary") {
        out[name] = value;
      }
    });
  }
  return out;
}

function renderAuthError(
  route: RegisteredRoute,
  event: BetterPortalEvent,
  status: number,
  message: string
): Response {
  const themeId = (event as unknown as { __bpThemeId?: string }).__bpThemeId;
  const acceptHeader = acceptHeaderFromEvent(event);
  const representation = resolveRequestedRepresentation(acceptHeader);
  const corsHeaders = corsHeadersFromEvent(event);

  // Auth errors NEVER emit navigation headers (HX-Location / HX-Redirect). A
  // service has no reliable knowledge of where the auth provider lives - it only
  // knows the JWKS for token *validation*, not a URL the browser should navigate
  // to - and letting it drive a whole-page redirect corrupts the host shell.
  // Login routing belongs to the theme, which resolves the auth service URL from
  // app.auth config and redirects on seeing this 401. Services just report status.

  // Prefer a route/theme status view so the body swaps cleanly into the htmx
  // target as a fragment rather than replacing the shell.
  if (themeId && (representation.kind === "html")) {
    const statusRenderer = resolveStatusRenderer(route, themeId, status, "page", undefined, "GET");
    if (statusRenderer) {
      try {
        const html = statusRenderer.render({ error: message, status });
        return new Response(toHtmlString(html), {
          status,
          headers: { ...corsHeaders, "content-type": htmlContentType(themeId, "status", route.chrome) }
        });
      } catch {
        // fall through to JSON
      }
    }
  }

  return jsonResponse({ error: message, status } as unknown as JsonValue, status, corsHeaders);
}

function readTenantAppFromEvent(event: BetterPortalEvent): { tenantId: string; appId: string } | undefined {
  const ctx = event as unknown as { __bpTenantId?: string; __bpAppId?: string };
  if (!ctx.__bpTenantId || !ctx.__bpAppId) return undefined;
  return { tenantId: ctx.__bpTenantId, appId: ctx.__bpAppId };
}

function renderUpgradeRequired(
  route: RegisteredRoute,
  event: BetterPortalEvent,
  validation: import("../contracts/auth.js").TenantAppValidation
): Response {
  const themeId = (event as unknown as { __bpThemeId?: string }).__bpThemeId;
  const acceptHeader = acceptHeaderFromEvent(event);
  const representation = resolveRequestedRepresentation(acceptHeader);
  const status = 426;

  // Honor Retry-After if requested
  const extraHeaders: Record<string, string> = {};
  if (validation.retryAfterSeconds) {
    extraHeaders["retry-after"] = String(validation.retryAfterSeconds);
  }

  if (themeId && representation.kind === "html") {
    const statusRenderer = resolveStatusRenderer(route, themeId, status, "page", undefined, "GET");
    if (statusRenderer) {
      try {
        const html = statusRenderer.render({
          status,
          reason: validation.reason,
          upgradeUrl: validation.upgradeUrl
        });
        return htmlResponse(toHtmlString(html), status, htmlContentType(themeId, "status", route.chrome));
      } catch {
        // fall through to JSON
      }
    }
  }

  return jsonResponse({
    status,
    error: "Upgrade Required",
    reason: validation.reason,
    upgradeUrl: validation.upgradeUrl
  } as unknown as JsonValue, status, extraHeaders);
}

function applyBpHeadersToEvent(
  event: BetterPortalEvent,
  collector: ReturnType<typeof createBpHeadersCollector>
): void {
  const { setHeaders, removeHeaders } = collector.emit();
  for (const directive of setHeaders) {
    event.res.headers.append("BP-SetHeader", directive);
  }
  for (const name of removeHeaders) {
    event.res.headers.append("BP-RemoveHeader", name);
  }
}

// -- Well-known routes ------------------------------------------------

/**
 * Register BetterPortal well-known discovery and health endpoints.
 */
export function registerBpWellKnownRoutes(
  app: BetterPortalH3App,
  manifest: PluginManifest,
  bpSchema: BpSchemaOutput,
  options: {
    health?: () => Response | JsonValue;
  } = {}
): void {
  app.get("/.well-known/bp/schema.json", () => {
    return jsonResponse(bpSchema as unknown as JsonValue);
  });

  app.get("/.well-known/bp/health", () => {
    const health = options.health?.();
    if (health instanceof Response) return health;
    if (health !== undefined) return jsonResponse(health);
    return jsonResponse({ ok: true, pluginId: manifest.pluginId });
  });

  app.get("/.well-known/bp/manifest", () => {
    return jsonResponse(manifest as unknown as JsonValue);
  });
}
