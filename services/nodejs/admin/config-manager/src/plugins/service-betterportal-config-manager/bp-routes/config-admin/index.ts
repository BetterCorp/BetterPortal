import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ViewAuthRequirement,
  type CacheHints
} from "@betterportal/framework-nodejs";

// ── Schemas ─────────────────────────────────────────────────────────

export const QuerySchema = av.object({}, { unknownKeys: "strip" });

export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({}, { unknownKeys: "strip" });

const ConfigManagerServiceSchema = av.object({
  serviceId: av.string().minLength(1),
  bindingId: av.string().minLength(1),
  endpointBaseUrl: av.string().format("url"),
  deploymentMode: av.string().minLength(1),
  healthUrl: av.string().format("url"),
  schemaUrl: av.string().format("url"),
  manifestUrl: av.string().format("url")
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  appId: av.string().minLength(1),
  requestTimeoutMs: av.int().min(1),
  services: av.array(ConfigManagerServiceSchema)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

// ── Metadata ────────────────────────────────────────────────────────

export const title = "Config Manager";
export const description = "Admin service that discovers BetterPortal service config surfaces.";

export const auth: ViewAuthRequirement = {
  required: false,
  realm: "runtime",
  minimumTier: "public",
  audiences: [],
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 30,
  varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
};

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Default Config Admin",
    match: { query: {} },
    response: {
      title: "Config Manager",
      tenantId: "tenant-main",
      appId: "app-main",
      requestTimeoutMs: 2000,
      services: []
    }
  }
];

// ── Handler ─────────────────────────────────────────────────────────

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    // The actual data is injected by the main plugin via the rawEvent context.
    // This handler is a passthrough — the plugin builds the response model
    // from config/bindings and attaches it to the event before the H3 adapter
    // calls this handler.
    const event = ctx.rawEvent as { __bpResponseModel?: ResponseData } | undefined;
    if (event?.__bpResponseModel) {
      return event.__bpResponseModel;
    }

    // Fallback: return empty state (should not happen in normal flow)
    return {
      title: "Config Manager",
      tenantId: "unknown",
      appId: "unknown",
      requestTimeoutMs: 2000,
      services: []
    };
  }
);
