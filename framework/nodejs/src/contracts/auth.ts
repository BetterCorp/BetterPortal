import * as av from "anyvali";
import type { Infer } from "anyvali";
import { IdentityRealmSchema } from "./common.js";

const NonEmptyStringSchema = av.string().minLength(1);
const NonEmptyStringArraySchema = av.array(NonEmptyStringSchema).minItems(1);

export const TokenTypeSchema = av.enum_(["id", "refresh"] as const);
export type TokenType = Infer<typeof TokenTypeSchema>;

export const JwtClaimsSchema = av.object({
  iss: NonEmptyStringSchema,
  aud: av.union([NonEmptyStringSchema, NonEmptyStringArraySchema]),
  sub: NonEmptyStringSchema,
  exp: av.int().min(1),
  iat: av.int().min(0),
  jti: NonEmptyStringSchema,
  realm: IdentityRealmSchema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  roles: av.array(NonEmptyStringSchema).default([]),
  tokenType: TokenTypeSchema,
  policyVersion: av.optional(NonEmptyStringSchema)
}, { unknownKeys: "strip" });
export type JwtClaims = Infer<typeof JwtClaimsSchema>;

export const TokenLifetimeConfigSchema = av.object({
  idTokenSeconds: av.int().min(1).default(60 * 30),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7)
}, { unknownKeys: "strip" });
export type TokenLifetimeConfig = Infer<typeof TokenLifetimeConfigSchema>;

export const AuthAudienceRuleSchema = av.object({
  realm: IdentityRealmSchema,
  audiences: NonEmptyStringArraySchema
}, { unknownKeys: "strip" });
export type AuthAudienceRule = Infer<typeof AuthAudienceRuleSchema>;
