import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints,
  type DemoScenario
} from "@betterportal/framework";

const TenantSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1)
}, { unknownKeys: "strip" });

const AppSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1),
  hostnames: av.array(av.string()).default([])
}, { unknownKeys: "strip" });

const SharedServiceSchema = av.object({
  id: av.string().minLength(1),
  serviceId: av.optional(av.string().minLength(1)),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  baseUrl: av.string().minLength(1),
  category: av.optional(av.string()),
  tags: av.array(av.string()).default([]),
  enabled: av.bool().default(true),
  active: av.bool().default(false)
}, { unknownKeys: "strip" });

const EndpointSchema = av.object({
  current: av.string().minLength(1),
  services: av.string().minLength(1),
  activateService: av.string().minLength(1),
  routes: av.string().minLength(1),
  fragments: av.string().minLength(1),
  theme: av.string().minLength(1),
  webhooks: av.string().minLength(1),
  webhookEvents: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  tenant: TenantSchema,
  app: AppSchema,
  idsVisible: av.bool().default(true),
  managementDiscoveryUrl: av.string().minLength(1),
  automationCatalogUrl: av.string().minLength(1),
  endpoints: EndpointSchema,
  sharedServices: av.array(SharedServiceSchema).default([]),
  routeCount: av.int().min(0),
  fragmentCount: av.int().min(0)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "App Settings";
export const description = "Manage the current BetterPortal app through the user management API.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "settings.index", permissions: ["read", "update"] }
  ]
};

export const dependencies = [
  "services.index",
  "routes.index",
  "fragments.index",
  "config.index"
];

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin", "referer"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Default",
    response: {
      title: "App Settings",
      tenant: { id: "tenant-id", title: "Tenant" },
      app: { id: "app-id", tenantId: "tenant-id", title: "App", hostnames: [] },
      idsVisible: true,
      managementDiscoveryUrl: "/.well-known/bp/management",
      automationCatalogUrl: "/.well-known/bp/automation/catalog",
      endpoints: {
        current: "/.well-known/bp/manage/current",
        services: "/.well-known/bp/manage/services",
        activateService: "/.well-known/bp/manage/services/activate",
        routes: "/.well-known/bp/manage/routes",
        fragments: "/.well-known/bp/manage/fragments",
        theme: "/.well-known/bp/manage/theme",
        webhooks: "/.well-known/bp/manage/webhooks/targets",
        webhookEvents: "/.well-known/bp/manage/webhooks/events"
      },
      sharedServices: [],
      routeCount: 0,
      fragmentCount: 0
    }
  }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return demoScenarios[0]!.response;
  }
);
