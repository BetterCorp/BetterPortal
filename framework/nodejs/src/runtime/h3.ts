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

export function createBetterPortalApp(): BetterPortalH3App {
  return new H3();
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
    "network.protocol.name": requestUrl.protocol.replace(":", ""),
    ...(requestIp ? { "client.address": requestIp } : {})
  };
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
