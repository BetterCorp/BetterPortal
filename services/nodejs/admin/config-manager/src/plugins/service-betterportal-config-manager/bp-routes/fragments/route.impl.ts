import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const AppSummarySchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  tenantId: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  apps: av.array(AppSummarySchema),
  selectedAppId: av.optional(av.string()),
  adminApiBase: av.string().minLength(1),
  serviceBaseUrl: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Fragments";
export const description = "Manage topbar/footer fragments per app.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "fragments.index", permissions: ["read","create","update","delete"] }
  ]
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Fragments", apps: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return { title: "Fragments", apps: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" };
  }
);
