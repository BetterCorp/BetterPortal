import * as av from "anyvali";
import type { BaseSchema, Infer, ParseContext, SchemaNode } from "anyvali";
import {
  DeploymentModeSchema,
  HttpMethodSchema,
  PluginCategorySchema,
  PluginIdSchema,
  RenderModeSchema,
  UuidV7Schema
} from "./common.js";
import { AppAuthConfigSchema, AuthProviderRuntimeMetadataSchema } from "./auth.js";
import { ConfigSchemaDescriptorSchema } from "./config.js";
import { JsonObjectSchema } from "./json.js";
import { ApiContractDescriptorSchema, M2MCallerModeSchema, M2MRequestDescriptorSchema } from "./m2m.js";
import { DeveloperResourceSchema, ShellManifestSchema, WebhookEventDescriptorSchema } from "./manifest.js";
import { OperationDependencySchema, ViewDemoScenarioSchema } from "./view.js";
import { BetterPortalRouteChromeSchema } from "./chrome.js";
export { BetterPortalRouteChromeSchema, BetterPortalRouteChromeValueSchema } from "./chrome.js";
export type { BetterPortalRouteChrome, BetterPortalRouteChromeValue } from "./chrome.js";

const NonEmptyStringSchema = av.string().minLength(1);


export const BetterPortalBrandingSchema = av.object({
  brandName: av.optional(NonEmptyStringSchema),
  logoUrl: av.optional(av.string().format("url")),
  primaryColor: av.optional(NonEmptyStringSchema),
  secondaryColor: av.optional(NonEmptyStringSchema)
}).default({});
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
}).default({});
export type BetterPortalThemeBootstrapPalette = Infer<typeof BetterPortalThemeBootstrapPaletteSchema>;

export const BetterPortalThemeSurfaceSchema = av.object({
  background: av.optional(NonEmptyStringSchema),
  surface: av.optional(NonEmptyStringSchema),
  surfaceAlt: av.optional(NonEmptyStringSchema),
  text: av.optional(NonEmptyStringSchema),
  textSoft: av.optional(NonEmptyStringSchema),
  border: av.optional(NonEmptyStringSchema),
  accentSoft: av.optional(NonEmptyStringSchema)
}).default({});
export type BetterPortalThemeSurface = Infer<typeof BetterPortalThemeSurfaceSchema>;

export const BetterPortalThemeConfigSchema = av.object({
  brandName: av.optional(NonEmptyStringSchema),
  documentTitle: av.optional(NonEmptyStringSchema),
  lightLogoUrl: av.optional(av.string().format("url")),
  darkLogoUrl: av.optional(av.string().format("url")),
  faviconUrl: av.optional(av.string().format("url")),
  mode: av.enum_(["light", "dark", "system"] as const).default("light"),
  bootstrap: BetterPortalThemeBootstrapPaletteSchema,
  light: BetterPortalThemeSurfaceSchema,
  dark: BetterPortalThemeSurfaceSchema
}).default({
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
  authProvider: av.optional(AuthProviderRuntimeMetadataSchema),
  capabilities: av.array(NonEmptyStringSchema).default([]),
  title: av.optional(NonEmptyStringSchema),
  description: av.optional(NonEmptyStringSchema),
  deploymentMode: DeploymentModeSchema.default("self-hosted"),
  createdAt: av.string().format("date-time"),
  lastSeenAt: av.optional(av.string().format("date-time")),
  lastSyncAt: av.optional(av.string().format("date-time")),
  enabled: av.bool().default(true)
});
export type TenantServiceRegistration = Infer<typeof TenantServiceRegistrationSchema>;

export const BetterPortalAppShellSchema = av.object({
  serviceId: UuidV7Schema
});
export type BetterPortalAppShell = Infer<typeof BetterPortalAppShellSchema>;

// -- Platform service (BP-hosted marketplace) -------------------------

