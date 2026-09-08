import * as av from "anyvali";
import type { Infer } from "anyvali";
import { PluginIdSchema, SemverSchema } from "./common.js";
import { BpSchemaOutputSchema } from "./manifest.js";

export const RegistryReferenceSchema = av.string().pattern("^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$");
export const DependencyAliasSchema = av.string().pattern("^[A-Za-z][A-Za-z0-9_-]*$");

export const BetterPortalProjectConfigSchema = av.object({
  $schema: av.optional(av.string()),
  registryRef: av.optional(RegistryReferenceSchema),
  defaultNamespace: av.optional(av.string().pattern("^[a-z0-9][a-z0-9-]*$")),
  dependencies: av.optional(av.record(av.string().minLength(1)))
}, { unknownKeys: "reject" });
export type BetterPortalProjectConfig = Infer<typeof BetterPortalProjectConfigSchema>;

const lockedFields = {
  registryRef: RegistryReferenceSchema,
  pluginId: PluginIdSchema,
  version: SemverSchema,
  digest: av.string().pattern("^sha256:[0-9a-f]{64}$"),
  // Legacy locks omit this and use runtime/contract.ts's locale-dependent JSON.
  // New native locks hash the exact cached UTF-8 bytes, with no locale dependency.
  digestFormat: av.optional(av.literal("json-bytes"))
};
export const LockedDependencySchema = av.object(lockedFields, { unknownKeys: "reject" });
export type LockedDependency = Infer<typeof LockedDependencySchema>;
export const BetterPortalLockSchema = av.object({
  dependencies: av.record(LockedDependencySchema).default({})
}, { unknownKeys: "reject" });
export type BetterPortalLock = Infer<typeof BetterPortalLockSchema>;
export const LocalDependencyLockSchema = av.record(av.object({
  ...lockedFields, path: av.string().minLength(1)
}, { unknownKeys: "reject" }));

// Existing service-betterportal-registry responses, shared with native tooling.
export const RegistryPackageListSchema = av.array(av.object({
  registryRef: RegistryReferenceSchema,
  contract: BpSchemaOutputSchema,
  versions: av.array(SemverSchema)
}, { unknownKeys: "reject" }));
export const RegistryPublishResultSchema = av.object({
  registryRef: RegistryReferenceSchema,
  pluginId: PluginIdSchema,
  version: SemverSchema,
  digest: lockedFields.digest,
  unchanged: av.bool()
}, { unknownKeys: "reject" });
