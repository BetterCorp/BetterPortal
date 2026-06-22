import type { HttpMethod, RenderMode } from "../contracts/common.js";
import type { JsonValue } from "../contracts/json.js";
import type {
  BetterPortalRegistry,
  RegisteredRoute,
  RegisteredThemeRenderer,
  ThemeRendererSet
} from "../contracts/registry.js";
import type { AdminApiDescriptor, PluginManifest } from "../contracts/manifest.js";
import type { ViewMetadata } from "../contracts/view.js";
import { toJsonSchemaDocument } from "./jsonSchema.js";

// -- Route resolution --------------------------------------------------

export interface ResolvedRoute {
  readonly route: RegisteredRoute;
  readonly params: Record<string, string>;
}

interface RouteCandidate {
  route: RegisteredRoute;
  segments: string[];
  paramIndices: Map<number, string>;
  staticCount: number;
}

function buildCandidates(registry: BetterPortalRegistry): RouteCandidate[] {
  return registry.routes.map((route) => {
    const segments = route.path.split("/").filter(Boolean);
    const paramIndices = new Map<number, string>();
    let staticCount = 0;

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startsWith(":")) {
        paramIndices.set(i, segments[i].slice(1));
      } else {
        staticCount++;
      }
    }

    return { route, segments, paramIndices, staticCount };
  });
}

/**
 * Resolve a request path to a registered route.
 * Static segments have priority over dynamic params (Next.js convention).
 */
