import { createEventStream, getRequestIP, getRequestURL } from "h3";
import type { HttpMethod } from "../contracts/common.js";
import type { JsonValue } from "../contracts/json.js";
import type { BpSchemaOutput, PluginManifest } from "../contracts/manifest.js";
import type { BetterPortalObservability, ObservabilityAttributes } from "../contracts/observability.js";
import type { BPElementReference, BetterPortalRegistry, RegisteredRoute, RouteUiAttributes, RouteUiOptions, ViewRenderContext } from "../contracts/registry.js";
import type {
  ApiAuthRequirement,
  FileResponseOptions,
  JwtVerifier,
  MultipartRequest,
  RawResponseBody,
  RouteHandler,
  RouteHandlerContext,
  ServiceTokenVerifier,
  UploadedFile,
  ValidatedServiceClaims,
  ValidatedUserClaims
} from "../contracts/route.js";
import type { BetterPortalApp, BetterPortalRouteChrome } from "../contracts/platformConfig.js";
import { isStreamHandler, type BpStreamHandler, type StreamShellContext } from "../contracts/streaming.js";
import { driveStream, driveStreamBuffered, ndjsonStreamResponse } from "../runtime/stream.js";
import type { AppAuthConfig, JwtClaims } from "../contracts/auth.js";
import type { ApiCallerMode } from "../contracts/m2m.js";
import {
  acceptHeaderFromEvent,
  annotateCoreHttpOutcome,
  annotateHttpOutcome,
  ensureCoreHttpOutcome,
  eventObservability,
  htmlResponse,
  jsonResponse,
  withCoreHttpOutcome,
  type BetterPortalEvent,
  type BetterPortalH3App
} from "../runtime/h3.js";
import { buildHostCandidates, hostFromHeaderValue, toHtmlString } from "../runtime/http.js";
import { parseAcceptHeader, resolveRequestedRepresentation } from "../runtime/media.js";
import { resolveRenderer } from "../runtime/registry.js";
import { createBpHeadersCollector } from "../runtime/bpHeaders.js";
import { isServiceToken } from "../runtime/auth/serviceToken.js";
import {
  resolveStatusRenderer,
  shouldFallThroughToDefaultRenderer,
  statusForbidsBody
} from "../runtime/statusViews.js";

// -- Helpers ----------------------------------------------------------

type MethodRegistrar = (path: string, handler: (event: BetterPortalEvent) => Response | Promise<Response>) => void;

const METHOD_WRITE_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"]);
const MAX_BUFFERED_MULTIPART_BYTES = 25 * 1024 * 1024;
const PLATFORM_ROOT_PERMISSION_ROLE_ID = "*";

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
  resolveAuth?: (event: BetterPortalEvent, route: RegisteredRoute) => Promise<H3AuthContext | undefined> | H3AuthContext | undefined;
  /**
   * Validate that the resolved (tenantId, appId) is allowed to use this service.
   * Returning { allowed: false } emits 426 Upgrade Required with optional upgradeUrl.
   * Called for every request after tenant/app context is resolved.
   */
  validateTenantApp?: (tenantId: string, appId: string) => Promise<import("../contracts/auth.js").TenantAppValidation> | import("../contracts/auth.js").TenantAppValidation;
  /** Extra per-request context supplied by the host service/plugin. */
  resolveContext?: (event: BetterPortalEvent, route: RegisteredRoute) => Promise<Partial<RouteHandlerContext>> | Partial<RouteHandlerContext>;
}

type RequiredHandlerContext =
  Omit<Partial<RouteHandlerContext>, "response" | "file">
  & Pick<RouteHandlerContext, "tenant" | "app">;
type RouteUrlOptions = NonNullable<RouteHandlerContext["routeUrl"]> extends (viewId: string, options?: infer T) => unknown ? T : never;
type ViewRenderContextSource = Pick<RouteHandlerContext, "tenant" | "app" | "method" | "path" | "params" | "query" | "routeUrl" | "uiRouteUrl">;

export interface H3AuthContext {
  readonly verifier?: JwtVerifier;
  readonly serviceVerifier?: ServiceTokenVerifier;
  readonly tenantId: string;
  readonly appId: string;
  readonly appAuthConfig?: AppAuthConfig;
  /**
   * Service-id alias map: tenant service-instance id (UUIDv7) -> pluginId.
   * Role grants in app.auth reference instance ids; route auth requirements
   * are authored against pluginIds. The permission check accepts either.
   */
  readonly serviceIdAliases?: Readonly<Record<string, string>>;
  readonly platformRoot?: {
    readonly tenantId?: string;
    readonly appId?: string;
  };
}

