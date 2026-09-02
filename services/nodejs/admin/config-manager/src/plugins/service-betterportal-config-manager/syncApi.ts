import { createEventStream } from "h3";
import type {
  ConfigSchemaDescriptor,
  ApiContractDescriptor,
  AppAuthConfig,
  AppAuthPermissionAction,
  AuthProviderRuntimeMetadata,
  BetterPortalH3App,
  BetterPortalEvent,
  BetterPortalRegistry,
  PlatformConfigStore,
  JsonValue,
  M2MRequestDescriptor,
  ScopedServiceConfig,
  BetterPortalRouteChrome,
  BetterPortalRouteMount,
  BetterPortalConfig,
  BetterPortalApp,
  DeveloperResource,
  ShellManifest,
  OperationDependency,
  RenderMode,
  ViewDemoScenario,
  WebhookEventDescriptor
} from "@betterportal/framework";
import { AuthProviderRuntimeMetadataSchema, DeveloperResourceSchema, ShellManifestSchema, ViewDemoScenarioSchema, deriveKeyId, eventObservability, jsonResponse, toPublishedJsonSchemaDocument, uuidv7 } from "@betterportal/framework";
import { sitemapMetadata } from "@betterportal/framework";
import { createPublicKey } from "node:crypto";
import { apiRoutePath, pageRoutePath } from "./routeMounts.js";
import { getAvailableServiceInstanceIdsForApp, getServicePluginId, legacyOperationId, legacyOperationMethod, resolveManifestViewLabels } from "./storage/core.js";
import { isPreviewService } from "./previewEnvironments.js";

const SYNC_PATH = "/.well-known/bp/sync";
const SERVICE_ACTIVITY_INTERVAL_MS = 60_000;

async function touchServiceActivity(
  store: PlatformConfigStore,
  serviceId: string,
  scope: "tenant" | "platform",
  tenantId: string | undefined,
  field: "lastSeenAt" | "lastSyncAt"
): Promise<void> {
  if (scope !== "tenant" || !tenantId) return;
  const config = await store.loadConfig();
  const service = config.tenants.find((tenant) => tenant.id === tenantId)?.services.find((candidate) => candidate.id === serviceId);
  if (!service) return;
  const now = Date.now();
  if (service[field] && now - Date.parse(service[field]) < SERVICE_ACTIVITY_INTERVAL_MS) return;
  service[field] = new Date(now).toISOString();
  await store.saveConfig(config, { notify: false });
}

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
  title: string;
  description: string;
  path: string;
  pathVariants: string[];
  paramsSchema?: Record<string, JsonValue>;
  operations: CachedManifestOperation[];
  fragments: Array<{ fragmentId: string; targetPath: string; operationId: string; method: CachedManifestOperation["method"] }>;
}

export interface CachedManifestOperation {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  title: string;
  description: string;
  renderers: string[];
  renderModes: RenderMode[];
  role?: string;
  authRequired: boolean;
  sitemap?: {
    kind: "default" | "exclude" | "metadata" | "provider";
    lastModified?: string;
    changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
  };
  robots: Array<{ userAgent: string; access: "allow" | "disallow"; crawlDelaySeconds?: number }>;
  chrome?: BetterPortalRouteChrome;
  dependencies: OperationDependency[];
  /** Per-view permission requirements from the service's auth.permissions[]. */
  permissions: Array<{ serviceId: string; viewId: string; permissions: AppAuthPermissionAction[] }>;
  /** True if any UI renderer exists (page/fragment/component). API-only views = false. */
  renderable: boolean;
  /** JSON schema documents for request/query/header/response/multipart contracts. */
  schemas?: Record<string, JsonValue>;
  /** True when the service route returns a raw/file Response and is API-only. */
  raw?: boolean;
  /** API contracts implemented by this view. */
  apiContracts: ApiContractDescriptor[];
  /** Example payloads advertised by the service route. */
  demoScenarios: ViewDemoScenario[];
}

export function isPageOperation(operation: Pick<CachedManifestOperation, "method" | "renderModes">): boolean {
  return operation.method === "GET" && operation.renderModes.includes("page");
}

export interface CachedManifest {
  serviceId: string;
  manifestVersion: string;
  title?: string;
  authProvider?: AuthProviderRuntimeMetadata;
  capabilities: string[];
  apiContracts: ApiContractDescriptor[];
  m2mRequests: M2MRequestDescriptor[];
  developerResources: DeveloperResource[];
  shell?: ShellManifest;
  viewIndex: Record<string, CachedManifestView>;
  configSchemas: ConfigSchemaDescriptor[];
  webhooks: WebhookEventDescriptor[];
  fetchedAt: number;
}

