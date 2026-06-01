import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
  type CacheHints
} from "@betterportal/framework-nodejs";

const RegisteredServiceItemSchema = av.object({
  id: av.string().minLength(1),
  hostname: av.string().format("url"),
  serviceId: av.optional(av.string()),
  title: av.optional(av.string()),
  description: av.optional(av.string()),
  createdAt: av.string(),
  lastSeenAt: av.optional(av.string()),
  enabled: av.bool(),
  scope: av.string().minLength(1),
  tenantId: av.optional(av.string()),
  pushBase: av.string().minLength(1),
  supportsCustomUi: av.bool().default(false),
  customUiPath: av.optional(av.string())
}, { unknownKeys: "strip" });

const AppByTenantSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1)
}, { unknownKeys: "strip" });

const AppSummarySchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1)
}, { unknownKeys: "strip" });

const TenantSummarySchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  services: av.array(RegisteredServiceItemSchema),
  tenants: av.array(TenantSummarySchema),
  apps: av.array(AppSummarySchema).default([]),
  tenantApps: av.record(av.array(AppByTenantSchema)).default({}),
  adminApiBase: av.string().minLength(1),
  serviceBaseUrl: av.optional(av.string()),
  configApiToken: av.string().default("bp-dev-config-token")
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Service Registry";
export const description = "Manage registered service instances.";

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Default",
    response: { title: "Service Registry", services: [], tenants: [], apps: [], tenantApps: {}, adminApiBase: "/.well-known/bp/admin", configApiToken: "bp-dev-config-token" }
  }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Service Registry", services: [], tenants: [], apps: [], tenantApps: {}, adminApiBase: "/.well-known/bp/admin", configApiToken: "bp-dev-config-token" };
  }
);
