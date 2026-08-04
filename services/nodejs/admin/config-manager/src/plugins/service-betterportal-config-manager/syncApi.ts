import { createEventStream } from "h3";
import type {
  ConfigSchemaDescriptor,
  AppAuthConfig,
  AuthProviderRuntimeMetadata,
  BetterPortalH3App,
  BetterPortalEvent,
  BetterPortalRegistry,
  PlatformConfigStore,
  JsonValue,
  ScopedServiceConfig,
  BetterPortalRouteChrome,
  BetterPortalRouteMount,
  BetterPortalConfig,
  DeveloperResource,
  ShellManifest,
  WebhookEventDescriptor
} from "@betterportal/framework";
import { AuthProviderRuntimeMetadataSchema, DeveloperResourceSchema, ShellManifestSchema, deriveKeyId, eventObservability, jsonResponse, uuidv7 } from "@betterportal/framework";
import { createPublicKey } from "node:crypto";
import { apiRoutePath, isApiRoute } from "./routeMounts.js";

const SYNC_PATH = "/.well-known/bp/sync";

function validateServicePublicKey(publicKeyPem: string, keyId: string): { publicKeyPem: string; keyId: string } {
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error("S2S public key must be RSA with a modulus of at least 2048 bits");
  }
  const normalized = key.export({ type: "spki", format: "pem" }).toString();
  if (deriveKeyId(normalized) !== keyId) throw new Error("S2S keyId does not match the public key");
  return { publicKeyPem: normalized, keyId };
}

/**
 * Hot manifest cache per service. The same data is persisted in platform config
 * so app shell resolution remains deterministic after a control-plane restart.
 * Used to inject resolvedServicePath into app.routes before delivery, and to
 * surface per-view permission requirements to the admin role editor.
 *
 */
export interface CachedManifestView {
  viewId: string;
  path: string;
  methods: string[];
  renderers: string[];
  role?: string;
  chrome?: BetterPortalRouteChrome;
  dependencies: string[];
  /** Per-view permission requirements from the service's auth.permissions[]. */
  permissions: Array<{ serviceId: string; viewId: string; permissions: string[] }>;
  /** True if any UI renderer exists (page/fragment/component). API-only views = false. */
  renderable: boolean;
  /** JSON schema documents for request/query/header/response/multipart contracts. */
  schemas?: Record<string, JsonValue>;
  /** True when the service route returns a raw/file Response and is API-only. */
  raw?: boolean;
  /** API contracts implemented by this view. */
  apiContracts: JsonValue[];
  /** Example payloads advertised by the service route. */
  demoScenarios: JsonValue[];
  fragments: Array<{ fragmentId: string; targetPath: string }>;
}

export interface CachedManifest {
  serviceId: string;
  manifestVersion: string;
  title?: string;
  authProvider?: AuthProviderRuntimeMetadata;
  capabilities: string[];
  apiContracts: JsonValue[];
  m2mRequests: JsonValue[];
  developerResources: DeveloperResource[];
  shell?: ShellManifest;
  viewIndex: Record<string, CachedManifestView>;
  configSchemas: ConfigSchemaDescriptor[];
  webhooks: WebhookEventDescriptor[];
  fetchedAt: number;
}

const manifestCache = new Map<string, CachedManifest>();

/** Read-only accessor for the manifest cache. */
export function getManifestCache(): ReadonlyMap<string, CachedManifest> {
  return manifestCache;
}

/** Resolve manifests for service instances, including shared-service activation aliases. */
export function getCachedManifestForService(
  config: BetterPortalConfig,
  serviceInstanceId: string,
  cache: ReadonlyMap<string, CachedManifest> = manifestCache
): CachedManifest | undefined {
  const read = (key: string): CachedManifest | undefined => {
    const hot = cache.get(key);
    if (hot) return hot;
    const stored = config.manifestCache?.find((entry) => entry.serviceId === key);
    return stored
      ? normalizeManifest(stored as unknown as Parameters<typeof normalizeManifest>[0])
      : undefined;
  };
  const direct = read(serviceInstanceId);
  if (direct) return direct;

  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceInstanceId);
  if (activation) {
    const shared = config.sharedServiceCatalog.find((candidate) => candidate.id === activation.sharedServiceId);
    return read(activation.sharedServiceId)
      ?? (shared?.serviceId ? read(shared.serviceId) : undefined);
  }

  for (const tenant of config.tenants) {
    const service = tenant.services.find((candidate) => candidate.id === serviceInstanceId);
    if (service?.serviceId) return read(service.serviceId);
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceInstanceId);
  return platform?.serviceId ? read(platform.serviceId) : undefined;
}

