import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const RegisteredServiceItemSchema = av.object({
  id: av.string().minLength(1).describe("Stable UUIDv7 service instance id."),
  hostname: av.string().format("url").describe("Service origin used by the browser for direct HTMX requests."),
  serviceId: av.optional(av.string()).describe("Service plugin id from the service manifest."),
  capabilities: av.array(av.string()).default([]).describe("Capabilities advertised by the service manifest."),
  title: av.optional(av.string()).describe("Human-readable service title from the manifest or registration."),
  description: av.optional(av.string()).describe("Human-readable service description from the manifest."),
  createdAt: av.string().describe("ISO timestamp when the service registration was created."),
  lastSeenAt: av.optional(av.string()).describe("ISO timestamp when the service last checked in or synced."),
  enabled: av.bool().describe("Whether this service registration is active."),
  scope: av.string().minLength(1).describe("Registration scope: tenant, shared, platform, or theme."),
  themeId: av.optional(av.string().minLength(1)).describe("Theme renderer id when the service provides a theme."),
  tenantId: av.optional(av.string()).describe("Owning tenant id for tenant-scoped service registrations."),
  pushBase: av.string().minLength(1).describe("Browser-visible route base used when pushing URLs for custom service UI."),
  supportsCustomUi: av.bool().default(false).describe("True when the service exposes a custom configuration UI."),
  configManifestKnown: av.bool().default(false).describe("True once config-manager has received this service instance manifest via sync."),
  hasConfigurableOptions: av.bool().default(false).describe("True when the service has configurable schema fields or a custom configuration UI."),
  customUiPath: av.optional(av.string()).describe("Service-side path for custom configuration UI, when provided.")
}, { unknownKeys: "strip" });

const AppByTenantSchema = av.object({
  id: av.string().minLength(1).describe("Stable UUIDv7 app id."),
  title: av.string().minLength(1).describe("Human-readable app title."),
  shellServiceId: av.optional(av.string().minLength(1)).describe("Shell service instance selected by the app.")
}, { unknownKeys: "strip" });

const AppSummarySchema = av.object({
  id: av.string().minLength(1).describe("Stable UUIDv7 app id."),
  tenantId: av.string().minLength(1).describe("Owning tenant id."),
  title: av.string().minLength(1).describe("Human-readable app title.")
}, { unknownKeys: "strip" });

const TenantSummarySchema = av.object({
  id: av.string().minLength(1).describe("Stable UUIDv7 tenant id."),
  title: av.string().minLength(1).describe("Human-readable tenant title.")
}, { unknownKeys: "strip" });

const SharedServiceCatalogItemSchema = av.object({
  id: av.string().minLength(1),
  serviceId: av.optional(av.string().minLength(1)),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  baseUrl: av.string().minLength(1),
  owner: av.optional(av.string()),
  category: av.optional(av.string()),
  tags: av.array(av.string()).default([]),
  installed: av.bool().default(false),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });

const SharedServiceActivationSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  appId: av.optional(av.string().minLength(1)),
  sharedServiceId: av.string().minLength(1),
  activatedAt: av.string().minLength(1),
  enabled: av.bool().default(true)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1).describe("View title for the service registry."),
  services: av.array(RegisteredServiceItemSchema).describe("Registered service instances visible to the admin view."),
  tenants: av.array(TenantSummarySchema).describe("Tenants available for grouping and service registration."),
  selectedTenantId: av.optional(av.string().minLength(1)).describe("Tenant currently selected in the service registry."),
  sharedServiceCatalog: av.array(SharedServiceCatalogItemSchema).default([]).describe("Shared service definitions from platform config."),
  sharedServiceActivations: av.array(SharedServiceActivationSchema).default([]).describe("Tenant/app activations for shared services."),
  apps: av.array(AppSummarySchema).default([]).describe("Apps available in the current admin context."),
  tenantApps: av.record(av.array(AppByTenantSchema)).default({}).describe("Apps keyed by tenant id for configuring tenant or theme-scoped services."),
  adminApiBase: av.string().minLength(1).describe("Base path for config-manager admin API calls."),
  serviceBaseUrl: av.optional(av.string()).describe("Config-manager service origin for browser-mediated admin requests.")
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Service Registry";
export const description = "Manage registered service instances.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "services.index", permissions: ["read"] }
  ]
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Default",
    response: { title: "Service Registry", services: [], tenants: [], sharedServiceCatalog: [], sharedServiceActivations: [], apps: [], tenantApps: {}, adminApiBase: "/.well-known/bp/admin" }
  }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return { title: "Service Registry", services: [], tenants: [], sharedServiceCatalog: [], sharedServiceActivations: [], apps: [], tenantApps: {}, adminApiBase: "/.well-known/bp/admin" };
  }
);
