import * as av from "anyvali";
import type { Infer } from "anyvali";
import { UuidV7Schema } from "./common.js";

export const M2MMethodSchema = av.enum_(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const);
export const ApiCallerModeSchema = av.enum_(["user", "service", "delegated"] as const);
export type ApiCallerMode = Infer<typeof ApiCallerModeSchema>;
export const M2MCallerModeSchema = av.enum_(["service", "delegated"] as const);
export type M2MCallerMode = Infer<typeof M2MCallerModeSchema>;

export const ApiContractDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  version: av.string().minLength(1),
  viewId: av.string().minLength(1),
  methods: av.array(M2MMethodSchema).minItems(1),
  capabilities: av.array(av.string().minLength(1)).default([]),
  permissions: av.array(av.string().minLength(1)).default([]),
  modes: av.array(M2MCallerModeSchema).minItems(1).default(["service"])
}, { unknownKeys: "strip" });
export type ApiContractDescriptor = Infer<typeof ApiContractDescriptorSchema>;

export const M2MRequestDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  contractId: av.string().minLength(1),
  version: av.optional(av.string().minLength(1)),
  requiredCapabilities: av.array(av.string().minLength(1)).default([]),
  methods: av.array(M2MMethodSchema).minItems(1),
  permissions: av.array(av.string().minLength(1)).default([]),
  mode: M2MCallerModeSchema.default("service"),
  optional: av.bool().default(false)
}, { unknownKeys: "strip" });
export type M2MRequestDescriptor = Infer<typeof M2MRequestDescriptorSchema>;

/** Short-lived proof that one installed service instance is calling another. */
export const ServiceTokenClaimsSchema = av.object({
  iss: UuidV7Schema,
  sub: UuidV7Schema,
  aud: UuidV7Schema,
  tenantId: UuidV7Schema,
  appId: UuidV7Schema,
  bindingId: UuidV7Schema,
  iat: av.int().min(0),
  nbf: av.optional(av.int().min(0)),
  exp: av.int().min(1),
  jti: av.string().minLength(1),
  tokenType: av.literal("service")
}, { unknownKeys: "strip" });
export type ServiceTokenClaims = Infer<typeof ServiceTokenClaimsSchema>;
