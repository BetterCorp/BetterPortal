import jwt from "jsonwebtoken";
import jwksClient, { type JwksClient } from "jwks-rsa";
import {
  ServiceConfigTicketClaimsSchema,
  type ServiceConfigAction,
  type ServiceConfigTicketClaims
} from "../contracts/serviceConfig.js";
import { uuidv7 } from "./uuid.js";

const ALLOWED_ALGORITHM = "RS256" as const;
const ALLOWED_TYP = "JWT" as const;
const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Audience every BetterPortal service-config ticket is minted for. */
export const CONFIG_TICKET_AUDIENCE = "betterportal-service-config";

// ── Signing (control plane) ──────────────────────────────────────────

export interface SignServiceConfigTicketOptions {
  /** PEM of the CP signing key (cpState.keyPair.privateKeyPem). */
  privateKeyPem: string;
  /** kid published in the CP JWKS. */
  kid: string;
  /** CP issuer (cpState.issuer); becomes the `iss` claim and verifier expectation. */
  issuer: string;
  tenantId: string;
  serviceId: string;
  actions: ServiceConfigAction[];
  subject?: string;
  bindingId?: string;
  expiresInSeconds: number;
  jti?: string;
}

/**
 * Mint a config ticket as an RS256 JWT signed by the control plane's key.
 * Replaces the legacy symmetric HMAC ticket — services verify it against the
 * CP JWKS, so no shared secret is required and only the CP can issue tickets.
 */
export function signServiceConfigTicket(options: SignServiceConfigTicketOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = ServiceConfigTicketClaimsSchema.parse({
    iss: options.issuer,
    aud: [CONFIG_TICKET_AUDIENCE],
    sub: options.subject ?? "betterportal-control-plane",
    exp: now + options.expiresInSeconds,
    iat: now,
    jti: options.jti ?? uuidv7(),
    realm: "control-plane",
    tenantId: options.tenantId,
    serviceId: options.serviceId,
    ...(options.bindingId ? { bindingId: options.bindingId } : {}),
    actions: options.actions
  });

  return jwt.sign(claims as object, options.privateKeyPem, {
    algorithm: ALLOWED_ALGORITHM,
    keyid: options.kid,
    header: { alg: ALLOWED_ALGORITHM, typ: ALLOWED_TYP, kid: options.kid }
  });
}

// ── Verification (service) ───────────────────────────────────────────

interface CachedClient {
  client: JwksClient;
  lastUsed: number;
}

const clientCache = new Map<string, CachedClient>();
const CLIENT_CACHE_TTL_MS = 30 * 60 * 1000;

function getJwksClient(jwksUri: string, issuer: string): JwksClient {
  const cacheKey = `${issuer}|${jwksUri}`;
  const now = Date.now();
  const existing = clientCache.get(cacheKey);
  if (existing && now - existing.lastUsed < CLIENT_CACHE_TTL_MS) {
    existing.lastUsed = now;
    return existing.client;
  }
  const client = jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 30,
    timeout: 5000
  });
  clientCache.set(cacheKey, { client, lastUsed: now });
  return client;
}

export interface VerifyServiceConfigTicketOptions {
  /** JWKS endpoint of the issuing control plane (delivered to the service at redeem). */
  jwksUri?: string;
  /** In-process key lookup, used instead of jwksUri when supplied (no network). */
  keyResolver?: (kid: string) => Promise<string> | string;
  /** Expected `iss` — the CP URL the service was installed against. */
  issuer: string;
  /** This service's id; the ticket's `serviceId` must match. */
  serviceId: string;
  clockToleranceSeconds?: number;
}

/**
 * Verify a CP-signed config ticket against the CP JWKS. Throws on any failure.
 * Pins RS256, rejects jku/x5u key references, and re-checks iss/aud/exp/serviceId
 * after library verification (defence in depth).
 */
export async function verifyServiceConfigTicket(
  token: string,
  options: VerifyServiceConfigTicketOptions
): Promise<ServiceConfigTicketClaims> {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Config ticket is empty");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Config ticket must have exactly three parts");
  }

  const header = parseHeader(parts[0]);
  if (header.alg !== ALLOWED_ALGORITHM) {
    throw new Error(`Algorithm not allowed: ${String(header.alg)}`);
  }
  if (header.typ !== ALLOWED_TYP) {
    throw new Error(`Ticket typ not allowed: ${String(header.typ)}`);
  }
  if ("jku" in header || "x5u" in header) {
    throw new Error("Ticket header contains untrusted reference (jku/x5u)");
  }
  const kid = header.kid;
  if (typeof kid !== "string" || !KID_PATTERN.test(kid) || kid.length > 256) {
    throw new Error("Invalid kid");
  }

  let publicKeyPem: string;
  if (options.keyResolver) {
    publicKeyPem = await options.keyResolver(kid);
  } else if (options.jwksUri) {
    publicKeyPem = (await getJwksClient(options.jwksUri, options.issuer).getSigningKey(kid)).getPublicKey();
  } else {
    throw new Error("verifyServiceConfigTicket requires either jwksUri or keyResolver");
  }

  let verified: unknown;
  try {
    verified = jwt.verify(token, publicKeyPem, {
      algorithms: [ALLOWED_ALGORITHM],
      issuer: options.issuer,
      audience: CONFIG_TICKET_AUDIENCE,
      clockTolerance: options.clockToleranceSeconds ?? 0,
      complete: false
    });
  } catch (error) {
    throw new Error(`Config ticket verification failed: ${(error as Error).message}`);
  }
  if (!verified || typeof verified !== "object") {
    throw new Error("Config ticket verifier returned non-object claims");
  }

  const claims = ServiceConfigTicketClaimsSchema.parse(verified);

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockToleranceSeconds ?? 0;
  if (claims.exp <= now - tolerance) {
    throw new Error("Config ticket expired (manual re-check)");
  }
  if (claims.iss !== options.issuer) {
    throw new Error(`Config ticket issuer mismatch (manual re-check) (${claims.iss} != ${options.issuer}`);
  }
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(CONFIG_TICKET_AUDIENCE)) {
    throw new Error(`Config ticket audience mismatch (manual re-check) (${CONFIG_TICKET_AUDIENCE} != ${auds.join(',')})`);
  }
  if (claims.serviceId !== options.serviceId) {
    throw new Error(`Config ticket serviceId mismatch (manual re-check) (${claims.serviceId} != ${options.serviceId})`);
  }

  return claims;
}

/**
 * Build a `validateTicket` callback for `registerServiceConfigRoutes` that
 * verifies CP-signed tickets against the CP JWKS. Returns null (not throw) on
 * any failure so the route responds 401 rather than 500.
 */
export function createCpConfigTicketValidator(
  options: VerifyServiceConfigTicketOptions
): (ticketValue: string | null, ...rest: unknown[]) => Promise<ServiceConfigTicketClaims | null> {
  return async (ticketValue: string | null) => {
    if (!ticketValue) return null;
    try {
      return await verifyServiceConfigTicket(ticketValue, options);
    } catch {
      return null;
    }
  };
}

export function clearConfigTicketJwksCache(): void {
  clientCache.clear();
}

function parseHeader(encodedHeader: string): Record<string, unknown> {
  let json: string;
  try {
    json = Buffer.from(encodedHeader, "base64url").toString("utf8");
  } catch {
    throw new Error("Config ticket header is not valid base64url");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Config ticket header is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Config ticket header is not an object");
  }
  return parsed as Record<string, unknown>;
}
