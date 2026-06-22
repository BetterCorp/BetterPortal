import { createPublicKey } from "node:crypto";

const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

interface CachedClient {
  keys: Map<string, string>;
  jwksUri: string;
  lastUsed: number;
}

const clientCache = new Map<string, CachedClient>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface JwksLookupOptions {
  jwksUri: string;
  issuer: string;
}

async function getJwksKeys(options: JwksLookupOptions): Promise<Map<string, string>> {
  const cacheKey = `${options.issuer}|${options.jwksUri}`;
  const now = Date.now();

  const existing = clientCache.get(cacheKey);
  if (existing && now - existing.lastUsed < CACHE_TTL_MS) {
    existing.lastUsed = now;
    return existing.keys;
  }

  const response = await fetch(options.jwksUri, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000)
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${options.jwksUri} HTTP ${response.status} ${text.slice(0, 160)}`);
  }
  if (!contentType.includes("application/json") && !contentType.includes("application/jwk-set+json")) {
    throw new Error(`JWKS endpoint returned non-JSON: ${options.jwksUri} content-type=${contentType || "(missing)"} body=${text.slice(0, 160)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`JWKS endpoint returned invalid JSON: ${options.jwksUri}: ${(error as Error).message}`);
  }

  const rawKeys = (parsed as { keys?: unknown }).keys;
  if (!Array.isArray(rawKeys)) {
    throw new Error(`JWKS endpoint missing keys array: ${options.jwksUri}`);
  }

  const keys = new Map<string, string>();
  for (const rawKey of rawKeys) {
    const kid = (rawKey as { kid?: unknown }).kid;
    if (typeof kid !== "string" || kid.length === 0) continue;
    try {
      const pem = createPublicKey({ key: rawKey as never, format: "jwk" }).export({ type: "spki", format: "pem" }) as string;
      keys.set(kid, pem);
    } catch {
      // Skip unusable keys; lookup below reports the missing kid.
    }
  }

  clientCache.set(cacheKey, { keys, jwksUri: options.jwksUri, lastUsed: now });
  return keys;
}

export async function getSigningKeyForKid(
  options: JwksLookupOptions,
  kid: string
): Promise<string> {
  if (typeof kid !== "string" || kid.length === 0 || kid.length > 256) {
    throw new Error("Invalid kid: empty or too long");
  }
  if (!KID_PATTERN.test(kid)) {
    throw new Error(`Invalid kid: must match ${KID_PATTERN.source}`);
  }

  const keys = await getJwksKeys(options);
  const key = keys.get(kid);
  if (!key) {
    throw new Error(`JWKS key not found for kid ${kid}: ${options.jwksUri}`);
  }
  return key;
}

export function clearJwksCache(): void {
  clientCache.clear();
}
