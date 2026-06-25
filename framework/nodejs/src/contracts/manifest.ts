import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigSchemaDescriptorSchema } from "./config.js";
import { DeploymentModeSchema, PluginCategorySchema, RenderModeSchema } from "./common.js";
import { JsonObjectSchema } from "./json.js";
import { ApiContractDescriptorSchema, M2MRequestDescriptorSchema } from "./m2m.js";
import { ViewMetadataSchema, ViewPermissionDefinitionSchema } from "./view.js";

const AdminMethodSchema = av.enum_(["GET", "POST", "PUT", "PATCH", "DELETE"] as const);

export const AdminApiDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  path: av.string().minLength(1),
  methods: av.array(AdminMethodSchema).minItems(1),
  supportsCustomUi: av.bool().default(false)
}, { unknownKeys: "strip" });
export type AdminApiDescriptor = Infer<typeof AdminApiDescriptorSchema>;

export const WebhookEventDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  payloadSchema: JsonObjectSchema
}, { unknownKeys: "strip" });
export type WebhookEventDescriptor = Infer<typeof WebhookEventDescriptorSchema>;

export const PluginManifestSchema = av.object({
  pluginId: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  version: av.string().minLength(1),
  category: PluginCategorySchema,
  deploymentModes: av.array(DeploymentModeSchema).minItems(1),
  capabilities: av.array(av.string().minLength(1)).default([]),
  supportedThemes: av.array(av.string().minLength(1)).default([]),
  supportedRenderModes: av.array(RenderModeSchema).default([]),
  views: av.array(ViewMetadataSchema).default([]),
  configSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  permissions: av.array(ViewPermissionDefinitionSchema).default([]),
  adminApis: av.array(AdminApiDescriptorSchema).default([]),
  webhooks: av.array(WebhookEventDescriptorSchema).default([]),
  apiContracts: av.array(ApiContractDescriptorSchema).default([]),
  m2mRequests: av.array(M2MRequestDescriptorSchema).default([]),
  cacheHints: av.object({
    metadataTtlSeconds: av.int().min(0).default(1800)
  }, { unknownKeys: "strip" }).default({ metadataTtlSeconds: 1800 })
}, { unknownKeys: "strip" });
export type PluginManifest = Infer<typeof PluginManifestSchema>;
