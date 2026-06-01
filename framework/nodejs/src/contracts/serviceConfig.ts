import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigSchemaDescriptorSchema } from "./config.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";

const NonEmptyStringSchema = av.string().minLength(1);
const NonEmptyStringArraySchema = av.array(NonEmptyStringSchema).minItems(1);

export const ServiceConfigActionSchema = av.enum_(["schema.read", "config.read", "config.write"] as const);
export type ServiceConfigAction = Infer<typeof ServiceConfigActionSchema>;

export const ServiceConfigManagementModeSchema = av.enum_(["static", "bp-managed", "hybrid"] as const);
export type ServiceConfigManagementMode = Infer<typeof ServiceConfigManagementModeSchema>;

export const ServiceConfigTicketClaimsSchema = av.object({
  iss: NonEmptyStringSchema,
  aud: av.union([NonEmptyStringSchema, NonEmptyStringArraySchema]),
  sub: NonEmptyStringSchema,
  exp: av.int().min(1),
  iat: av.int().min(0),
  jti: NonEmptyStringSchema,
  realm: av.literal("control-plane"),
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  serviceId: NonEmptyStringSchema,
  bindingId: av.optional(NonEmptyStringSchema),
  actions: av.array(ServiceConfigActionSchema).minItems(1)
}, { unknownKeys: "strip" });
export type ServiceConfigTicketClaims = Infer<typeof ServiceConfigTicketClaimsSchema>;

export const ServiceConfigStateSchema = av.object({
  tenant: av.record(JsonValueSchema).default({}),
  app: av.record(av.record(JsonValueSchema)).default({})
}, { unknownKeys: "strip" });
export type ServiceConfigState = Infer<typeof ServiceConfigStateSchema>;

export const ServiceConfigWriteRequestSchema = av.object({
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  values: JsonObjectSchema
}, { unknownKeys: "strip" });
export type ServiceConfigWriteRequest = Infer<typeof ServiceConfigWriteRequestSchema>;

export const ServiceConfigSchemaResponseSchema = av.object({
  serviceId: NonEmptyStringSchema,
  mode: ServiceConfigManagementModeSchema,
  configSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  supportsCustomUi: av.bool().default(false),
  customUiPath: av.optional(NonEmptyStringSchema),
  supportsWrite: av.bool().default(false)
}, { unknownKeys: "strip" });
export type ServiceConfigSchemaResponse = Infer<typeof ServiceConfigSchemaResponseSchema>;

export const ServiceConfigReadResponseSchema = av.object({
  serviceId: NonEmptyStringSchema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  values: JsonObjectSchema
}, { unknownKeys: "strip" });
export type ServiceConfigReadResponse = Infer<typeof ServiceConfigReadResponseSchema>;
