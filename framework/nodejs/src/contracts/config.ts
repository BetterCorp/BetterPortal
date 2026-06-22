import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigOwnershipSchema, ConfigScopeSchema, ConfigVisibilitySchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";

const NonEmptyStringSchema = av.string().minLength(1);

export const ConfigFieldGroupDescriptorSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  order: av.optional(av.int()),
  optional: av.optional(av.bool())
}, { unknownKeys: "strip" });
export type ConfigFieldGroupDescriptor = Infer<typeof ConfigFieldGroupDescriptorSchema>;

export const ConfigFieldUiDescriptorSchema = av.object({
  control: av.optional(av.enum_([
    "text",
    "textarea",
    "password",
    "number",
    "checkbox",
    "select",
    "multiselect",
    "color",
    "date",
    "time",
    "datetime-local",
    "url",
    "email"
  ] as const)),
  placeholder: av.optional(av.string()),
  options: av.optional(av.array(av.object({
    value: NonEmptyStringSchema,
    label: NonEmptyStringSchema
  }, { unknownKeys: "strip" }))),
  optionsSource: av.optional(av.enum_(["app.routes"] as const)),
  min: av.optional(av.union([av.number(), av.string()])),
  max: av.optional(av.union([av.number(), av.string()])),
  step: av.optional(av.number()),
  rows: av.optional(av.int().min(1))
}, { unknownKeys: "strip" });
export type ConfigFieldUiDescriptor = Infer<typeof ConfigFieldUiDescriptorSchema>;

export const ConfigFieldDescriptorSchema = av.object({
  key: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  scope: ConfigScopeSchema,
  visibility: ConfigVisibilitySchema,
  ownership: ConfigOwnershipSchema,
  sourceOfTruth: av.enum_(["bp", "plugin", "external"] as const),
  groupId: av.optional(NonEmptyStringSchema),
  order: av.optional(av.int()),
  defaultValue: av.optional(JsonValueSchema),
  ui: av.optional(ConfigFieldUiDescriptorSchema),
  required: av.bool().default(false)
}, { unknownKeys: "strip" });
export type ConfigFieldDescriptor = Infer<typeof ConfigFieldDescriptorSchema>;

export const ConfigSchemaDescriptorSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  scope: ConfigScopeSchema,
  jsonSchema: JsonObjectSchema,
  groups: av.optional(av.array(ConfigFieldGroupDescriptorSchema)),
  fields: av.array(ConfigFieldDescriptorSchema).default([])
}, { unknownKeys: "strip" });
export type ConfigSchemaDescriptor = Infer<typeof ConfigSchemaDescriptorSchema>;
