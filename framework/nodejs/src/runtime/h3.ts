import { H3, getRequestIP, getRequestURL, handleCors, toNodeHandler } from "h3";
import { STATUS_CODES } from "node:http";
import { JsonValue } from "../contracts/json.js";
import {
  type BetterPortalObservability,
  type HttpOutcomeDiagnostic,
  type HttpOutcomeSource,
  type ObservabilityAttributes
} from "../contracts/observability.js";
import { toHtmlString, type HeaderMap } from "./http.js";
import { type NegotiatedViewResponse } from "./view.js";

export type BetterPortalEvent = import("h3").H3Event;
export type BetterPortalH3App = import("h3").H3;
type BetterPortalCorsOptions = import("h3").CorsOptions;
type H3HTTPResponse = import("h3").HTTPResponse;
type BetterPortalHandler = (event: BetterPortalEvent) => unknown;
type BetterPortalRouteRegistrar = (path: string, handler: BetterPortalHandler) => BetterPortalH3App;
type BetterPortalRouteRegistrarName = "get" | "post" | "put" | "patch" | "delete" | "options" | "use";

export interface BetterPortalAppOptions {
  createRequestObservability?: (
    name: string,
    attributes: ObservabilityAttributes
  ) => BetterPortalObservability;
}

type ObservedEventState = {
  observability: BetterPortalObservability;
  startedAt: number;
  diagnostic?: ResolvedHttpOutcomeDiagnostic;
};

type ResolvedHttpOutcomeDiagnostic = HttpOutcomeDiagnostic & {
  readonly source: HttpOutcomeSource;
};

const RESPONSE_DIAGNOSTICS = new WeakMap<Response, ResolvedHttpOutcomeDiagnostic>();
const DIAGNOSTIC_BODY_LIMIT = 2 * 1024;
const DIAGNOSTIC_READ_TIMEOUT_MS = 100;

function observedEventState(event: BetterPortalEvent): ObservedEventState | undefined {
  return (event as unknown as { __bpObservedEvent?: ObservedEventState }).__bpObservedEvent;
}

