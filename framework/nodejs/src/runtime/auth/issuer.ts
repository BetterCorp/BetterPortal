import type { ElevationClaims, JwtClaims, TokenType } from "../../contracts/auth.js";
import type { JsonObject } from "../../contracts/json.js";
import type { JwtVerifier } from "../../contracts/route.js";
import { uuidv7 } from "../uuid.js";
import type { RsaKeyPair } from "./keypair.js";
import { signJwt, verifyJwt, type KeyResolver } from "./tokens.js";
import { sign, verify } from "node:crypto";

export interface BpTokenIssuerOptions {
  keyPair: RsaKeyPair;
  issuer: string;
  audience: string;
  accessTokenSeconds: number;
  refreshTokenSeconds?: number;
}

export interface BpTokenUser {
  sub: string;
  tenantId: string;
  appId: string;
  roles?: string[];
  authProvider?: string;
  refreshContext?: JsonObject;
  sessionId?: string;
  sessionVersion?: number;
  providerSubject?: string;
  provider?: JwtClaims["provider"];
  name?: string;
  email?: string;
  picture?: string;
}

export interface BpTokenPairUser extends BpTokenUser {
  authProvider: string;
  refreshContext: JsonObject;
}

export interface BpIssuedTokenPair {
  tokenId: string;
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken?: string;
  refreshTokenExpiresInSeconds?: number;
}

export interface BpRefreshTokenValidation {
  refreshToken: string;
  tenantId: string;
  appId: string;
}

export function createBpTokenIssuer(options: BpTokenIssuerOptions) {
  const keyResolver: KeyResolver = async (kid) => {
    if (kid !== options.keyPair.kid) throw new Error("Unknown signing key");
    return options.keyPair.publicKeyPem;
  };

  const signToken = (input: BpTokenUser, tokenType: TokenType, expiresInSeconds: number, tokenId = uuidv7(), elevation?: ElevationClaims): string => signJwt({
    privateKeyPem: options.keyPair.privateKeyPem,
    kid: options.keyPair.kid,
    claims: {
      iss: options.issuer,
      aud: options.audience,
      sub: input.sub,
      tenantId: input.tenantId,
      appId: input.appId,
      roles: tokenType === "refresh" ? [] : (input.roles ?? []),
      realm: "runtime",
      tokenType,
      authProvider: input.authProvider,
      elevation: tokenType === "access" ? elevation : undefined,
      sessionId: tokenType === "access" ? input.sessionId : undefined,
      sessionVersion: tokenType === "access" ? input.sessionVersion : undefined,
      refreshContext: tokenType === 'refresh' ? input.refreshContext : undefined,
      providerSubject: input.providerSubject,
      provider: input.provider,
      name: input.name,
      email: input.email,
      picture: input.picture,
      expiresInSeconds,
      jti: tokenId
    }
  });

  return {
    accessTokenSeconds: options.accessTokenSeconds,
    signConfirmationChallenge(user: JwtClaims): string {
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({ iss: options.issuer, aud: options.audience, sub: user.sub, tenantId: user.tenantId, appId: user.appId, jti: user.jti, nonce: uuidv7(), iat: now, exp: Math.min(user.exp, now + 300) })).toString("base64url");
      const receipt = `bp-confirm-v1.${payload}`;
      return `${receipt}.${sign("RSA-SHA256", Buffer.from(receipt), options.keyPair.privateKeyPem).toString("base64url")}`;
    },

    verifyConfirmationChallenge(user: JwtClaims, receipt: string): number {
      if (receipt.length > 8192) throw new Error("Invalid confirmation receipt");
      const [purpose, payload, signature, extra] = receipt.split(".");
      if (purpose !== "bp-confirm-v1" || !payload || !signature || extra !== undefined
        || !verify("RSA-SHA256", Buffer.from(`${purpose}.${payload}`), options.keyPair.publicKeyPem, Buffer.from(signature, "base64url"))) throw new Error("Invalid confirmation receipt");
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      const now = Math.floor(Date.now() / 1000);
      if (data.iss !== options.issuer || data.aud !== options.audience || data.sub !== user.sub || data.tenantId !== user.tenantId || data.appId !== user.appId || data.jti !== user.jti
        || !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp) || data.iat > now || data.iat < 0 || data.exp <= now || data.exp > user.exp || data.exp > data.iat + 300) throw new Error("Invalid confirmation receipt");
      // Repeated completion never makes an old confirmation fresh again.
      return data.iat;
    },
    // The caller must verify a server-side challenge before invoking this hook.
    // Normal access/refresh issuance deliberately never copies elevation.
    signElevatedAccessToken(input: BpTokenUser, elevation: ElevationClaims, expiresInSeconds: number): string {
      const now = Math.floor(Date.now() / 1000);
      const lifetime = Math.min(options.accessTokenSeconds, Math.floor(expiresInSeconds));
      if (lifetime < 1 || elevation.verifiedAt > now || elevation.expiresAt > now + lifetime
        || elevation.expiresAt <= now || elevation.verifiedAt >= elevation.expiresAt) throw new Error("Invalid elevation lifetime");
      return signToken(input, "access", lifetime, uuidv7(), elevation);
    },

    signAccessToken(input: BpTokenUser): string {
      return signToken(input, "access", options.accessTokenSeconds);
    },

    issueTokenPair(input: BpTokenPairUser, pairOptions: { includeRefreshToken?: boolean } = { includeRefreshToken: true }): BpIssuedTokenPair {
      const tokenId = uuidv7();
      const accessToken = signToken(input, "access", options.accessTokenSeconds, tokenId);
      if (pairOptions.includeRefreshToken === false) {
        return {
          tokenId,
          accessToken,
          accessTokenExpiresInSeconds: options.accessTokenSeconds
        };
      }
      if (!input.authProvider) {
        throw new Error("authProvider is required to issue refresh tokens");
      }
      if (!input.refreshContext) {
        throw new Error('refreshContext is required to issue refresh tokens');
      }
      if (!options.refreshTokenSeconds) {
        throw new Error("refreshTokenSeconds is required to issue refresh tokens");
      }
      return {
        tokenId,
        accessToken,
        accessTokenExpiresInSeconds: options.accessTokenSeconds,
        refreshToken: signToken(input, "refresh", options.refreshTokenSeconds, tokenId),
        refreshTokenExpiresInSeconds: options.refreshTokenSeconds
      };
    },

    async verifyRefreshToken(input: BpRefreshTokenValidation): Promise<JwtClaims> {
      const claims = await verifyJwt(input.refreshToken, {
        keyResolver,
        expectedIssuer: options.issuer,
        expectedAudience: options.audience,
        expectedTokenType: "refresh"
      });
      if (claims.tenantId !== input.tenantId || claims.appId !== input.appId) {
        throw new Error("Refresh token bound to a different tenant/app");
      }
      return claims;
    },

    verifier(expectedTokenType: TokenType = "access"): JwtVerifier {
      return {
        verify(token: string): Promise<JwtClaims> {
          return verifyJwt(token, {
            keyResolver,
            expectedIssuer: options.issuer,
            expectedAudience: options.audience,
            expectedTokenType
          });
        }
      };
    }
  };
}

export type BpTokenIssuer = ReturnType<typeof createBpTokenIssuer>;
