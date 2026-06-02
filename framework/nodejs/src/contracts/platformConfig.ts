import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  DeploymentModeSchema,
  HttpMethodSchema,
  PluginCategorySchema
} from "./common.js";

const NonEmptyStringSchema = av.string().minLength(1);


export const BetterPortalBrandingSchema = av.object({
  brandName: av.optional(NonEmptyStringSchema),
  logoUrl: av.optional(av.string().format("url")),
  primaryColor: av.optional(NonEmptyStringSchema),
  secondaryColor: av.optional(NonEmptyStringSchema)
}, { unknownKeys: "strip" }).default({});
export type BetterPortalBranding = Infer<typeof BetterPortalBrandingSchema>;

export const BetterPortalThemeBootstrapPaletteSchema = av.object({
  primary: av.optional(NonEmptyStringSchema),
  secondary: av.optional(NonEmptyStringSchema),
  success: av.optional(NonEmptyStringSchema),
  info: av.optional(NonEmptyStringSchema),
  warning: av.optional(NonEmptyStringSchema),
  danger: av.optional(NonEmptyStringSchema),
  light: av.optional(NonEmptyStringSchema),
  dark: av.optional(NonEmptyStringSchema)
}, { unknownKeys: "strip" }).default({});
export type BetterPortalThemeBootstrapPalette = Infer<typeof BetterPortalThemeBootstrapPaletteSchema>;

export const BetterPortalThemeSurfaceSchema = av.object({
  background: av.optional(NonEmptyStringSchema),
  surface: av.optional(NonEmptyStringSchema),
  surfaceAlt: av.optional(NonEmptyStringSchema),
  text: av.optional(NonEmptyStringSchema),
  textSoft: av.optional(NonEmptyStringSchema),
  border: av.optional(NonEmptyStringSchema),
  accentSoft: av.optional(NonEmptyStringSchema)
}, { unknownKeys: "strip" }).default({});
export type BetterPortalThemeSurface = Infer<typeof BetterPortalThemeSurfaceSchema>;

export const BetterPortalThemeConfigSchema = av.object({
  mode: av.enum_(["light", "dark", "system"] as const).default("light"),
  bootstrap: BetterPortalThemeBootstrapPaletteSchema,
  light: BetterPortalThemeSurfaceSchema,
  dark: BetterPortalThemeSurfaceSchema
}, { unknownKeys: "strip" }).default({
  mode: "light",
  bootstrap: {},
  light: {},
  dark: {}
});
export type BetterPortalThemeConfig = Infer<typeof BetterPortalThemeConfigSchema>;

// ── Service registration (per-tenant owned) ─────────────────────────

