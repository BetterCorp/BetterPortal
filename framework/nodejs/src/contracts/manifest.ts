import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigSchemaDescriptorSchema } from "./config.js";
import {
  DeploymentModeSchema,
  HttpMethodSchema,
  PluginCategorySchema,
  PluginIdSchema,
  RenderModeSchema,
  SemverSchema
} from "./common.js";
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

export const DeveloperResourceSchema = av.object({
  id: av.string().pattern("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$"),
  kind: av.enum_(["guide", "template", "skill", "example"] as const),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  mediaType: av.string().minLength(1).maxLength(128).pattern("^[^\\r\\n]+$"),
  language: av.optional(av.string().minLength(1)),
  content: av.string().minLength(1).maxLength(512 * 1024)
}, { unknownKeys: "strip" });
export type DeveloperResource = Infer<typeof DeveloperResourceSchema>;

export const ShellFragmentDescriptorSchema = av.object({
  id: av.string().pattern("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$"),
  kind: av.enum_(["fragment", "block"] as const),
  title: av.string().minLength(1),
  description: av.string(),
  defaultItems: av.array(av.string().minLength(1)).default([])
});
export type ShellFragmentDescriptor = Infer<typeof ShellFragmentDescriptorSchema>;

export const ShellManifestSchema = av.object({
  service: av.string().minLength(1),
  renderer: av.string().minLength(1),
  fragments: av.array(ShellFragmentDescriptorSchema).default([])
});
export type ShellManifest = Infer<typeof ShellManifestSchema>;

export const PluginManifestSchema = av.object({
  protocolVersion: av.literal(1),
  pluginId: PluginIdSchema,
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  version: SemverSchema,
  category: PluginCategorySchema,
  deploymentModes: av.array(DeploymentModeSchema).minItems(1),
  capabilities: av.array(av.string().minLength(1)).default([]),
  supportedRenderers: av.array(av.string().minLength(1)).default([]),
  supportedRenderModes: av.array(RenderModeSchema).default([]),
  views: av.array(ViewMetadataSchema).default([]),
  configSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  permissions: av.array(ViewPermissionDefinitionSchema).default([]),
  adminApis: av.array(AdminApiDescriptorSchema).default([]),
  webhooks: av.array(WebhookEventDescriptorSchema).default([]),
  apiContracts: av.array(ApiContractDescriptorSchema).default([]),
  m2mRequests: av.array(M2MRequestDescriptorSchema).default([]),
  developerResources: av.array(DeveloperResourceSchema).default([]),
  shell: av.optional(ShellManifestSchema),
  cacheHints: av.object({
    metadataTtlSeconds: av.int().min(0).default(1800)
  }, { unknownKeys: "strip" }).default({ metadataTtlSeconds: 1800 })
}, { unknownKeys: "strip" });
export type PluginManifest = Infer<typeof PluginManifestSchema>;

export const BpSchemaRouteSchema = av.object({
  viewId: av.string().minLength(1),
  path: av.string().minLength(1),
  pathVariants: av.array(av.string().minLength(1)).default([]),
  methods: av.array(HttpMethodSchema).minItems(1),
  paramNames: av.array(av.string().minLength(1)).default([]),
  renderers: av.array(av.string().minLength(1)).default([]),
  hasFragments: av.bool().default(false),
  fragments: av.array(av.object({
    fragmentLocation: av.string().minLength(1),
    fragmentId: av.string().minLength(1),
    renderers: av.array(av.string().minLength(1)).default([])
  }, { unknownKeys: "strip" })).default([]),
  components: av.array(av.string().minLength(1)).default([])
}, { unknownKeys: "strip" });
export type BpSchemaRoute = Infer<typeof BpSchemaRouteSchema>;

export const BpSchemaOutputSchema = av.object({
  manifest: PluginManifestSchema,
  routes: av.array(BpSchemaRouteSchema).default([])
}, { unknownKeys: "strip" });
export type BpSchemaOutput = Infer<typeof BpSchemaOutputSchema>;