export const PlatformServiceSchema = av.object({
  id: UuidV7Schema,
  hostname: av.string().format("url"),
  apiKeyHash: av.string().default(""),
  publicKeyPem: av.optional(NonEmptyStringSchema),
  keyId: av.optional(NonEmptyStringSchema),
  serviceId: av.optional(PluginIdSchema),
  authProvider: av.optional(AuthProviderRuntimeMetadataSchema),
  capabilities: av.array(NonEmptyStringSchema).default([]),
  title: NonEmptyStringSchema,
  description: av.optional(NonEmptyStringSchema),
  category: av.optional(NonEmptyStringSchema),
  createdAt: av.string().format("date-time"),
  enabled: av.bool().default(true)
});
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
});
export type BetterPortalTenant = Infer<typeof BetterPortalTenantSchema>;

export const BetterPortalRouteMountSchema = av.object({
  id: UuidV7Schema,
  kind: av.enum_(["page", "api"] as const).default("page"),
  path: NonEmptyStringSchema,
  serviceId: UuidV7Schema,
  viewId: NonEmptyStringSchema,
  /** Selected service path when a view exposes more than one path variant. */
  servicePathVariant: av.optional(NonEmptyStringSchema),
  /** Values supplied to service path params that are not present in the app path. */
  fixedParams: av.optional(av.record(av.string().minLength(1).maxLength(100))),
  /** Manifest-derived SEO metadata injected by the control plane. */
  authRequired: av.optional(av.bool()),
  sitemap: av.optional(av.object({
    kind: av.enum_(["default", "exclude", "metadata", "provider"] as const),
    lastModified: av.optional(av.string().format("date-time")),
    changeFrequency: av.optional(av.enum_(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"] as const)),
    priority: av.optional(av.number().min(0).max(1))
  })),
  robots: av.optional(av.array(av.object({
    userAgent: NonEmptyStringSchema,
    access: av.enum_(["allow", "disallow"] as const),
    crawlDelaySeconds: av.optional(av.int().min(0).max(86400))
  }))),
  /** @deprecated Use resolvedServicePath (CP-injected). Kept one release for migration. */
  targetPath: av.optional(NonEmptyStringSchema),
  /** Service path resolved by control plane from manifest cache. Injected on sync delivery. */
  resolvedServicePath: av.optional(NonEmptyStringSchema),
  /** HTTP methods resolved from selected operation ids. Injected on sync delivery. */
  resolvedMethods: av.optional(av.array(HttpMethodSchema).minItems(1)),
  /** Optional query string appended to service request. */
  query: av.optional(av.string()),
  title: av.optional(NonEmptyStringSchema),
  icon: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true),
  enablement: av.optional(av.enum_(["auto", "enabled", "disabled"] as const)),
  operations: av.array(NonEmptyStringSchema).minItems(1),
  chrome: av.optional(BetterPortalRouteChromeSchema)
});
export type BetterPortalRouteMount = Infer<typeof BetterPortalRouteMountSchema>;

export const BetterPortalSeoConfigSchema = av.object({
  visibility: av.enum_(["auto", "public", "private"] as const).default("auto"),
  serviceFailure: av.enum_(["known-routes", "omit-service", "error"] as const).default("omit-service"),
  serviceCache: av.enum_(["none", "1h", "24h", "7d"] as const).default("24h"),
  canonicalOrigin: av.optional(av.string().format("url"))
}).default({
  visibility: "auto",
  serviceFailure: "omit-service",
  serviceCache: "24h"
});
export type BetterPortalSeoConfig = Infer<typeof BetterPortalSeoConfigSchema>;

// -- Menu (separate from routes) --------------------------------------

export interface BetterPortalMenuItem {
  id: string;
  type: "link" | "group" | "section" | "divider" | "external";
  title?: string;
  icon?: string;
  routeId?: string;
  href?: string;
  enabled: boolean;
  serviceStatus: "show" | "hide";
  authStatus: "show" | "hide-unauthenticated" | "hide-unauthorized";
  defaultExpanded?: boolean;
  children: BetterPortalMenuItem[];
}

export const BETTERPORTAL_MENU_MAX_DEPTH = 32;

class MenuDepthExceededSchema extends av.BaseSchema<unknown, never> {
  _validate(_input: unknown, ctx: ParseContext): undefined {
    ctx.issues.push({
      code: av.ISSUE_CODES.TOO_DEEP,
      message: `Menu nesting exceeds the maximum depth of ${BETTERPORTAL_MENU_MAX_DEPTH}`,
      path: [...ctx.path],
      expected: `<= ${BETTERPORTAL_MENU_MAX_DEPTH} menu levels`,
      received: "too deep"
    });
    return undefined;
  }

  _toNode(): SchemaNode {
    return { kind: "never", metadata: { description: `Menu nesting is limited to ${BETTERPORTAL_MENU_MAX_DEPTH} levels.` } };
  }
}

function menuItemSchema(depth: number): BaseSchema<unknown, BetterPortalMenuItem> {
  const child = depth < BETTERPORTAL_MENU_MAX_DEPTH
    ? menuItemSchema(depth + 1)
    : new MenuDepthExceededSchema();
  return av.object({
    id: UuidV7Schema,
    type: av.enum_(["link", "group", "section", "divider", "external"] as const).default("link"),
    title: av.optional(NonEmptyStringSchema),
    icon: av.optional(NonEmptyStringSchema),
    routeId: av.optional(UuidV7Schema),
    href: av.optional(av.string()),
    enabled: av.bool().default(true),
    serviceStatus: av.enum_(["show", "hide"] as const).default("show"),
    authStatus: av.enum_(["show", "hide-unauthenticated", "hide-unauthorized"] as const).default("show"),
    defaultExpanded: av.optional(av.bool()),
    children: av.array(child).default([])
  }) as unknown as BaseSchema<unknown, BetterPortalMenuItem>;
}

export const BetterPortalMenuItemSchema = menuItemSchema(1);

export const BetterPortalSlotAssignmentSchema = av.object({
  slotId: NonEmptyStringSchema,
  serviceId: UuidV7Schema,
  viewId: NonEmptyStringSchema,
  renderer: av.optional(NonEmptyStringSchema),
  enabled: av.bool().default(true)
});
export type BetterPortalSlotAssignment = Infer<typeof BetterPortalSlotAssignmentSchema>;

export const BetterPortalFragmentAssignmentSchema = av.object({
  serviceId: UuidV7Schema,
  fragmentId: NonEmptyStringSchema,
  targetPath: NonEmptyStringSchema,
  enabled: av.bool().default(true)
});
export type BetterPortalFragmentAssignment = Infer<typeof BetterPortalFragmentAssignmentSchema>;

export const BetterPortalShellFragmentItemSchema = av.union([
  av.object({ source: av.literal("shell"), fragmentId: NonEmptyStringSchema }),
  av.object({
    source: av.literal("service"),
    serviceId: UuidV7Schema,
    fragmentId: NonEmptyStringSchema,
    targetPath: NonEmptyStringSchema
  })
]);
export type BetterPortalShellFragmentItem = Infer<typeof BetterPortalShellFragmentItemSchema>;

export const BetterPortalShellFragmentSettingSchema = av.union([
  av.object({ mode: av.literal("none") }),
  av.object({ mode: av.literal("override"), item: BetterPortalShellFragmentItemSchema }),
  av.object({ mode: av.literal("items"), items: av.array(BetterPortalShellFragmentItemSchema).default([]) })
]);
export type BetterPortalShellFragmentSetting = Infer<typeof BetterPortalShellFragmentSettingSchema>;

export const BetterPortalAppSchema = av.object({
  id: UuidV7Schema,
  tenantId: UuidV7Schema,
  slug: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  hostnames: av.array(NonEmptyStringSchema).minItems(1),
  originOverrides: av.array(av.string().format("url")).default([]),
  refererOverrides: av.array(av.string().format("url")).default([]),
  shell: av.optional(BetterPortalAppShellSchema),
  themeConfig: BetterPortalThemeConfigSchema,
  layoutId: av.optional(NonEmptyStringSchema),
  defaultRoute: NonEmptyStringSchema.default("/"),
  seo: av.optional(BetterPortalSeoConfigSchema),
  routes: av.array(BetterPortalRouteMountSchema).default([]),
  menu: av.array(BetterPortalMenuItemSchema).default([]),
  slots: av.array(BetterPortalSlotAssignmentSchema).default([]),
  fragments: av.record(av.array(BetterPortalFragmentAssignmentSchema)).default({}),
  /** Shell service instance UUID -> shell fragment id -> explicit setting. Missing means shell default. */
  shellFragments: av.record(av.record(BetterPortalShellFragmentSettingSchema)).default({}),
  auth: av.optional(AppAuthConfigSchema),
  statusViewIds: av.optional(av.record(NonEmptyStringSchema))
});
export type BetterPortalApp = Infer<typeof BetterPortalAppSchema>;

export interface BetterPortalResolvedShell {
  readonly serviceId: string;
  readonly service: string;
  readonly renderer: string;
}

export type BetterPortalResolvedApp = Omit<BetterPortalApp, "shell"> & {
  readonly shell?: BetterPortalResolvedShell;
  /** Full application route index supplied to scoped services for cross-service lookup. */
  readonly appRoutes?: ReadonlyArray<BetterPortalApp["routes"][number]>;
  /** Full application fragment index supplied to scoped services for cross-service lookup. */
  readonly appFragments?: BetterPortalApp["fragments"];
};

export const BetterPortalConfigManagementAuthSchema = av.object({
  mechanism: av.enum_(["none", "dev-token", "jwt", "oidc"] as const).default("none"),
  issuer: av.optional(NonEmptyStringSchema),
  audience: av.optional(NonEmptyStringSchema),
  requiredPermissions: av.array(NonEmptyStringSchema).default([])
}).default({
  mechanism: "none",
  requiredPermissions: []
});
export type BetterPortalConfigManagementAuth = Infer<typeof BetterPortalConfigManagementAuthSchema>;

export const BetterPortalConfigManagementSchema = av.object({
  adminTenantId: av.optional(NonEmptyStringSchema),
  managementAppId: av.optional(NonEmptyStringSchema),
  auth: BetterPortalConfigManagementAuthSchema
}).default({
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
  authProvider: av.optional(AuthProviderRuntimeMetadataSchema),
  supportedDeploymentModes: av.array(DeploymentModeSchema).default([]),
  owner: av.enum_(["bp", "3p"] as const).default("bp"),
  upgradeUrlTemplate: av.optional(av.string()),
  category: av.optional(NonEmptyStringSchema),
  tags: av.array(NonEmptyStringSchema).default([]),
  pricingHint: av.optional(av.enum_(["free", "freemium", "paid"] as const)),
  publishedAt: av.optional(av.string().format("date-time")),
  enabled: av.bool().default(true)
});
export type SharedServiceDefinition = Infer<typeof SharedServiceDefinitionSchema>;

export const TenantSharedServiceActivationSchema = av.object({
  id: UuidV7Schema,
  tenantId: NonEmptyStringSchema,
  appId: av.optional(NonEmptyStringSchema),
  sharedServiceId: NonEmptyStringSchema,
  activatedAt: av.string().format("date-time"),
  enabled: av.bool().default(true)
});
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
  mode: M2MCallerModeSchema.default("service"),
  enabled: av.bool().default(true),
  createdAt: av.string().format("date-time")
});
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
});
export type M2MGrant = Infer<typeof M2MGrantSchema>;

