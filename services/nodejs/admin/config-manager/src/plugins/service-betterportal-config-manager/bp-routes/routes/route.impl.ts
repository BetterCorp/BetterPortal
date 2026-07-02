import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const RouteItemSchema = av.object({
  id: av.string().minLength(1),
  kind: av.enum_(["page", "api"] as const).default("page"),
  path: av.string().minLength(1),
  serviceId: av.string().minLength(1),
  viewId: av.string().minLength(1),
  targetPath: av.optional(av.string()),
  methods: av.array(av.string()).default([]),
  query: av.optional(av.string()),
  title: av.optional(av.string()),
  renderable: av.bool().default(true),
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
  path: av.string(),
  methods: av.array(av.string()).default([]),
  renderable: av.bool().default(true),
  dependencies: av.array(av.string()).default([])
}, { unknownKeys: "strip" });

const AvailableServiceSchema = av.object({
  id: av.string().minLength(1),
  title: av.string(),
  hostname: av.string().format("url"),
  serviceId: av.optional(av.string()),
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

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "routes.index", permissions: ["read","create","update","delete"] }
  ]
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Route Designer", apps: [], routes: [], availableServices: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return { title: "Route Designer", apps: [], routes: [], availableServices: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" };
  }
);
