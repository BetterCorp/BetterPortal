import {
  createPluginManifest,
  createViewDefinition,
  negotiateViewResponse,
  resolveRepresentationFromAccept,
  type HtmlRenderable,
  type PluginManifest,
  type RequestedRepresentation
} from "@betterportal/framework-nodejs";
import { z } from "zod";
import { renderBootstrap1HelloView, renderEmbeddedHelloView } from "../../views/hello";

const HelloParamsSchema = z.object({});
const HelloQuerySchema = z.object({
  name: z.string().min(1).default("World")
});
const HelloHeadersSchema = z.object({
  accept: z.string().optional()
});
const HelloBodySchema = z.object({});

export const HelloResponseSchema = z.object({
  greeting: z.string().min(1),
  themeHint: z.string().min(1),
  supports: z.array(z.string().min(1)).min(1)
});
export type HelloResponse = z.infer<typeof HelloResponseSchema>;

export const HelloRoute = createViewDefinition({
  viewId: "hello.index",
  title: "Hello View",
  description: "Example BetterPortal view with JSON, HTML, and metadata representations.",
  path: "/hello",
  methods: ["GET"],
  schemas: {
    params: HelloParamsSchema,
    query: HelloQuerySchema,
    headers: HelloHeadersSchema,
    body: HelloBodySchema,
    response: HelloResponseSchema
  },
  html: {
    defaultTheme: "bootstrap1",
    allowDefaultThemeWhenOmitted: true,
    supportedThemes: ["bootstrap1", "embedded"],
    renderModes: ["page", "fragment", "embed"]
  },
  auth: {
    required: false,
    minimumTier: "public",
    audiences: [],
    permissions: []
  },
  cacheHints: {
    ttlSeconds: 60,
    varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
  }
});

export const HelloManifest: PluginManifest = createPluginManifest({
  pluginId: "service.betterportal.hello-view",
  title: "BetterPortal Hello View Example",
  description: "Example business service showing API-first view negotiation.",
  version: "1.0.0",
  category: "service",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted", "third-party-saas"],
  capabilities: ["view.json", "view.html", "view.metadata", "theme.bootstrap1", "theme.embedded"],
  supportedThemes: ["bootstrap1", "embedded"],
  supportedRenderModes: ["page", "fragment", "embed"],
  views: [HelloRoute.toMetadata()],
  configSchemas: [],
  permissions: [],
  adminApis: [],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

export function buildHelloResponse(name: string, requestedRepresentation: RequestedRepresentation): HelloResponse {
  const themeHint = requestedRepresentation.kind === "html"
    ? requestedRepresentation.theme ?? "bootstrap1"
    : "json";

  return HelloResponseSchema.parse({
    greeting: `Hello, ${name}`,
    themeHint,
    supports: ["application/json", "application/vnd.betterportal.metadata+json", "text/html"]
  });
}

export function renderHelloHtml(theme: string, response: HelloResponse): HtmlRenderable {
  if (theme === "embedded") {
    return renderEmbeddedHelloView(response);
  }

  return renderBootstrap1HelloView(response);
}

export function handleHelloRoute(input: {
  acceptHeader?: string;
  query: unknown;
}) {
  const query = HelloQuerySchema.parse(input.query);
  const requestedRepresentation = resolveRepresentationFromAccept(input.acceptHeader);
  const response = buildHelloResponse(query.name, requestedRepresentation);

  return negotiateViewResponse(HelloRoute, input.acceptHeader, response, (theme) => renderHelloHtml(theme, response));
}
