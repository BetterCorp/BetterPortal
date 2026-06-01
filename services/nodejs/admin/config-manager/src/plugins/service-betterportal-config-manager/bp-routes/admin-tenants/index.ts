import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const TenantItemSchema = av.object({
  id: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  active: av.bool(),
  serviceCount: av.int().min(0)
}, { unknownKeys: "strip" });

const AppItemSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  slug: av.string().minLength(1),
  title: av.string().minLength(1),
  hostnames: av.array(av.string()),
  themeId: av.string().minLength(1),
  routeCount: av.int().min(0)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  tenants: av.array(TenantItemSchema),
  apps: av.array(AppItemSchema),
  adminApiBase: av.string().minLength(1),
  serviceBaseUrl: av.optional(av.string())
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Tenants & Apps";
export const description = "Manage tenants and applications.";

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Tenants & Apps", tenants: [], apps: [], adminApiBase: "/.well-known/bp/admin" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Tenants & Apps", tenants: [], apps: [], adminApiBase: "/.well-known/bp/admin" };
  }
);