function cacheManifest(serviceId: string, manifest: CachedManifest): void {
  manifestCache.set(serviceId, manifest);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function normalizeAuthProviderMetadata(value: unknown): AuthProviderRuntimeMetadata | undefined {
  try {
    const parsed = AuthProviderRuntimeMetadataSchema.parse(value);
    const issuer = parsed.issuer.trim().replace(/\/+$/, "");
    const audience = parsed.audience.trim();
    const jwksUri = parsed.jwksUri.trim();
    return issuer && audience && jwksUri ? { ...parsed, issuer, audience, jwksUri } : undefined;
  } catch {
    return undefined;
  }
}

function normalizeManifest(input: {
  serviceId: string;
  manifestVersion?: string;
  title?: string;
  authProvider?: AuthProviderRuntimeMetadata;
  capabilities?: string[];
  configSchemas?: ConfigSchemaDescriptor[];
  webhooks?: WebhookEventDescriptor[];
  apiContracts?: JsonValue[];
  m2mRequests?: JsonValue[];
  developerResources?: DeveloperResource[];
  shell?: ShellManifest;
  viewIndex?: Record<string, {
    viewId: string;
    path: string;
    methods: string[];
    renderers?: string[];
    role?: string;
    chrome?: BetterPortalRouteChrome;
    dependencies?: string[];
    renderable?: boolean;
    schemas?: Record<string, JsonValue>;
    raw?: boolean;
    apiContracts?: JsonValue[];
    demoScenarios?: JsonValue[];
    fragments?: Array<{ fragmentId: string; targetPath: string }>;
    permissions?: Array<{ serviceId: string; viewId: string; permissions: string[] }>;
  }>;
}): CachedManifest {
  const normalizedViews: Record<string, CachedManifestView> = {};
  for (const [vid, v] of Object.entries(input.viewIndex ?? {})) {
    normalizedViews[vid] = {
      viewId: v.viewId,
      path: v.path,
      methods: v.methods ?? [],
      renderers: Array.isArray(v.renderers) ? v.renderers.filter((value): value is string => typeof value === "string" && value.length > 0) : [],
      ...(v.role ? { role: v.role } : {}),
      ...(v.chrome ? { chrome: v.chrome } : {}),
      dependencies: Array.isArray(v.dependencies) ? v.dependencies.filter((value): value is string => typeof value === "string" && value.length > 0) : [],
      permissions: v.permissions ?? [],
      renderable: v.renderable ?? true,
      ...(v.schemas && typeof v.schemas === "object" ? { schemas: v.schemas } : {}),
      ...(v.raw === true ? { raw: true } : {}),
      apiContracts: Array.isArray(v.apiContracts) ? v.apiContracts : [],
      demoScenarios: Array.isArray(v.demoScenarios) ? v.demoScenarios : [],
      fragments: Array.isArray(v.fragments) ? v.fragments.filter((fragment) =>
        typeof fragment?.fragmentId === "string" && typeof fragment?.targetPath === "string"
      ) : []
    };
  }

  return {
    serviceId: input.serviceId,
    manifestVersion: input.manifestVersion ?? "unknown",
    title: input.title,
    ...(input.authProvider ? { authProvider: normalizeAuthProviderMetadata(input.authProvider) } : {}),
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.filter((value): value is string => typeof value === "string") : [],
    apiContracts: Array.isArray(input.apiContracts) ? input.apiContracts : [],
    m2mRequests: Array.isArray(input.m2mRequests) ? input.m2mRequests : [],
    developerResources: Array.isArray(input.developerResources)
      ? input.developerResources.flatMap((resource) => {
        try {
          return [DeveloperResourceSchema.parse(resource)];
        } catch {
          return [];
        }
      })
      : [],
    ...(input.shell ? { shell: ShellManifestSchema.parse(input.shell) } : {}),
    viewIndex: normalizedViews,
    configSchemas: Array.isArray(input.configSchemas) ? input.configSchemas : [],
    webhooks: Array.isArray(input.webhooks) ? input.webhooks : [],
    fetchedAt: Date.now()
  };
}

export async function reconcileServiceRegistry(
  store: PlatformConfigStore,
  serviceId: string,
  registry: BetterPortalRegistry,
  options: {
    manifestVersion?: string;
    title?: string;
    capabilities?: string[];
    configSchemas?: ConfigSchemaDescriptor[];
    webhooks?: WebhookEventDescriptor[];
    apiContracts?: JsonValue[];
    m2mRequests?: JsonValue[];
    developerResources?: DeveloperResource[];
    shell?: ShellManifest;
    authProvider?: AuthProviderRuntimeMetadata;
  } = {}
): Promise<CachedManifest> {
  const viewIndex: NonNullable<Parameters<typeof normalizeManifest>[0]["viewIndex"]> = {};
  for (const route of registry.routes) {
    const renderable = route.raw === true
      ? false
      : Object.values(route.renderers).some((set) =>
        set.pages.length > 0 || set.components.length > 0 || set.fragments.length > 0 || Boolean(set.stream)
      );
    viewIndex[route.viewId] = {
      viewId: route.viewId,
      path: route.path,
      methods: [...route.methods],
      renderers: Object.keys(route.renderers),
      ...(route.role ? { role: route.role } : {}),
      ...(route.chrome ? { chrome: route.chrome } : {}),
      dependencies: [...(route.dependencies ?? [])],
      permissions: route.auth.permissions ?? [],
      renderable,
      ...(route.raw === true ? { raw: true } : {}),
      apiContracts: (route.apiContracts ?? []).map((contract) => ({
        ...contract,
        viewId: route.viewId,
        methods: contract.methods ? [...contract.methods] : [...route.methods]
      })) as JsonValue[],
      demoScenarios: route.demoScenarios.map((scenario) => toJsonValue({
        id: scenario.id,
        title: scenario.title,
        ...(scenario.description ? { description: scenario.description } : {}),
        ...(scenario.match ? { match: scenario.match } : {}),
        response: scenario.response
      })),
      fragments: [...new Map(Object.values(route.renderers).flatMap((theme) =>
        theme.fragments.flatMap((fragment) => {
          const fragmentId = fragment.fragmentLocation && fragment.fragmentId
            ? `${fragment.fragmentLocation}.${fragment.fragmentId}`
            : fragment.rendererId;
          return [[fragmentId, { fragmentId, targetPath: route.path }] as const];
        })
      )).values()]
    };
  }

  const manifest = normalizeManifest({ serviceId, viewIndex, ...options });
  cacheManifest(serviceId, manifest);
  await updateServiceMetadata(store, serviceId, manifest);
  return manifest;
}

/**
 * Inject resolvedServicePath onto each app route using the manifest cache.
 * Routes whose target service hasn't published a manifest yet are left
 * with resolvedServicePath undefined - client treats as unresolved.
 */
function injectResolvedServicePaths(scoped: ScopedServiceConfig): ScopedServiceConfig {
  const serviceManifestKeys = new Map<string, string>();
  for (const tenant of scoped.tenants) {
    for (const service of tenant.services) {
      if (service.serviceId) serviceManifestKeys.set(service.id, service.serviceId);
    }
  }

  const resolveRoutes = (routes: ScopedServiceConfig["apps"][number]["routes"]) => routes.map((route) => {
    const cached = manifestCache.get(route.serviceId)
      ?? manifestCache.get(serviceManifestKeys.get(route.serviceId) ?? "");
    if (!cached) return route;
    const view = cached.viewIndex[route.viewId];
    if (!view) return route;
    const chrome = view.chrome || route.chrome
      ? { ...(view.chrome ?? {}), ...(route.chrome ?? {}) }
      : undefined;
    return {
      ...route,
      resolvedServicePath: view.path,
      ...(chrome ? { chrome } : {})
    };
  });

  const apps = scoped.apps.map((app) => ({
    ...app,
    routes: resolveRoutes(app.routes),
    ...(app.appRoutes ? { appRoutes: resolveRoutes(app.appRoutes) } : {})
  }));
  return { ...scoped, apps };
}

export function registerSyncEndpoint(app: BetterPortalH3App, store: PlatformConfigStore): void {
  app.get(SYNC_PATH, async (event: BetterPortalEvent) => {
    const obs = eventObservability(event);
    const authHeader = event.req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!apiKey) {
      obs?.logger.warn("BP SYNC: rejected missing bearer token");
      return jsonResponse({ error: "Bearer token required" }, 401);
    }

    const validated = await store.validateApiKey(apiKey);
    if (!validated) {
      obs?.logger.warn("BP SYNC: rejected invalid API key");
      return jsonResponse({ error: "Invalid API key" }, 403);
    }

    if (!validated.serviceId) {
      obs?.logger.warn("BP SYNC: rejected unlinked service scope={scope} tenant={tenantId}", {
        scope: validated.scope,
        tenantId: validated.tenantId ?? ""
      });
      return jsonResponse({ error: "Service not yet linked - serviceId unknown" }, 412);
    }

    const serviceId = validated.serviceId;
    obs?.logger.info("BP SYNC: accepted service={serviceId} scope={scope} tenant={tenantId}", {
      serviceId,
      scope: validated.scope,
      tenantId: validated.tenantId ?? ""
    });

    const stream = createEventStream(event);

    const sendScopedConfig = async () => {
      const scoped = await store.getScopedConfig(serviceId, validated.scope, validated.tenantId);
      const resolved = injectResolvedServicePaths(scoped);
      obs?.logger.info("BP SYNC: sending config service={serviceId} tenants={tenants} apps={apps}", {
        serviceId,
        tenants: resolved.tenants.length,
        apps: resolved.apps.length
      });
      await stream.push({
        event: "config",
        data: JSON.stringify(resolved)
      });
    };

    const unsubscribe = store.onChange(() => {
      sendScopedConfig().catch((error) => {
        obs?.logger.warn("BP SYNC: failed sending config service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
      });
    });

    stream.onClosed(() => {
      obs?.logger.info("BP SYNC: stream closed service={serviceId}", {
        serviceId
      });
      unsubscribe();
    });

    const response = stream.send();
    sendScopedConfig().catch((error) => {
      obs?.logger.warn("BP SYNC: failed sending initial config service={serviceId}: {msg}", {
        serviceId,
        msg: error instanceof Error ? error.message : String(error)
      });
    });

    return response;
  });

  const pollHandler = async (event: BetterPortalEvent) => {
    const obs = eventObservability(event);
    const authHeader = event.req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!apiKey) {
      obs?.logger.warn("BP SYNC POLL: rejected missing bearer token");
      return jsonResponse({ error: "Bearer token required" }, 401);
    }

    const validated = await store.validateApiKey(apiKey);
    if (!validated) {
      obs?.logger.warn("BP SYNC POLL: rejected invalid API key");
      return jsonResponse({ error: "Invalid API key" }, 403);
    }

    if (!validated.serviceId) {
      obs?.logger.warn("BP SYNC POLL: rejected unlinked service scope={scope} tenant={tenantId}", {
        scope: validated.scope,
        tenantId: validated.tenantId ?? ""
      });
      return jsonResponse({ error: "Service not yet linked" }, 412);
    }

    const serviceId = validated.serviceId;

    // POST: extract manifest push if present and cache.
    if (event.req.method === "POST") {
      const body = await event.req.json().catch(() => null) as {
        publicKeyPem?: string;
        keyId?: string;
        manifestVersion?: string;
        title?: string;
        authProvider?: AuthProviderRuntimeMetadata;
        capabilities?: string[];
        configSchemas?: ConfigSchemaDescriptor[];
        webhooks?: WebhookEventDescriptor[];
        apiContracts?: JsonValue[];
        m2mRequests?: JsonValue[];
        developerResources?: DeveloperResource[];
        shell?: ShellManifest;
        viewIndex?: Record<string, {
          viewId: string;
          path: string;
          methods: string[];
          renderers?: string[];
          role?: string;
          chrome?: BetterPortalRouteChrome;
          dependencies?: string[];
          renderable?: boolean;
          schemas?: Record<string, JsonValue>;
          raw?: boolean;
          apiContracts?: JsonValue[];
          demoScenarios?: JsonValue[];
          fragments?: Array<{ fragmentId: string; targetPath: string }>;
          permissions?: Array<{ serviceId: string; viewId: string; permissions: string[] }>;
        }>;
      } | null;
      if (body?.publicKeyPem || body?.keyId) {
        if (typeof body.publicKeyPem !== "string" || typeof body.keyId !== "string") {
          return jsonResponse({ error: "Both publicKeyPem and keyId are required" }, 400);
        }
        let identity: { publicKeyPem: string; keyId: string };
        try {
          identity = validateServicePublicKey(body.publicKeyPem, body.keyId);
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Invalid S2S public key" }, 400);
        }
        const registration = await store.registerServicePublicKey(
          serviceId,
          validated.scope,
          validated.tenantId,
          identity.publicKeyPem,
          identity.keyId
        );
        if (registration === "mismatch") {
          return jsonResponse({
            error: "The service already has a different S2S key. Use the explicit key recovery/rotation flow."
          }, 409);
        }
        if (registration === "not-found") return jsonResponse({ error: "Service registration not found" }, 404);
      }
      if (body && (body.viewIndex || body.configSchemas)) {
        const cachedManifest = normalizeManifest({
          serviceId,
          manifestVersion: body.manifestVersion,
          title: body.title,
          authProvider: body.authProvider,
          capabilities: body.capabilities,
          apiContracts: body.apiContracts,
          m2mRequests: body.m2mRequests,
          developerResources: body.developerResources,
          shell: body.shell,
          viewIndex: body.viewIndex,
          configSchemas: body.configSchemas,
          webhooks: body.webhooks
        });
        cacheManifest(serviceId, cachedManifest);
        await updateServiceMetadata(store, serviceId, cachedManifest);
        obs?.logger.info("BP SYNC POLL: cached manifest service={serviceId} version={version} views={count} configSchemas={configSchemas}", {
          serviceId,
          version: body.manifestVersion ?? "unknown",
          count: Object.keys(cachedManifest.viewIndex).length,
          configSchemas: Array.isArray(body.configSchemas) ? body.configSchemas.length : 0
        });
      }
    }

    const scoped = await store.getScopedConfig(serviceId, validated.scope, validated.tenantId);
    const resolved = injectResolvedServicePaths(scoped);
    obs?.logger.info("BP SYNC POLL: sending config service={serviceId} scope={scope} tenant={tenantId} tenants={tenants} apps={apps}", {
      serviceId,
      scope: validated.scope,
      tenantId: validated.tenantId ?? "",
      tenants: resolved.tenants.length,
      apps: resolved.apps.length
    });
    return jsonResponse(resolved as unknown as JsonValue);
  };

  app.get(`${SYNC_PATH}/poll`, pollHandler);
  app.post(`${SYNC_PATH}/poll`, pollHandler);
}