export function resolveRoute(
  registry: BetterPortalRegistry,
  path: string,
  method: HttpMethod
): ResolvedRoute | null {
  const requestSegments = path.split("/").filter(Boolean);
  const candidates = buildCandidates(registry);
  const matches: Array<{ candidate: RouteCandidate; params: Record<string, string> }> = [];

  for (const candidate of candidates) {
    if (candidate.segments.length !== requestSegments.length) continue;
    if (!candidate.route.methods.includes(method)) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < candidate.segments.length; i++) {
      const paramName = candidate.paramIndices.get(i);
      if (paramName) {
        params[paramName] = requestSegments[i];
      } else if (candidate.segments[i] !== requestSegments[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      matches.push({ candidate, params });
    }
  }

  if (matches.length === 0) return null;

  // Sort: more static segments = higher priority (static > dynamic)
  matches.sort((a, b) => b.candidate.staticCount - a.candidate.staticCount);

  return {
    route: matches[0].candidate.route,
    params: matches[0].params
  };
}

// -- Renderer resolution -----------------------------------------------

export interface ResolvedRenderer {
  readonly renderer: RegisteredThemeRenderer;
  readonly themeId: string;
}

/**
 * Resolve a theme renderer for a route.
 * Method-specific renderers have priority over default (no method).
 */
export function resolveRenderer(
  route: RegisteredRoute,
  themeId: string,
  type: "page" | "component" | "fragment",
  method?: HttpMethod,
  componentId?: string,
  fragmentKey?: string
): ResolvedRenderer | null {
  const themeSet = route.themeRenderers[themeId];
  if (!themeSet) return null;

  let pool: ReadonlyArray<RegisteredThemeRenderer>;
  switch (type) {
    case "page":
      pool = themeSet.pages;
      break;
    case "component":
      pool = themeSet.components;
      break;
    case "fragment":
      pool = themeSet.fragments;
      break;
  }

  // Filter by target
  let candidates: RegisteredThemeRenderer[];
  if (type === "component" && componentId) {
    candidates = pool.filter((r) => r.rendererId === componentId);
  } else if (type === "fragment" && fragmentKey) {
    const [location, id] = fragmentKey.split(".");
    candidates = pool.filter(
      (r) => r.fragmentLocation === location && r.fragmentId === id
    );
  } else {
    candidates = pool.filter((r) => r.rendererId === "default");
  }

  if (candidates.length === 0) return null;

  // Method-specific wins over generic
  if (method) {
    const methodSpecific = candidates.find((r) => r.method === method);
    if (methodSpecific) return { renderer: methodSpecific, themeId };
  }

  // Fallback to no-method renderer
  const generic = candidates.find((r) => r.method === undefined);
  return generic ? { renderer: generic, themeId } : null;
}

// -- Manifest builder --------------------------------------------------

export interface ManifestBaseFields {
  pluginId: string;
  title: string;
  description: string;
  category?: PluginManifest["category"];
  deploymentModes?: ReadonlyArray<PluginManifest["deploymentModes"][number]>;
  capabilities?: ReadonlyArray<string>;
  configSchemas?: PluginManifest["configSchemas"];
  permissions?: PluginManifest["permissions"];
  adminApis?: PluginManifest["adminApis"];
  webhooks?: PluginManifest["webhooks"];
  cacheHints?: PluginManifest["cacheHints"];
}

const CONFIG_ADMIN_APIS: readonly AdminApiDescriptor[] = [
  { id: "config.schema", title: "Config Schema", description: "BetterPortal-managed config schemas for this service.", path: "/.well-known/bp/config/schema", methods: ["GET"], supportsCustomUi: false },
  { id: "config.values", title: "Config Values", description: "Read and write BetterPortal-managed config values.", path: "/.well-known/bp/config", methods: ["GET", "POST"], supportsCustomUi: false }
];

function deriveAdminApis(base: ManifestBaseFields): AdminApiDescriptor[] {
  const explicit = base.adminApis ?? [];
  const hasConfigSchemas = (base.configSchemas?.length ?? 0) > 0;
  if (!hasConfigSchemas) return [...explicit];

  const explicitIds = new Set(explicit.map((a) => a.id));
  const derived = CONFIG_ADMIN_APIS.filter((a) => !explicitIds.has(a.id));
  return [...explicit, ...derived];
}

/**
 * Build a PluginManifest from the registry, auto-deriving:
 * - version (from package.json)
 * - supportedThemes (from route themeRenderers)
 * - supportedRenderModes (from renderer types)
 * - views (from non-fragment routes)
 * - capabilities (from themes + view types)
 */
export function buildManifestFromRegistry(
  registry: BetterPortalRegistry,
  packageJson: { version: string },
  base: ManifestBaseFields
): PluginManifest {
  const themes = new Set<string>();
  const renderModes = new Set<string>();
  const capabilities = new Set<string>();

  for (const capability of base.capabilities ?? []) {
    capabilities.add(capability);
  }

  capabilities.add("view.json");
  capabilities.add("view.metadata");

  for (const route of registry.routes) {
    // Streaming views (spec/streaming.md section 5)
    if (route.schemas.item) {
      capabilities.add("stream.ndjson");
    }

    for (const [themeId, rendererSet] of Object.entries(route.themeRenderers)) {
      themes.add(themeId);
      capabilities.add(`theme.${themeId}`);

      if (rendererSet.pages.length > 0) renderModes.add("page");
      if (rendererSet.fragments.length > 0) renderModes.add("fragment");
      if (rendererSet.pages.length > 0 || rendererSet.components.length > 0) {
        capabilities.add("view.html");
      }
      if (rendererSet.stream) {
        capabilities.add("view.sse-render");
        capabilities.add("view.html");
        renderModes.add("fragment");
      }
    }
  }

  const seenViewIds = new Set<string>();
  const views: ViewMetadata[] = registry.routes
    .filter((route) => {
      if (seenViewIds.has(route.viewId)) return false;
      seenViewIds.add(route.viewId);

      // Exclude fragment-only routes (routes that have fragment renderers but no pages)
      const hasAnyPage = Object.values(route.themeRenderers).some(
        (set) => set.pages.length > 0 || set.stream !== undefined
      );
      return hasAnyPage || Object.keys(route.themeRenderers).length === 0;
    })
    .map((route) => routeToViewMetadata(route));

  return {
    pluginId: base.pluginId,
    title: base.title,
    description: base.description,
    version: packageJson.version,
    category: base.category ?? "service",
    deploymentModes: base.deploymentModes ? [...base.deploymentModes] : ["self-hosted"],
    capabilities: [...capabilities],
    supportedThemes: [...themes],
    supportedRenderModes: [...renderModes] as PluginManifest["supportedRenderModes"],
    views,
    configSchemas: base.configSchemas ?? [],
    permissions: base.permissions ?? [],
    adminApis: deriveAdminApis(base),
    webhooks: base.webhooks ?? [],
    cacheHints: base.cacheHints ?? { metadataTtlSeconds: 1800 }
  };
}

function routeToViewMetadata(route: RegisteredRoute): ViewMetadata {
  const themeRenderers: Record<string, {
    defaultRenderer: string;
    renderModes: RenderMode[];
    slots: string[];
    renderers: Array<{ id: string; title: string; slotId: string; renderModes: RenderMode[] }>;
  }> = {};

  for (const [themeId, set] of Object.entries(route.themeRenderers)) {
    const modes: RenderMode[] = [];
    const renderers: Array<{ id: string; title: string; slotId: string; renderModes: RenderMode[] }> = [];

    if (set.pages.length > 0) modes.push("page");
    if (set.fragments.length > 0 || set.stream) modes.push("fragment");

    for (const page of set.pages) {
      renderers.push({
        id: page.rendererId,
        title: page.rendererId === "default" ? "Default Content" : page.rendererId,
        slotId: "main",
        renderModes: ["page", "fragment"]
      });
    }

    for (const fragment of set.fragments) {
      const slotId = fragment.fragmentLocation && fragment.fragmentId
        ? `${fragment.fragmentLocation}.${fragment.fragmentId}`
        : fragment.rendererId;
      renderers.push({
        id: fragment.rendererId,
        title: fragment.rendererId,
        slotId,
        renderModes: ["fragment"]
      });
    }

    themeRenderers[themeId] = {
      defaultRenderer: "default",
      renderModes: modes,
      slots: [...new Set(renderers.map((r) => r.slotId))],
      renderers
    };
  }

  const renderable = route.raw === true
    ? false
    : Object.values(route.themeRenderers).some((set) =>
      set.pages.length > 0 || set.components.length > 0 || set.fragments.length > 0 || Boolean(set.stream)
    );

  return {
    viewId: route.viewId,
    title: route.title,
    description: route.description,
    path: route.path,
    methods: [...route.methods],
    paramsSchema: {},
    querySchema: route.schemas.query ? toJsonSchemaDocument(route.schemas.query) : {},
    headersSchema: route.schemas.headers ? toJsonSchemaDocument(route.schemas.headers) : {},
    bodySchema: route.schemas.multipart
      ? toJsonSchemaDocument(route.schemas.multipart)
      : route.schemas.request ? toJsonSchemaDocument(route.schemas.request) : {},
    jsonResponseSchema: route.schemas.response ? toJsonSchemaDocument(route.schemas.response) : {},
    metadataResponseSchema: {},
    renderable,
    ...(route.raw === true ? { raw: true } : {}),
    ...(route.schemas.item ? {
      streaming: {
        itemSchema: toJsonSchemaDocument(route.schemas.item),
        ...(route.schemas.summary ? { summarySchema: toJsonSchemaDocument(route.schemas.summary) } : {})
      }
    } : {}),
    html: { themeRenderers },
    auth: route.auth,
    ...(route.role ? { role: route.role } : {}),
    dependencies: [...(route.dependencies ?? [])],
    ...(route.chrome ? { chrome: route.chrome } : {}),
    demoScenarios: route.demoScenarios.map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.description ? { description: s.description } : {}),
      ...(s.match ? { match: s.match } : {}),
      response: s.response as JsonValue
    })),
    cacheHints: route.cacheHints
  };
}

