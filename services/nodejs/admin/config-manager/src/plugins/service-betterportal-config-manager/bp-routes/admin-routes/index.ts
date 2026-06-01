import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
  type CacheHints
} from "@betterportal/framework-nodejs";

const RouteItemSchema = av.object({
  id: av.string().minLength(1),
  path: av.string().minLength(1),
  serviceId: av.string().minLength(1),
  viewId: av.string().minLength(1),
  targetPath: av.optional(av.string()),
  title: av.optional(av.string()),
  enabled: av.bool()
}, { unknownKeys: "strip" });

const AppSummarySchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  tenantId: av.string().minLength(1)
}, { unknownKeys: "strip" });

const AvailableViewSchema = av.object({
  viewId: av.string().minLength(1),
  title: av.string(),
  path: av.string()
}, { unknownKeys: "strip" });

const AvailableServiceSchema = av.object({
  id: av.string().minLength(1),
  title: av.string(),
  views: av.array(AvailableViewSchema).default([])
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  apps: av.array(AppSummarySchema),
  selectedAppId: av.optional(av.string()),
  routes: av.array(RouteItemSchema),
  availableServices: av.array(AvailableServiceSchema).default([]),
  adminApiBase: av.string().minLength(1),
  serviceBaseUrl: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Route Designer";
export const description = "Design navigation routes for apps.";

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Route Designer", apps: [], routes: [], availableServices: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Route Designer", apps: [], routes: [], availableServices: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" };
  }
);
