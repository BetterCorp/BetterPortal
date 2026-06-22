import * as av from "anyvali";
import type { Infer } from "anyvali";

export const HttpMethodSchema = av.enum_(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const);
export type HttpMethod = Infer<typeof HttpMethodSchema>;

export const RenderModeSchema = av.enum_(["page", "fragment", "embed"] as const);
export type RenderMode = Infer<typeof RenderModeSchema>;

export const PluginCategorySchema = av.enum_(["framework", "auth", "theme", "service", "utility", "integration"] as const);
export type PluginCategory = Infer<typeof PluginCategorySchema>;

export const UuidV7Schema = av.string().pattern("^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
export type UuidV7 = Infer<typeof UuidV7Schema>;

export const PluginIdSchema = av.string().pattern("^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$");
export type PluginId = Infer<typeof PluginIdSchema>;

export const DeploymentModeSchema = av.enum_([
  "bp-hosted",
  "customer-hosted",
  "third-party-saas",
  "self-hosted",
  "saas-managed"
] as const);
export type DeploymentMode = Infer<typeof DeploymentModeSchema>;

export const ConfigScopeSchema = av.enum_(["tenant", "app"] as const);
export type ConfigScope = Infer<typeof ConfigScopeSchema>;

export const ConfigVisibilitySchema = av.enum_(["public", "protected", "secret"] as const);
export type ConfigVisibility = Infer<typeof ConfigVisibilitySchema>;

export const ConfigOwnershipSchema = av.enum_(["bp", "plugin", "mixed"] as const);
export type ConfigOwnership = Infer<typeof ConfigOwnershipSchema>;

export const IdentityRealmSchema = av.enum_(["runtime", "control-plane"] as const);
export type IdentityRealm = Infer<typeof IdentityRealmSchema>;