function byteCountFromHeader(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function responseByteCount(response: Response): number {
  const contentLength = byteCountFromHeader(response.headers.get("content-length"));
  if (contentLength > 0) return contentLength;
  return 0;
}

export function eventObservability(event: BetterPortalEvent): BetterPortalObservability | undefined {
  return observedEventState(event)?.observability;
}

function setEventDiagnostic(
  event: BetterPortalEvent,
  diagnostic: HttpOutcomeDiagnostic,
  source: HttpOutcomeSource
): void {
  const state = observedEventState(event);
  if (!state) return;
  state.diagnostic = resolveDiagnostic(diagnostic, source);
}

export function annotateHttpOutcome(event: BetterPortalEvent, diagnostic: HttpOutcomeDiagnostic): void {
  setEventDiagnostic(event, diagnostic, "explicit");
}

export function annotateCoreHttpOutcome(event: BetterPortalEvent, diagnostic: HttpOutcomeDiagnostic): void {
  setEventDiagnostic(event, diagnostic, "core");
}

export function ensureCoreHttpOutcome(event: BetterPortalEvent, diagnostic: HttpOutcomeDiagnostic): void {
  if (observedEventState(event)?.diagnostic) return;
  setEventDiagnostic(event, diagnostic, "core");
}

export function withHttpOutcome(response: Response, diagnostic: HttpOutcomeDiagnostic): Response {
  RESPONSE_DIAGNOSTICS.set(response, resolveDiagnostic(diagnostic, "explicit"));
  return response;
}

export function withCoreHttpOutcome(response: Response, diagnostic: HttpOutcomeDiagnostic): Response {
  RESPONSE_DIAGNOSTICS.set(response, resolveDiagnostic(diagnostic, "core"));
  return response;
}

/**
 * The direct socket peer IP of the request - i.e. NOT derived from
 * X-Forwarded-For. Use this to decide whether a request actually arrived from a
 * trusted upstream proxy before honouring any proxy-supplied headers.
 */
export function getEventPeerIp(event: BetterPortalEvent): string | undefined {
  return getRequestIP(event, { xForwardedFor: false }) ?? undefined;
}

export function createBetterPortalApp(options: BetterPortalAppOptions = {}): BetterPortalH3App {
  const app = new H3({
    onRequest: (event) => {
      const obs = options.createRequestObservability?.(
        "bp.http.request",
        requestAttributes(event)
      );
      if (obs) {
        (event as unknown as { __bpObservedEvent?: ObservedEventState }).__bpObservedEvent = {
          observability: obs,
          startedAt: performance.now()
        };
      }
    },
    onResponse: async (response, event) => {
      event.res.headers.forEach((value, name) => {
        if (!response.headers.has(name)) response.headers.set(name, value);
      });

      const state = observedEventState(event);
      if (!state) return;

      const durationMs = roundedDuration(performance.now() - state.startedAt);
      const requestUrl = getRequestURL(event);
      const requestIp = getRequestIP(event, { xForwardedFor: true }) ?? "";
      const bpContext = (event as unknown as { __bpTenantId?: string; __bpAppId?: string });
      const diagnostic = await resolveHttpOutcome(event, response);
      const attrs = {
        method: event.req.method,
        path: requestUrl.pathname,
        status: response.status,
        durationMs,
        callerIp: requestIp,
        host: event.req.headers.get("host") ?? "",
        referer: event.req.headers.get("referer") ?? "",
        tenantId: bpContext.__bpTenantId ?? "",
        appId: bpContext.__bpAppId ?? "",
        requestBytes: byteCountFromHeader(event.req.headers.get("content-length")),
        responseBytes: responseByteCount(response),
        outcomeCode: diagnostic?.code ?? "",
        outcomeReason: diagnostic?.reason ?? "",
        ...httpOutcomeAttributes(event, response, diagnostic)
      };
      const message = "BP REQUEST: {method} {path} -> {status} in {durationMs}ms callerIp={callerIp} host={host} referer={referer} tenant={tenantId} app={appId} requestBytes={requestBytes} responseBytes={responseBytes} outcome={outcomeCode} reason={outcomeReason}";

      if (response.status >= 500) {
        state.observability.logger.error(message, attrs);
      } else if (response.status >= 400) {
        state.observability.logger.warn(message, attrs);
      } else {
        state.observability.logger.info(message, attrs);
      }

      state.observability.end({
        "http.response.status_code": response.status,
        "duration.ms": durationMs,
        ...httpOutcomeAttributes(event, response, diagnostic)
      });
    }
  });
  return observeRegisteredHandlers(app);
}

export function createBetterPortalNodeHandler(app: BetterPortalH3App) {
  return toNodeHandler(app);
}

export function eventHeaders(event: BetterPortalEvent): HeaderMap {
  return event.req.headers;
}

export function acceptHeaderFromEvent(event: BetterPortalEvent): string | undefined {
  return event.req.headers.get("accept") ?? undefined;
}

function contentTypeWithCharset(contentType: string): string {
  return contentType.toLowerCase().includes("charset=")
    ? contentType
    : `${contentType}; charset=utf-8`;
}

export function jsonResponse(body: JsonValue, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function htmlResponse(body: string, status = 200, contentType = "text/html", headers?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentTypeWithCharset(contentType),
      ...headers
    }
  });
}

export function negotiatedResponseToWebResponse(negotiated: NegotiatedViewResponse): Response {
  if (negotiated.contentType.startsWith("text/html")) {
    return htmlResponse(toHtmlString(negotiated.body ?? ""), negotiated.status, negotiated.contentType);
  }

  return jsonResponse(negotiated.body as JsonValue, negotiated.status, {
    "content-type": contentTypeWithCharset(negotiated.contentType)
  });
}

