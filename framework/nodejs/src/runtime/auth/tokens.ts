import jwt, { type JwtHeader, type SignOptions } from "jsonwebtoken";
import { JwtClaimsSchema, type JwtClaims, type TokenType } from "../../contracts/auth.js";
import { uuidv7 } from "../uuid.js";
import { getSigningKeyForKid, type JwksLookupOptions } from "./jwks.js";

const ALLOWED_ALGORITHM = "RS256" as const;
const ALLOWED_TYP = "JWT" as const;
const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface SignJwtOptions {
  privateKeyPem: string;
  kid: string;
  claims: Omit<JwtClaims, "iss" | "aud" | "exp" | "iat" | "jti"> & {
    iss: string;
    aud: string | string[];
    expiresInSeconds: number;
    jti?: string;
  };
}

export type KeyResolver = (kid: string) => Promise<string>;

export interface VerifyJwtOptions {
  jwks?: JwksLookupOptions;
  keyResolver?: KeyResolver;
  expectedIssuer: string;
  expectedAudience: string;
  expectedTokenType?: TokenType;
  clockToleranceSeconds?: number;
}

export function signJwt(options: SignJwtOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const { expiresInSeconds, jti, ...rest } = options.claims;
  const fullClaims = {
    ...rest,
    iat: now,
    exp: now + expiresInSeconds,
    jti: jti ?? generateJti()
  };

  const validated = JwtClaimsSchema.parse(fullClaims);

  const signOptions: SignOptions = {
    algorithm: ALLOWED_ALGORITHM,
    keyid: options.kid,
    header: { alg: ALLOWED_ALGORITHM, typ: ALLOWED_TYP, kid: options.kid }
  };

  return jwt.sign(validated as object, options.privateKeyPem, signOptions);
}

export async function verifyJwt(token: string, options: VerifyJwtOptions): Promise<JwtClaims> {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Token is empty");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Token must have exactly three parts");
  }

  const [encodedHeader] = parts;
  const header = parseHeader(encodedHeader);

  if (header.alg !== ALLOWED_ALGORITHM) {
    throw new Error(`Algorithm not allowed: ${String(header.alg)}`);
  }
  if (header.typ !== ALLOWED_TYP) {
    throw new Error(`Token typ not allowed: ${String(header.typ)}`);
  }
  if (typeof header.kid !== "string") {
    throw new Error("Token header missing kid");
  }
  if ("jku" in header || "x5u" in header) {
    throw new Error("Token header contains untrusted reference (jku/x5u)");
  }
  if (!KID_PATTERN.test(header.kid) || header.kid.length > 256) {
    throw new Error(`Invalid kid: must match ${KID_PATTERN.source}`);
  }

  const publicKeyPem = options.keyResolver
    ? await options.keyResolver(header.kid)
    : await getSigningKeyForKid(requireJwks(options), header.kid);

  let libVerified: unknown;
  try {
    libVerified = jwt.verify(token, publicKeyPem, {
      algorithms: [ALLOWED_ALGORITHM],
      issuer: options.expectedIssuer,
      audience: options.expectedAudience,
      clockTolerance: options.clockToleranceSeconds ?? 0,
      complete: false
    });
  } catch (error) {
    throw new Error(`Library verification failed: ${(error as Error).message}`);
  }

  if (!libVerified || typeof libVerified !== "object") {
    throw new Error("Library returned non-object claims");
  }

  const claims = JwtClaimsSchema.parse(libVerified);

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockToleranceSeconds ?? 0;
  if (claims.exp <= now - tolerance) {
    throw new Error("Token is expired (manual re-check)");
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + tolerance) {
    throw new Error("Token is not yet valid (manual re-check)");
  }
  if (claims.iss !== options.expectedIssuer) {
    throw new Error(`EIssuer mismatch (manual re-check) (${claims.iss} != ${options.expectedIssuer}`);
  }
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(options.expectedAudience)) {
    throw new Error(`Audience mismatch (manual re-check) (${options.expectedAudience} != ${auds.join(',')})`);
  }
  if (typeof claims.tenantId !== "string" || claims.tenantId.length === 0) {
    throw new Error("tenantId missing or empty");
  }
  if (typeof claims.appId !== "string" || claims.appId.length === 0) {
    throw new Error("appId missing or empty");
  }
  if (!Array.isArray(claims.roles)) {
    throw new Error("roles missing");
  }
  if (claims.roles.some((role) => typeof role !== "string" || role.length === 0)) {
    throw new Error("roles entries invalid");
  }
  if (options.expectedTokenType && claims.tokenType !== options.expectedTokenType) {
    throw new Error(`Token type mismatch: expected ${options.expectedTokenType}, got ${claims.tokenType}`);
  }

  return claims;
}

function parseHeader(encodedHeader: string): JwtHeader & { kid?: string; jku?: string; x5u?: string } {
  let json: string;
  try {
    json = Buffer.from(encodedHeader, "base64url").toString("utf8");
  } catch {
    throw new Error("Token header is not valid base64url");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Token header is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Token header is not an object");
  }
  return parsed as JwtHeader & { kid?: string; jku?: string; x5u?: string };
}

function generateJti(): string {
  return uuidv7();
}

function requireJwks(options: VerifyJwtOptions): JwksLookupOptions {
  if (!options.jwks) {
    throw new Error("verifyJwt requires either jwks or keyResolver");
  }
  return options.jwks;
}

export function unsafeDecodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token must have exactly three parts");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}
