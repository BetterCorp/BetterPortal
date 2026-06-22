import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const ServiceViewSchema = av.object({
  serviceId: av.string().minLength(1),
  endpointBaseUrl: av.string().format("url"),
  views: av.array(av.object({
    viewId: av.string().minLength(1),
    title: av.string(),
    path: av.string().minLength(1),
    themes: av.array(av.string()),
    components: av.array(av.string()),
    hasFragments: av.bool(),
    demoScenarios: av.array(av.object({
      id: av.string().minLength(1),
      title: av.string()
    }, { unknownKeys: "strip" }))
  }, { unknownKeys: "strip" }))
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  services: av.array(ServiceViewSchema)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Component Preview";
export const description = "Browse and preview service views, components, and fragments.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "preview.index", permissions: ["read"] }
  ]
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Component Preview", services: [] } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return { title: "Component Preview", services: [] };
  }
);
