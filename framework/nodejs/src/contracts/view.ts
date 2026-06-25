import * as av from "anyvali";
import type { Infer } from "anyvali";
import { HttpMethodSchema, RenderModeSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { BetterPortalRouteChromeSchema } from "./platformConfig.js";
import { ApiAuthRequirementSchema } from "./route.js";
import { ApiContractDescriptorSchema } from "./m2m.js";

const NonEmptyStringSchema = av.string().minLength(1);

export const CacheHintsSchema = av.object({
  ttlSeconds: av.int().min(0).default(0),
  varyBy: av.array(NonEmptyStringSchema).default([])
}, { unknownKeys: "strip" });
export type CacheHints = Infer<typeof CacheHintsSchema>;

export const ViewRendererVariantSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  slotId: NonEmptyStringSchema,
  renderModes: av.array(RenderModeSchema).default([])
}, { unknownKeys: "strip" });
export type ViewRendererVariant = Infer<typeof ViewRendererVariantSchema>;

export const ThemeRendererSupportSchema = av.object({
  defaultRenderer: NonEmptyStringSchema.default("default"),
  renderModes: av.array(RenderModeSchema).default([]),
  slots: av.array(NonEmptyStringSchema).default([]),
  renderers: av.array(ViewRendererVariantSchema).default([])
}, { unknownKeys: "strip" });
export type ThemeRendererSupport = Infer<typeof ThemeRendererSupportSchema>;

export const HtmlRepresentationSupportSchema = av.object({
  themeRenderers: av.record(ThemeRendererSupportSchema).default({})
}, { unknownKeys: "strip" });
export type HtmlRepresentationSupport = Infer<typeof HtmlRepresentationSupportSchema>;

export const ViewDemoScenarioMatchSchema = av.object({
  query: av.optional(av.record(av.any())),
  params: av.optional(av.record(av.any())),
  headers: av.optional(av.record(av.string())),
  request: av.optional(av.record(av.any()))
}, { unknownKeys: "strip" });
export type ViewDemoScenarioMatch = Infer<typeof ViewDemoScenarioMatchSchema>;

export const ViewDemoScenarioSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  match: av.optional(ViewDemoScenarioMatchSchema),
  response: JsonValueSchema
}, { unknownKeys: "strip" });
export type ViewDemoScenario = Infer<typeof ViewDemoScenarioSchema>;

/**
 * Optional role hint for a view. Used by discovery flows to auto-fill app config.
 * Examples: "auth.login", "auth.logout", "auth.refresh", "nav.profile", "footer.brand".
 * Not enforced - pure metadata.
 */
export const ViewRoleSchema = av.string().minLength(1);
export type ViewRole = Infer<typeof ViewRoleSchema>;

/**
 * Streaming declaration for a view (spec/streaming.md section 5). Present only on
 * streaming views; `jsonResponseSchema` then holds the derived buffered shape.
 */
export const ViewStreamingSupportSchema = av.object({
  itemSchema: JsonObjectSchema,
  summarySchema: av.optional(JsonObjectSchema)
}, { unknownKeys: "strip" });
export type ViewStreamingSupport = Infer<typeof ViewStreamingSupportSchema>;

export const ViewMetadataSchema = av.object({
  viewId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  path: NonEmptyStringSchema,
  methods: av.array(HttpMethodSchema).minItems(1),
  paramsSchema: JsonObjectSchema,
  querySchema: JsonObjectSchema,
  headersSchema: JsonObjectSchema,
  bodySchema: JsonObjectSchema,
  jsonResponseSchema: JsonObjectSchema,
  metadataResponseSchema: JsonObjectSchema,
  renderable: av.bool().default(true),
  raw: av.optional(av.bool()),
  streaming: av.optional(ViewStreamingSupportSchema),
  html: HtmlRepresentationSupportSchema,
  auth: ApiAuthRequirementSchema,
  role: av.optional(ViewRoleSchema),
  dependencies: av.array(NonEmptyStringSchema).default([]),
  chrome: av.optional(BetterPortalRouteChromeSchema),
  apiContracts: av.array(ApiContractDescriptorSchema).default([]),
  demoScenarios: av.array(ViewDemoScenarioSchema).default([]),
  cacheHints: CacheHintsSchema
}, { unknownKeys: "strip" });
export type ViewMetadata = Infer<typeof ViewMetadataSchema>;

export const ViewPermissionDefinitionSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  defaultRoles: av.array(NonEmptyStringSchema).default([])
}, { unknownKeys: "strip" });
export type ViewPermissionDefinition = Infer<typeof ViewPermissionDefinitionSchema>;
