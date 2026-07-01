import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

export const QuerySchema = av.object({}, { unknownKeys: "strip" });
export const HeadersSchema = av.object({}, { unknownKeys: "strip" });
export const RequestSchema = av.object({}, { unknownKeys: "strip" });

const HighlightSchema = av.object({
  title: av.string().minLength(1),
  text: av.string().minLength(1)
}, { unknownKeys: "strip" });

const CapabilitySchema = av.object({
  title: av.string().minLength(1),
  text: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  headline: av.string().minLength(1),
  subheading: av.string().minLength(1),
  summary: av.string().minLength(1),
  highlights: av.array(HighlightSchema),
  capabilities: av.array(CapabilitySchema),
  aboutHref: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "BetterPortal";
export const description = "Landing page for BetterPortal, the service-oriented portal framework.";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 300,
  varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
};

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema, headers: HeadersSchema, request: RequestSchema },
  () => ({
    headline: "BetterPortal",
    subheading: "Composable portals for serious service platforms.",
    summary: "BetterPortal lets teams ship independent services, views, auth providers, themes, and automation surfaces without forcing every part of the stack into one deployable application.",
    highlights: [
      {
        title: "Service-first",
        text: "Each capability is owned by the service that implements it, with typed routes, views, schemas, and manifests exposed through the BP runtime."
      },
      {
        title: "Tenant aware",
        text: "Configuration is scoped through the platform, then resolved per tenant and app so shared services can still behave locally."
      },
      {
        title: "AI ready",
        text: "Discovery documents, schema-backed APIs, and route metadata give agents enough structure to understand what the portal can do."
      }
    ],
    capabilities: [
      {
        title: "Typed service routes",
        text: "Handlers validate input and output with schemas, then negotiate JSON, HTML, streams, or raw responses through the framework."
      },
      {
        title: "Config-managed delivery",
        text: "Services can run separately and pull scoped platform configuration without requiring direct service-to-service access."
      },
      {
        title: "Theme and auth independence",
        text: "Themes, auth providers, and business services are peers. Apps decide what to activate and expose."
      },
      {
        title: "Automation surface",
        text: "The same route and manifest model can drive human UIs, integrations, AI tools, and workflow platforms."
      }
    ],
    aboutHref: "/about"
  })
);
