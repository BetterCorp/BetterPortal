import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
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

export const auth: ViewAuthRequirement = {
  required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: []
};

export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };

export const demoScenarios: DemoScenario<ResponseData>[] = [
  { id: "default", title: "Default", response: { title: "Component Preview", services: [] } }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) return event.__bpResponseModel;
    return { title: "Component Preview", services: [] };
  }
);
