import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  DeploymentModeSchema,
  HttpMethodSchema,
  PluginCategorySchema,
  PluginIdSchema,
  UuidV7Schema
} from "./common.js";
import { AppAuthConfigSchema } from "./auth.js";

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
  brandName: av.optional(NonEmptyStringSchema),
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

// -- Service registration (per-tenant owned) -------------------------

export const TenantServiceRegistrationSchema = av.object({
  id: UuidV7Schema,
  hostname: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  publicKeyPem: av.optional(NonEmptyStringSchema),
  keyId: av.optional(NonEmptyStringSchema),
  serviceId: av.optional(PluginIdSchema),
  capabilities: av.array(NonEmptyStringSchema).default([]),
  title: av.optional(NonEmptyStringSchema),
  description: av.optional(NonEmptyStringSchema),
  deploymentMode: DeploymentModeSchema.default("self-hosted"),
  createdAt: av.string().format("date-time"),
  lastSeenAt: av.optional(av.string().format("date-time")),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type TenantServiceRegistration = Infer<typeof TenantServiceRegistrationSchema>;

export const BetterPortalAppShellSchema = av.object({
  serviceId: UuidV7Schema
}, { unknownKeys: "strip" });
export type BetterPortalAppShell = Infer<typeof BetterPortalAppShellSchema>;

// -- Platform service (BP-hosted marketplace) -------------------------

export const PlatformServiceSchema = av.object({
  id: UuidV7Schema,
  hostname: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  publicKeyPem: av.optional(NonEmptyStringSchema),
  keyId: av.optional(NonEmptyStringSchema),
  serviceId: av.optional(PluginIdSchema),
  capabilities: av.array(NonEmptyStringSchema).default([]),
  title: NonEmptyStringSchema,
  description: av.optional(NonEmptyStringSchema),
  category: av.optional(NonEmptyStringSchema),
  createdAt: av.string().format("date-time"),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type PlatformService = Infer<typeof PlatformServiceSchema>;

// -- Tenant -----------------------------------------------------------

export const BetterPortalTenantSchema = av.object({
  id: UuidV7Schema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  active: av.bool().default(true),
  branding: BetterPortalBrandingSchema,
  services: av.array(TenantServiceRegistrationSchema).default([]),
  activatedPlatformServices: av.array(UuidV7Schema).default([])
}, { unknownKeys: "strip" });
export type BetterPortalTenant = Infer<typeof BetterPortalTenantSchema>;

export const BetterPortalRouteChromeValueSchema = av.union([av.string(), av.number(), av.bool()]);
export type BetterPortalRouteChromeValue = Infer<typeof BetterPortalRouteChromeValueSchema>;

export const BetterPortalRouteChromeSchema = av.intersection([
  av.object({
    hideMenu: av.optional(av.bool()),
    hideHeader: av.optional(av.bool()),
    hideFooter: av.optional(av.bool()),
    fullScreen: av.optional(av.bool())
  }, { unknownKeys: "allow" }),
  av.record(BetterPortalRouteChromeValueSchema)
]);
export type BetterPortalRouteChrome = Infer<typeof BetterPortalRouteChromeSchema>;

export const BetterPortalRouteMountSchema = av.object({
  id: UuidV7Schema,
  kind: av.enum_(["page", "api"] as const).default("page"),
  path: NonEmptyStringSchema,
  serviceId: UuidV7Schema,
  viewId: NonEmptyStringSchema,
  /** @deprecated Use resolvedServicePath (CP-injected). Kept one release for migration. */
  targetPath: av.optional(NonEmptyStringSchema),
  /** Service path resolved by control plane from manifest cache. Injected on sync delivery. */
  resolvedServicePath: av.optional(NonEmptyStringSchema),
  /** Optional query string appended to service request. */
  query: av.optional(av.string()),
  title: av.optional(NonEmptyStringSchema),
  icon: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true),
  methods: av.array(HttpMethodSchema).minItems(1).default(["GET"]),
  chrome: av.optional(BetterPortalRouteChromeSchema)
}, { unknownKeys: "strip" });
export type BetterPortalRouteMount = Infer<typeof BetterPortalRouteMountSchema>;

// -- Menu (separate from routes) --------------------------------------

export const BetterPortalMenuItemSchema: any = av.object({
  id: UuidV7Schema,
  type: av.enum_(["link", "group", "section", "divider", "external"] as const).default("link"),
  title: av.optional(NonEmptyStringSchema),
  icon: av.optional(NonEmptyStringSchema),
  routeId: av.optional(UuidV7Schema),
  href: av.optional(av.string()),
  enabled: av.bool().default(true),
  defaultExpanded: av.optional(av.bool()),
  children: av.array(av.any()).default([])
}, { unknownKeys: "strip" });
export type BetterPortalMenuItem = Infer<typeof BetterPortalMenuItemSchema>;

export const BetterPortalSlotAssignmentSchema = av.object({
  slotId: NonEmptyStringSchema,
  serviceId: UuidV7Schema,
  viewId: NonEmptyStringSchema,
  renderer: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type BetterPortalSlotAssignment = Infer<typeof BetterPortalSlotAssignmentSchema>;

export const BetterPortalFragmentAssignmentSchema = av.object({
  serviceId: UuidV7Schema,
  fragmentId: NonEmptyStringSchema,
  targetPath: NonEmptyStringSchema,
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type BetterPortalFragmentAssignment = Infer<typeof BetterPortalFragmentAssignmentSchema>;

export const BetterPortalAppSchema = av.object({
  id: UuidV7Schema,
  tenantId: UuidV7Schema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  hostnames: av.array(NonEmptyStringSchema).minItems(1),
  originOverrides: av.array(av.string().format("url")).default([]),
  refererOverrides: av.array(av.string().format("url")).default([]),
  shell: av.optional(BetterPortalAppShellSchema),
  themeId: av.optional(NonEmptyStringSchema),
  themeConfig: BetterPortalThemeConfigSchema,
  layoutId: av.optional(NonEmptyStringSchema),
  defaultRoute: NonEmptyStringSchema.default("/"),
  routes: av.array(BetterPortalRouteMountSchema).default([]),
  menu: av.array(BetterPortalMenuItemSchema).default([]),
  slots: av.array(BetterPortalSlotAssignmentSchema).default([]),
  fragments: av.record(av.array(BetterPortalFragmentAssignmentSchema)).default({}),
  auth: av.optional(AppAuthConfigSchema),
  statusViewIds: av.optional(av.record(NonEmptyStringSchema))
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
  managementAppId: av.optional(NonEmptyStringSchema),
  auth: BetterPortalConfigManagementAuthSchema
}, { unknownKeys: "strip" }).default({
  auth: {
    mechanism: "none",
    requiredPermissions: []
  }
});
export type BetterPortalConfigManagement = Infer<typeof BetterPortalConfigManagementSchema>;

// -- Shared service catalog (BP-curated + 3rd-party marketplace) -----

export const SharedServiceDefinitionSchema = av.object({
  id: NonEmptyStringSchema,
  serviceId: av.optional(PluginIdSchema),
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  logoUrl: av.optional(av.string().format("url")),
  baseUrl: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  publicKeyPem: av.optional(NonEmptyStringSchema),
  keyId: av.optional(NonEmptyStringSchema),
  supportedDeploymentModes: av.array(DeploymentModeSchema).default([]),
  owner: av.enum_(["bp", "3p"] as const).default("bp"),
  upgradeUrlTemplate: av.optional(av.string()),
  category: av.optional(NonEmptyStringSchema),
  tags: av.array(NonEmptyStringSchema).default([]),
  pricingHint: av.optional(av.enum_(["free", "freemium", "paid"] as const)),
  publishedAt: av.optional(av.string().format("date-time")),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type SharedServiceDefinition = Infer<typeof SharedServiceDefinitionSchema>;

export const TenantSharedServiceActivationSchema = av.object({
  id: UuidV7Schema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  sharedServiceId: NonEmptyStringSchema,
  activatedAt: av.string().format("date-time"),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });
export type TenantSharedServiceActivation = Infer<typeof TenantSharedServiceActivationSchema>;

export const M2MBindingSchema = av.object({
  id: UuidV7Schema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  sourceServiceId: UuidV7Schema,
  requestId: NonEmptyStringSchema,
  contractId: NonEmptyStringSchema,
  targetServiceId: UuidV7Schema,
  targetViewId: NonEmptyStringSchema,
  enabled: av.bool().default(true),
  createdAt: av.string().format("date-time")
}, { unknownKeys: "strip" });
export type M2MBinding = Infer<typeof M2MBindingSchema>;

export const M2MGrantSchema = av.object({
  id: UuidV7Schema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  bindingId: UuidV7Schema,
  methods: av.array(HttpMethodSchema).minItems(1),
  permissions: av.array(NonEmptyStringSchema).default([]),
  enabled: av.bool().default(true),
  createdAt: av.string().format("date-time")
}, { unknownKeys: "strip" });
export type M2MGrant = Infer<typeof M2MGrantSchema>;

export const M2MConfigSchema = av.object({
  bindings: av.array(M2MBindingSchema).default([]),
  grants: av.array(M2MGrantSchema).default([])
}, { unknownKeys: "strip" }).default({ bindings: [], grants: [] });
export type M2MConfig = Infer<typeof M2MConfigSchema>;

// -- Manifest cache (CP-side per spec section P8) --------------------

export const ServiceManifestCacheEntrySchema = av.object({
  serviceId: NonEmptyStringSchema,
  manifestVersion: NonEmptyStringSchema,
  fetchedAt: av.string().format("date-time"),
  m2mRequests: av.array(av.any()).default([]),
  apiContracts: av.array(av.any()).default([]),
  viewIndex: av.record(av.object({
    viewId: NonEmptyStringSchema,
    path: NonEmptyStringSchema,
    methods: av.array(NonEmptyStringSchema).default([]),
    role: av.optional(NonEmptyStringSchema),
    chrome: av.optional(BetterPortalRouteChromeSchema),
    dependencies: av.array(NonEmptyStringSchema).default([]),
    permissions: av.array(av.object({
      serviceId: NonEmptyStringSchema,
      viewId: NonEmptyStringSchema,
      permissions: av.array(NonEmptyStringSchema).default([])
    }, { unknownKeys: "strip" })).default([]),
    renderable: av.bool().default(true),
    schemas: av.optional(av.record(av.any())),
    raw: av.optional(av.bool()),
    apiContracts: av.array(av.any()).default([]),
    demoScenarios: av.array(av.any()).default([])
  }, { unknownKeys: "strip" })).default({})
}, { unknownKeys: "strip" });
export type ServiceManifestCacheEntry = Infer<typeof ServiceManifestCacheEntrySchema>;

export const WebhookTargetSchema = av.object({
  id: UuidV7Schema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  serviceId: NonEmptyStringSchema,
  eventId: NonEmptyStringSchema,
  url: av.string().format("url"),
  secret: NonEmptyStringSchema,
  createdAt: av.string().format("date-time"),
  enabled: av.bool().default(true),
  maxAttempts: av.int().min(1).max(20).default(10)
}, { unknownKeys: "strip" });
export type WebhookTarget = Infer<typeof WebhookTargetSchema>;

export const BetterPortalConfigSchema = av.object({
  configManagement: BetterPortalConfigManagementSchema,
  platformServices: av.array(PlatformServiceSchema).default([]),
  tenants: av.array(BetterPortalTenantSchema).default([]),
  apps: av.array(BetterPortalAppSchema).default([]),
  sharedServiceCatalog: av.array(SharedServiceDefinitionSchema).default([]),
  sharedServiceActivations: av.array(TenantSharedServiceActivationSchema).default([]),
  manifestCache: av.array(ServiceManifestCacheEntrySchema).default([]),
  m2m: M2MConfigSchema,
  webhooks: av.object({
    targets: av.array(WebhookTargetSchema).default([])
  }, { unknownKeys: "strip" }).default({ targets: [] })
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
