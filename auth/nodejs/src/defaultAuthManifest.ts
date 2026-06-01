import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  AdminApiDescriptor,
  AuthAudienceRule,
  createPluginManifest,
  JwtClaimsSchema,
  PluginManifest,
  ViewPermissionDefinition
} from "@betterportal/framework-nodejs";

export const RuntimeTokenConfigSchema = av.object({
  idTokenSeconds: av.int().min(1).default(60 * 30),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7),
  runtimeAudiences: av.array(av.string().minLength(1)).minItems(1),
  controlPlaneAudiences: av.array(av.string().minLength(1)).minItems(1)
}, { unknownKeys: "strip" });
export type RuntimeTokenConfig = Infer<typeof RuntimeTokenConfigSchema>;

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
