import { z } from "zod";
import { ConfigSchemaDescriptorSchema } from "./config";
import { DeploymentModeSchema, RenderModeSchema, PluginCategorySchema } from "./common";
import { ViewMetadataSchema, ViewPermissionDefinitionSchema } from "./view";

export const AdminApiDescriptorSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  path: z.string().min(1),
  methods: z.array(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])).min(1),
  supportsCustomUi: z.boolean().default(false)
});
export type AdminApiDescriptor = z.infer<typeof AdminApiDescriptorSchema>;

export const PluginManifestSchema = z.object({
  pluginId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  category: PluginCategorySchema,
  deploymentModes: z.array(DeploymentModeSchema).min(1),
  capabilities: z.array(z.string().min(1)).default([]),
  supportedThemes: z.array(z.string().min(1)).default([]),
  supportedRenderModes: z.array(RenderModeSchema).default([]),
  views: z.array(ViewMetadataSchema).default([]),
  configSchemas: z.array(ConfigSchemaDescriptorSchema).default([]),
  permissions: z.array(ViewPermissionDefinitionSchema).default([]),
  adminApis: z.array(AdminApiDescriptorSchema).default([]),
  cacheHints: z.object({
    metadataTtlSeconds: z.number().int().nonnegative().default(1800)
  }).default({ metadataTtlSeconds: 1800 })
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
