import * as av from "anyvali";
import type { Infer } from "anyvali";
import { ConfigOwnershipSchema, ConfigScopeSchema, ConfigVisibilitySchema } from "./common.js";
import { JsonObjectSchema } from "./json.js";

export const ConfigFieldDescriptorSchema = av.object({
  key: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  scope: ConfigScopeSchema,
  visibility: ConfigVisibilitySchema,
  ownership: ConfigOwnershipSchema,
  sourceOfTruth: av.enum_(["bp", "plugin", "external"] as const),
  required: av.bool().default(false)
}, { unknownKeys: "strip" });
export type ConfigFieldDescriptor = Infer<typeof ConfigFieldDescriptorSchema>;

export const ConfigSchemaDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  scope: ConfigScopeSchema,
  jsonSchema: JsonObjectSchema,
  fields: av.array(ConfigFieldDescriptorSchema).default([])
}, { unknownKeys: "strip" });
export type ConfigSchemaDescriptor = Infer<typeof ConfigSchemaDescriptorSchema>;
