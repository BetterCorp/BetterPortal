import type { JwtClaims, TokenType } from "../../contracts/auth.js";
import type { JwtVerifier } from "../../contracts/route.js";
import { uuidv7 } from "../uuid.js";
import type { RsaKeyPair } from "./keypair.js";
import { signJwt, verifyJwt, type KeyResolver } from "./tokens.js";

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
  providerSubject?: string;
  provider?: JwtClaims["provider"];
  name?: string;
  email?: string;
  picture?: string;
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

  const signToken = (input: BpTokenUser, tokenType: TokenType, expiresInSeconds: number, tokenId = uuidv7()): string => signJwt({
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
    signAccessToken(input: BpTokenUser): string {
      return signToken(input, "access", options.accessTokenSeconds);
    },

    issueTokenPair(input: BpTokenUser, pairOptions: { includeRefreshToken?: boolean } = { includeRefreshToken: true }): BpIssuedTokenPair {
      const tokenId = uuidv7();
      const accessToken = signToken(input, "access", options.accessTokenSeconds, tokenId);
      if (!pairOptions.includeRefreshToken) {
        return {
          tokenId,
          accessToken,
          accessTokenExpiresInSeconds: options.accessTokenSeconds
        };
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
