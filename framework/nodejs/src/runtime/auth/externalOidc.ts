import { getSigningKeyForKid } from "./jwks.js";
import { verifyRs256Jwt } from "./jwtCrypto.js";

const KID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface VerifyExternalOidcTokenOptions {
  issuer: string;
  audience: string;
  jwksUri: string;
  clockToleranceSeconds?: number;
}

/** Verify a standards-based external OIDC token without requiring BetterPortal claims. */
export async function verifyExternalOidcToken(
  token: string,
  options: VerifyExternalOidcTokenOptions
): Promise<Record<string, unknown>> {
  if (!token || token.length > 16_384) throw new Error("OIDC token is empty or too long");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("OIDC token must have exactly three parts");

  const header = parseHeader(parts[0]!);
  if (header.alg !== "RS256") throw new Error("OIDC token algorithm must be RS256");
  if (header.typ !== undefined && header.typ !== "JWT") throw new Error("OIDC token typ must be JWT when present");
  if (typeof header.kid !== "string" || header.kid.length > 256 || !KID_PATTERN.test(header.kid)) {
    throw new Error("OIDC token has an invalid kid");
  }
  if ("jku" in header || "x5u" in header) throw new Error("OIDC token contains an untrusted key reference");

  const publicKey = await getSigningKeyForKid({ issuer: options.issuer, jwksUri: options.jwksUri }, header.kid);
  const verified = await verifyRs256Jwt(token, publicKey, {
    issuer: options.issuer,
    audience: options.audience,
    clockToleranceSeconds: options.clockToleranceSeconds ?? 30
  });
  if (!verified || typeof verified !== "object" || Array.isArray(verified)) {
    throw new Error("OIDC token claims are invalid");
  }
  if (typeof verified.sub !== "string" || verified.sub.length === 0) {
    throw new Error("OIDC token subject is missing");
  }
  if (typeof verified.exp !== "number" || !Number.isFinite(verified.exp)) {
    throw new Error("OIDC token expiry is missing or invalid");
  }
  return verified as Record<string, unknown>;
}

function parseHeader(encoded: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error("OIDC token header is invalid");
  }
}
