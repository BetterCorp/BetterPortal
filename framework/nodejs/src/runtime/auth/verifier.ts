import { createPublicKey } from "node:crypto";
import type { JwtClaims, TokenType } from "../../contracts/auth.js";
import type { JwtVerifier } from "../../contracts/route.js";
import { verifyJwt, type KeyResolver } from "./tokens.js";

export interface CreateJwksVerifierOptions {
  jwksUri: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedTokenType?: TokenType;
  clockToleranceSeconds?: number;
}

/**
 * Build a JwtVerifier that fetches signing keys from a remote JWKS endpoint.
 * Use when verifying tokens issued by a separate auth service.
 */
export function createJwksVerifier(options: CreateJwksVerifierOptions): JwtVerifier {
  return {
    verify(token: string): Promise<JwtClaims> {
      return verifyJwt(token, {
        jwks: { jwksUri: options.jwksUri, issuer: options.expectedIssuer },
        expectedIssuer: options.expectedIssuer,
        expectedAudience: options.expectedAudience,
        expectedTokenType: options.expectedTokenType,
        clockToleranceSeconds: options.clockToleranceSeconds
      });
    }
  };
}

export interface CreateLocalVerifierOptions {
  keyResolver: KeyResolver;
  expectedIssuer: string;
  expectedAudience: string;
  expectedTokenType?: TokenType;
  clockToleranceSeconds?: number;
}

export interface CreateStaticJwksVerifierOptions {
  /** JWKS document — keys pushed by the auth service at /install. */
  jwks: { keys: ReadonlyArray<Record<string, unknown>> };
  expectedIssuer: string;
  expectedAudience: string;
  expectedTokenType?: TokenType;
  clockToleranceSeconds?: number;
}

/**
 * Build a JwtVerifier that resolves signing keys from an in-memory JWKS doc.
 * Use when the CP cannot reach the issuer for live JWKS fetches — keys are
 * pushed by the auth service at /install (and on rotation) and cached in
 * app.auth.publicKeys.
 */
export function createStaticJwksVerifier(options: CreateStaticJwksVerifierOptions): JwtVerifier {
  const byKid = new Map<string, string>();
  for (const jwk of options.jwks.keys) {
    const kid = jwk.kid;
    if (typeof kid !== "string" || kid.length === 0) continue;
    try {
      const pem = createPublicKey({ key: jwk as never, format: "jwk" })
        .export({ type: "spki", format: "pem" }) as string;
      byKid.set(kid, pem);
    } catch {
      // Skip unparseable key; verifier will reject tokens that need it.
    }
  }
  const keyResolver: KeyResolver = async (kid: string) => {
    const pem = byKid.get(kid);
    if (!pem) throw new Error(`No public key for kid ${kid}`);
    return pem;
  };
  return {
    verify(token: string): Promise<JwtClaims> {
      return verifyJwt(token, {
        keyResolver,
        expectedIssuer: options.expectedIssuer,
        expectedAudience: options.expectedAudience,
        expectedTokenType: options.expectedTokenType,
        clockToleranceSeconds: options.clockToleranceSeconds
      });
    }
  };
}

/**
 * Build a JwtVerifier that uses an in-process key resolver.
 * Use when the verifying service is the same as the issuer (auth provider verifying its own refresh tokens).
 */
export function createLocalVerifier(options: CreateLocalVerifierOptions): JwtVerifier {
  return {
    verify(token: string): Promise<JwtClaims> {
      return verifyJwt(token, {
        keyResolver: options.keyResolver,
        expectedIssuer: options.expectedIssuer,
        expectedAudience: options.expectedAudience,
        expectedTokenType: options.expectedTokenType,
        clockToleranceSeconds: options.clockToleranceSeconds
      });
    }
  };
}
