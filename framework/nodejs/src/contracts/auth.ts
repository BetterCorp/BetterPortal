import * as av from "anyvali";
import type { Infer } from "anyvali";
import { IdentityRealmSchema, UuidV7Schema } from "./common.js";

const NonEmptyStringSchema = av.string().minLength(1);
const NonEmptyStringArraySchema = av.array(NonEmptyStringSchema).minItems(1);

export const TokenTypeSchema = av.enum_(["access", "refresh", "cp-envelope", "setup", "install"] as const);
export type TokenType = Infer<typeof TokenTypeSchema>;

export const JwtClaimsSchema = av.object({
  iss: NonEmptyStringSchema,
  aud: av.union([NonEmptyStringSchema, NonEmptyStringArraySchema]),
  sub: NonEmptyStringSchema,
  exp: av.int().min(1),
  iat: av.int().min(0),
  nbf: av.optional(av.int().min(0)),
  jti: NonEmptyStringSchema,
  realm: IdentityRealmSchema,
  tenantId: UuidV7Schema,
  appId: UuidV7Schema,
  roles: av.array(NonEmptyStringSchema).default([]),
  tokenType: TokenTypeSchema,
  authProvider: av.optional(av.string().minLength(1)),
  providerSubject: av.optional(av.string().minLength(1)),
  provider: av.optional(av.object({
    username: av.optional(av.string()),
    profileUrl: av.optional(av.string()),
    accountId: av.optional(av.union([av.string(), av.number()])),
    nodeId: av.optional(av.string()),
    scope: av.optional(av.string())
  }, { unknownKeys: "strip" })),
  name: av.optional(av.string()),
  email: av.optional(av.string()),
  picture: av.optional(av.string())
}, { unknownKeys: "strip" });
export type JwtClaims = Infer<typeof JwtClaimsSchema>;

export const TokenLifetimeConfigSchema = av.object({
  accessTokenSeconds: av.int().min(1).default(60 * 15),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7)
}, { unknownKeys: "strip" });
export type TokenLifetimeConfig = Infer<typeof TokenLifetimeConfigSchema>;

export const AuthAudienceRuleSchema = av.object({
  realm: IdentityRealmSchema,
  audiences: NonEmptyStringArraySchema
}, { unknownKeys: "strip" });
export type AuthAudienceRule = Infer<typeof AuthAudienceRuleSchema>;

export const AppAuthPermissionActionSchema = av.enum_(["read", "create", "update", "delete"] as const);
export type AppAuthPermissionAction = Infer<typeof AppAuthPermissionActionSchema>;

export const AppAuthPermissionGrantSchema = av.object({
  serviceId: UuidV7Schema,
  viewId: NonEmptyStringSchema,
  permissions: av.array(AppAuthPermissionActionSchema).minItems(1)
}, { unknownKeys: "strip" });
export type AppAuthPermissionGrant = Infer<typeof AppAuthPermissionGrantSchema>;

export const AppAuthRoleSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  permissions: av.array(AppAuthPermissionGrantSchema).default([])
}, { unknownKeys: "strip" });
export type AppAuthRole = Infer<typeof AppAuthRoleSchema>;

export const DefaultAuthProviderConfigSchema = av.object({
  kind: av.literal("betterportal.default")
}, { unknownKeys: "strip" });
export type DefaultAuthProviderConfig = Infer<typeof DefaultAuthProviderConfigSchema>;

export const AuthressProviderConfigSchema = av.object({
  kind: av.literal("authress.io"),
  roleClaimPath: av.string().minLength(1).default("roles"),
  subjectClaimPath: av.string().minLength(1).default("sub"),
  nameClaimPath: av.optional(av.string().minLength(1)),
  emailClaimPath: av.optional(av.string().minLength(1)),
  pictureClaimPath: av.optional(av.string().minLength(1))
}, { unknownKeys: "strip" });
export type AuthressProviderConfig = Infer<typeof AuthressProviderConfigSchema>;

export const AppAuthProviderConfigSchema = av.union([
  DefaultAuthProviderConfigSchema,
  AuthressProviderConfigSchema
]);
export type AppAuthProviderConfig = Infer<typeof AppAuthProviderConfigSchema>;

export const AppAuthConfigSchema = av.object({
  serviceId: UuidV7Schema,
  provider: av.optional(AppAuthProviderConfigSchema),
  loginViewId: av.optional(NonEmptyStringSchema),
  logoutViewId: av.optional(NonEmptyStringSchema),
  refreshViewId: av.optional(NonEmptyStringSchema),
  expectedIssuer: NonEmptyStringSchema,
  expectedAudience: NonEmptyStringSchema,
  /** Reference URL only — published by the auth service for clients/browsers.
   *  Verifiers MUST use publicKeys (pushed at /install) to avoid CM → service fetch. */
  jwksUri: NonEmptyStringSchema,
  /** Public JWKS pushed by the auth service at /install and on key rotation.
   *  CP-side JWT verification uses these static keys, never fetches jwksUri. */
  publicKeys: av.optional(av.object({
    keys: av.array(av.record(av.any()))
  }, { unknownKeys: "strip" })),
  roles: av.array(AppAuthRoleSchema).default([])
}, { unknownKeys: "strip" });
export type AppAuthConfig = Infer<typeof AppAuthConfigSchema>;

// ── Tenant-app validation (validateTenantApp hook return) ───────────

export const TenantAppValidationSchema = av.object({
  allowed: av.bool(),
  reason: av.optional(av.string()),
  upgradeUrl: av.optional(av.string()),
  retryAfterSeconds: av.optional(av.int().min(0))
}, { unknownKeys: "strip" });
export type TenantAppValidation = Infer<typeof TenantAppValidationSchema>;

// ── CP envelope token claims ────────────────────────────────────────

export const CpEnvelopeClaimsSchema = av.object({
  iss: NonEmptyStringSchema,
  aud: NonEmptyStringSchema,
  exp: av.int().min(1),
  iat: av.int().min(0),
  jti: NonEmptyStringSchema,
  tokenType: av.literal("cp-envelope"),
  tenantId: UuidV7Schema,
  appId: UuidV7Schema,
  originUserJti: av.optional(NonEmptyStringSchema),
  cpId: NonEmptyStringSchema,
  cpJwksUri: NonEmptyStringSchema
}, { unknownKeys: "strip" });
export type CpEnvelopeClaims = Infer<typeof CpEnvelopeClaimsSchema>;

// ── Setup token claims (control-plane → browser) ────────────────────

export const SetupTokenClaimsSchema = av.object({
  iss: NonEmptyStringSchema,
  exp: av.int().min(1),
  iat: av.int().min(0),
  jti: NonEmptyStringSchema,
  tokenType: av.literal("setup"),
  /** UUIDv7 — pre-assigned by CP for this install. Becomes tenant.services[].id. */
  instanceId: UuidV7Schema,
  serviceUrl: NonEmptyStringSchema,
  cpUrl: NonEmptyStringSchema,
  cpJwksUri: NonEmptyStringSchema,
  scope: av.optional(av.object({
    tenantId: UuidV7Schema,
    appId: av.optional(UuidV7Schema)
  }, { unknownKeys: "strip" }))
}, { unknownKeys: "strip" });
export type SetupTokenClaims = Infer<typeof SetupTokenClaimsSchema>;
