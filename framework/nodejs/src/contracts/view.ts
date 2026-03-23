import { z } from "zod";
import { ContextTierSchema, HttpMethodSchema, IdentityRealmSchema, RenderModeSchema } from "./common";
import { JsonObjectSchema } from "./json";

export const CacheHintsSchema = z.object({
  ttlSeconds: z.number().int().nonnegative().default(0),
  varyBy: z.array(z.string().min(1)).default([])
});
export type CacheHints = z.infer<typeof CacheHintsSchema>;

export const HtmlRepresentationSupportSchema = z.object({
  defaultTheme: z.string().min(1).optional(),
  allowDefaultThemeWhenOmitted: z.boolean().default(false),
  supportedThemes: z.array(z.string().min(1)).default([]),
  renderModes: z.array(RenderModeSchema).default([])
});
export type HtmlRepresentationSupport = z.infer<typeof HtmlRepresentationSupportSchema>;

export const ViewAuthRequirementSchema = z.object({
  required: z.boolean().default(false),
  realm: IdentityRealmSchema.optional(),
  minimumTier: ContextTierSchema.default("public"),
  audiences: z.array(z.string().min(1)).default([]),
  permissions: z.array(z.string().min(1)).default([])
});
export type ViewAuthRequirement = z.infer<typeof ViewAuthRequirementSchema>;

export const ViewMetadataSchema = z.object({
  viewId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  path: z.string().min(1),
  methods: z.array(HttpMethodSchema).min(1),
  paramsSchema: JsonObjectSchema,
  querySchema: JsonObjectSchema,
  headersSchema: JsonObjectSchema,
  bodySchema: JsonObjectSchema,
  jsonResponseSchema: JsonObjectSchema,
  metadataResponseSchema: JsonObjectSchema,
  html: HtmlRepresentationSupportSchema,
  auth: ViewAuthRequirementSchema,
  cacheHints: CacheHintsSchema
});
export type ViewMetadata = z.infer<typeof ViewMetadataSchema>;

export const ViewPermissionDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  defaultRoles: z.array(z.string().min(1)).default([])
});
export type ViewPermissionDefinition = z.infer<typeof ViewPermissionDefinitionSchema>;
