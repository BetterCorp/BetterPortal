import { z } from "zod";
import { ConfigOwnershipSchema, ConfigScopeSchema, ConfigVisibilitySchema } from "./common";
import { JsonObjectSchema } from "./json";

export const ConfigFieldDescriptorSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  scope: ConfigScopeSchema,
  visibility: ConfigVisibilitySchema,
  ownership: ConfigOwnershipSchema,
  sourceOfTruth: z.enum(["bp", "plugin", "external"]),
  required: z.boolean().default(false)
});
export type ConfigFieldDescriptor = z.infer<typeof ConfigFieldDescriptorSchema>;

export const ConfigSchemaDescriptorSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  scope: ConfigScopeSchema,
  jsonSchema: JsonObjectSchema,
  fields: z.array(ConfigFieldDescriptorSchema).default([])
});
export type ConfigSchemaDescriptor = z.infer<typeof ConfigSchemaDescriptorSchema>;