export const M2MConfigSchema = av.object({
  bindings: av.array(M2MBindingSchema).default([]),
  grants: av.array(M2MGrantSchema).default([])
}).default({ bindings: [], grants: [] });
export type M2MConfig = Infer<typeof M2MConfigSchema>;

// -- Manifest cache (CP-side per spec section P8) --------------------

export const ServiceManifestCacheEntrySchema = av.object({
  serviceId: NonEmptyStringSchema,
  manifestVersion: NonEmptyStringSchema,
  fetchedAt: av.string().format("date-time"),
  title: av.optional(NonEmptyStringSchema),
  authProvider: av.optional(AuthProviderRuntimeMetadataSchema),
  capabilities: av.array(NonEmptyStringSchema).default([]),
  m2mRequests: av.array(M2MRequestDescriptorSchema).default([]),
  apiContracts: av.array(ApiContractDescriptorSchema).default([]),
  developerResources: av.array(DeveloperResourceSchema).default([]),
  configSchemas: av.array(ConfigSchemaDescriptorSchema).default([]),
  webhooks: av.array(WebhookEventDescriptorSchema).default([]),
  shell: av.optional(ShellManifestSchema),
  viewIndex: av.record(av.object({
    viewId: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    path: NonEmptyStringSchema,
    pathVariants: av.array(NonEmptyStringSchema).default([]),
    paramsSchema: av.optional(JsonObjectSchema),
    operations: av.array(av.object({
      operationId: NonEmptyStringSchema,
      method: HttpMethodSchema,
      title: NonEmptyStringSchema,
      description: NonEmptyStringSchema,
      renderers: av.array(NonEmptyStringSchema).default([]),
      renderModes: av.array(RenderModeSchema).default([]),
      role: av.optional(NonEmptyStringSchema),
      authRequired: av.bool(),
      sitemap: av.optional(av.object({
        kind: av.enum_(["default", "exclude", "metadata", "provider"] as const),
        lastModified: av.optional(av.string().format("date-time")),
        changeFrequency: av.optional(av.enum_(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"] as const)),
        priority: av.optional(av.number().min(0).max(1))
      })),
      robots: av.array(av.object({
        userAgent: NonEmptyStringSchema,
        access: av.enum_(["allow", "disallow"] as const),
        crawlDelaySeconds: av.optional(av.int().min(0).max(86400))
      })).default([]),
      chrome: av.optional(BetterPortalRouteChromeSchema),
      dependencies: av.array(OperationDependencySchema).default([]),
      permissions: av.array(av.object({
        serviceId: NonEmptyStringSchema,
        viewId: NonEmptyStringSchema,
        permissions: av.array(NonEmptyStringSchema).default([])
      })).default([]),
      renderable: av.bool(),
      schemas: av.optional(av.object({
        query: av.optional(JsonObjectSchema),
        headers: av.optional(JsonObjectSchema),
        request: av.optional(JsonObjectSchema),
        multipart: av.optional(JsonObjectSchema),
        response: av.optional(JsonObjectSchema)
      })),
      raw: av.optional(av.bool()),
      apiContracts: av.array(ApiContractDescriptorSchema).default([]),
      demoScenarios: av.array(ViewDemoScenarioSchema).default([])
    })).minItems(1),
    fragments: av.array(av.object({
      fragmentId: NonEmptyStringSchema,
      targetPath: NonEmptyStringSchema,
      operationId: NonEmptyStringSchema,
      method: HttpMethodSchema
    })).default([])
  })).default({})
});
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
});
export type WebhookTarget = Infer<typeof WebhookTargetSchema>;

