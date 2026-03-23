/** @jsxImportSource jsx-htmx */
import {
  createPluginManifest,
  createViewDefinition,
  negotiateViewResponse,
  type PluginManifest,
  type RequestedRepresentation,
  resolveRepresentationFromAccept
} from "@betterportal/framework-nodejs";
import { z } from "zod";

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

export const HelloView = createViewDefinition({
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
    varyBy: ["accept", "origin", "referer"]
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
  views: [HelloView.toMetadata()],
  configSchemas: [],
  permissions: [],
  adminApis: [],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

function Bootstrap1HelloFragment(response: HelloResponse): string {
  return String(
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-3">
        <span class="badge rounded-pill text-bg-primary w-auto">{response.themeHint}</span>
        <div>
          <h1 class="h3 mb-2">{response.greeting}</h1>
          <p class="text-body-secondary mb-0">
            This HTML representation is rendered from the same validated API output.
          </p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          {response.supports.map((item) => (
            <span class="badge text-bg-light border text-dark">{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmbeddedHelloFragment(response: HelloResponse): string {
  return String(
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="small text-body-secondary mb-2">{response.themeHint}</div>
        <div class="h5 mb-2">{response.greeting}</div>
        <div class="text-body-secondary">Rendered for lightweight embedded usage.</div>
      </div>
    </div>
  );
}

export function renderHelloHtml(theme: string, response: HelloResponse): string {
  if (theme === "embedded") {
    return EmbeddedHelloFragment(response);
  }

  return Bootstrap1HelloFragment(response);
}

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

export function handleHelloViewRequest(input: {
  acceptHeader?: string;
  query: unknown;
}): ReturnType<typeof negotiateViewResponse<typeof HelloResponseSchema>> {
  const query = HelloQuerySchema.parse(input.query);
  const requestedRepresentation = resolveRepresentationFromAccept(input.acceptHeader);
  const response = buildHelloResponse(query.name, requestedRepresentation);

  return negotiateViewResponse(HelloView, input.acceptHeader, response, (theme) => renderHelloHtml(theme, response));
}
