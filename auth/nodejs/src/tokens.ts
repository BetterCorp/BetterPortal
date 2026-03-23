import { createHmac, timingSafeEqual } from "node:crypto";
import { JwtClaims, JwtClaimsSchema } from "@betterportal/framework-nodejs";

export interface SignJwtOptions {
  secret: string;
  claims: JwtClaims;
}

export interface VerifyJwtOptions {
  secret: string;
  expectedIssuer?: string;
  expectedAudience?: string;
}

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(paddingLength)}`, "base64").toString("utf8");
}

function signSignature(unsignedToken: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(unsignedToken).digest("base64");
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function signJwt(options: SignJwtOptions): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT"
  };

  const claims = JwtClaimsSchema.parse(options.claims);
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signSignature(unsignedToken, options.secret);
  return `${unsignedToken}.${signature}`;
}

export function verifyJwt(token: string, options: VerifyJwtOptions): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT must contain exactly three parts");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = signSignature(`${encodedHeader}.${encodedPayload}`, options.secret);
  const providedSignature = Buffer.from(signature);
  const computedSignature = Buffer.from(expectedSignature);
  if (
    providedSignature.length !== computedSignature.length ||
    !timingSafeEqual(providedSignature, computedSignature)
  ) {
    throw new Error("Invalid JWT signature");
  }

  const parsedHeader = JSON.parse(decodeBase64Url(encodedHeader)) as JwtHeader;
  if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") {
    throw new Error("Unsupported JWT header");
  }

  const claims = JwtClaimsSchema.parse(JSON.parse(decodeBase64Url(encodedPayload)) as unknown);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowSeconds) {
    throw new Error("JWT is expired");
  }

  if (options.expectedIssuer && claims.iss !== options.expectedIssuer) {
    throw new Error("JWT issuer mismatch");
  }

  if (options.expectedAudience) {
    const audiences = typeof claims.aud === "string" ? [claims.aud] : claims.aud;
    if (!audiences.includes(options.expectedAudience)) {
      throw new Error("JWT audience mismatch");
    }
  }

  return claims;
}
