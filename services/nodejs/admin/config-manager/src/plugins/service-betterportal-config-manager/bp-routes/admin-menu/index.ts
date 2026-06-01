import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
  type CacheHints
} from "@betterportal/framework-nodejs";

const RouteOptionSchema = av.object({
  id: av.string().minLength(1),
  path: av.string().minLength(1),
  title: av.string()
}, { unknownKeys: "strip" });

const MenuItemSchema = av.object({
  id: av.string().minLength(1),
  type: av.string().minLength(1),
  title: av.optional(av.string()),
  routeId: av.optional(av.string()),
  href: av.optional(av.string()),
  enabled: av.bool()
}, { unknownKeys: "strip" });

const AppSummarySchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  tenantId: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  apps: av.array(AppSummarySchema),
  selectedAppId: av.optional(av.string()),
  menu: av.array(MenuItemSchema).default([]),
  routes: av.array(RouteOptionSchema).default([]),
  adminApiBase: av.string().minLength(1),
  serviceBaseUrl: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Menu Designer";
export const description = "Design app navigation menu.";

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Menu Designer", apps: [], menu: [], routes: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Menu Designer", apps: [], menu: [], routes: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" };
  }
);
