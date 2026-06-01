import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigSchemaDescriptorSchema } from "./config.js";
import { DeploymentModeSchema } from "./common.js";

const NonEmptyStringSchema = av.string().minLength(1);

export const AppRouteSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  path: NonEmptyStringSchema,
  viewId: NonEmptyStringSchema,
  serviceId: NonEmptyStringSchema,
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type AppRoute = Infer<typeof AppRouteSchema>;

export const TenantSchema = av.object({
  id: NonEmptyStringSchema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  branding: av.object({
    logoUrl: av.optional(av.string().format("url")),
    primaryColor: av.optional(NonEmptyStringSchema),
    secondaryColor: av.optional(NonEmptyStringSchema)
  }, { unknownKeys: "strip" }).default({})
}, { unknownKeys: "strip" });
export type Tenant = Infer<typeof TenantSchema>;

export const FragmentAssignmentSchema = av.object({
  serviceId: NonEmptyStringSchema,
  fragmentId: NonEmptyStringSchema,
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type FragmentAssignment = Infer<typeof FragmentAssignmentSchema>;

export const AppSchema = av.object({
  id: NonEmptyStringSchema,
  tenantId: NonEmptyStringSchema,
  slug: NonEmptyStringSchema,
  hostname: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  themeId: NonEmptyStringSchema,
  routes: av.array(AppRouteSchema).default([]),
  fragments: av.record(av.array(FragmentAssignmentSchema)).default({})
}, { unknownKeys: "strip" });
export type App = Infer<typeof AppSchema>;

export const BindingTrustSchema = av.object({
  credentialId: NonEmptyStringSchema,
  issuer: NonEmptyStringSchema,
  audience: NonEmptyStringSchema,
  scopes: av.array(NonEmptyStringSchema).default([]),
  rotationVersion: NonEmptyStringSchema
}, { unknownKeys: "strip" });
export type BindingTrust = Infer<typeof BindingTrustSchema>;

export const BindingRecordSchema = av.object({
  bindingId: NonEmptyStringSchema,
  serviceId: NonEmptyStringSchema,
  tenantId: NonEmptyStringSchema,
  appIds: av.array(NonEmptyStringSchema).default([]),
  endpointBaseUrl: av.string().format("url"),
  deploymentMode: DeploymentModeSchema,
  enabled: av.bool().default(true),
  importedManifestVersion: NonEmptyStringSchema,
  lastSyncAtIso: av.optional(av.string().format("date-time")),
  trust: BindingTrustSchema
}, { unknownKeys: "strip" });
export type BindingRecord = Infer<typeof BindingRecordSchema>;

export const ServiceCatalogEntrySchema = av.object({
  serviceId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  category: av.enum_(["utility", "integration", "theme", "auth", "service"] as const),
  manifestUrl: av.string().format("url"),
  defaultEndpointBaseUrl: av.string().format("url"),
  deploymentModes: av.array(DeploymentModeSchema).minItems(1),
  tenantConfigSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  appConfigSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  hostedByBetterPortal: av.bool().default(false)
}, { unknownKeys: "strip" });
export type ServiceCatalogEntry = Infer<typeof ServiceCatalogEntrySchema>;
