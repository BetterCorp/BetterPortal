import type { IncomingMessage, ServerResponse } from "node:http";
import { JsonValue } from "../contracts/json";
import { NegotiatedViewResponse, type HtmlRenderable } from "./view";

export interface HeaderMap {
  [key: string]: string | string[] | undefined;
}

function firstHeaderValue(headers: HeaderMap, candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    const value = headers[candidate];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function hostnameFromHeaderValue(value?: string): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    try {
      return new URL(`https://${value}`).hostname;
    } catch {
      return null;
    }
  }
}

export function resolveEmbeddedSourceHeader(headers: HeaderMap): string | undefined {
  return firstHeaderValue(headers, [":referer", "referer", ":origin", "origin"]);
}

export function resolveThemeSourceHeader(headers: HeaderMap): string | undefined {
  return firstHeaderValue(headers, [":origin", "origin", ":referer", "referer"]);
}

export function resolveEmbeddedHostname(headers: HeaderMap): string | null {
  return hostnameFromHeaderValue(resolveEmbeddedSourceHeader(headers));
}

export function resolveThemeHostname(headers: HeaderMap): string | null {
  return hostnameFromHeaderValue(resolveThemeSourceHeader(headers));
}

export function toHtmlString(body: HtmlRenderable): string {
  return typeof body === "string" ? body : body.toString();
}

export function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

export function sendHtml(response: ServerResponse, statusCode: number, body: HtmlRenderable, contentType = "text/html"): void {
  response.writeHead(statusCode, {
    "Content-Type": `${contentType}; charset=utf-8`
  });
  response.end(toHtmlString(body));
}

export function sendNegotiatedResponse(response: ServerResponse, negotiated: NegotiatedViewResponse): void {
  if (negotiated.contentType.startsWith("text/html")) {
    sendHtml(response, negotiated.status, negotiated.body as HtmlRenderable, negotiated.contentType);
    return;
  }

  sendJson(response, negotiated.status, negotiated.body as JsonValue);
}

export function acceptHeader(request: IncomingMessage): string | undefined {
  const header = request.headers.accept;
  return typeof header === "string" ? header : undefined;
}
