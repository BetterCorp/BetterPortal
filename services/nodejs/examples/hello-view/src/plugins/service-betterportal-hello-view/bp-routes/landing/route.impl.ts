import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
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

const AudienceSchema = av.object({
  title: av.string().minLength(1),
  text: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  headline: av.string().minLength(1),
  subheading: av.string().minLength(1),
  summary: av.string().minLength(1),
  highlights: av.array(HighlightSchema),
  capabilities: av.array(CapabilitySchema),
  audiences: av.array(AudienceSchema),
  aboutHref: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "BetterPortal";
export const description = "Landing page for BetterPortal, the service-oriented portal framework.";
export const chrome: BetterPortalRouteChrome = { fullScreen: true };

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
    summary: "BetterPortal is a TypeScript platform for building tenant-aware portals from independently deployed services. It keeps UI, auth, configuration, automation, and AI discovery on one typed contract without forcing every team into one monolith.",
    highlights: [
      {
        title: "Schema-backed routes",
        text: "Every service route declares input, output, auth, chrome, cache, renderer, and dependency metadata so the same endpoint can serve people, tools, and agents."
      },
      {
        title: "Tenant and app scoped",
        text: "Shared services can be activated per tenant while apps decide which service routes are mounted, branded, and exposed."
      },
      {
        title: "Designed for distributed hosting",
        text: "Services pull scoped config from the control plane and stay browser-reachable, so private networks and remote services can coexist cleanly."
      }
    ],
    capabilities: [
      {
        title: "Typed APIs and views",
        text: "A route can negotiate JSON, HTML, streams, SSE, raw files, or metadata from the same source contract."
      },
      {
        title: "Config manager control plane",
        text: "Tenants, apps, shared services, route mounts, menu entries, auth bindings, and scoped service config are managed centrally."
      },
      {
        title: "Theme and auth as services",
        text: "Themes, default auth, external auth providers, and business modules all plug in through the same BP service model."
      },
      {
        title: "Automation and AI discovery",
        text: "Public manifests, llms.txt, route schemas, and service metadata make portals inspectable by integrations and AI agents."
      }
    ],
    audiences: [
      {
        title: "Platform teams",
        text: "Run a multi-tenant portal without coupling every feature to the control plane deploy."
      },
      {
        title: "Service teams",
        text: "Own your routes, views, config schema, auth requirements, and release cycle."
      },
      {
        title: "Product teams",
        text: "Compose apps from shared services, app-specific routes, menus, themes, and auth choices."
      },
      {
        title: "Automation builders",
        text: "Discover actions and schemas from the portal instead of hand-maintaining integration maps."
      }
    ],
    aboutHref: "/about"
  })
);
