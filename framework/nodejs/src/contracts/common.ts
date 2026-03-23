import { z } from "zod";

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const RenderModeSchema = z.enum(["page", "fragment", "embed"]);
export type RenderMode = z.infer<typeof RenderModeSchema>;

export const PluginCategorySchema = z.enum(["framework", "auth", "theme", "service", "utility", "integration"]);
export type PluginCategory = z.infer<typeof PluginCategorySchema>;

export const DeploymentModeSchema = z.enum([
  "bp-hosted",
  "customer-hosted",
  "third-party-saas",
  "self-hosted",
  "saas-managed"
]);
export type DeploymentMode = z.infer<typeof DeploymentModeSchema>;

export const ConfigScopeSchema = z.enum(["tenant", "app"]);
export type ConfigScope = z.infer<typeof ConfigScopeSchema>;

export const ConfigVisibilitySchema = z.enum(["public", "protected", "secret"]);
export type ConfigVisibility = z.infer<typeof ConfigVisibilitySchema>;

export const ConfigOwnershipSchema = z.enum(["bp", "plugin", "mixed"]);
export type ConfigOwnership = z.infer<typeof ConfigOwnershipSchema>;

export const ContextTierSchema = z.enum(["public", "runtime-authenticated", "control-plane-authenticated"]);
export type ContextTier = z.infer<typeof ContextTierSchema>;

export const IdentityRealmSchema = z.enum(["runtime", "control-plane"]);
export type IdentityRealm = z.infer<typeof IdentityRealmSchema>;
