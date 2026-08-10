import type { HttpMethod, RenderMode } from "../contracts/common.js";
import type { JsonValue } from "../contracts/json.js";
import type {
  BetterPortalRegistry,
  RegisteredMethodRoute,
  RegisteredRoute,
  RegisteredViewRenderer,
  ViewRendererSet
} from "../contracts/registry.js";
import type { AdminApiDescriptor, BpSchemaOutput, PluginManifest } from "../contracts/manifest.js";
import type { ViewMetadata, ViewOperationMetadata } from "../contracts/view.js";
import { sitemapMetadata } from "../contracts/seo.js";
import { toPublishedJsonSchemaDocument } from "./jsonSchema.js";

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
  readonly renderer: RegisteredViewRenderer;
  readonly rendererKey: string;
}

/** Resolve an exact compatibility renderer for a route. */
export function resolveRenderer(
  route: RegisteredRoute,
  rendererKey: string,
  type: "page" | "component" | "fragment",
  method?: HttpMethod,
  componentId?: string,
  fragmentKey?: string
): ResolvedRenderer | null {
  const rendererSet = route.renderers[rendererKey];
  if (!rendererSet) return null;

  let pool: ReadonlyArray<RegisteredViewRenderer>;
  switch (type) {
    case "page":
      pool = rendererSet.pages;
      break;
    case "component":
      pool = rendererSet.components;
      break;
    case "fragment":
      pool = rendererSet.fragments;
      break;
  }

  // Filter by target
  let candidates: RegisteredViewRenderer[];
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

  if (!method) return null;
  const methodSpecific = candidates.find((r) => r.method === method);
  return methodSpecific ? { renderer: methodSpecific, rendererKey } : null;
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
  apiContracts?: PluginManifest["apiContracts"];
  m2mRequests?: PluginManifest["m2mRequests"];
  developerResources?: PluginManifest["developerResources"];
  shell?: PluginManifest["shell"];
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
 * - supportedRenderers (from route renderers)
 * - supportedRenderModes (from renderer types)
 * - views (from non-fragment routes)
 * - capabilities (from renderers + view types)
 */
export function buildManifestFromRegistry(
  registry: BetterPortalRegistry,
  packageJson: { version: string },
  base: ManifestBaseFields
): PluginManifest {
  const rendererKeys = new Set<string>();
  const renderModes = new Set<string>();
  const capabilities = new Set<string>();
  const apiContracts: PluginManifest["apiContracts"] = [...(base.apiContracts ?? [])];

  for (const capability of base.capabilities ?? []) {
    capabilities.add(capability);
  }

  if (base.shell) {
    rendererKeys.add(base.shell.renderer);
    capabilities.add(`renderer.${base.shell.renderer}`);
  }

  capabilities.add("view.json");
  capabilities.add("view.metadata");

  for (const route of registry.routes) {
    for (const operation of Object.values(route.methodRoutes ?? {})) {
      if (!operation) continue;
      const callers = operation.auth.callers ?? ["user"];
      for (const contract of operation.apiContracts ?? []) {
        const unsupportedModes = (contract.modes ?? ["service"]).filter((mode) => !callers.includes(mode));
        if (unsupportedModes.length > 0) {
          throw new Error(`Operation ${operation.operationId} publishes ${contract.id} for ${unsupportedModes.join(", ")} callers but does not allow them in auth.callers`);
        }
        apiContracts.push({
          ...contract,
          viewId: route.viewId,
          methods: [operation.method]
        });
      }
      if (operation.schemas.item) capabilities.add("stream.ndjson");
    }

    for (const [renderer, rendererSet] of Object.entries(route.renderers)) {
      rendererKeys.add(renderer);
      capabilities.add(`renderer.${renderer}`);

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

  const groupedRoutes = groupRoutesByViewId(registry.routes);
  const views: ViewMetadata[] = groupedRoutes
    .filter(({ primary }) => {
      const hasAnyPage = Object.values(primary.renderers).some(
        (set) => set.pages.length > 0 || set.stream !== undefined
      );
      return hasAnyPage || Object.keys(primary.renderers).length === 0;
    })
    .map(({ primary, variants }) => routeToViewMetadata(primary, variants));

  return {
    protocolVersion: 2,
    pluginId: base.pluginId,
    title: base.title,
    description: base.description,
    version: packageJson.version,
    category: base.category ?? "service",
    deploymentModes: base.deploymentModes ? [...base.deploymentModes] : ["self-hosted"],
    capabilities: [...capabilities],
    supportedRenderers: [...rendererKeys],
    supportedRenderModes: [...renderModes] as PluginManifest["supportedRenderModes"],
    views,
    configSchemas: base.configSchemas ?? [],
    permissions: base.permissions ?? [],
    adminApis: deriveAdminApis(base),
    webhooks: base.webhooks ?? [],
    apiContracts,
    m2mRequests: base.m2mRequests ?? [],
    developerResources: base.developerResources ?? [],
    ...(base.shell ? {
      shell: {
        service: base.shell.service,
        renderer: base.shell.renderer,
        fragments: registry.shellFragments?.map((fragment) => ({
          id: fragment.id,
          kind: fragment.kind,
          title: fragment.title,
          description: fragment.description,
          defaultItems: [...(fragment.defaultItems ?? [])]
        })) ?? [...base.shell.fragments]
      }
    } : {}),
    cacheHints: base.cacheHints ?? { metadataTtlSeconds: 1800 }
  };
}

function groupRoutesByViewId(routes: ReadonlyArray<RegisteredRoute>): Array<{
  primary: RegisteredRoute;
  variants: string[];
}> {
  const groups = new Map<string, RegisteredRoute[]>();
  for (const route of routes) {
    const group = groups.get(route.viewId) ?? [];
    group.push(route);
    groups.set(route.viewId, group);
  }
  return [...groups.values()].map((group) => {
    const ordered = [...group].sort((a, b) =>
      b.paramNames.length - a.paramNames.length || b.path.length - a.path.length
    );
    return { primary: ordered[0], variants: ordered.map((route) => route.path) };
  });
}

function validateRobots(operation: RegisteredMethodRoute): void {
  for (const rule of operation.robots ?? []) {
    if (!/^[A-Za-z0-9*._-]{1,100}$/.test(rule.userAgent)) {
      throw new Error(`Operation ${operation.operationId} has an invalid robots user-agent token: ${rule.userAgent}`);
    }
    if (rule.access !== "allow" && rule.access !== "disallow") {
      throw new Error(`Operation ${operation.operationId} has an invalid robots access rule`);
    }
    if (rule.crawlDelaySeconds !== undefined
      && (!Number.isInteger(rule.crawlDelaySeconds)
        || rule.crawlDelaySeconds < 0
        || rule.crawlDelaySeconds > 86_400)) {
      throw new Error(`Operation ${operation.operationId} has an invalid robots crawl delay`);
    }
  }
}

function operationRendererSupport(route: RegisteredRoute, method: HttpMethod): ViewOperationMetadata["html"] {
  const rendererSupport: Record<string, {
    defaultRenderer: string;
    renderModes: RenderMode[];
    slots: string[];
    renderers: Array<{ id: string; title: string; slotId: string; renderModes: RenderMode[] }>;
  }> = {};

  for (const [renderer, set] of Object.entries(route.renderers)) {
    const pages = set.pages.filter((entry) => entry.method === method);
    const fragments = set.fragments.filter((entry) => entry.method === method);
    const components = set.components.filter((entry) => entry.method === method);
    const stream = method === "GET" ? set.stream : undefined;
    const modes: RenderMode[] = [];
    const rendererVariants: Array<{ id: string; title: string; slotId: string; renderModes: RenderMode[] }> = [];

    if (pages.length > 0) modes.push("page");
    if (fragments.length > 0 || stream) modes.push("fragment");

    for (const page of pages) {
      rendererVariants.push({
        id: page.rendererId,
        title: page.rendererId === "default" ? "Default Content" : page.rendererId,
        slotId: "main",
        renderModes: ["page", "fragment"]
      });
    }

    for (const fragment of fragments) {
      const slotId = fragment.fragmentLocation && fragment.fragmentId
        ? `${fragment.fragmentLocation}.${fragment.fragmentId}`
        : fragment.rendererId;
      rendererVariants.push({
        id: fragment.rendererId,
        title: fragment.rendererId,
        slotId,
        renderModes: ["fragment"]
      });
    }

    if (pages.length === 0 && fragments.length === 0 && components.length === 0 && !stream) continue;
    rendererSupport[renderer] = {
      defaultRenderer: "default",
      renderModes: modes,
      slots: [...new Set(rendererVariants.map((r) => r.slotId))],
      renderers: rendererVariants
    };
  }

  return { renderers: rendererSupport };
}

function operationToMetadata(route: RegisteredRoute, operation: RegisteredMethodRoute): ViewOperationMetadata {
  validateRobots(operation);
  const html = operationRendererSupport(route, operation.method);
  const renderable = operation.raw === true
    ? false
    : Object.keys(html.renderers).length > 0;

  return {
    operationId: operation.operationId,
    method: operation.method,
    title: operation.title,
    description: operation.description,
    querySchema: operation.schemas.query
      ? toPublishedJsonSchemaDocument(operation.schemas.query, `${route.viewId} ${operation.method} QuerySchema`)
      : {},
    headersSchema: operation.schemas.headers
      ? toPublishedJsonSchemaDocument(operation.schemas.headers, `${route.viewId} ${operation.method} HeadersSchema`)
      : {},
    bodySchema: operation.schemas.multipart
      ? toPublishedJsonSchemaDocument(operation.schemas.multipart, `${route.viewId} ${operation.method} MultipartSchema`)
      : operation.schemas.request
        ? toPublishedJsonSchemaDocument(operation.schemas.request, `${route.viewId} ${operation.method} RequestSchema`)
        : {},
    jsonResponseSchema: operation.schemas.response
      ? toPublishedJsonSchemaDocument(operation.schemas.response, `${route.viewId} ${operation.method} ResponseSchema`)
      : {},
    metadataResponseSchema: {},
    renderable,
    ...(operation.raw === true ? { raw: true } : {}),
    ...(operation.schemas.item ? {
      streaming: {
        itemSchema: toPublishedJsonSchemaDocument(
          operation.schemas.item,
          `${route.viewId} ${operation.method} ItemSchema`
        ),
        ...(operation.schemas.summary ? {
          summarySchema: toPublishedJsonSchemaDocument(
            operation.schemas.summary,
            `${route.viewId} ${operation.method} SummarySchema`
          )
        } : {})
      }
    } : {}),
    html,
    auth: { ...operation.auth, callers: [...(operation.auth.callers ?? ["user"])] },
    sitemap: sitemapMetadata(operation.sitemap),
    robots: [...(operation.robots ?? [])],
    ...(operation.role ? { role: operation.role } : {}),
    dependencies: [...(operation.dependencies ?? [])],
    ...(operation.chrome ? { chrome: operation.chrome } : {}),
    apiContracts: (operation.apiContracts ?? []).map((contract) => ({
      ...contract,
      viewId: route.viewId,
      methods: [operation.method]
    })),
    demoScenarios: operation.demoScenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      ...(scenario.description ? { description: scenario.description } : {}),
      ...(scenario.match ? { match: scenario.match } : {}),
      response: scenario.response as JsonValue
    })),
    cacheHints: operation.cacheHints
  };
}

