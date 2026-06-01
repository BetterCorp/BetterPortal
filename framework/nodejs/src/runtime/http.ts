import { type HtmlRenderable } from "./view.js";

export type HeaderMap = Headers | Record<string, string | string[] | undefined>;

function headerLookup(headers: HeaderMap, key: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }

  const value = headers[key];
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
  }

  return typeof value === "string" ? value : undefined;
}

function firstHeaderValue(headers: HeaderMap, candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    const value = headerLookup(headers, candidate);
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