function normalizeHttpResponse(response: H3HTTPResponse): Response {
  return new Response(response.body ?? null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export function handleCorsRequest(event: BetterPortalEvent, options: BetterPortalCorsOptions): Response | false {
  const corsResponse = handleCors(event, options);
  if (corsResponse === false) {
    return false;
  }

  return corsResponse instanceof Response ? corsResponse : normalizeHttpResponse(corsResponse);
}

function statusCodeFromResult(event: BetterPortalEvent, result: unknown): number {
  if (result instanceof Response) {
    return result.status;
  }

  return event.res.status || 200;
}

function requestAttributes(event: BetterPortalEvent): ObservabilityAttributes {
  const requestUrl = getRequestURL(event);
  const requestIp = getRequestIP(event, { xForwardedFor: true });
  const origin = event.req.headers.get("origin");
  const requestedMethod = event.req.headers.get("access-control-request-method");
  const requestedHeaders = event.req.headers.get("access-control-request-headers");

  return {
    "http.request.method": event.req.method,
    "url.full": requestUrl.toString(),
    "url.path": requestUrl.pathname,
    "server.address": event.req.headers.get("host") ?? "",
    "http.request.header.referer": event.req.headers.get("referer") ?? "",
    ...(origin ? { "http.request.header.origin": origin } : {}),
    ...(requestedMethod ? { "http.request.header.access_control_request_method": requestedMethod } : {}),
    ...(requestedHeaders ? { "http.request.header.access_control_request_headers": requestedHeaders.slice(0, 1024) } : {}),
    "network.protocol.name": requestUrl.protocol.replace(":", ""),
    ...(requestIp ? { "client.address": requestIp } : {})
  };
}

function responseKind(event: BetterPortalEvent, response: Response): string {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (response.status === 204 || response.status === 205 || response.status === 304 || response.body === null) return "empty";
  if (response.status >= 300 && response.status < 400 && response.headers.has("location")) return "redirect";
  if (response.headers.has("content-disposition")) return "file";
  if (contentType.includes("application/vnd.betterportal.metadata+json")) return "metadata";
  if (contentType.includes("application/x-ndjson")) return "ndjson";
  if (contentType.includes("text/event-stream")) return "sse";
  if (contentType.includes("application/json") || contentType.includes("+json")) return "json";
  if (contentType.includes("text/html")) {
    if (/(?:^|;)\s*mode=status(?:;|$)/i.test(contentType)) return "html.status";
    if (/(?:^|;)\s*mode=fragment(?:;|$)/i.test(contentType)) {
      return event.url.searchParams.has("_c") ? "html.component" : "html.fragment";
    }
    return "html.page";
  }
  return contentType ? "raw" : "unknown";
}

function normalizeDiagnosticReason(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, DIAGNOSTIC_BODY_LIMIT);
}

function resolveDiagnostic(
  diagnostic: HttpOutcomeDiagnostic,
  source: HttpOutcomeSource
): ResolvedHttpOutcomeDiagnostic {
  return {
    code: diagnostic.code.trim().slice(0, 128) || "http.unclassified",
    reason: normalizeDiagnosticReason(diagnostic.reason) || "HTTP request failed",
    source,
    ...(diagnostic.attributes ? { attributes: diagnostic.attributes } : {})
  };
}

function jsonDiagnosticReason(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    for (const key of ["reason", "error", "message", "detail"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) return normalizeDiagnosticReason(value);
      if (value && typeof value === "object") {
        const encoded = JSON.stringify(value);
        if (encoded && encoded !== "{}") return normalizeDiagnosticReason(encoded);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function boundedResponseText(response: Response): Promise<{ text: string; truncated: boolean } | undefined> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!(contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("+json"))) return undefined;
  try {
    const reader = response.clone().body?.getReader();
    if (!reader) return undefined;
    const chunks: Uint8Array[] = [];
    let length = 0;
    let truncated = false;
    const deadline = Date.now() + DIAGNOSTIC_READ_TIMEOUT_MS;
    while (length <= DIAGNOSTIC_BODY_LIMIT) {
      const remainingTime = deadline - Date.now();
      if (remainingTime <= 0) {
        void reader.cancel().catch(() => {});
        return undefined;
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        reader.read(),
        new Promise<undefined>((resolve) => {
          timeout = setTimeout(() => resolve(undefined), remainingTime);
        })
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      if (!result) {
        void reader.cancel().catch(() => {});
        return undefined;
      }
      const { done, value } = result;
      if (done) break;
      if (!value) continue;
      const remaining = DIAGNOSTIC_BODY_LIMIT - length;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        truncated = true;
        break;
      }
      chunks.push(value);
      length += value.byteLength;
    }
    if (truncated) void reader.cancel().catch(() => {});
    const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text: new TextDecoder().decode(bytes), truncated };
  } catch {
    return undefined;
  }
}

async function inferHttpOutcome(response: Response, status: number): Promise<ResolvedHttpOutcomeDiagnostic> {
  const body = await boundedResponseText(response);
  if (body) {
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const reason = contentType.includes("json") ? jsonDiagnosticReason(body.text) : undefined;
    const normalized = reason ?? normalizeDiagnosticReason(body.text);
    if (normalized) {
      return {
        code: "http.response_body",
        reason: normalized,
        source: "response-body",
        attributes: { "bp.http.outcome_detail_truncated": body.truncated }
      };
    }
  }
  return {
    code: "http.unclassified",
    reason: response.statusText || STATUS_CODES[status] || `HTTP ${status}`,
    source: "http-status"
  };
}

async function resolveHttpOutcome(
  event: BetterPortalEvent,
  response: Response
): Promise<ResolvedHttpOutcomeDiagnostic | undefined> {
  const state = observedEventState(event);
  const attached = RESPONSE_DIAGNOSTICS.get(response);
  if (attached && state) state.diagnostic = attached;
  if (attached) return attached;
  if (state?.diagnostic) return state.diagnostic;
  if (response.status >= 200 && response.status < 400) return undefined;
  const inferred = await inferHttpOutcome(response, response.status);
  if (state) state.diagnostic = inferred;
  return inferred;
}

function httpOutcomeAttributes(
  event: BetterPortalEvent,
  response: Response,
  diagnostic?: ResolvedHttpOutcomeDiagnostic
): ObservabilityAttributes {
  return {
    ...(diagnostic?.attributes ?? {}),
    "bp.http.response_kind": responseKind(event, response),
    ...(diagnostic ? {
      "bp.http.outcome_code": diagnostic.code,
      "bp.http.outcome_reason": diagnostic.reason,
      "bp.http.outcome_source": diagnostic.source
    } : {})
  };
}

function roundedDuration(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}

function observeRegisteredHandlers(app: BetterPortalH3App): BetterPortalH3App {
  const registrars = app as unknown as Record<BetterPortalRouteRegistrarName, BetterPortalRouteRegistrar>;
  const names: BetterPortalRouteRegistrarName[] = ["get", "post", "put", "patch", "delete", "options", "use"];

  for (const name of names) {
    const original = registrars[name].bind(app);
    registrars[name] = (path, handler) => original(path, async (event) => {
      const obs = eventObservability(event);
      const response = obs
        ? await withObservedEvent(event, obs, "bp.h3.handler", handler, {
            "http.route": path,
            "http.route.method": name.toUpperCase()
          })
        : await handler(event);
      // h3 does not merge middleware-set headers into error Responses.
      if (response instanceof Response && !response.ok) {
        event.res.headers.forEach((value, header) => {
          if (!response.headers.has(header)) response.headers.set(header, value);
        });
      }
      return response;
    });
  }

  return app;
}

export async function withObservedEvent<T>(
  event: BetterPortalEvent,
  observability: BetterPortalObservability,
  name: string,
  handler: (event: BetterPortalEvent, span: BetterPortalObservability) => Promise<T> | T,
  attributes: ObservabilityAttributes = {}
): Promise<T> {
  const span = observability.startSpan(name, {
    ...requestAttributes(event),
    ...attributes
  });

  try {
    const result = await handler(event, span);
    const outcomeAttributes = result instanceof Response
      ? httpOutcomeAttributes(event, result, await resolveHttpOutcome(event, result))
      : {};
    span.end({
      "http.response.status_code": statusCodeFromResult(event, result),
      ...outcomeAttributes
    });
    return result;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    span.error(normalizedError, {
      "error.name": normalizedError.name
    });
    if (!observedEventState(event)?.diagnostic) {
      setEventDiagnostic(event, {
        code: "framework.exception",
        reason: normalizeDiagnosticReason(normalizedError.message || normalizedError.name)
      }, "exception");
    }
    span.end({
      "http.response.status_code": event.res.status || 500
    });
    throw error;
  }
}
