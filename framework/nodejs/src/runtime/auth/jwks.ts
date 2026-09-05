import { createPublicKey } from "node:crypto";

const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

interface CachedClient {
  keys: Map<string, string>;
  jwksUri: string;
  fetchedAt: number;
}

const clientCache = new Map<string, CachedClient>();
const refreshes = new Map<string, Promise<CachedClient>>();
const nextMissRefreshAt = new Map<string, number>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MISS_REFRESH_INTERVAL_MS = 2_000;
let cacheGeneration = 0;

export interface JwksLookupOptions {
  jwksUri: string;
  issuer: string;
}

function getCacheKey(options: JwksLookupOptions): string {
  return `${options.issuer}|${options.jwksUri}`;
}

async function loadJwksKeys(options: JwksLookupOptions, generation: number): Promise<CachedClient> {
  const cacheKey = getCacheKey(options);
  const now = Date.now();

  let response: Response;
  try {
    response = await fetch(options.jwksUri, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    throw new Error(`JWKS fetch failed: ${options.jwksUri}: ${networkErrorDetails(error)}`, { cause: error });
  }
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
    throw new Error(`JWKS endpoint returned invalid JSON: ${options.jwksUri}: ${(error as Error).message}`, { cause: error });
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

  const client = { keys, jwksUri: options.jwksUri, fetchedAt: now };
  if (generation === cacheGeneration) {
    clientCache.set(cacheKey, client);
    nextMissRefreshAt.set(cacheKey, now + MISS_REFRESH_INTERVAL_MS);
  }
  return client;
}

function refreshJwksKeys(options: JwksLookupOptions): Promise<CachedClient> {
  const cacheKey = getCacheKey(options);
  const existing = refreshes.get(cacheKey);
  if (existing) return existing;

  const refresh = loadJwksKeys(options, cacheGeneration);
  refreshes.set(cacheKey, refresh);
  const clearRefresh = (): void => {
    if (refreshes.get(cacheKey) === refresh) refreshes.delete(cacheKey);
  };
  void refresh.then(clearRefresh, clearRefresh);
  return refresh;
}

async function getJwksKeys(options: JwksLookupOptions): Promise<CachedClient> {
  const existing = clientCache.get(getCacheKey(options));
  if (existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) return existing;
  return refreshJwksKeys(options);
}

function networkErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error
    ? error.cause as Error & { code?: unknown; syscall?: unknown; hostname?: unknown; address?: unknown; port?: unknown }
    : undefined;
  const fields = [
    error.message,
    cause?.code ? `code=${String(cause.code)}` : undefined,
    cause?.syscall ? `syscall=${String(cause.syscall)}` : undefined,
    cause?.hostname ? `hostname=${String(cause.hostname)}` : undefined,
    cause?.address ? `address=${String(cause.address)}` : undefined,
    cause?.port ? `port=${String(cause.port)}` : undefined,
    cause?.message ? `cause=${cause.message}` : undefined
  ];
  return fields.filter(Boolean).join(" ");
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

  const cacheKey = getCacheKey(options);
  let client = await getJwksKeys(options);
  let key = client.keys.get(kid);
  const pendingRefresh = refreshes.get(cacheKey);
  if (!key && pendingRefresh) {
    client = await pendingRefresh;
    key = client.keys.get(kid);
  } else if (!key && Date.now() >= (nextMissRefreshAt.get(cacheKey) ?? 0)) {
    nextMissRefreshAt.set(cacheKey, Date.now() + MISS_REFRESH_INTERVAL_MS);
    client = await refreshJwksKeys(options);
    key = client.keys.get(kid);
  }
  if (!key) {
    throw new Error(`JWKS key not found for kid ${kid}: ${options.jwksUri}`);
  }
  return key;
}

export function clearJwksCache(): void {
  cacheGeneration += 1;
  clientCache.clear();
  refreshes.clear();
  nextMissRefreshAt.clear();
}
