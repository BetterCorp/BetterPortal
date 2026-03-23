import { z } from "zod";
import { ConfigSchemaDescriptorSchema } from "./config";
import { DeploymentModeSchema } from "./common";

export const AppRouteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1),
  viewId: z.string().min(1),
  serviceId: z.string().min(1),
  enabled: z.boolean().default(true)
});
export type AppRoute = z.infer<typeof AppRouteSchema>;

export const TenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  branding: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().min(1).optional(),
    secondaryColor: z.string().min(1).optional()
  }).default({})
});
export type Tenant = z.infer<typeof TenantSchema>;

export const AppSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  slug: z.string().min(1),
  hostname: z.string().min(1),
  title: z.string().min(1),
  themeId: z.string().min(1),
  routes: z.array(AppRouteSchema).default([])
});
export type App = z.infer<typeof AppSchema>;

export const BindingTrustSchema = z.object({
  credentialId: z.string().min(1),
  issuer: z.string().min(1),
  audience: z.string().min(1),
  scopes: z.array(z.string().min(1)).default([]),
  rotationVersion: z.string().min(1)
});
export type BindingTrust = z.infer<typeof BindingTrustSchema>;

export const BindingRecordSchema = z.object({
  bindingId: z.string().min(1),
  serviceId: z.string().min(1),
  tenantId: z.string().min(1),
  appIds: z.array(z.string().min(1)).default([]),
  endpointBaseUrl: z.string().url(),
  deploymentMode: DeploymentModeSchema,
  enabled: z.boolean().default(true),
  importedManifestVersion: z.string().min(1),
  lastSyncAtIso: z.string().datetime().optional(),
  trust: BindingTrustSchema
});
export type BindingRecord = z.infer<typeof BindingRecordSchema>;

export const ServiceCatalogEntrySchema = z.object({
  serviceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["utility", "integration", "theme", "auth", "service"]),
  manifestUrl: z.string().url(),
  defaultEndpointBaseUrl: z.string().url(),
  deploymentModes: z.array(DeploymentModeSchema).min(1),
  tenantConfigSchemas: z.array(ConfigSchemaDescriptorSchema).default([]),
  appConfigSchemas: z.array(ConfigSchemaDescriptorSchema).default([]),
  hostedByBetterPortal: z.boolean().default(false)
});
export type ServiceCatalogEntry = z.infer<typeof ServiceCatalogEntrySchema>;
