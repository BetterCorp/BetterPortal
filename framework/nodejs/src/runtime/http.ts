import { type HtmlRenderable } from "./view.js";

export type HeaderMap = Headers | Record<string, string | string[] | undefined>;

export interface BetterPortalHeaderTrustOptions {
  trustedProxyHeaders?: boolean;
  cfProxy?: boolean;
}

function headerLookup(headers: HeaderMap, key: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }

  const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
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

function forwardedHostFromHeaderValue(value?: string): string | undefined {
  if (!value) return undefined;

  const firstEntry = value.split(",")[0]?.trim();
  if (!firstEntry) return undefined;

  for (const part of firstEntry.split(";")) {
    const [rawKey, ...rawValueParts] = part.split("=");
    if (rawKey?.trim().toLowerCase() !== "host") continue;
    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) return undefined;
    return rawValue.replace(/^"|"$/g, "");
  }

  return undefined;
}

export function hostFromHeaderValue(value?: string): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const forwardedHost = forwardedHostFromHeaderValue(value);
  if (forwardedHost) {
    return hostFromHeaderValue(forwardedHost);
  }

  const candidate = value.split(",")[0]?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.hostname) {
      return normalizedHostFromUrl(parsed);
    }
  } catch {
    /* try as a scheme-less host below */
  }

  try {
    return normalizedHostFromUrl(new URL(`https://${candidate}`));
  } catch {
    return null;
  }
}

function normalizedHostFromUrl(url: URL): string {
  const hostname = url.hostname.toLowerCase();
  if (!url.port || url.port === "80" || url.port === "443") {
    return hostname;
  }
  return `${hostname}:${url.port}`;
}

function trustedProxyHeaderCandidates(options: BetterPortalHeaderTrustOptions = {}): string[] {
  const candidates: string[] = [];
  if (options.trustedProxyHeaders) {
    candidates.push("forwarded", "x-forwarded-host", "x-original-host", "original-host");
  }
  if (options.cfProxy) {
    candidates.push("cf-connecting-host", "cf-original-host");
  }
  return candidates;
}

export function resolveEmbeddedSourceHeader(headers: HeaderMap, options: BetterPortalHeaderTrustOptions = {}): string | undefined {
  // NOTE: hx-current-url is deliberately NOT trusted - it is set by client-side
  // JS (HTMX) and is fully attacker-controllable, so it must never drive
  // tenant/app resolution. Rely on browser-enforced referer/origin instead, and
  // on proxy headers only when an upstream proxy is explicitly trusted.
  return firstHeaderValue(headers, [
    ":referer",
    "referer",
    ":origin",
    "origin",
    ...trustedProxyHeaderCandidates(options)
  ]);
}

export function resolveThemeSourceHeader(headers: HeaderMap, options: BetterPortalHeaderTrustOptions = {}): string | undefined {
  return firstHeaderValue(headers, [
    ":origin",
    "origin",
    ":referer",
    "referer",
    ":authority",
    "authority",
    ...trustedProxyHeaderCandidates(options)
  ]);
}

export function resolveEmbeddedHostname(headers: HeaderMap, options: BetterPortalHeaderTrustOptions = {}): string | null {
  return hostFromHeaderValue(resolveEmbeddedSourceHeader(headers, options));
}

export function resolveThemeHostname(headers: HeaderMap, options: BetterPortalHeaderTrustOptions = {}): string | null {
  return hostFromHeaderValue(resolveThemeSourceHeader(headers, options));
}

export function toHtmlString(body: HtmlRenderable): string {
  return typeof body === "string" ? body : body.toString();
}