function normalizeMethods(methods: string[]): BetterPortalRouteMount["methods"] {
  return methods.filter((method): method is BetterPortalRouteMount["methods"][number] =>
    method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" || method === "OPTIONS"
  );
}

function sameMethods(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((method) => rightSet.has(method));
}

function addMissingDependencyRoutes(app: { routes: BetterPortalRouteMount[] }, sourceRoute: BetterPortalRouteMount, manifest: CachedManifest): boolean {
  const sourceView = manifest.viewIndex[sourceRoute.viewId];
  if (!sourceView) return false;

  let changed = false;
  for (const dependencyViewId of sourceView.dependencies) {
    const dependency = manifest.viewIndex[dependencyViewId];
    if (!dependency) continue;
    if (app.routes.some((route) => route.serviceId === sourceRoute.serviceId && route.viewId === dependencyViewId)) continue;

    const methods = normalizeMethods(dependency.methods);
    app.routes.push({
      id: uuidv7(),
      kind: "api",
      path: apiRoutePath(manifest.serviceId, dependency.path),
      serviceId: sourceRoute.serviceId,
      viewId: dependencyViewId,
      targetPath: dependency.path,
      title: dependency.viewId,
      enabled: true,
      methods: methods.length ? methods : ["GET"]
    });
    changed = true;
  }
  return changed;
}