interface RequiredPermissionDescriptor {
  readonly serviceId: string;
  readonly viewId: string;
  readonly permissions: ReadonlyArray<string>;
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

function parseRouteParams(
  rawParams: Record<string, string>,
  schema: RegisteredRoute["schemas"]["params"]
): Record<string, string> | Response {
  for (const [name, value] of Object.entries(rawParams)) {
    if (!value || value.length > 100) {
      return coreJsonResponse(
        { error: `Invalid path parameter: ${name}` },
        400,
        "request.params.invalid",
        `Invalid path parameter: ${name}`,
        { "bp.request.parameter": name }
      );
    }
  }
  if (!schema) return rawParams;
  try {
    return schema.parse(rawParams) as Record<string, string>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return coreJsonResponse({
      error: "Invalid path parameters",
      detail: reason
    }, 400, "request.params.invalid", reason);
  }
}

function escapeContentDispositionValue(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}

function responseHelper(body: RawResponseBody = null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

function coreResponse(
  response: Response,
  code: string,
  reason: string,
  attributes?: ObservabilityAttributes
): Response {
  return withCoreHttpOutcome(response, { code, reason, attributes });
}

function coreJsonResponse(
  body: JsonValue,
  status: number,
  code: string,
  reason: string,
  attributes?: ObservabilityAttributes,
  headers?: HeadersInit
): Response {
  return coreResponse(jsonResponse(body, status, headers), code, reason, attributes);
}

function parseRequestValue<T>(
  schema: { parse(value: unknown): T },
  value: unknown,
  code: string,
  target: string
): { value: T } | { response: Response } {
  try {
    return { value: schema.parse(value) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      response: coreJsonResponse(
        { error: `Invalid ${target}`, detail: reason },
        400,
        code,
        reason,
        { "bp.request.validation_target": target }
      )
    };
  }
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
  routerOptions: H3RouterObservabilityOptions,
  route: RegisteredRoute
): Promise<RequiredHandlerContext | null> {
  const extraContext = await routerOptions.resolveContext?.(event, route) ?? {};
  return extraContext.tenant && extraContext.app
    ? extraContext as RequiredHandlerContext
    : null;
}

export function isBpManagementAuthRoute(route: RegisteredRoute): boolean {
  return route.auth.required && (
    route.path === "/.well-known/bp"
    || route.path.startsWith("/.well-known/bp/")
  );
}

export function isBpManagementAuthPath(routes: ReadonlyArray<RegisteredRoute>, pathname: string): boolean {
  return routes.some((route) => isBpManagementAuthRoute(route) && routePathsMatch(route.path, pathname));
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

function htmlContentType(mode: string, chrome?: BetterPortalRouteChrome): string {
  return `text/html; mode=${mode}${chromeContentTypeParams(chrome)}`;
}

function rendererFromEvent(event: BetterPortalEvent): string | undefined {
  return (event as unknown as { __bpApp?: { shell?: { renderer?: string } } }).__bpApp?.shell?.renderer;
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
        return withRequestObservability(event, route, method, options, (obs) =>
          handleRouteRequest(registry.routes, registry.dependencies ?? {}, route, method, event, obs, options)
        );
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
          (obs) => handleStreamSse(registry.routes, registry.dependencies ?? {}, route, streamGetHandler, event, obs, options),
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
        const rawParams: Record<string, string> =
          (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};
        const params = parseRouteParams(rawParams, route.schemas.params);
        if (params instanceof Response) return params;

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
          // Renderer identity comes only from the server-resolved app shell.
          const fragmentKey = (rawQuery._f as string | undefined) ?? undefined;
          let sseRender: ((data: unknown) => unknown) | undefined;
          if (fragmentKey) {
            const renderer = rendererFromEvent(event);

            if (renderer) {
              const resolved = resolveRenderer(route, renderer, "fragment", "GET", undefined, fragmentKey);
              if (resolved?.renderer.sseRender) {
                sseRender = resolved.renderer.sseRender as (data: unknown) => unknown;
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
    return segment === other || pathParamName(segment) !== null || pathParamName(other) !== null;
  });
}

function routeMountServicePath(routeMount: BetterPortalApp["routes"][number]): string | undefined {
  return routeMount.resolvedServicePath ?? routeMount.servicePathVariant ?? routeMount.targetPath;
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
  // Well-known routes are control-plane/service endpoints. Their access policy
  // is declared by the route and must not depend on being mounted as an app page.
  if (route.path.startsWith("/.well-known/")) return { allowed: true };

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
  return null;
}

function fillAppPath(path: string, params: RouteUrlOptions["params"] = {}): string | null {
  const [pathPart, queryPart] = path.split("?", 2);
  let unresolved = false;
  const resolved = pathPart.split("/").map((segment) => {
    const name = pathParamName(segment);
    const value = name ? params[name] : undefined;
    if (name && (value === null || value === undefined)) {
      unresolved = true;
      return "";
    }
    return name ? encodeURIComponent(String(value)) : segment;
  }).join("/");
  if (unresolved) return null;
  return queryPart ? `${resolved}?${queryPart}` : resolved;
}

function selectRegisteredRoute(
  routes: ReadonlyArray<RegisteredRoute>,
  viewId: string,
  params: RouteUrlOptions["params"] = {}
): RegisteredRoute | null {
  const matches = routes
    .filter((candidate) => candidate.viewId === viewId)
    .filter((candidate) => candidate.paramNames.every((name) => params[name] !== null && params[name] !== undefined))
    .sort((a, b) => b.paramNames.length - a.paramNames.length);
  return matches[0] ?? null;
}

function appOrigin(app: BetterPortalApp, override?: string): string {
  const raw = (override ?? app.hostnames[0] ?? "").replace(/\/+$/, "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function requestAppOrigin(app: BetterPortalApp, event: BetterPortalEvent): string | undefined {
  const headers = event.req.headers;
  for (const candidate of buildHostCandidates(headers, "theme")) {
    const hostname = app.hostnames.find((entry) => hostFromHeaderValue(entry) === candidate.host);
    if (hostname) return appOrigin(app, hostname);
  }
  return undefined;
}

function serviceOrigin(extraContext: RequiredHandlerContext, serviceId: string, override?: string): string | null {
  if (override) return appOrigin(extraContext.app, override);
  const service = extraContext.tenant.services.find((candidate) =>
    candidate.enabled && (candidate.id === serviceId || candidate.serviceId === serviceId)
  );
  return service ? service.hostname.replace(/\/+$/, "") : null;
}

function appendQuery(path: string, query: RouteUrlOptions["query"] = {}, absoluteOrigin?: string): string {
  const url = new URL(path, absoluteOrigin ?? "http://betterportal.invalid");
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return absoluteOrigin ? url.toString() : `${url.pathname}${url.search}`;
}

function renderUrl(path: string, options: RouteUrlOptions & { component?: string; fragment?: string } = {}): string {
  const query = { ...(options.query ?? {}) };
  if (options.component) query._c = options.component;
  if (options.fragment) query._f = options.fragment;
  return appendQuery(path, query, options.absolute ? options.origin : undefined);
}

function createRouteUiAttributes(url: string, options: RouteUiOptions = {}, form = false): RouteUiAttributes {
  const method = (options.method ?? "GET").toLowerCase();
  const methodAttr = `hx-${method}`;
  const attrs: Record<string, string> = form
    ? { action: url, method: (options.method ?? "GET") }
    : { href: url };
  attrs[methodAttr] = url;
  if (options.target) attrs["hx-target"] = options.target;
  if (options.swap) attrs["hx-swap"] = options.swap;
  if (options.push !== undefined) attrs["hx-push-url"] = String(options.push);
  return attrs;
}

function createElementResolver(
  extraContext: RequiredHandlerContext,
  dependencyAliases: Readonly<Record<string, string>>
): ViewRenderContext["element"] {
  return (reference: BPElementReference) => {
    if (!reference.fragment.trim()) return { unavailable: "fragment_required" };

    if (reference.service === "shell") {
      const shellServiceId = extraContext.app.shell?.serviceId;
      const origin = shellServiceId ? serviceOrigin(extraContext, shellServiceId) : null;
      if (!shellServiceId || !origin) return { unavailable: "shell_unavailable" };
      const path = `/.well-known/bp/shell/fragment/${encodeURIComponent(reference.fragment)}`;
      return { serviceId: shellServiceId, url: appendQuery(path, reference.args?.query, origin) };
    }

    if (!reference.path?.startsWith("/")) return { unavailable: "service_path_required" };
    const pluginId = dependencyAliases[reference.service] ?? reference.service;
    const serviceIds = new Set(extraContext.tenant.services
      .filter((service) => service.enabled && (service.serviceId === pluginId || service.id === pluginId))
      .map((service) => service.id));
    const mounts = appRouteIndex(extraContext.app).filter((mount) => {
      const servicePath = routeMountServicePath(mount);
      return mount.enabled !== false
        && serviceIds.has(mount.serviceId)
        && Boolean(servicePath)
        && routePathsMatch(servicePath!, reference.path!);
    });
    if (mounts.length !== 1) return { unavailable: mounts.length ? "ambiguous_provider" : "service_unavailable" };
    const mount = mounts[0];
    const origin = serviceOrigin(extraContext, mount.serviceId);
    if (!origin) return { unavailable: "service_unavailable" };
    const servicePath = fillAppPath(routeMountServicePath(mount)!, {
      ...mount.fixedParams,
      ...(reference.args?.params ?? {})
    });
    if (!servicePath) return { unavailable: "path_params_required" };
    return {
      serviceId: mount.serviceId,
      url: renderUrl(servicePath, { absolute: true, origin, query: reference.args?.query, fragment: reference.fragment })
    };
  };
}

function createViewRenderContext(
  route: RegisteredRoute,
  ctx: ViewRenderContextSource,
  dependencyAliases: Readonly<Record<string, string>>,
  renderer: string,
  mode: import("../contracts/common.js").RenderMode,
  kind: "page" | "fragment" | "component",
  key: string | undefined,
  status: number
): ViewRenderContext {
  const current = (options: RouteUrlOptions & { component?: string; fragment?: string } = {}) => renderUrl(ctx.path, options);
  const path = (value: string, options: RouteUrlOptions = {}) => renderUrl(value, options);
  const routeUrl = (viewId: string, options?: RouteUrlOptions) => ctx.routeUrl?.(viewId, options) ?? null;
  const uiRoute = (viewId: string, options?: RouteUrlOptions) => ctx.uiRouteUrl?.(viewId, options) ?? null;
  const ui = (url: string, options?: RouteUiOptions) => createRouteUiAttributes(url, options);
  const form = (url: string, options?: RouteUiOptions) => createRouteUiAttributes(url, options, true);
  return {
    tenant: {
      id: ctx.tenant.id,
      slug: ctx.tenant.slug,
      title: ctx.tenant.title,
      branding: { ...ctx.tenant.branding }
    },
    app: {
      id: ctx.app.id,
      tenantId: ctx.app.tenantId,
      slug: ctx.app.slug,
      title: ctx.app.title,
      defaultRoute: ctx.app.defaultRoute,
      ...(ctx.app.shell ? { shell: { ...ctx.app.shell } } : {}),
      ...(ctx.app.auth ? {
        auth: {
          serviceId: ctx.app.auth.serviceId,
          ...(ctx.app.auth.loginViewId ? { loginViewId: ctx.app.auth.loginViewId } : {}),
          ...(ctx.app.auth.logoutViewId ? { logoutViewId: ctx.app.auth.logoutViewId } : {})
        }
      } : {})
    },
    request: { method: ctx.method, path: ctx.path, params: ctx.params, query: ctx.query },
    route: { viewId: route.viewId, path: route.path, renderer, mode, kind, key, status },
    url: { current, path, route: routeUrl, uiRoute },
    routeUi: {
      link: ui,
      current: (options = {}) => ui(current(options), options),
      fragment: ui,
      form
    },
    element: createElementResolver(ctx as RequiredHandlerContext, dependencyAliases)
  };
}
function appRouteIndex(app: RequiredHandlerContext["app"]): ReadonlyArray<RequiredHandlerContext["app"]["routes"][number]> {
  return app.appRoutes ?? app.routes;
}

function serviceReferenceIds(
  extraContext: RequiredHandlerContext,
  reference: string,
  dependencyAliases: Readonly<Record<string, string>>
): Set<string> {
  const serviceKey = dependencyAliases[reference] ?? reference;
  const ids = new Set<string>([serviceKey]);
  for (const service of extraContext.tenant.services) {
    if (!service.enabled || (service.id !== serviceKey && service.serviceId !== serviceKey)) continue;
    ids.add(service.id);
    if (service.serviceId) ids.add(service.serviceId);
  }
  return ids;
}

function createServiceRouteUrlBuilder(
  routes: ReadonlyArray<RegisteredRoute>,
  extraContext: RequiredHandlerContext,
  dependencyAliases: Readonly<Record<string, string>>,
  currentServiceId?: string
): RouteHandlerContext["routeUrl"] {
  return (viewId, options = {}) => {
    const targetServiceId = options.serviceId ?? currentServiceId;
    if (!targetServiceId) return null;
    const targetIds = serviceReferenceIds(extraContext, targetServiceId, dependencyAliases);
    const currentIds = currentServiceId
      ? serviceReferenceIds(extraContext, currentServiceId, dependencyAliases)
      : new Set<string>();
    const isCurrentService = [...targetIds].some((id) => currentIds.has(id));

    if (isCurrentService) {
      const route = selectRegisteredRoute(routes, viewId, options.params);
      if (!route) return null;
      const origin = options.absolute ? serviceOrigin(extraContext, targetServiceId, options.origin) : undefined;
      if (options.absolute && !origin) return null;
      const path = fillAppPath(route.path, options.params);
      return path ? appendQuery(path, options.query, origin ?? undefined) : null;
    }

    const mounts = appRouteIndex(extraContext.app).filter((candidate) =>
      candidate.enabled !== false
      && candidate.viewId === viewId
      && targetIds.has(candidate.serviceId)
      && Boolean(routeMountServicePath(candidate))
    );
    const targets = new Map(mounts.map((mount) => [`${mount.serviceId}\0${routeMountServicePath(mount)}`, mount]));
    if (targets.size !== 1) return null;
    const mount = [...targets.values()][0];
    const servicePath = routeMountServicePath(mount)!;
    const origin = options.absolute ? serviceOrigin(extraContext, mount.serviceId, options.origin) : undefined;
    if (options.absolute && !origin) return null;
    const path = fillAppPath(servicePath, { ...mount.fixedParams, ...(options.params ?? {}) });
    return path ? appendQuery(path, options.query, origin ?? undefined) : null;
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

function createUiRouteUrlBuilder(
  event: BetterPortalEvent,
  extraContext: RequiredHandlerContext,
  dependencyAliases: Readonly<Record<string, string>>,
  currentServiceId?: string
): RouteHandlerContext["uiRouteUrl"] {
  return (viewId, options = {}) => {
    const targetServiceId = options.serviceId ?? currentServiceId;
    if (!targetServiceId) return null;

    const serviceIds = serviceReferenceIds(extraContext, targetServiceId, dependencyAliases);

    const routes = appRouteIndex(extraContext.app).filter((candidate) =>
      candidate.enabled !== false
      && (candidate.kind ?? "page") === "page"
      && methodAllowed(candidate.methods, "GET")
      && candidate.viewId === viewId
      && serviceIds.has(candidate.serviceId)
    );
    const resolved = routes.flatMap((route) => {
      const path = fillAppPath(route.path, options.params);
      return path ? [{ route, path }] : [];
    });
    const uniquePaths = new Map(resolved.map((entry) => [entry.path, entry]));
    if (uniquePaths.size !== 1) return null;
    const { path } = [...uniquePaths.values()][0];

    const origin = options.absolute
      ? options.origin
        ? appOrigin(extraContext.app, options.origin)
        : requestAppOrigin(extraContext.app, event) ?? appOrigin(extraContext.app)
      : undefined;
    return appendQuery(path, options.query, origin);
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
  return coreJsonResponse(
    { error: "Route not found" },
    404,
    "route.not_mounted",
    reason,
    {
      "bp.route.view_id": route.viewId,
      "bp.route.path": route.path,
      "bp.route_allowlist.reason": reason
    }
  );
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
  dependencyAliases: Readonly<Record<string, string>>,
  route: RegisteredRoute,
  method: HttpMethod,
  event: BetterPortalEvent,
  obs?: BetterPortalObservability,
  routerOptions: H3RouterObservabilityOptions = {}
): Promise<Response> {
  const methodRoute = route.methodRoutes?.[method];
  const handler = methodRoute?.handler ?? route.handlers[method];
  const schemas = {
    ...route.schemas,
    ...(methodRoute?.schemas ?? {}),
    params: methodRoute?.schemas.params ?? route.schemas.params
  };
  if (!handler) {
    return coreJsonResponse(
      { error: `No handler for ${method} ${route.path}` },
      405,
      "route.handler_missing",
      `No handler for ${method} ${route.path}`
    );
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
          return coreJsonResponse(
            { error: "Multipart payload too large" },
            413,
            "request.multipart.too_large",
            err.message
          );
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

  const queryResult = schemas.query
    ? parseRequestValue(schemas.query, rawQuery, "request.query.invalid", "query parameters")
    : { value: rawQuery };
  if ("response" in queryResult) return queryResult.response;
  const query = queryResult.value;

  const headersResult = schemas.headers
    ? parseRequestValue(schemas.headers, rawHeaders, "request.headers.invalid", "request headers")
    : { value: rawHeaders };
  if ("response" in headersResult) return headersResult.response;
  const headers = headersResult.value;

  const requestResult = schemas.request && METHOD_WRITE_BODY.has(method)
    ? parseRequestValue(schemas.request, rawBody, "request.body.invalid", "request body")
    : { value: rawBody };
  if ("response" in requestResult) return requestResult.response;
  const request = requestResult.value;

  const multipartResult = schemas.multipart
    ? parseRequestValue(schemas.multipart, rawMultipart ?? { fields: {}, files: {} }, "request.multipart.invalid", "multipart request")
    : { value: undefined };
  if ("response" in multipartResult) return multipartResult.response;
  const multipart = multipartResult.value;

  // Path params - H3 populates event.context.params for `:paramName` routes
  const rawParams: Record<string, string> = (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};
  const params = parseRouteParams(rawParams, schemas.params);
  if (params instanceof Response) return params;

  const extraContext = await resolveRequiredHandlerContext(event, routerOptions, route);
  if (!extraContext) {
    return coreJsonResponse(
      { error: "BetterPortal tenant/app context required" },
      400,
      "route.context_unresolved",
      "BetterPortal tenant/app context required"
    );
  }

  const routeAllowlistAcceptHeader = acceptHeaderFromEvent(event);
  const routeAllowance = appAllowsRoute(extraContext.app, route, method, url, routeAllowlistAcceptHeader);
  if (!routeAllowance.allowed) {
    return rejectUnallowedAppRoute(obs, route, method, extraContext, routeAllowance.reason ?? "route_not_mounted_for_app");
  }

  const routeUrl = createServiceRouteUrlBuilder(registryRoutes, extraContext, dependencyAliases, routerOptions.serviceId);
  const uiRouteUrl = createUiRouteUrlBuilder(event, extraContext, dependencyAliases, routerOptions.serviceId);
  const earlyRenderContext = (status: number): ViewRenderContext | undefined => {
    const renderer = rendererFromEvent(event);
    return renderer ? createViewRenderContext(route, {
      tenant: extraContext.tenant,
      app: extraContext.app,
      method,
      path: url.pathname,
      params,
      query: query as Record<string, unknown>,
      routeUrl,
      uiRouteUrl
    }, dependencyAliases, renderer, "page", "page", undefined, status) : undefined;
  };

  // -- Auth resolution (per spec section 0.5) ----------------------

  const apiAuth: ApiAuthRequirement = route.auth;
  const authResolved = await loadAuthContext(event, route, routerOptions, obs);
  const authResult = await resolveRequestAuth(apiAuth, event, authResolved, route, method, obs);
  if (authResult.error) {
    return renderAuthError(
      route,
      event,
      authResult.status,
      authResult.code ?? "auth.unclassified",
      authResult.error,
      authResult.requiredPermissions,
      earlyRenderContext(authResult.status)
    );
  }

  // -- Tenant/app activation check (validateTenantApp hook -> 426) -----

  const tenantApp = readTenantAppFromEvent(event);
  if (tenantApp && routerOptions.validateTenantApp && !isBpManagementAuthRoute(route)) {
    try {
      const validation = await routerOptions.validateTenantApp(tenantApp.tenantId, tenantApp.appId);
      if (!validation.allowed) {
        obs?.logger.warn("Tenant-app validation rejected: tenant={tenantId} app={appId} reason={reason}", {
          tenantId: tenantApp.tenantId,
          appId: tenantApp.appId,
          reason: validation.reason ?? "(unspecified)"
        });
        return renderUpgradeRequired(route, event, validation, earlyRenderContext(426));
      }
    } catch (err) {
      obs?.logger.warn("validateTenantApp threw: {msg}", { msg: (err as Error).message });
      // Fail-open: validation error treated as block.
      return renderUpgradeRequired(route, event, {
        allowed: false,
        reason: "Tenant-app validation error"
      }, earlyRenderContext(426));
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
    serviceCaller: authResult.serviceCaller,
    callerMode: authResult.callerMode,
    ...extraContext,
    bpHeaders,
    responseHeaders: event.res.headers,
    setStatus: (status) => { event.res.status = status; },
    diagnostic: (diagnostic) => annotateHttpOutcome(event, diagnostic),
    serviceId: routerOptions.serviceId,
    routeUrl,
    uiRouteUrl,
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
    rawData = await withCoreFailure(event, "handler.exception", () => withSpan(obs, "bp.route.handler", {
      "bp.route.view_id": route.viewId,
      "bp.route.path": route.path,
      "http.request.method": method,
      "bp.route.stream_buffered": true
    }, () => driveStreamBuffered(handler, ctx)));
  } else {
    rawData = await withCoreFailure(event, "handler.exception", () => withSpan(obs, "bp.route.handler", {
      "bp.route.view_id": route.viewId,
      "bp.route.path": route.path,
      "http.request.method": method
    }, () => (handler as RouteHandler)(ctx)));
  }

  // -- Emit BP-managed headers -------------------------------------

  applyBpHeadersToEvent(event, bpHeaders);

  if (rawData instanceof Response) {
    return rawData;
  }

  // -- Status decision ---------------------------------------------

  const handlerStatus = event.res.status && event.res.status !== 0 ? event.res.status : 200;
  if (handlerStatus < 200 || handlerStatus >= 400) {
    ensureCoreHttpOutcome(event, {
      code: "response.status_unclassified",
      reason: `Handler returned HTTP ${handlerStatus} without an explicit diagnostic`
    });
  }

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
      auth: { ...route.auth, callers: [...(route.auth.callers ?? ["user"])] },
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
    const reason = `Route "${route.viewId}" has no ResponseSchema and did not return a raw Response`;
    return coreJsonResponse({ error: reason }, 500, "response.schema_missing", reason);
  }
  let data: unknown;
  try {
    data = schemas.response.parse(rawData);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return coreJsonResponse(
      { error: "Response schema validation failed", detail: reason },
      500,
      "response.schema_invalid",
      reason
    );
  }

  // NDJSON only exists for streaming views; those were handled before
  // negotiation, so reaching here means the view does not stream.
  if (representation.kind === "ndjson") {
    logNegotiationFailure(obs, route, method, "ndjson_not_streaming", {
      "http.request.accept": acceptHeader ?? "",
      "bp.representation.kind": representation.kind
    });
    return coreJsonResponse(
      { error: "NDJSON streaming is not supported by this view" },
      406,
      "representation.ndjson_not_supported",
      "NDJSON streaming is not supported by this view"
    );
  }

  // JSON - already validated above, no redundant parse
  if (representation.kind === "json") {
    return jsonResponse(data as JsonValue, handlerStatus);
  }

  const renderer = rendererFromEvent(event);
  if (!renderer) {
    logNegotiationFailure(obs, route, method, "renderer_not_resolved", {
      "http.request.accept": acceptHeader ?? "",
      "bp.representation.kind": representation.kind
    });
    return coreJsonResponse(
      { error: "Renderer could not be resolved from the app shell" },
      406,
      "representation.renderer_unresolved",
      "Renderer could not be resolved from the app shell"
    );
  }

  // Determine the renderer kind requested
  const fragmentKey = url.searchParams.get("_f") ?? fragmentFromAcceptHeader(acceptHeader);
  const componentId = url.searchParams.get("_c");
  const requestedKind: "page" | "component" | "fragment" =
    fragmentKey ? "fragment" : componentId ? "component" : "page";
  const requestedKey = fragmentKey ?? componentId ?? undefined;
  const renderContext = createViewRenderContext(route, ctx, dependencyAliases, renderer, representation.mode ?? "page", requestedKind, requestedKey, handlerStatus);

  // Status-specific renderer lookup (any non-undefined status code)
  if (handlerStatus !== 200) {
    const statusRenderer = resolveStatusRenderer(route, renderer, handlerStatus, requestedKind, requestedKey, method);
    if (statusRenderer) {
      if (handlerStatus < 200 || handlerStatus >= 400) {
        ensureCoreHttpOutcome(event, {
          code: "response.status_unclassified",
          reason: `Handler returned HTTP ${handlerStatus} without an explicit diagnostic`
        });
      }
      const html = await withCoreFailure(event, "render.status_failed", () => withSpan(obs, "bp.view.render", {
        "bp.route.view_id": route.viewId,
        "bp.view.renderer": renderer,
        "bp.view.kind": requestedKind,
        "bp.view.status": handlerStatus
      }, () => statusRenderer.render(data, renderContext)));
      return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType("status", route.chrome));
    }
    // No specific renderer found.
    if (!shouldFallThroughToDefaultRenderer(handlerStatus)) {
      // 4xx/5xx without a specific renderer -> empty body with status.
      ensureCoreHttpOutcome(event, {
        code: "response.status_unclassified",
        reason: `Handler returned HTTP ${handlerStatus} without an explicit diagnostic`
      });
      return new Response(null, { status: handlerStatus });
    }
    // 2xx without specific -> fall through to default renderer, but keep handlerStatus.
  }

  // Fragment request via `_f` query param or Accept header
  if (fragmentKey) {
    const resolved = resolveRenderer(route, renderer, "fragment", method, undefined, fragmentKey);
    if (!resolved) {
      logNegotiationFailure(obs, route, method, "fragment_renderer_not_found", {
        "http.request.accept": acceptHeader ?? "",
        "bp.view.renderer": renderer,
        "bp.view.kind": "fragment",
        "bp.view.key": fragmentKey
      });
      return coreJsonResponse({
        error: `No fragment renderer found for fragment="${fragmentKey}" in renderer "${renderer}"`
      }, 406, "representation.fragment_not_found", `Fragment renderer "${fragmentKey}" was not found`);
    }

    const html = await withCoreFailure(event, "render.fragment_failed", () => withSpan(obs, "bp.view.render", {
      "bp.route.view_id": route.viewId,
      "bp.view.renderer": renderer,
      "bp.view.kind": "fragment",
      "bp.view.key": fragmentKey
    }, () => resolved.renderer.render(data, renderContext)));
    return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType("fragment", route.chrome));
  }

  // Component request via `_c` query param
  if (componentId) {
    const resolved = resolveRenderer(route, renderer, "component", method, componentId);
    if (!resolved) {
      logNegotiationFailure(obs, route, method, "component_renderer_not_found", {
        "http.request.accept": acceptHeader ?? "",
        "bp.view.renderer": renderer,
        "bp.view.kind": "component",
        "bp.view.key": componentId
      });
      return coreJsonResponse({
        error: `No component renderer found for _c="${componentId}" in renderer "${renderer}"`
      }, 406, "representation.component_not_found", `Component renderer "${componentId}" was not found`);
    }

    const html = await withCoreFailure(event, "render.component_failed", () => withSpan(obs, "bp.view.render", {
      "bp.route.view_id": route.viewId,
      "bp.view.renderer": renderer,
      "bp.view.kind": "component",
      "bp.view.key": componentId
    }, () => resolved.renderer.render(data, renderContext)));
    return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType("fragment", route.chrome));
  }

  // Page request - only page renderers allowed
  const resolved = resolveRenderer(route, renderer, "page", method);
  if (!resolved) {
    logNegotiationFailure(obs, route, method, "page_renderer_not_found", {
      "http.request.accept": acceptHeader ?? "",
      "bp.view.renderer": renderer,
      "bp.view.kind": "page"
    });
    return coreJsonResponse({
      error: `No page renderer found for renderer "${renderer}"`
    }, 406, "representation.page_not_found", `Page renderer "${renderer}" was not found`);
  }

  const html = await withCoreFailure(event, "render.page_failed", () => withSpan(obs, "bp.view.render", {
    "bp.route.view_id": route.viewId,
    "bp.view.renderer": renderer,
    "bp.view.kind": "page"
  }, () => resolved.renderer.render(data, renderContext)));
  const mode = representation.mode ?? "page";
  return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), handlerStatus, htmlContentType(mode, route.chrome));
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

  const renderer = rendererFromEvent(event);
  if (!renderer) return null;

  const streamSet = route.renderers[renderer]?.stream;
  if (!streamSet) return null;

  // Full-page request with a page renderer available -> buffered render of the
  // complete data set (crawlers, no-SSE clients). Fragment swaps stream.
  if (representation.mode === "page" && resolveRenderer(route, renderer, "page", method)) {
    return null;
  }

  const shellCtx: StreamShellContext = {
    sseConnectPath: `${url.pathname}/__sse${url.search}`,
    params: ctx.params,
    query: ctx.query
  };
  const html = await withCoreFailure(event, "render.stream_shell_failed", () => withSpan(obs, "bp.view.render", {
    "bp.route.view_id": route.viewId,
    "bp.view.renderer": renderer,
    "bp.view.kind": "stream-shell"
  }, () => streamSet.renderShell(shellCtx)));
  return htmlResponse(rewriteServiceRouteTokens(toHtmlString(html), ctx.routeUrl, obs), 200, htmlContentType("fragment", route.chrome));
}

/**
 * SSE delivery of the frame stream at `{path}/__sse`. With a theme context and
 * stream renderers, event payloads are server-rendered HTML; otherwise frame
 * JSON (spec/streaming.md section 2.3, section 4.1). Runs the generator itself - no stream
 * state is shared with the shell request.
 */
async function handleStreamSse(
  registryRoutes: ReadonlyArray<RegisteredRoute>,
  dependencyAliases: Readonly<Record<string, string>>,
  route: RegisteredRoute,
  handler: AnyStreamHandler,
  event: BetterPortalEvent,
  obs: BetterPortalObservability | undefined,
  routerOptions: H3RouterObservabilityOptions
): Promise<Response | BodyInit> {
  const url = getRequestURL(event);
  const rawQuery = queryFromUrl(url);
  const methodSchemas = route.methodRoutes?.GET?.schemas;
  const sseSchemas = {
    ...route.schemas,
    ...(methodSchemas ?? {}),
    params: methodSchemas?.params ?? route.schemas.params
  };
  const query = sseSchemas.query ? sseSchemas.query.parse(rawQuery) : rawQuery;
  const rawParams: Record<string, string> =
    (event as unknown as { context: { params?: Record<string, string> } }).context?.params ?? {};
  const params = parseRouteParams(rawParams, sseSchemas.params);
  if (params instanceof Response) return params;

  // The frame stream carries the same data as the view route - enforce the
  // same auth requirement.
  const authResolved = await loadAuthContext(event, route, routerOptions, obs);
  const authResult = await resolveRequestAuth(route.auth, event, authResolved, route, "GET", obs);
  if (authResult.error) {
    return coreJsonResponse(
      { error: authResult.error, status: authResult.status } as unknown as JsonValue,
      authResult.status,
      authResult.code ?? "auth.unclassified",
      authResult.error
    );
  }

  const extraContext = await resolveRequiredHandlerContext(event, routerOptions, route);
  if (!extraContext) {
    return coreJsonResponse(
      { error: "BetterPortal tenant/app context required" },
      400,
      "stream.context_unresolved",
      "BetterPortal tenant/app context required"
    );
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
    serviceCaller: authResult.serviceCaller,
    callerMode: authResult.callerMode,
    ...extraContext,
    serviceId: routerOptions.serviceId,
    routeUrl: createServiceRouteUrlBuilder(registryRoutes, extraContext, dependencyAliases, routerOptions.serviceId),
    uiRouteUrl: createUiRouteUrlBuilder(event, extraContext, dependencyAliases, routerOptions.serviceId),
    diagnostic: (diagnostic) => annotateHttpOutcome(event, diagnostic),
    response: responseHelper,
    file: fileResponseHelper,
    ...(obs ? { obs } : {})
  };

  const renderer = rendererFromEvent(event);
  const streamSet = renderer ? route.renderers[renderer]?.stream : undefined;

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
  serviceCaller?: ValidatedServiceClaims;
  callerMode?: ApiCallerMode;
  error?: string;
  code?: string;
  status: number;
  requiredPermissions?: ReadonlyArray<RequiredPermissionDescriptor>;
}

async function loadAuthContext(
  event: BetterPortalEvent,
  route: RegisteredRoute,
  routerOptions: H3RouterObservabilityOptions,
  obs?: BetterPortalObservability
): Promise<H3AuthContext | undefined> {
  try {
    return await routerOptions.resolveAuth?.(event, route);
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
  route: RegisteredRoute,
  method: HttpMethod,
  obs?: BetterPortalObservability
): Promise<AuthResult> {
  const required = apiAuth.required;
  const primaryHeader = event.req.headers.get("authorization");
  const secondaryHeader = event.req.headers.get("x-bp-service-authorization");
  const primary = primaryHeader?.startsWith("Bearer ") ? primaryHeader.slice(7) : null;
  const secondary = secondaryHeader?.startsWith("Bearer ") ? secondaryHeader.slice(7) : null;
  const callerMode: ApiCallerMode | undefined = secondaryHeader !== null
    ? "delegated"
    : primary && isServiceToken(primary)
      ? "service"
      : primary
        ? "user"
        : undefined;

  if (!primary || !callerMode) {
    if (required) return { status: 401, error: "Authentication required", code: "auth.required" };
    return { status: 200 };
  }

  const allowedCallers = apiAuth.callers ?? ["user"];
  if (!allowedCallers.includes(callerMode)) {
    if (required) return { status: 403, error: `${callerMode} callers are not allowed`, code: "auth.caller_not_allowed" };
    return { status: 200 };
  }

  if (!authContext) {
    if (required) return { status: 503, error: "Auth context unavailable", code: "auth.context_unavailable" };
    return { status: 200 };
  }

  if (callerMode === "user") {
    return resolveUserRequestAuth(primary, apiAuth, authContext, obs);
  }

  const sourceServiceId = event.req.headers.get("x-bp-service-id");
  const tenantId = event.req.headers.get("x-bp-tenant-id");
  const appId = event.req.headers.get("x-bp-app-id");
  if (!sourceServiceId || !tenantId || !appId) {
    return { status: 401, error: "Service, tenant, and app headers are required for S2S calls", code: "s2s.headers_missing" };
  }
  if (tenantId !== authContext.tenantId || appId !== authContext.appId) {
    return { status: 401, error: "S2S headers do not match the resolved tenant/app", code: "s2s.context_mismatch" };
  }
  if (!authContext.serviceVerifier) {
    if (required) return { status: 503, error: "Service auth context unavailable", code: "s2s.verifier_unavailable" };
    return { status: 200 };
  }

  const verifyService = async (token: string, mode: "service" | "delegated"): Promise<ValidatedServiceClaims | AuthResult> => {
    try {
      return await authContext.serviceVerifier!.verify(token, {
        tenantId: authContext.tenantId,
        appId: authContext.appId,
        viewId: route.viewId,
        method,
        mode,
        sourceServiceId,
        requiredPermissions: apiAuth.permissions.flatMap((requirement) => requirement.permissions)
      });
    } catch (err) {
      obs?.logger.warn("Service token verification failed: {msg}", { msg: (err as Error).message });
      const status = (err as { status?: number }).status === 403 ? 403 : 401;
      return {
        status,
        error: status === 403 ? "Service access denied" : "Invalid service token",
        code: status === 403 ? "s2s.access_denied" : "s2s.token_invalid"
      };
    }
  };

  if (callerMode === "service") {
    const serviceCaller = await verifyService(primary, "service");
    if ("status" in serviceCaller) return required ? serviceCaller : { status: 200 };
    return { status: 200, serviceCaller, callerMode };
  }

  if (!secondary || isServiceToken(primary)) {
    return {
      status: 401,
      error: "Delegated calls require a BP user token and a service token",
      code: "s2s.delegated_token_invalid"
    };
  }
  const userResult = await resolveUserRequestAuth(primary, apiAuth, authContext, obs);
  if (userResult.error || !userResult.user) return userResult.error
    ? userResult
    : { status: 401, error: "Valid BP user token required", code: "s2s.delegated_token_invalid" };
  const serviceCaller = await verifyService(secondary, "delegated");
  if ("status" in serviceCaller) return required ? serviceCaller : { status: 200 };
  return { status: 200, user: userResult.user, serviceCaller, callerMode };
}

async function resolveUserRequestAuth(
  bearer: string,
  apiAuth: ApiAuthRequirement,
  authContext: H3AuthContext,
  obs?: BetterPortalObservability
): Promise<AuthResult> {
  const required = apiAuth.required;
  const verifier = authContext.verifier;
  if (!verifier) {
    if (required) return { status: 503, error: "Auth context unavailable", code: "auth.context_unavailable" };
    return { status: 200 };
  }
  let claims: JwtClaims;
  try {
    claims = await withSpan(obs, "bp.auth.verify_token", {
      "bp.auth.required": required,
      "bp.auth.tenant_id": authContext.tenantId,
      "bp.auth.app_id": authContext.appId
    }, () => verifier.verify(bearer, {
      tenantId: authContext.tenantId,
      appId: authContext.appId
    }));
  } catch (err) {
    obs?.logger.warn("JWT verification failed: {msg}", { msg: (err as Error).message });
    if (required) return { status: 401, error: "Invalid token", code: "auth.token_invalid" };
    return { status: 200 };
  }

  if (claims.tenantId !== authContext.tenantId) {
    obs?.logger.warn("JWT tenantId mismatch: token={t1} request={t2}", {
      t1: claims.tenantId,
      t2: authContext.tenantId
    });
    if (required) return { status: 401, error: "Token bound to a different tenant", code: "auth.token_tenant_mismatch" };
    return { status: 200 };
  }

  if (claims.appId !== authContext.appId) {
    obs?.logger.warn("JWT appId mismatch: token={a1} request={a2}", {
      a1: claims.appId,
      a2: authContext.appId
    });
    if (required) return { status: 401, error: "Token bound to a different app", code: "auth.token_app_mismatch" };
    return { status: 200 };
  }

  if (apiAuth.permissions.length > 0) {
    const hasPlatformRootRole = claims.roles.includes(PLATFORM_ROOT_PERMISSION_ROLE_ID);
    if (hasPlatformRootRole) {
      const rootMatches = authContext.platformRoot?.tenantId === authContext.tenantId
        && authContext.platformRoot?.appId === authContext.appId
        && claims.tenantId === authContext.platformRoot.tenantId
        && claims.appId === authContext.platformRoot.appId;
      if (rootMatches) {
        return { status: 200, user: claims, callerMode: "user" };
      }
      obs?.logger.error("Reserved platform-root permission role used outside management app: tenant={tenantId} app={appId} rootTenant={rootTenantId} rootApp={rootAppId}", {
        tenantId: claims.tenantId,
        appId: claims.appId,
        rootTenantId: authContext.platformRoot?.tenantId ?? "",
        rootAppId: authContext.platformRoot?.appId ?? ""
      });
    }

    const granted = expandRolesToPermissions(claims.roles, authContext.appAuthConfig);
    const aliases = authContext.serviceIdAliases ?? {};
    const serviceIdsMatch = (grantServiceId: string, requiredServiceId: string): boolean =>
      grantServiceId === requiredServiceId
      || aliases[grantServiceId] === requiredServiceId
      || aliases[requiredServiceId] === grantServiceId;
    const ok = apiAuth.permissions.every((requirement) =>
      requirement.permissions.every((action) =>
        granted.some((grant) =>
          serviceIdsMatch(grant.serviceId, requirement.serviceId)
          && grant.viewId === requirement.viewId
          && grant.permissions.includes(action)
        )
      )
    );
    if (!ok) {
      if (required) {
        return {
          status: 403,
          error: "Insufficient permissions",
          code: "auth.permissions_insufficient",
          requiredPermissions: apiAuth.permissions
        };
      }
      return { status: 200 };
    }
  }

  return { status: 200, user: claims, callerMode: "user" };
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]!));
}

function formatRequiredPermissions(requiredPermissions: ReadonlyArray<RequiredPermissionDescriptor> = []): string {
  if (requiredPermissions.length === 0) return "";
  return requiredPermissions
    .map((requirement) => `${requirement.serviceId} / ${requirement.viewId} / ${requirement.permissions.join("+")}`)
    .join("; ");
}

function renderAuthError(
  route: RegisteredRoute,
  event: BetterPortalEvent,
  status: number,
  code: string,
  message: string,
  requiredPermissions: ReadonlyArray<RequiredPermissionDescriptor> = [],
  context?: ViewRenderContext
): Response {
  const renderer = rendererFromEvent(event);
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
  if (renderer && (representation.kind === "html")) {
    const statusRenderer = resolveStatusRenderer(route, renderer, status, "page", undefined, "GET");
    if (statusRenderer && context) {
      try {
        const html = statusRenderer.render({ error: message, status, requiredPermissions }, context);
        return coreResponse(new Response(toHtmlString(html), {
          status,
          headers: { ...corsHeaders, "content-type": htmlContentType("status", route.chrome) }
        }), code, message);
      } catch {
        // fall through to JSON
      }
    }
  }

  if (representation.kind === "html" && status === 403) {
    const details = formatRequiredPermissions(requiredPermissions);
    const html = `
      <section class="container py-4">
        <div class="alert alert-warning border-0 shadow-sm" role="alert">
          <h2 class="h5 mb-2">Permission required</h2>
          <p class="mb-2">${escapeHtml(message)}</p>
          ${details ? `<p class="small mb-0"><strong>Required:</strong> <code>${escapeHtml(details)}</code></p>` : ""}
        </div>
      </section>
    `;
    return coreResponse(new Response(html, {
      status,
      headers: { ...corsHeaders, "content-type": renderer ? htmlContentType("status", route.chrome) : "text/html; charset=utf-8" }
    }), code, message);
  }

  return coreJsonResponse(
    { error: message, status, requiredPermissions } as unknown as JsonValue,
    status,
    code,
    message,
    undefined,
    corsHeaders
  );
}

async function withCoreFailure<T>(
  event: BetterPortalEvent,
  code: string,
  handler: () => Promise<T> | T
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    annotateCoreHttpOutcome(event, {
      code,
      reason: (error instanceof Error ? error.message : String(error)).slice(0, 2048)
    });
    throw error;
  }
}

function readTenantAppFromEvent(event: BetterPortalEvent): { tenantId: string; appId: string } | undefined {
  const ctx = event as unknown as { __bpTenantId?: string; __bpAppId?: string };
  if (!ctx.__bpTenantId || !ctx.__bpAppId) return undefined;
  return { tenantId: ctx.__bpTenantId, appId: ctx.__bpAppId };
}

function renderUpgradeRequired(
  route: RegisteredRoute,
  event: BetterPortalEvent,
  validation: import("../contracts/auth.js").TenantAppValidation,
  context?: ViewRenderContext
): Response {
  const renderer = rendererFromEvent(event);
  const acceptHeader = acceptHeaderFromEvent(event);
  const representation = resolveRequestedRepresentation(acceptHeader);
  const status = 426;

  // Honor Retry-After if requested
  const extraHeaders: Record<string, string> = {};
  if (validation.retryAfterSeconds) {
    extraHeaders["retry-after"] = String(validation.retryAfterSeconds);
  }

  if (renderer && representation.kind === "html") {
    const statusRenderer = resolveStatusRenderer(route, renderer, status, "page", undefined, "GET");
    if (statusRenderer && context) {
      try {
        const html = statusRenderer.render({
          status,
          reason: validation.reason,
          upgradeUrl: validation.upgradeUrl
        }, context);
        return coreResponse(
          htmlResponse(toHtmlString(html), status, htmlContentType("status", route.chrome)),
          "route.tenant_app_unavailable",
          validation.reason ?? "Tenant/app is not available for this service"
        );
      } catch {
        // fall through to JSON
      }
    }
  }

  return coreJsonResponse({
    status,
    error: "Upgrade Required",
    reason: validation.reason,
    upgradeUrl: validation.upgradeUrl
  } as unknown as JsonValue, status, "route.tenant_app_unavailable", validation.reason ?? "Upgrade required", undefined, extraHeaders);
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

  app.get("/.well-known/bp/resources", () => {
    return jsonResponse({
      resources: manifest.developerResources.map(({ content: _content, ...resource }) => ({
        ...resource,
        url: `/.well-known/bp/resources/${encodeURIComponent(resource.id)}`
      }))
    } as unknown as JsonValue);
  });

  app.get("/.well-known/bp/resources/**", (event) => {
    const encodedId = event.url.pathname.slice("/.well-known/bp/resources/".length);
    let id: string;
    try { id = decodeURIComponent(encodedId); }
    catch {
      return coreJsonResponse(
        { error: "invalid_resource_id" },
        400,
        "discovery.resource_id_invalid",
        "Developer resource id is not valid URL encoding"
      );
    }
    const resource = manifest.developerResources.find((candidate) => candidate.id === id);
    if (!resource) {
      return coreJsonResponse(
        { error: "resource_not_found" },
        404,
        "discovery.resource_not_found",
        `Developer resource "${id}" was not found`
      );
    }
    return new Response(resource.content, {
      headers: {
        "content-type": resource.mediaType,
        "cache-control": `public, max-age=${manifest.cacheHints.metadataTtlSeconds}`,
        "content-security-policy": "sandbox; default-src 'none'",
        "x-content-type-options": "nosniff"
      }
    });
  });
}
