import { z } from "zod";
import { IdentityRealmSchema } from "./common";

export const TokenTypeSchema = z.enum(["id", "refresh"]);
export type TokenType = z.infer<typeof TokenTypeSchema>;

export const JwtClaimsSchema = z.object({
  iss: z.string().min(1),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  sub: z.string().min(1),
  exp: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  jti: z.string().min(1),
  realm: IdentityRealmSchema,
  tenantId: z.string().min(1),
  appId: z.string().min(1).optional(),
  roles: z.array(z.string().min(1)).default([]),
  tokenType: TokenTypeSchema,
  policyVersion: z.string().min(1).optional()
});
export type JwtClaims = z.infer<typeof JwtClaimsSchema>;

export const TokenLifetimeConfigSchema = z.object({
  idTokenSeconds: z.number().int().positive().default(60 * 30),
  refreshTokenSeconds: z.number().int().positive().default(60 * 60 * 24 * 7)
});
export type TokenLifetimeConfig = z.infer<typeof TokenLifetimeConfigSchema>;

export const AuthAudienceRuleSchema = z.object({
  realm: IdentityRealmSchema,
  audiences: z.array(z.string().min(1)).min(1)
});
export type AuthAudienceRule = z.infer<typeof AuthAudienceRuleSchema>;