async function updateServiceMetadata(
  store: PlatformConfigStore,
  serviceInstanceId: string,
  manifest: CachedManifest
): Promise<void> {
  const config = await store.loadConfig();
  const persistedManifest = {
    ...manifest,
    serviceId: serviceInstanceId,
    fetchedAt: new Date(manifest.fetchedAt).toISOString()
  };
  const persistedIndex = config.manifestCache.findIndex((entry) => entry.serviceId === serviceInstanceId);
  if (persistedIndex === -1) config.manifestCache.push(persistedManifest);
  else config.manifestCache[persistedIndex] = persistedManifest;
  let changed = true;
  const routeServiceIds = new Set<string>([serviceInstanceId]);
  for (const tenant of config.tenants) {
    const service = tenant.services.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
    if (!service) continue;
    routeServiceIds.add(service.id);
    cacheManifest(service.id, manifest);
    service.capabilities = manifest.capabilities;
    if (manifest.authProvider) service.authProvider = manifest.authProvider;
    if (manifest.title && (!service.title || service.title === service.serviceId)) service.title = manifest.title;
    changed = true;
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
  if (platform) {
    routeServiceIds.add(platform.id);
    cacheManifest(platform.id, manifest);
    platform.capabilities = manifest.capabilities;
    if (manifest.authProvider) platform.authProvider = manifest.authProvider;
    if (manifest.title && (!platform.title || platform.title === platform.serviceId)) platform.title = manifest.title;
    changed = true;
  }
  const shared = config.sharedServiceCatalog.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
  if (shared) {
    cacheManifest(shared.id, manifest);
    for (const activation of config.sharedServiceActivations.filter((candidate) => candidate.enabled && candidate.sharedServiceId === shared.id)) {
      routeServiceIds.add(activation.id);
      cacheManifest(activation.id, manifest);
    }
    shared.tags = [...new Set([...(shared.tags ?? []), ...manifest.capabilities])];
    if (manifest.authProvider) shared.authProvider = manifest.authProvider;
    if (manifest.title && (!shared.title || shared.title === shared.id || shared.title === shared.serviceId)) shared.title = manifest.title;
    changed = true;
  }
  for (const app of config.apps) {
    if (manifest.authProvider && app.auth && routeServiceIds.has(app.auth.serviceId)) {
      applyAuthProviderMetadata(app.auth, manifest.authProvider);
      changed = true;
    }
    for (const route of app.routes.filter((candidate) => routeServiceIds.has(candidate.serviceId))) {
      const view = manifest.viewIndex[route.viewId];
      if (!view) {
        if (route.enabled !== false) {
          route.enabled = false;
          changed = true;
        }
        continue;
      }

      const methods = normalizeMethods(view.methods);
      if (methods.length > 0 && !sameMethods(route.methods, methods)) {
        route.methods = methods;
        changed = true;
      }
      if (route.targetPath !== view.path) {
        route.targetPath = view.path;
        changed = true;
      }
      const routeIsApi = isApiRoute(route, view.renderable);
      if (routeIsApi) {
        const nextPath = apiRoutePath(manifest.serviceId, view.path);
        if (route.kind !== "api") {
          route.kind = "api";
          changed = true;
        }
        if (route.path !== nextPath) {
          route.path = nextPath;
          changed = true;
        }
        if (route.query !== undefined) {
          delete route.query;
          changed = true;
        }
      } else if (route.kind !== "page") {
        route.kind = "page";
        changed = true;
      }
      if (!route.title && view.viewId) {
        route.title = view.viewId;
        changed = true;
      }
      if (addMissingDependencyRoutes(app, route, manifest)) changed = true;
    }
  }
  if (changed) await store.saveConfig(config);
}

function applyAuthProviderMetadata(
  appAuth: AppAuthConfig,
  authProvider: AuthProviderRuntimeMetadata
): void {
  appAuth.expectedIssuer = authProvider.issuer;
  appAuth.expectedAudience = authProvider.audience;
  appAuth.jwksUri = authProvider.jwksUri;
  if (authProvider.publicKeys) appAuth.publicKeys = authProvider.publicKeys;
}