export const TenantServiceRegistrationSchema = av.object({
  id: NonEmptyStringSchema,
  hostname: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  serviceId: av.optional(NonEmptyStringSchema),
  title: av.optional(NonEmptyStringSchema),
  description: av.optional(NonEmptyStringSchema),
  deploymentMode: DeploymentModeSchema.default("self-hosted"),
  createdAt: av.string().format("date-time"),
  lastSeenAt: av.optional(av.string().format("date-time")),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type TenantServiceRegistration = Infer<typeof TenantServiceRegistrationSchema>;

// ── Theme registry (themes available to apps) ───────────────────────

export const ThemeRegistrationSchema = av.object({
  id: NonEmptyStringSchema,
  hostname: av.string().format("url"),
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type ThemeRegistration = Infer<typeof ThemeRegistrationSchema>;

// ── Platform service (BP-hosted marketplace) ─────────────────────────

export const PlatformServiceSchema = av.object({
  id: NonEmptyStringSchema,
  hostname: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  serviceId: av.optional(NonEmptyStringSchema),
  title: NonEmptyStringSchema,
  description: av.optional(NonEmptyStringSchema),
  category: av.optional(NonEmptyStringSchema),
  createdAt: av.string().format("date-time"),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type PlatformService = Infer<typeof PlatformServiceSchema>;

// ── Tenant ───────────────────────────────────────────────────────────

export const BetterPortalTenantSchema = av.object({
  id: NonEmptyStringSchema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  active: av.bool().default(true),
  branding: BetterPortalBrandingSchema,
  services: av.array(TenantServiceRegistrationSchema).default([]),
  activatedPlatformServices: av.array(NonEmptyStringSchema).default([])
}, { unknownKeys: "strip" });
export type BetterPortalTenant = Infer<typeof BetterPortalTenantSchema>;

export const BetterPortalRouteMountSchema = av.object({
  id: NonEmptyStringSchema,
  path: NonEmptyStringSchema,
  serviceId: NonEmptyStringSchema,
  viewId: NonEmptyStringSchema,
  targetPath: av.optional(NonEmptyStringSchema),
  title: av.optional(NonEmptyStringSchema),
  icon: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true),
  methods: av.array(HttpMethodSchema).minItems(1).default(["GET"])
}, { unknownKeys: "strip" });
export type BetterPortalRouteMount = Infer<typeof BetterPortalRouteMountSchema>;

// ── Menu (separate from routes) ──────────────────────────────────────

export const BetterPortalMenuItemSchema: any = av.object({
  id: NonEmptyStringSchema,
  type: av.enum_(["link", "group", "section", "divider", "external"] as const).default("link"),
  title: av.optional(NonEmptyStringSchema),
  icon: av.optional(NonEmptyStringSchema),
  routeId: av.optional(NonEmptyStringSchema),
  href: av.optional(av.string()),
  enabled: av.bool().default(true),
  children: av.array(av.any()).default([])
}, { unknownKeys: "strip" });
export type BetterPortalMenuItem = Infer<typeof BetterPortalMenuItemSchema>;

export const BetterPortalSlotAssignmentSchema = av.object({
  slotId: NonEmptyStringSchema,
  serviceId: NonEmptyStringSchema,
  viewId: NonEmptyStringSchema,
  renderer: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type BetterPortalSlotAssignment = Infer<typeof BetterPortalSlotAssignmentSchema>;

export const BetterPortalFragmentAssignmentSchema = av.object({
  serviceId: NonEmptyStringSchema,
  fragmentId: NonEmptyStringSchema,
  targetPath: NonEmptyStringSchema,
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type BetterPortalFragmentAssignment = Infer<typeof BetterPortalFragmentAssignmentSchema>;

export const BetterPortalAppSchema = av.object({
  id: NonEmptyStringSchema,
  tenantId: NonEmptyStringSchema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  hostnames: av.array(NonEmptyStringSchema).minItems(1),
  originOverrides: av.array(av.string().format("url")).default([]),
  refererOverrides: av.array(av.string().format("url")).default([]),
  themeId: NonEmptyStringSchema,
  themeConfig: BetterPortalThemeConfigSchema,
  layoutId: av.optional(NonEmptyStringSchema),
  defaultRoute: NonEmptyStringSchema.default("/"),
  routes: av.array(BetterPortalRouteMountSchema).default([]),
  menu: av.array(BetterPortalMenuItemSchema).default([]),
  slots: av.array(BetterPortalSlotAssignmentSchema).default([]),
  fragments: av.record(av.array(BetterPortalFragmentAssignmentSchema)).default({})
}, { unknownKeys: "strip" });
export type BetterPortalApp = Infer<typeof BetterPortalAppSchema>;

export const BetterPortalConfigManagementAuthSchema = av.object({
  mechanism: av.enum_(["none", "dev-token", "jwt", "oidc"] as const).default("none"),
  issuer: av.optional(NonEmptyStringSchema),
  audience: av.optional(NonEmptyStringSchema),
  requiredPermissions: av.array(NonEmptyStringSchema).default([])
}, { unknownKeys: "strip" }).default({
  mechanism: "none",
  requiredPermissions: []
});
export type BetterPortalConfigManagementAuth = Infer<typeof BetterPortalConfigManagementAuthSchema>;

export const BetterPortalConfigManagementSchema = av.object({
  adminTenantId: av.optional(NonEmptyStringSchema),
  auth: BetterPortalConfigManagementAuthSchema
}, { unknownKeys: "strip" }).default({
  auth: {
    mechanism: "none",
    requiredPermissions: []
  }
});
export type BetterPortalConfigManagement = Infer<typeof BetterPortalConfigManagementSchema>;

export const BetterPortalConfigSchema = av.object({
  configManagement: BetterPortalConfigManagementSchema,
  themes: av.array(ThemeRegistrationSchema).default([]),
  platformServices: av.array(PlatformServiceSchema).default([]),
  tenants: av.array(BetterPortalTenantSchema).default([]),
  apps: av.array(BetterPortalAppSchema).default([])
}, { unknownKeys: "strip" });
export type BetterPortalConfig = Infer<typeof BetterPortalConfigSchema>;

export interface BetterPortalResolvedRequestContext {
  tenant: BetterPortalTenant;
  app: BetterPortalApp;
}

export interface BetterPortalResolvedServiceBinding {
  tenant: BetterPortalTenant;
  app: BetterPortalApp;
  service: TenantServiceRegistration;
}

export const BetterPortalOriginPolicySchema = av.object({
  allowedOrigins: av.array(av.string().format("url")).default([]),
  allowedReferers: av.array(av.string().format("url")).default([])
}, { unknownKeys: "strip" });
export type BetterPortalOriginPolicy = Infer<typeof BetterPortalOriginPolicySchema>;
