import jwt from "jsonwebtoken";
import {
  CpEnvelopeClaimsSchema,
  SetupTokenClaimsSchema,
  type CpEnvelopeClaims,
  type SetupTokenClaims
} from "../../contracts/auth.js";
import { uuidv7 } from "../uuid.js";
import { getSigningKeyForKid, type JwksLookupOptions } from "./jwks.js";

const ALLOWED_ALGORITHM = "RS256" as const;
const ALLOWED_TYP = "JWT" as const;
const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface SignCpEnvelopeOptions {
  privateKeyPem: string;
  kid: string;
  claims: Omit<CpEnvelopeClaims, "exp" | "iat" | "jti"> & {
    expiresInSeconds: number;
    jti?: string;
  };
}

export interface SignSetupTokenOptions {
  privateKeyPem: string;
  kid: string;
  claims: Omit<SetupTokenClaims, "exp" | "iat" | "jti"> & {
    expiresInSeconds: number;
    jti?: string;
  };
}

export interface VerifyEnvelopeOptions {
  /** JWKS lookup details for the issuer (CP). */
  jwks?: JwksLookupOptions;
  /** Or an in-process key resolver (preferred for installer flow). */
  keyResolver?: (kid: string) => Promise<string>;
  expectedIssuer: string;
  expectedAudience?: string;
  clockToleranceSeconds?: number;
}

export function signCpEnvelope(options: SignCpEnvelopeOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const { expiresInSeconds, jti, ...rest } = options.claims;
  const fullClaims = {
    ...rest,
    iat: now,
    exp: now + expiresInSeconds,
    jti: jti ?? uuidv7()
  };

  const validated = CpEnvelopeClaimsSchema.parse(fullClaims);
  return jwt.sign(validated as object, options.privateKeyPem, {
    algorithm: ALLOWED_ALGORITHM,
    keyid: options.kid,
    header: { alg: ALLOWED_ALGORITHM, typ: ALLOWED_TYP, kid: options.kid }
  });
}

export function signSetupToken(options: SignSetupTokenOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const { expiresInSeconds, jti, ...rest } = options.claims;
  const fullClaims = {
    ...rest,
    iat: now,
    exp: now + expiresInSeconds,
    jti: jti ?? uuidv7()
  };

  const validated = SetupTokenClaimsSchema.parse(fullClaims);
  return jwt.sign(validated as object, options.privateKeyPem, {
    algorithm: ALLOWED_ALGORITHM,
    keyid: options.kid,
    header: { alg: ALLOWED_ALGORITHM, typ: ALLOWED_TYP, kid: options.kid }
  });
}

export async function verifyCpEnvelope(token: string, options: VerifyEnvelopeOptions): Promise<CpEnvelopeClaims> {
  const claims = await verifyTypedToken(token, options);
  if (claims.tokenType !== "cp-envelope") {
    throw new Error(`Expected cp-envelope token, got ${String(claims.tokenType)}`);
  }
  return CpEnvelopeClaimsSchema.parse(claims);
}

export async function verifySetupToken(token: string, options: VerifyEnvelopeOptions): Promise<SetupTokenClaims> {
  const claims = await verifyTypedToken(token, options);
  if (claims.tokenType !== "setup") {
    throw new Error(`Expected setup token, got ${String(claims.tokenType)}`);
  }
  return SetupTokenClaimsSchema.parse(claims);
}

async function verifyTypedToken(token: string, options: VerifyEnvelopeOptions): Promise<Record<string, unknown>> {
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
  if (typeof header.kid !== "string" || !KID_PATTERN.test(header.kid)) {
    throw new Error("Invalid kid");
  }
  if ("jku" in header || "x5u" in header) {
    throw new Error("Token header contains untrusted reference (jku/x5u)");
  }

  const publicKeyPem = options.keyResolver
    ? await options.keyResolver(header.kid)
    : await getSigningKeyForKid(requireJwks(options), header.kid);

  let verified: unknown;
  try {
    verified = jwt.verify(token, publicKeyPem, {
      algorithms: [ALLOWED_ALGORITHM],
      issuer: options.expectedIssuer,
      audience: options.expectedAudience,
      clockTolerance: options.clockToleranceSeconds ?? 0,
      complete: false
    });
  } catch (error) {
    throw new Error(`Envelope verification failed: ${(error as Error).message}`);
  }
  if (!verified || typeof verified !== "object") {
    throw new Error("Verifier returned non-object claims");
  }
  return verified as Record<string, unknown>;
}

function parseHeader(encodedHeader: string): Record<string, unknown> {
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
  return parsed as Record<string, unknown>;
}

function requireJwks(options: VerifyEnvelopeOptions): JwksLookupOptions {
  if (!options.jwks) {
    throw new Error("verifyEnvelope requires either jwks or keyResolver");
  }
  return options.jwks;
}
