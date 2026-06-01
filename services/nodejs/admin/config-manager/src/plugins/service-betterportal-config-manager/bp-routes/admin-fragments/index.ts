import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
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

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Fragments", apps: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Fragments", apps: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "" };
  }
);
