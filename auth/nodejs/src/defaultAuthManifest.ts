import {
  AdminApiDescriptor,
  AuthAudienceRule,
  createPluginManifest,
  JwtClaimsSchema,
  PluginManifest,
  TokenLifetimeConfigSchema,
  ViewPermissionDefinition
} from "@betterportal/framework-nodejs";
import { z } from "zod";

export const RuntimeTokenConfigSchema = TokenLifetimeConfigSchema.extend({
  runtimeAudiences: z.array(z.string().min(1)).min(1),
  controlPlaneAudiences: z.array(z.string().min(1)).min(1)
});
export type RuntimeTokenConfig = z.infer<typeof RuntimeTokenConfigSchema>;

export const DefaultRuntimeAudienceRules: readonly AuthAudienceRule[] = [
  {
    realm: "runtime",
    audiences: ["betterportal-runtime"]
  },
  {
    realm: "control-plane",
    audiences: ["betterportal-control-plane"]
  }
];

export const DefaultAuthPermissions: readonly ViewPermissionDefinition[] = [
  {
    id: "auth.user.read",
    title: "Read authenticated user profile",
    description: "Allows reading runtime user profile information.",
    defaultRoles: ["user", "admin"]
  },
  {
    id: "auth.user.manage",
    title: "Manage users",
    description: "Allows control-plane user administration.",
    defaultRoles: ["admin"]
  }
];

export const DefaultAuthAdminApis: readonly AdminApiDescriptor[] = [
  {
    id: "auth-token-config",
    title: "Auth token configuration",
    description: "Manage auth token lifetimes and allowed audiences.",
    path: "/admin/auth/token-config",
    methods: ["GET", "PUT"],
    supportsCustomUi: true
  }
];

export const DefaultAuthManifest: PluginManifest = createPluginManifest({
  pluginId: "auth.betterportal.default",
  title: "BetterPortal Default Auth",
  description: "JWT issuing auth plugin for BetterPortal v10 runtime and control-plane flows.",
  version: "1.0.0",
  category: "auth",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted", "saas-managed"],
  capabilities: [
    "auth.jwt",
    "auth.refresh-token",
    "auth.runtime-identity",
    "auth.control-plane-identity"
  ],
  supportedThemes: [],
  supportedRenderModes: [],
  views: [],
  configSchemas: [],
  permissions: [...DefaultAuthPermissions],
  adminApis: [...DefaultAuthAdminApis],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

export const RuntimeJwtClaimsContract = JwtClaimsSchema;