// -- BP Schema builder -------------------------------------------------

export interface BpSchemaOutput {
  manifest: PluginManifest;
  routes: Array<{
    viewId: string;
    path: string;
    methods: ReadonlyArray<HttpMethod>;
    paramNames: ReadonlyArray<string>;
    themes: string[];
    hasFragments: boolean;
    fragments: Array<{ fragmentLocation: string; fragmentId: string; themes: string[] }>;
    components: string[];
  }>;
}

/**
 * Build /.well-known/bp/schema.json output.
 */
export function buildBpSchema(
  registry: BetterPortalRegistry,
  manifest: PluginManifest
): BpSchemaOutput {
  return {
    manifest,
    routes: registry.routes.map((route) => {
      // Aggregate fragments across themes: same (location, fragmentId) groups themes that support it
      const fragMap = new Map<string, { fragmentLocation: string; fragmentId: string; themes: string[] }>();
      for (const [themeId, set] of Object.entries(route.themeRenderers)) {
        for (const f of set.fragments) {
          if (!f.fragmentLocation || !f.fragmentId) continue;
          const key = `${f.fragmentLocation}::${f.fragmentId}`;
          const existing = fragMap.get(key);
          if (existing) existing.themes.push(themeId);
          else fragMap.set(key, { fragmentLocation: f.fragmentLocation, fragmentId: f.fragmentId, themes: [themeId] });
        }
      }

      return {
        viewId: route.viewId,
        path: route.path,
        methods: route.methods,
        paramNames: route.paramNames,
        themes: Object.keys(route.themeRenderers),
        hasFragments: fragMap.size > 0,
        fragments: Array.from(fragMap.values()),
        components: Object.values(route.themeRenderers).flatMap(
          (set) => set.components.map((c) => c.rendererId)
        )
      };
    })
  };
}
