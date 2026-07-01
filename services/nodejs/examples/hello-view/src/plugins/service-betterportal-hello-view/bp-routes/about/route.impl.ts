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

const SectionSchema = av.object({
  title: av.string().minLength(1),
  text: av.string().minLength(1)
}, { unknownKeys: "strip" });

const PrincipleSchema = av.object({
  title: av.string().minLength(1),
  text: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  intro: av.string().minLength(1),
  sections: av.array(SectionSchema),
  principles: av.array(PrincipleSchema),
  landingHref: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "About BetterPortal";
export const description = "Overview of BetterPortal architecture and design principles.";

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
    title: "About BetterPortal",
    intro: "BetterPortal is a framework for building tenant-aware portals from independently deployed services. The platform gives services a shared contract without forcing them into a shared process.",
    sections: [
      {
        title: "Control plane",
        text: "The config manager owns platform state, service activation, app routes, shared service bindings, and scoped configuration. Services pull what they need and apply it locally."
      },
      {
        title: "Runtime services",
        text: "A service can expose APIs, views, fragments, streaming endpoints, raw file responses, and service metadata. The same route remains useful to browsers, integrations, and agents."
      },
      {
        title: "Themes",
        text: "Themes render the shell and negotiate content from services. They keep navigation, profile fragments, background fragments, and chrome behavior outside business services."
      },
      {
        title: "Auth",
        text: "Auth providers plug into the same service model. Apps choose an auth service, while service routes keep their own explicit auth and permission requirements."
      }
    ],
    principles: [
      {
        title: "Typed boundaries",
        text: "Inputs, outputs, scoped config, and metadata are declared as schemas so runtime behavior stays observable and predictable."
      },
      {
        title: "No hidden platform reach",
        text: "Browser-driven setup and pull-based sync avoid assuming the config manager can directly reach every deployed service."
      },
      {
        title: "Local ownership",
        text: "Services own their route behavior and view renderers. The platform decides which routes are mounted for each app."
      },
      {
        title: "Composable operations",
        text: "The same discovery surface supports users, admins, automation systems, and AI agents without separate bespoke integration layers."
      }
    ],
    landingHref: "/landing"
  })
);