// -- Preview environments -------------------------------------------

export const PreviewEnvironmentOidcSchema = av.object({
  issuer: NonEmptyStringSchema,
  audience: NonEmptyStringSchema,
  jwksUri: av.string().format("url"),
  subjectPrefix: av.optional(NonEmptyStringSchema),
  requiredClaims: av.record(NonEmptyStringSchema).default({})
});
export type PreviewEnvironmentOidc = Infer<typeof PreviewEnvironmentOidcSchema>;

export const PreviewEnvironmentServiceConfigSchema = av.object({
  tenant: JsonObjectSchema.default({}),
  app: JsonObjectSchema.default({})
}).default({ tenant: {}, app: {} });
export type PreviewEnvironmentServiceConfig = Infer<typeof PreviewEnvironmentServiceConfigSchema>;

export const PreviewEnvironmentGroupServiceSchema = av.object({
  serviceId: PluginIdSchema,
  title: av.optional(NonEmptyStringSchema),
  config: PreviewEnvironmentServiceConfigSchema
});
export type PreviewEnvironmentGroupService = Infer<typeof PreviewEnvironmentGroupServiceSchema>;

export const PreviewEnvironmentGroupSchema = av.object({
  id: UuidV7Schema,
  name: NonEmptyStringSchema,
  sourceTenantId: UuidV7Schema,
  sourceAppId: UuidV7Schema,
  expiresInDays: av.nullable(av.int().min(1).max(3650)).default(30),
  apiKeyHash: NonEmptyStringSchema,
  oidc: av.optional(PreviewEnvironmentOidcSchema),
  services: av.array(PreviewEnvironmentGroupServiceSchema).default([]),
  createdAt: av.string().format("date-time"),
  updatedAt: av.string().format("date-time")
});
export type PreviewEnvironmentGroup = Infer<typeof PreviewEnvironmentGroupSchema>;