function routeToViewMetadata(route: RegisteredRoute, variants: ReadonlyArray<string>): ViewMetadata {
  const operations = route.methods.map((method) => {
    const operation = route.methodRoutes?.[method];
    if (!operation) throw new Error(`Route ${route.viewId} is missing operation metadata for ${method}`);
    return operationToMetadata(route, operation);
  });

  return {
    viewId: route.viewId,
    title: route.title,
    description: route.description,
    path: route.path,
    pathVariants: variants.length > 1 ? [...variants] : [],
    paramsSchema: route.schemas.params
      ? toPublishedJsonSchemaDocument(route.schemas.params, `${route.viewId} ParamsSchema`)
      : {},
    operations
  };
}

// -- BP Schema builder -------------------------------------------------

/**
 * Build /.well-known/bp/schema.json output.
 */
export function buildBpSchema(
  registry: BetterPortalRegistry,
  manifest: PluginManifest
): BpSchemaOutput {
  return {
    manifest,
    routes: groupRoutesByViewId(registry.routes).map(({ primary: route, variants }) => {
      const fragMap = new Map<string, { fragmentLocation: string; fragmentId: string; renderers: string[] }>();
      for (const [renderer, set] of Object.entries(route.renderers)) {
        for (const f of set.fragments) {
          if (!f.fragmentLocation || !f.fragmentId) continue;
          const key = `${f.fragmentLocation}::${f.fragmentId}`;
          const existing = fragMap.get(key);
          if (existing) existing.renderers.push(renderer);
          else fragMap.set(key, { fragmentLocation: f.fragmentLocation, fragmentId: f.fragmentId, renderers: [renderer] });
        }
      }

      return {
        viewId: route.viewId,
        path: route.path,
        pathVariants: variants.length > 1 ? variants : [],
        operations: route.methods.map((method) => {
          const operation = route.methodRoutes?.[method];
          if (!operation) throw new Error(`Route ${route.viewId} is missing operation metadata for ${method}`);
          return { operationId: operation.operationId, method };
        }),
        paramNames: [...route.paramNames],
        renderers: Object.keys(route.renderers),
        hasFragments: fragMap.size > 0,
        fragments: Array.from(fragMap.values()),
        components: Object.values(route.renderers).flatMap(
          (set) => set.components.map((c) => c.rendererId)
        )
      };
    })
  };
}
