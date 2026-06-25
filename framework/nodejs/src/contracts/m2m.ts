import * as av from "anyvali";
import type { Infer } from "anyvali";

export const M2MMethodSchema = av.enum_(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const);

export const ApiContractDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  version: av.string().minLength(1),
  viewId: av.string().minLength(1),
  methods: av.array(M2MMethodSchema).minItems(1),
  capabilities: av.array(av.string().minLength(1)).default([]),
  permissions: av.array(av.string().minLength(1)).default([])
}, { unknownKeys: "strip" });
export type ApiContractDescriptor = Infer<typeof ApiContractDescriptorSchema>;

export const M2MRequestDescriptorSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  contractId: av.string().minLength(1),
  version: av.optional(av.string().minLength(1)),
  requiredCapabilities: av.array(av.string().minLength(1)).default([]),
  methods: av.array(M2MMethodSchema).minItems(1),
  permissions: av.array(av.string().minLength(1)).default([]),
  optional: av.bool().default(false)
}, { unknownKeys: "strip" });
export type M2MRequestDescriptor = Infer<typeof M2MRequestDescriptorSchema>;