export const PreviewEnvironmentDeploymentServiceSchema = av.object({
  serviceId: PluginIdSchema,
  instanceId: UuidV7Schema,
  url: av.string().format("url")
});
export type PreviewEnvironmentDeploymentService = Infer<typeof PreviewEnvironmentDeploymentServiceSchema>;

export const PreviewEnvironmentDeploymentSchema = av.object({
  id: UuidV7Schema,
  groupId: UuidV7Schema,
  key: av.string().minLength(1).maxLength(255),
  name: NonEmptyStringSchema,
  hostname: NonEmptyStringSchema,
  tenantId: UuidV7Schema,
  appId: UuidV7Schema,
  expiresInDays: av.nullable(av.int().min(1).max(3650)),
  expiresAt: av.optional(av.string().format("date-time")),
  services: av.array(PreviewEnvironmentDeploymentServiceSchema).minItems(1),
  createdAt: av.string().format("date-time"),
  updatedAt: av.string().format("date-time")
});
export type PreviewEnvironmentDeployment = Infer<typeof PreviewEnvironmentDeploymentSchema>;

export const BetterPortalConfigSchema = av.object({
  configManagement: BetterPortalConfigManagementSchema,
  platformServices: av.array(PlatformServiceSchema).default([]),
  tenants: av.array(BetterPortalTenantSchema).default([]),
  apps: av.array(BetterPortalAppSchema).default([]),
  sharedServiceCatalog: av.array(SharedServiceDefinitionSchema).default([]),
  sharedServiceActivations: av.array(TenantSharedServiceActivationSchema).default([]),
  manifestCache: av.array(ServiceManifestCacheEntrySchema).default([]),
  m2m: M2MConfigSchema,
  previewEnvironmentGroups: av.array(PreviewEnvironmentGroupSchema).default([]),
  previewEnvironmentDeployments: av.array(PreviewEnvironmentDeploymentSchema).default([]),
  webhooks: av.object({
    targets: av.array(WebhookTargetSchema).default([])
  }).default({ targets: [] })
});
export type BetterPortalConfig = Infer<typeof BetterPortalConfigSchema>;

export interface BetterPortalResolvedRequestContext {
  tenant: BetterPortalTenant;
  app: BetterPortalResolvedApp;
}

export interface BetterPortalResolvedServiceBinding {
  tenant: BetterPortalTenant;
  app: BetterPortalResolvedApp;
  service: TenantServiceRegistration;
}

export const BetterPortalOriginPolicySchema = av.object({
  allowedOrigins: av.array(av.string().format("url")).default([]),
  allowedReferers: av.array(av.string().format("url")).default([])
});
export type BetterPortalOriginPolicy = Infer<typeof BetterPortalOriginPolicySchema>;
