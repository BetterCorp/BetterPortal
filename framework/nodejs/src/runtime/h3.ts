import { H3, getRequestIP, getRequestURL, handleCors, toNodeHandler } from "h3";
import { JsonValue } from "../contracts/json.js";
import {
  type BetterPortalObservability,
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
};

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

/**
 * The direct socket peer IP of the request — i.e. NOT derived from
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
    onResponse: (response, event) => {
      event.res.headers.forEach((value, name) => {
        if (!response.headers.has(name)) response.headers.set(name, value);
      });

      const state = observedEventState(event);
      if (!state) return;

      const durationMs = roundedDuration(performance.now() - state.startedAt);
      const requestUrl = getRequestURL(event);
      const requestIp = getRequestIP(event, { xForwardedFor: true }) ?? "";
      const bpContext = (event as unknown as { __bpTenantId?: string; __bpAppId?: string });
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
        responseBytes: responseByteCount(response)
      };
      const message = "BP REQUEST: {method} {path} -> {status} in {durationMs}ms callerIp={callerIp} host={host} referer={referer} tenant={tenantId} app={appId} requestBytes={requestBytes} responseBytes={responseBytes}";

      if (response.status >= 500) {
        state.observability.logger.error(message, attrs);
      } else if (response.status >= 400) {
        state.observability.logger.warn(message, attrs);
      } else {
        state.observability.logger.info(message, attrs);
      }

      state.observability.end({
        "http.response.status_code": response.status,
        "duration.ms": durationMs
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

  return {
    "http.request.method": event.req.method,
    "url.full": requestUrl.toString(),
    "url.path": requestUrl.pathname,
    "server.address": event.req.headers.get("host") ?? "",
    "http.request.header.referer": event.req.headers.get("referer") ?? "",
    "network.protocol.name": requestUrl.protocol.replace(":", ""),
    ...(requestIp ? { "client.address": requestIp } : {})
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
      if (!obs) return handler(event);
      return withObservedEvent(event, obs, "bp.h3.handler", handler, {
        "http.route": path,
        "http.route.method": name.toUpperCase()
      });
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
    span.end({
      "http.response.status_code": statusCodeFromResult(event, result)
    });
    return result;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    span.error(normalizedError, {
      "error.name": normalizedError.name
    });
    span.end({
      "http.response.status_code": event.res.status || 500
    });
    throw error;
  }
}