export interface DerivedRolePermission {
  roleId: string;
  serviceId: string;
  viewId: string;
  permissions: AppAuthPermissionAction[];
  requiredBy: Array<{ serviceId: string; operationId: string; method: CachedManifestOperation["method"] }>;
}

export function deriveRolePermissions(
  auth: AppAuthConfig,
  routes: BetterPortalRouteMount[],
  resolveManifest: (serviceId: string) => CachedManifest | undefined
): { auth: AppAuthConfig; derived: DerivedRolePermission[] } {
  const mounted = routes.flatMap((route) => {
    if (!route.enabled) return [];
    const manifest = resolveManifest(route.serviceId);
    const view = manifest?.viewIndex[route.viewId];
    return manifest && view
      ? view.operations
          .filter((operation) => route.operations.includes(operation.operationId))
          .map((operation) => ({ route, manifest, view, operation }))
      : [];
  });
  const resolveDependency = (source: typeof mounted[number], dependency: OperationDependency) => {
    const matches = mounted.filter((candidate) =>
      candidate.operation.operationId === dependency.operationId
      && candidate.operation.method === dependency.method
      && (dependency.serviceId
        ? candidate.manifest.serviceId === dependency.serviceId
        : candidate.route.serviceId === source.route.serviceId)
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const instanceId = (serviceId: string) => {
    const ids = [...new Set(mounted.filter((candidate) => candidate.manifest.serviceId === serviceId).map((candidate) => candidate.route.serviceId))];
    return ids.length === 1 ? ids[0] : undefined;
  };
  const derived: DerivedRolePermission[] = [];

  const roles = auth.roles.map((role) => {
    const permissions = role.permissions.map((grant) => ({ ...grant, permissions: [...grant.permissions] }));
    const queued = mounted.filter((candidate) => candidate.operation.permissions.every((required) => {
      const serviceId = required.serviceId === candidate.manifest.serviceId
        ? candidate.route.serviceId
        : instanceId(required.serviceId);
      if (!serviceId) return false;
      const grant = permissions.find((value) => value.serviceId === serviceId && value.viewId === required.viewId);
      return required.permissions.every((permission) => grant?.permissions.includes(permission));
    }));
    const seen = new Set<string>();
    while (queued.length > 0) {
      const source = queued.shift()!;
      const sourceKey = `${source.route.serviceId}:${source.operation.operationId}:${source.operation.method}`;
      if (seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      for (const requirement of source.operation.dependencies) {
        const target = resolveDependency(source, requirement);
        if (!target) continue;
        queued.push(target);
        for (const required of target.operation.permissions) {
          const serviceId = required.serviceId === target.manifest.serviceId
            ? target.route.serviceId
            : instanceId(required.serviceId);
          if (!serviceId) continue;
          const grant = permissions.find((candidate) => candidate.serviceId === serviceId && candidate.viewId === required.viewId);
          const additions = required.permissions.filter((permission) => !grant?.permissions.includes(permission));
          if (grant) grant.permissions = [...new Set([...grant.permissions, ...required.permissions])];
          else if (required.permissions.length > 0) permissions.push({ serviceId, viewId: required.viewId, permissions: [...required.permissions] });
          if (additions.length > 0) {
            const existing = derived.find((candidate) =>
              candidate.roleId === role.id && candidate.serviceId === serviceId && candidate.viewId === required.viewId
            );
            const requiredBy = {
              serviceId: source.route.serviceId,
              operationId: source.operation.operationId,
              method: source.operation.method
            };
            if (existing) {
              existing.permissions = [...new Set([...existing.permissions, ...additions])];
              if (!existing.requiredBy.some((candidate) =>
                candidate.serviceId === requiredBy.serviceId
                && candidate.operationId === requiredBy.operationId
                && candidate.method === requiredBy.method
              )) existing.requiredBy.push(requiredBy);
            } else {
              derived.push({ roleId: role.id, serviceId, viewId: required.viewId, permissions: additions, requiredBy: [requiredBy] });
            }
          }
        }
      }
    }
    return { ...role, permissions };
  });

  return { auth: { ...auth, roles }, derived };
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
  fetchedAt?: number | string;
  title?: string;
  authProvider?: AuthProviderRuntimeMetadata;
  capabilities?: string[];
  configSchemas?: ConfigSchemaDescriptor[];
  webhooks?: WebhookEventDescriptor[];
  apiContracts?: ApiContractDescriptor[];
  m2mRequests?: M2MRequestDescriptor[];
  developerResources?: DeveloperResource[];
  shell?: ShellManifest;
  viewIndex?: Record<string, {
    viewId: string;
    title?: string;
    description?: string;
    path: string;
    pathVariants?: string[];
    paramsSchema?: Record<string, JsonValue>;
    operations: Array<CachedManifestOperation>;
    fragments?: Array<{ fragmentId: string; targetPath: string; operationId: string; method: CachedManifestOperation["method"] }>;
  }>;
}): CachedManifest {
  const normalizedViews: Record<string, CachedManifestView> = {};
  for (const [vid, v] of Object.entries(input.viewIndex ?? {})) {
    const labels = resolveManifestViewLabels(v);
    normalizedViews[vid] = {
      viewId: v.viewId,
      title: labels.title,
      description: labels.description,
      path: v.path,
      pathVariants: Array.isArray(v.pathVariants) ? v.pathVariants : [],
      ...(v.paramsSchema ? { paramsSchema: v.paramsSchema } : {}),
      operations: v.operations.map((operation) => ({
        ...operation,
        renderers: Array.isArray(operation.renderers) ? operation.renderers : [],
        renderModes: Array.isArray(operation.renderModes) ? operation.renderModes : operation.renderable
          ? [operation.method === "GET" ? "page" : "fragment"]
          : [],
        robots: Array.isArray(operation.robots) ? operation.robots : [],
        dependencies: Array.isArray(operation.dependencies) ? operation.dependencies : [],
        permissions: Array.isArray(operation.permissions) ? operation.permissions : [],
        apiContracts: Array.isArray(operation.apiContracts) ? operation.apiContracts : [],
        demoScenarios: Array.isArray(operation.demoScenarios) ? operation.demoScenarios : []
      })),
      fragments: Array.isArray(v.fragments) ? v.fragments.filter((fragment) =>
        typeof fragment?.fragmentId === "string"
        && typeof fragment?.targetPath === "string"
        && typeof fragment?.operationId === "string"
        && typeof fragment?.method === "string"
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
    fetchedAt: typeof input.fetchedAt === "number"
      ? input.fetchedAt
      : typeof input.fetchedAt === "string" && Number.isFinite(Date.parse(input.fetchedAt))
        ? Date.parse(input.fetchedAt)
        : Date.now()
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
    apiContracts?: ApiContractDescriptor[];
    m2mRequests?: M2MRequestDescriptor[];
    developerResources?: DeveloperResource[];
    shell?: ShellManifest;
    authProvider?: AuthProviderRuntimeMetadata;
  } = {}
): Promise<CachedManifest> {
  const viewIndex: NonNullable<Parameters<typeof normalizeManifest>[0]["viewIndex"]> = {};
  const routeGroups = new Map<string, typeof registry.routes[number][]>();
  for (const route of registry.routes) {
    const group = routeGroups.get(route.viewId) ?? [];
    group.push(route);
    routeGroups.set(route.viewId, group);
  }
  for (const group of routeGroups.values()) {
    const routes = [...group].sort((a, b) => b.paramNames.length - a.paramNames.length || b.path.length - a.path.length);
    const route = routes[0];
    viewIndex[route.viewId] = {
      viewId: route.viewId,
      title: route.title,
      description: route.description,
      path: route.path,
      pathVariants: routes.length > 1 ? routes.map((candidate) => candidate.path) : [],
      ...(route.schemas.params ? {
        paramsSchema: toPublishedJsonSchemaDocument(route.schemas.params, `${route.viewId} ParamsSchema`) as Record<string, JsonValue>
      } : {}),
      operations: route.methods.map((method) => {
        const operation = route.methodRoutes?.[method];
        if (!operation) throw new Error(`Route ${route.viewId} is missing operation metadata for ${method}`);
        const renderers = Object.entries(route.renderers).filter(([, set]) =>
          set.pages.some((renderer) => renderer.method === method)
          || set.components.some((renderer) => renderer.method === method)
          || set.fragments.some((renderer) => renderer.method === method)
          || (method === "GET" && Boolean(set.stream))
        ).map(([renderer]) => renderer);
        const renderModes = [...new Set(Object.values(route.renderers).flatMap((set) => [
          ...(set.pages.some((renderer) => renderer.method === method) ? ["page" as const] : []),
          ...(set.fragments.some((renderer) => renderer.method === method) || (method === "GET" && Boolean(set.stream))
            ? ["fragment" as const]
            : [])
        ]))];
        return {
          operationId: operation.operationId,
          method,
          title: operation.title,
          description: operation.description,
          renderers,
          renderModes,
          ...(operation.role ? { role: operation.role } : {}),
          authRequired: operation.auth.required,
          sitemap: sitemapMetadata(operation.sitemap),
          robots: [...(operation.robots ?? [])],
          ...(operation.chrome ? { chrome: operation.chrome } : {}),
          dependencies: [...(operation.dependencies ?? [])],
          permissions: operation.auth.permissions ?? [],
          renderable: operation.raw !== true && renderers.length > 0,
          schemas: {
            ...(operation.schemas.query ? {
              query: toPublishedJsonSchemaDocument(operation.schemas.query, `${route.viewId} ${operation.method} QuerySchema`) as JsonValue
            } : {}),
            ...(operation.schemas.headers ? {
              headers: toPublishedJsonSchemaDocument(operation.schemas.headers, `${route.viewId} ${operation.method} HeadersSchema`) as JsonValue
            } : {}),
            ...(operation.schemas.request ? {
              request: toPublishedJsonSchemaDocument(operation.schemas.request, `${route.viewId} ${operation.method} RequestSchema`) as JsonValue
            } : {}),
            ...(operation.schemas.multipart ? {
              multipart: toPublishedJsonSchemaDocument(operation.schemas.multipart, `${route.viewId} ${operation.method} MultipartSchema`) as JsonValue
            } : {}),
            ...(operation.schemas.response ? {
              response: toPublishedJsonSchemaDocument(operation.schemas.response, `${route.viewId} ${operation.method} ResponseSchema`) as JsonValue
            } : {})
          },
          ...(operation.raw === true ? { raw: true } : {}),
          apiContracts: (operation.apiContracts ?? []).map((contract) => ({
            ...contract,
            viewId: route.viewId,
            methods: [method]
          })) as ApiContractDescriptor[],
          demoScenarios: operation.demoScenarios.map((scenario) => ViewDemoScenarioSchema.parse(toJsonValue({
            id: scenario.id,
            title: scenario.title,
            ...(scenario.description ? { description: scenario.description } : {}),
            ...(scenario.match ? { match: scenario.match } : {}),
            response: scenario.response
          })))
        };
      }),
      fragments: [...new Map(Object.values(route.renderers).flatMap((theme) =>
        theme.fragments.flatMap((fragment) => {
          if (!fragment.method) return [];
          const operation = route.methodRoutes?.[fragment.method];
          if (!operation) return [];
          const fragmentId = fragment.fragmentLocation && fragment.fragmentId
            ? `${fragment.fragmentLocation}.${fragment.fragmentId}`
            : fragment.rendererId;
          const key = `${fragmentId}:${operation.operationId}:${fragment.method}`;
          return [[key, { fragmentId, targetPath: route.path, operationId: operation.operationId, method: fragment.method }] as const];
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
    const operation = view.operations.find((candidate) => route.operations.includes(candidate.operationId) && isPageOperation(candidate))
      ?? view.operations.find((candidate) => route.operations.includes(candidate.operationId));
    if (!operation) return route;
    const resolvedMethods = view.operations
      .filter((candidate) => route.operations.includes(candidate.operationId))
      .map((candidate) => candidate.method);
    const chrome = operation.chrome || route.chrome
      ? { ...(operation.chrome ?? {}), ...(route.chrome ?? {}) }
      : undefined;
    return {
      ...route,
      resolvedServicePath: route.servicePathVariant && [view.path, ...view.pathVariants].includes(route.servicePathVariant)
        ? route.servicePathVariant
        : view.path,
      resolvedMethods,
      authRequired: operation.authRequired,
      ...(operation.sitemap ? { sitemap: operation.sitemap } : {}),
      robots: [...operation.robots],
      ...(chrome ? { chrome } : {})
    };
  });

  const apps = scoped.apps.map((app) => {
    const routes = resolveRoutes(app.routes);
    return {
      ...app,
      routes,
      ...(app.appRoutes ? { appRoutes: resolveRoutes(app.appRoutes) } : {}),
      ...(app.auth ? {
        auth: deriveRolePermissions(
          app.auth,
          routes,
          (serviceId) => manifestCache.get(serviceId) ?? manifestCache.get(serviceManifestKeys.get(serviceId) ?? "")
        ).auth
      } : {})
    };
  });
  return { ...scoped, apps };
}

export interface SyncEndpointOptions {
  onManifestUpdated?: (serviceIds: string[], manifest: CachedManifest) => Promise<void>;
}

export function registerSyncEndpoint(
  app: BetterPortalH3App,
  store: PlatformConfigStore,
  options: SyncEndpointOptions = {}
): void {
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
    await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSeenAt").catch((error) => {
      obs?.logger.warn("BP SYNC: failed updating last seen service={serviceId}: {msg}", {
        serviceId,
        msg: error instanceof Error ? error.message : String(error)
      });
    });
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
      await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSyncAt").catch((error) => {
        obs?.logger.warn("BP SYNC: failed updating last sync service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
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

    const lastSeenTimer = setInterval(() => {
      touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSeenAt").catch((error) => {
        obs?.logger.warn("BP SYNC: failed updating last seen service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
      });
    }, SERVICE_ACTIVITY_INTERVAL_MS);

    stream.onClosed(() => {
      clearInterval(lastSeenTimer);
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
    await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSeenAt").catch((error) => {
      obs?.logger.warn("BP SYNC POLL: failed updating last seen service={serviceId}: {msg}", {
        serviceId,
        msg: error instanceof Error ? error.message : String(error)
      });
    });

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
        apiContracts?: ApiContractDescriptor[];
        m2mRequests?: M2MRequestDescriptor[];
        developerResources?: DeveloperResource[];
        shell?: ShellManifest;
        viewIndex?: NonNullable<Parameters<typeof normalizeManifest>[0]["viewIndex"]>;
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
          identity.keyId,
          { replace: isPreviewService(await store.loadConfig(), serviceId) }
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
        const serviceIds = await updateServiceMetadata(store, serviceId, cachedManifest);
        await options.onManifestUpdated?.(serviceIds, cachedManifest);
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
    await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSyncAt").catch((error) => {
      obs?.logger.warn("BP SYNC POLL: failed updating last sync service={serviceId}: {msg}", {
        serviceId,
        msg: error instanceof Error ? error.message : String(error)
      });
    });
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

function sameOperations(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((operationId) => right.includes(operationId));
}

function operationIndex(manifest: CachedManifest): Map<string, { view: CachedManifestView; operation: CachedManifestOperation }> {
  return new Map(Object.values(manifest.viewIndex).flatMap((view) =>
    view.operations.map((operation) => [operation.operationId, { view, operation }] as const)
  ));
}

export interface OperationDependencyIssue {
  sourceRouteId: string;
  sourceOperationId: string;
  sourceMethod: CachedManifestOperation["method"];
  targetServiceId?: string;
  targetOperationId: string;
  targetMethod: CachedManifestOperation["method"];
  enabledRouteIds: string[];
  disabledRouteIds: string[];
}

export function analyzeOperationDependencies(
  config: BetterPortalConfig,
  app: BetterPortalApp
): OperationDependencyIssue[] {
  const availableServiceIds = getAvailableServiceInstanceIdsForApp(config, app);
  const issues: OperationDependencyIssue[] = [];

  for (const sourceRoute of app.routes.filter((route) => route.enabled)) {
    const sourceView = getCachedManifestForService(config, sourceRoute.serviceId)?.viewIndex[sourceRoute.viewId];
    if (!sourceView) continue;
    for (const sourceOperation of sourceView.operations.filter((operation) => sourceRoute.operations.includes(operation.operationId))) {
      for (const requirement of sourceOperation.dependencies) {
        const targetServiceIds = requirement.serviceId
          ? new Set([...availableServiceIds].filter((serviceId) => getServicePluginId(config, serviceId) === requirement.serviceId))
          : new Set([sourceRoute.serviceId]);
        const candidates = app.routes.filter((route) => {
          if (!targetServiceIds.has(route.serviceId) || !route.operations.includes(requirement.operationId)) return false;
          const operation = getCachedManifestForService(config, route.serviceId)?.viewIndex[route.viewId]?.operations
            .find((candidate) => candidate.operationId === requirement.operationId);
          return operation?.method === requirement.method;
        });
        const enabledRouteIds = candidates.filter((route) => route.enabled).map((route) => route.id);
        if (enabledRouteIds.length === 1) continue;
        issues.push({
          sourceRouteId: sourceRoute.id,
          sourceOperationId: sourceOperation.operationId,
          sourceMethod: sourceOperation.method,
          ...(requirement.serviceId ? { targetServiceId: requirement.serviceId } : {}),
          targetOperationId: requirement.operationId,
          targetMethod: requirement.method,
          enabledRouteIds,
          disabledRouteIds: candidates.filter((route) => !route.enabled).map((route) => route.id)
        });
      }
    }
  }
  return issues;
}

function addMissingDependencyRoutes(
  config: BetterPortalConfig,
  app: BetterPortalConfig["apps"][number],
  sourceRoute: BetterPortalRouteMount,
  manifest: CachedManifest
): boolean {
  if (!sourceRoute.enabled) return false;
  const sourceView = manifest.viewIndex[sourceRoute.viewId];
  if (!sourceView) return false;
  const dependencies = sourceView.operations
    .filter((operation) => sourceRoute.operations.includes(operation.operationId))
    .flatMap((operation) => operation.dependencies);

  let changed = false;
  const availableServiceIds = getAvailableServiceInstanceIdsForApp(config, app);
  for (const requirement of dependencies) {
    const targetServiceIds = requirement.serviceId
      ? [...availableServiceIds].filter((serviceId) =>
          getServicePluginId(config, serviceId) === requirement.serviceId
        )
      : [sourceRoute.serviceId];
    if (targetServiceIds.length !== 1) continue;
    const targetServiceId = targetServiceIds[0];
    const targetManifest = getCachedManifestForService(config, targetServiceId);
    if (!targetManifest) continue;
    const dependency = operationIndex(targetManifest).get(requirement.operationId);
    if (!dependency || dependency.operation.method !== requirement.method) continue;
    const existing = app.routes.find((route) =>
      route.serviceId === targetServiceId && route.operations.includes(requirement.operationId)
    );
    if (existing) {
      if (existing.enablement !== "disabled" && !existing.enabled) {
        existing.enabled = true;
        changed = true;
      }
      continue;
    }

    app.routes.push({
      id: uuidv7(),
      kind: "api",
      path: apiRoutePath(targetManifest.serviceId, dependency.view.path),
      serviceId: targetServiceId,
      viewId: dependency.view.viewId,
      targetPath: dependency.view.path,
      title: dependency.operation.title,
      enabled: true,
      enablement: "auto",
      operations: [requirement.operationId]
    });
    changed = true;
  }
  return changed;
}

function reconcileDependencyRoutes(config: BetterPortalConfig, app: BetterPortalConfig["apps"][number]): boolean {
  const previous = new Map(app.routes.map((route) => [route.id, `${route.enabled}:${route.enablement ?? ""}`]));
  for (const route of app.routes) {
    if (route.kind === "api" && route.enablement === "auto") route.enabled = false;
  }
  for (let pass = 0; pass <= app.routes.length; pass++) {
    let passChanged = false;
    for (const route of [...app.routes]) {
      const manifest = getCachedManifestForService(config, route.serviceId);
      if (manifest && addMissingDependencyRoutes(config, app, route, manifest)) passChanged = true;
    }
    if (!passChanged) break;
  }
  return app.routes.length !== previous.size || app.routes.some((route) =>
    previous.get(route.id) !== `${route.enabled}:${route.enablement ?? ""}`
  );
}

async function updateServiceMetadata(
  store: PlatformConfigStore,
  serviceInstanceId: string,
  manifest: CachedManifest
): Promise<string[]> {
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
    if (manifest.title) service.title = manifest.title;
    changed = true;
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
  if (platform) {
    routeServiceIds.add(platform.id);
    cacheManifest(platform.id, manifest);
    platform.capabilities = manifest.capabilities;
    if (manifest.authProvider) platform.authProvider = manifest.authProvider;
    if (manifest.title) platform.title = manifest.title;
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
    if (manifest.title) shared.title = manifest.title;
    changed = true;
  }
  for (const app of config.apps) {
    for (const route of app.routes) {
      if (Array.isArray(route.operations) && route.operations.length > 0) continue;
      const legacyMethods = (route as unknown as { methods?: string[] }).methods ?? ["GET"];
      route.operations = legacyMethods.map((method) => legacyOperationId(route.viewId, method));
    }
    const appServiceIds = getAvailableServiceInstanceIdsForApp(config, app);
    const syncedServiceIds = new Set([...routeServiceIds].filter((id) => appServiceIds.has(id)));
    const manifestOperations = operationIndex(manifest);
    for (const route of app.routes.filter((candidate) => syncedServiceIds.has(candidate.serviceId))) {
      const view = manifest.viewIndex[route.viewId];
      if (!view) continue;
      const resolvedOperations = route.operations.map((operationId) => {
        const legacyMethod = legacyOperationMethod(operationId);
        if (!legacyMethod) return operationId;
        return view.operations.find((operation) => operation.method === legacyMethod)?.operationId ?? operationId;
      });
      if (!sameOperations(route.operations, resolvedOperations)) {
        route.operations = resolvedOperations;
        changed = true;
      }
    }
    const staleApiRouteIds = new Set(app.routes
      .filter((route) => syncedServiceIds.has(route.serviceId)
        && route.kind === "api"
        && !route.operations.some((operationId) => manifestOperations.get(operationId)?.view.viewId === route.viewId))
      .map((route) => route.id));
    if (staleApiRouteIds.size > 0) {
      app.routes = app.routes.filter((route) => !staleApiRouteIds.has(route.id));
      changed = true;
    }
    if (manifest.authProvider && app.auth && routeServiceIds.has(app.auth.serviceId)) {
      applyAuthProviderMetadata(app.auth, manifest.authProvider);
      changed = true;
    }
    for (const route of app.routes.filter((candidate) => syncedServiceIds.has(candidate.serviceId))) {
      const view = manifest.viewIndex[route.viewId];
      if (!view) {
        if (route.enabled !== false) {
          route.enabled = false;
          changed = true;
        }
        continue;
      }

      const validOperations = route.operations.filter((operationId) =>
        manifestOperations.get(operationId)?.view.viewId === route.viewId
      );
      if (validOperations.length === 0) {
        if (route.enabled !== false) {
          route.enabled = false;
          changed = true;
        }
        continue;
      }
      if (!sameOperations(route.operations, validOperations)) {
        route.operations = validOperations;
        changed = true;
      }
      const selectedOperations = validOperations.map((operationId) => manifestOperations.get(operationId)!.operation);
      const pageOperation = selectedOperations.find(isPageOperation);
      const operation = pageOperation ?? selectedOperations[0];
      if (route.operations.length > 1) {
        route.operations = [operation.operationId];
        changed = true;
      }
      const wasApi = route.kind === "api";
      const selectedServicePath = !wasApi && pageOperation && route.servicePathVariant && [view.path, ...view.pathVariants].includes(route.servicePathVariant)
        ? route.servicePathVariant
        : view.path;
      if (route.targetPath !== selectedServicePath) {
        route.targetPath = selectedServicePath;
        changed = true;
      }
      const routeIsApi = !pageOperation;
      if (routeIsApi) {
        const nextPath = apiRoutePath(manifest.serviceId, selectedServicePath);
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
        if (route.servicePathVariant !== undefined) {
          delete route.servicePathVariant;
          changed = true;
        }
        if (route.fixedParams !== undefined) {
          delete route.fixedParams;
          changed = true;
        }
        if (route.title !== operation.title) {
          route.title = operation.title;
          changed = true;
        }
      } else {
        if (wasApi) {
          route.kind = "page";
          route.enabled = false;
          route.path = pageRoutePath(manifest.serviceId, selectedServicePath);
          changed = true;
        }
      }
      if (!route.title) {
        route.title = operation.title;
        changed = true;
      }
    }
    for (const serviceId of syncedServiceIds) {
      for (const view of Object.values(manifest.viewIndex)) {
        for (const operation of view.operations.filter((candidate) => !isPageOperation(candidate))) {
          if (app.routes.some((route) => route.serviceId === serviceId && route.operations.includes(operation.operationId))) continue;
          app.routes.push({
            id: uuidv7(),
            kind: "api",
            path: apiRoutePath(manifest.serviceId, view.path),
            serviceId,
            viewId: view.viewId,
            targetPath: view.path,
            title: operation.title,
            enabled: false,
            enablement: "auto",
            operations: [operation.operationId]
          });
          changed = true;
        }
      }
    }
    if (reconcileDependencyRoutes(config, app)) changed = true;
  }
  if (changed) await store.saveConfig(config);
  return [...routeServiceIds];
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
