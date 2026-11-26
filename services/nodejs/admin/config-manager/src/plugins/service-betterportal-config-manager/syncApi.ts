import { effectiveRouteAuth, ApiAuthRequirementSchema } from "@betterportal/framework";
import type { ServiceRegistryContext } from "./storage/core.js";
import { createEventStream } from "h3";
import type {
  ConfigRequestBudget,
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
import { AuthProviderRuntimeMetadataSchema, DeveloperResourceSchema, ServiceManifestCacheEntrySchema, ShellManifestSchema, ViewDemoScenarioSchema, deriveKeyId, eventObservability, jsonResponse, readBoundedJsonBody, toPublishedJsonSchemaDocument, uuidv7 } from "@betterportal/framework";
import { sitemapMetadata } from "@betterportal/framework";
import { hostname } from "node:os";
import { createPublicKey, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { isPageOperation, apiRoutePath, pageRoutePath } from "./routeMounts.js";
import { applyServicePublicKey, ConfigRevisionConflictError, getAvailableServiceInstanceIdsForApp, getServicePluginId, legacyOperationId, legacyOperationMethod, resolveManifestViewLabels } from "./storage/core.js";
import { isPreviewService, PreviewEnvironmentError } from "./previewEnvironments.js";
import { configManagerInstance } from "./credentialDiagnostics.js";

const SYNC_DEADLINE_MS = 20_000;
const SYNC_PATH = "/.well-known/bp/sync";
const SERVICE_ACTIVITY_INTERVAL_MS = 60_000;
const SYNC_HEARTBEAT_INTERVAL_MS = 15_000;

async function touchServiceActivity(
  store: PlatformConfigStore,
  serviceId: string,
  scope: "tenant" | "platform",
  tenantId: string | undefined,
  field: "lastSeenAt" | "lastSyncAt",
  budget?: ConfigRequestBudget
): Promise<void> {
  if (scope !== "tenant" || !tenantId) return;
  if (store.touchServiceActivity) return store.touchServiceActivity(serviceId, field, budget);
  const config = await store.loadConfig({ budget });
  const service = config.tenants.find((tenant) => tenant.id === tenantId)?.services.find((candidate) => candidate.id === serviceId);
  if (!service) return;
  const now = Date.now();
  if (field === "lastSeenAt" && service[field] && now - Date.parse(service[field]) < SERVICE_ACTIVITY_INTERVAL_MS) return;
  service[field] = new Date(now).toISOString();
  budget?.signal.throwIfAborted();
  await store.saveConfig(config, { notify: false, budget });
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
  auth?: NonNullable<BetterPortalRouteMount["resolvedAuth"]>[number]["auth"];
  sitemap?: {
    kind: "default" | "exclude" | "metadata" | "provider";
    lastModified?: string;
    changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
  };
  robots: Array<{ userAgent: string; access: "allow" | "disallow"; crawlDelaySeconds?: number }>;
  menu?: boolean;
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

export { isPageOperation } from "./routeMounts.js";

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

  const requirementsFor = (candidate: typeof mounted[number]) => effectiveRouteAuth(
    candidate.operation.auth ?? { required: candidate.operation.authRequired, permissions: candidate.operation.permissions },
    candidate.manifest.serviceId, candidate.route.viewId, candidate.operation.method).permissions;

  const roles = auth.roles.map((role) => {
    const permissions = role.permissions.map((grant) => ({ ...grant, permissions: [...grant.permissions] }));
    const queued = mounted.filter((candidate) => requirementsFor(candidate).length > 0 && requirementsFor(candidate).every((required) => {
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
        for (const required of requirementsFor(target)) {
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

/** Rebuild this replica's hot cache from the shared persisted cache. */
export function hydrateManifestCache(config: ServiceRegistryContext & Pick<BetterPortalConfig, "manifestCache">): void {
  manifestCache.clear();
  for (const stored of config.manifestCache ?? []) {
    const manifest = normalizeManifest({ ...stored, serviceId: getServicePluginId(config, stored.serviceId) ?? stored.serviceId } as unknown as Parameters<typeof normalizeManifest>[0]);
    cacheManifest(stored.serviceId, manifest);
    for (const tenant of config.tenants) {
      for (const service of tenant.services.filter((candidate) =>
        candidate.id === stored.serviceId || candidate.serviceId === stored.serviceId
      )) cacheManifest(service.id, manifest);
    }
    for (const service of config.platformServices.filter((candidate) =>
      candidate.id === stored.serviceId || candidate.serviceId === stored.serviceId
    )) cacheManifest(service.id, manifest);
    for (const service of config.sharedServiceCatalog.filter((candidate) =>
      candidate.id === stored.serviceId || candidate.serviceId === stored.serviceId
    )) {
      cacheManifest(service.id, manifest);
      for (const activation of config.sharedServiceActivations.filter((candidate) =>
        candidate.enabled && candidate.sharedServiceId === service.id
      )) cacheManifest(activation.id, manifest);
    }
  }
}

/** Resolve manifests for service instances, including shared-service activation aliases. */
export function getCachedManifestForService(
  config: ServiceRegistryContext & Partial<Pick<BetterPortalConfig, "manifestCache">>,
  serviceInstanceId: string,
  cache: ReadonlyMap<string, CachedManifest> = manifestCache
): CachedManifest | undefined {
  const read = (key: string): CachedManifest | undefined => {
    const stored = config.manifestCache?.find((entry) => entry.serviceId === key);
    const hot = cache.get(key);
    // Keep the fast path only when it describes this committed snapshot.
    if (hot && (!stored || (hot.fetchedAt === Date.parse(stored.fetchedAt) && hot.manifestVersion === stored.manifestVersion))) {
      const pluginId = getServicePluginId(config, key) ?? hot.serviceId;
      return pluginId === hot.serviceId ? hot : { ...hot, serviceId: pluginId };
    }
    return stored
      ? normalizeManifest({ ...stored, serviceId: getServicePluginId(config, stored.serviceId) ?? stored.serviceId } as unknown as Parameters<typeof normalizeManifest>[0])
      : cache.get(key);
  };
  const keys = [serviceInstanceId];
  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceInstanceId);
  if (activation) {
    const shared = config.sharedServiceCatalog.find((candidate) => candidate.id === activation.sharedServiceId);
    keys.push(activation.sharedServiceId);
    if (shared?.serviceId) keys.push(shared.serviceId);
  } else {
    for (const tenant of config.tenants) {
      const service = tenant.services.find((candidate) => candidate.id === serviceInstanceId);
      if (service?.serviceId) keys.push(service.serviceId);
    }
    const platform = config.platformServices.find((candidate) => candidate.id === serviceInstanceId);
    if (platform?.serviceId) keys.push(platform.serviceId);
  }
  const storedKey = keys.find(key => config.manifestCache?.some(entry => entry.serviceId === key));
  if (storedKey) return read(storedKey);
  for (const key of keys) {
    const manifest = read(key);
    if (manifest) return manifest;
  }
  return undefined;
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
        title: operation.title || labels.title,
        description: operation.description || labels.description,
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
          authRequired: operation.auth.required || Boolean(operation.auth.elevation),
          auth: ApiAuthRequirementSchema.parse(operation.auth),
          sitemap: sitemapMetadata(operation.sitemap),
          robots: [...(operation.robots ?? [])],
          ...(operation.menu !== undefined ? { menu: operation.menu } : {}),
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
  await updateServiceMetadata(store, serviceId, manifest);
  return manifest;
}

/**
 * Inject resolved paths and authoritative menu/access policy using the manifest cache.
 * Routes whose target service hasn't published a manifest yet are left
 * with resolvedServicePath undefined - client treats as unresolved.
 */
export function injectResolvedServicePaths(scoped: ScopedServiceConfig): ScopedServiceConfig {
  const serviceManifestKeys = new Map<string, string>();
  for (const tenant of scoped.tenants) {
    for (const service of tenant.services) {
      if (service.serviceId) serviceManifestKeys.set(service.id, service.serviceId);
    }
  }

  const resolveRoutes = (routes: ScopedServiceConfig["apps"][number]["routes"]) => routes.map((route) => {
    // Never trust persisted/client-supplied derived policy when a manifest is unavailable.
    const unresolved = { ...route, resolvedAuth: undefined };
    const cached = manifestCache.get(route.serviceId)
      ?? manifestCache.get(serviceManifestKeys.get(route.serviceId) ?? "");
    if (!cached) return unresolved;
    const view = cached.viewIndex[route.viewId];
    if (!view) return unresolved;
    const operation = view.operations.find((candidate) => route.operations.includes(candidate.operationId) && isPageOperation(candidate))
      ?? view.operations.find((candidate) => route.operations.includes(candidate.operationId));
    if (!operation) return unresolved;
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
      resolvedAuth: view.operations.filter(candidate => route.operations.includes(candidate.operationId) && candidate.auth).map(candidate => ({
        operationId: candidate.operationId, method: candidate.method,
        auth: ApiAuthRequirementSchema.parse(candidate.auth)
      })),
      authRequired: (operation.auth?.required ?? operation.authRequired) || Boolean(operation.auth?.elevation),
      menu: operation.menu !== false,
      menuPermissions: effectiveRouteAuth(operation.auth ?? { required: operation.authRequired, permissions: operation.permissions }, route.serviceId, route.viewId, operation.method).permissions.map(requirement => ({
        ...requirement,
        serviceId: [...serviceManifestKeys].find(([id, plugin]) => plugin === requirement.serviceId && id === route.serviceId)?.[0]
          ?? requirement.serviceId
      })),
      ...(operation.sitemap ? { sitemap: operation.sitemap } : {}),
      robots: [...operation.robots],
      ...(chrome ? { chrome } : {})
    };
  });

  const resolveFragments = (locations: ScopedServiceConfig["apps"][number]["fragments"]) => Object.fromEntries(
    Object.entries(locations ?? {}).map(([location, fragments]) => [location, fragments.map(fragment => {
      const unresolved = { ...fragment, resolvedPolicy: undefined };
      const cached = manifestCache.get(fragment.serviceId) ?? manifestCache.get(serviceManifestKeys.get(fragment.serviceId) ?? "");
      if (!fragment.enabled || !cached) return unresolved;
      const keys = new Set([fragment.fragmentId, `${location}.${fragment.fragmentId}`]);
      const parts = (value: string) => {
        const segments = value.split(/[?#]/, 1)[0].split("/");
        while (segments.length > 1 && segments[segments.length - 1] === "") segments.pop();
        return segments;
      };
      const matches = (template: string): boolean => {
        const pattern = parts(template), actual = parts(fragment.targetPath);
        return pattern.length === actual.length && pattern.every((part, index) => {
          if (part.startsWith(":") || /^\{[^}]+\}$/.test(part)) return Boolean(actual[index]);
          try { return decodeURIComponent(part) === decodeURIComponent(actual[index]); } catch { return false; }
        });
      };
      const specificity = (template: string) => parts(template)
        .map(part => part.startsWith(":") || /^\{[^}]+\}$/.test(part) ? 0 : 1);
      const compare = (left: number[], right: number[]) => {
        for (let index = 0; index < Math.max(left.length, right.length); index++) {
          const difference = (left[index] ?? 0) - (right[index] ?? 0);
          if (difference) return difference;
        }
        return 0;
      };
      const views = Object.values(cached.viewIndex).filter(view => view.operations.some(operation => operation.method === "GET"))
        .flatMap(view => [view.path, ...(view.pathVariants ?? [])]
        .filter(matches).map(path => ({ view, rank: specificity(path) })));
      views.sort((left, right) => compare(right.rank, left.rank));
      const best = views[0]?.rank;
      const candidates = views.filter(candidate => best && compare(candidate.rank, best) === 0).flatMap(({ view }) => {
        return (view.fragments ?? []).filter(item => item.method === "GET" && keys.has(item.fragmentId)).flatMap(item => {
          const operation = view.operations.find(candidate => candidate.operationId === item.operationId && candidate.method === "GET");
          return operation?.auth ? [{ viewId: view.viewId, operationId: operation.operationId, auth: ApiAuthRequirementSchema.parse(operation.auth) }] : [];
        });
      });
      const unique = [...new Map(candidates.map(policy => [JSON.stringify([policy.viewId, policy.operationId]), policy])).values()];
      return unique.length === 1 ? { ...fragment, resolvedPolicy: unique[0] } : unresolved;
    })])
  );

  const apps = scoped.apps.map((app) => {
    const routes = resolveRoutes(app.routes);
    return {
      ...app,
      routes,
      fragments: resolveFragments(app.fragments),
      ...(app.appFragments ? { appFragments: resolveFragments(app.appFragments) } : {}),
      ...(app.appRoutes ? { appRoutes: resolveRoutes(app.appRoutes) } : {}),
      ...(app.auth ? {
        auth: deriveRolePermissions(
          app.auth,
          routes,
          (serviceId) => {
            const manifest = manifestCache.get(serviceId) ?? manifestCache.get(serviceManifestKeys.get(serviceId) ?? "");
            return manifest ? { ...manifest, serviceId: serviceManifestKeys.get(serviceId) ?? manifest.serviceId } : undefined;
          }
        ).auth
      } : {})
    };
  });
  return { ...scoped, apps };
}

export interface SyncEndpointOptions {
  build?: string;
  /** Mutate the same snapshot before commit; may run again after a revision conflict. No external side effects. */
  onManifestUpdated?: (config: BetterPortalConfig, serviceIds: string[], manifest: CachedManifest) => void;
}

class SyncSubmissionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function registerSyncEndpoint(
  app: BetterPortalH3App,
  store: PlatformConfigStore,
  options: SyncEndpointOptions = {}
): void {
  type Projection = { result: Promise<string>; consumers: number; controller: AbortController };
  const inFlight = new Map<string, Projection>();
  store.onChange(() => { inFlight.clear(); });
  const projection = async (serviceId: string, scope: "platform" | "tenant", tenantId?: string, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const key = JSON.stringify([scope, tenantId, serviceId]);
    let pending = inFlight.get(key);
    if (!pending) {
      const controller = new AbortController();
      // One subscriber timing out must not cancel the same projection for another.
      const budget = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(SYNC_DEADLINE_MS)]),
        deadline: Date.now() + SYNC_DEADLINE_MS };
      const result = store.getScopedConfig(serviceId, scope, tenantId, budget)
        .then(config => JSON.stringify(injectResolvedServicePaths(config)));
      pending = { result, consumers: 0, controller };
      inFlight.set(key, pending);
    }
    pending.consumers++;
    let abort: (() => void) | undefined;
    try {
      if (!signal) return await pending.result;
      return await Promise.race([pending.result, new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
      })]);
    } finally {
      if (abort) signal?.removeEventListener("abort", abort);
      if (--pending.consumers === 0) {
        if (inFlight.get(key) === pending) inFlight.delete(key);
        pending.controller.abort();
      }
    }
  };
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
      obs?.logger.warn("BP SYNC: rejected invalid API key instance={configManagerInstance}", { configManagerInstance });
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
    let closed = false;
    let sending = false;
    let dirty = false;
    let lastData: string | undefined;
    const sendScopedConfig = async () => {
      dirty = true;
      if (sending || closed) return;
      sending = true;
      try {
        while (dirty && !closed) {
          dirty = false;
          const current = await store.validateApiKey(apiKey);
          if (!current || current.serviceId !== serviceId || current.scope !== validated.scope || current.tenantId !== validated.tenantId) {
            closed = true;
            await stream.close();
            return;
          }
          const data = await projection(serviceId, validated.scope, validated.tenantId);
          // A change during projection invalidates the result before it leaves the process.
          if (dirty) continue;
          if (closed || data === lastData) continue;
          await stream.push({ event: "config", data });
          lastData = data;
        }
      } finally {
        sending = false;
      }
      await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSyncAt").catch((error) => {
        obs?.logger.warn("BP SYNC: failed updating last sync service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
      });
    };

    const sendOrClose = () => {
      void sendScopedConfig().catch(async (error) => {
        obs?.logger.warn("BP SYNC: failed sending config service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
        closed = true;
        await stream.close().catch(() => {});
      });
    };
    const unsubscribe = store.onChange(sendOrClose);

    // Named events work with both h3 stream implementations used by service-base.
    // Sync clients ignore heartbeat events while idle HTTP connections stay active.
    // Bound writes to one pending heartbeat when a client stops consuming the stream.
    let heartbeatPending = false;
    const heartbeatTimer = setInterval(() => {
      if (closed || heartbeatPending) return;
      heartbeatPending = true;
      void Promise.resolve().then(() => stream.push({ event: "heartbeat", data: "keepalive" })).catch(() => {
        closed = true;
        return stream.close();
      }).catch(() => {}).finally(() => { heartbeatPending = false; });
    }, SYNC_HEARTBEAT_INTERVAL_MS);

    const lastSeenTimer = setInterval(() => {
      touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSeenAt").catch((error) => {
        obs?.logger.warn("BP SYNC: failed updating last seen service={serviceId}: {msg}", {
          serviceId,
          msg: error instanceof Error ? error.message : String(error)
        });
      });
    }, SERVICE_ACTIVITY_INTERVAL_MS);

    stream.onClosed(() => {
      closed = true;
      clearInterval(heartbeatTimer);
      clearInterval(lastSeenTimer);
      obs?.logger.info("BP SYNC: stream closed service={serviceId}", {
        serviceId
      });
      unsubscribe();
    });

    const response = stream.send();
    sendOrClose();

    return response;
  });

  const poll = async (event: BetterPortalEvent, trace: SyncTrace, budget: ConfigRequestBudget) => {
    const { signal } = budget;
    signal.throwIfAborted();
    trace.enter("authentication");
    const authHeader = event.req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!apiKey) {
      return jsonResponse({ error: "Bearer token required" }, 401);
    }

    const validated = await store.validateApiKey(apiKey, budget);
    signal.throwIfAborted();
    if (!validated) {
      return jsonResponse({ error: "Invalid API key" }, 403);
    }

    if (!validated.serviceId) {
      return jsonResponse({ error: "Service not yet linked" }, 412);
    }

    const serviceId = validated.serviceId;
    trace.serviceId = serviceId;
    trace.enter("activity");
    await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSeenAt", budget).catch(() => { trace.activityFailed = true; });
    signal.throwIfAborted();

    // POST: extract manifest push if present and cache.
    if (event.req.method === "POST") {
      trace.enter("validation");
      const parsedBody = await readBoundedJsonBody(event.req, 4 * 1024 * 1024, { signal, onBytes: bytes => { trace.payloadBytes = bytes; } });
      signal.throwIfAborted();
      if (parsedBody instanceof Response) return parsedBody;
      const body = parsedBody as {
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
      let identity: { publicKeyPem: string; keyId: string } | undefined;
      if (body?.publicKeyPem || body?.keyId) {
        if (typeof body.publicKeyPem !== "string" || typeof body.keyId !== "string") {
          return jsonResponse({ error: "Both publicKeyPem and keyId are required" }, 400);
        }
        try {
          identity = validateServicePublicKey(body.publicKeyPem, body.keyId);
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Invalid S2S public key" }, 400);
        }
      }
      let cachedManifest: CachedManifest | undefined;
      if (body && (body.viewIndex || body.configSchemas)) {
        cachedManifest = normalizeManifest({
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
      }
      if (identity || cachedManifest) {
        // Leave time for projection/delivery before the client's 30-second deadline.
        trace.enter("queue");
        try {
          await updateServiceMetadata(store, serviceId, cachedManifest, options.onManifestUpdated, async (config) => {
            const current = await store.validateApiKey(apiKey, budget);
            if (!current || current.serviceId !== serviceId || current.tenantId !== validated.tenantId || current.scope !== validated.scope) {
              throw new SyncSubmissionError("Sync credentials changed during submission; reconnect required", 403);
            }
            if (identity) {
              const registration = applyServicePublicKey(config, serviceId, current.scope, current.tenantId,
                identity.publicKeyPem, identity.keyId, { replace: isPreviewService(config, serviceId) });
              if (registration === "mismatch") throw new SyncSubmissionError(
                "The service already has a different S2S key. Use the explicit key recovery/rotation flow.", 409);
              if (registration === "not-found") throw new SyncSubmissionError("Service registration not found", 404);
            }
          }, signal, trace);
        } catch (error) {
          if (error instanceof SyncSubmissionError || error instanceof PreviewEnvironmentError) return jsonResponse({ error: error.message }, error.status);
          if (error instanceof ConfigRevisionConflictError) return trace.busy("revision_conflict_exhausted");
          if (signal.aborted || (error instanceof Error && error.name === "TimeoutError")) return trace.timeout();
          throw error;
        }
      }
    }

    signal.throwIfAborted();
    trace.enter("projection");
    const data = await projection(serviceId, validated.scope, validated.tenantId, signal);
    signal.throwIfAborted();
    trace.enter("activity");
    await touchServiceActivity(store, serviceId, validated.scope, validated.tenantId, "lastSyncAt", budget).catch(() => { trace.activityFailed = true; });
    signal.throwIfAborted();
    trace.enter("delivery");
    return new Response(data, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  };

  const pollHandler = async (event: BetterPortalEvent) => {
    const trace = new SyncTrace(event.req);
    const signal = AbortSignal.any([event.req.signal, AbortSignal.timeout(SYNC_DEADLINE_MS)]);
    let abort!: () => void;
    const expired = new Promise<Response>(resolve => {
      abort = () => resolve(trace.timeout());
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    let status = 500;
    try {
      const response = await Promise.race([expired, poll(event, trace, { signal, deadline: trace.started + SYNC_DEADLINE_MS }).catch(error => {
        if (signal.aborted || (error instanceof Error && error.name === "TimeoutError")) return trace.timeout();
        throw error;
      })]);
      status = response.status;
      response.headers.set("x-bp-sync-id", trace.id);
      return response;
    } finally {
      signal.removeEventListener("abort", abort);
      const stage = trace.stage;
      trace.enter("finished");
      const fields = { correlationId: trace.id, serviceId: trace.serviceId, stage, status,
        instance: hostname(), build: options.build ?? "unknown",
        payloadBytes: trace.payloadBytes,
        durationMs: Date.now() - trace.started, budgetMs: SYNC_DEADLINE_MS, cancelled: event.req.signal.aborted, activityFailed: trace.activityFailed,
        timings: JSON.stringify(trace.timings), queueDepth: trace.queueDepth, active: trace.active, conflicts: trace.conflicts };
      const logger = eventObservability(event)?.logger;
      const message = "BP SYNC POLL: request serviceId={serviceId} correlationId={correlationId} stage={stage} status={status} instance={instance} build={build} payloadBytes={payloadBytes} durationMs={durationMs} budgetMs={budgetMs} cancelled={cancelled} activityFailed={activityFailed} timings={timings} queueDepth={queueDepth} active={active} conflicts={conflicts}";
      if (status >= 400 || fields.activityFailed || fields.durationMs > 1000) logger?.warn(message, fields);
      else logger?.debug(message, fields);
    }
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

function ensureApiRouteMounts(app: BetterPortalApp, serviceId: string, manifest: CachedManifest): void {
  for (const view of Object.values(manifest.viewIndex)) {
    for (const operation of view.operations.filter(candidate => !isPageOperation(candidate))) {
      if (app.routes.some(route => route.serviceId === serviceId && route.operations.includes(operation.operationId))) continue;
      app.routes.push({
        id: uuidv7(), kind: "api", path: apiRoutePath(manifest.serviceId, view.path), serviceId,
        viewId: view.viewId, targetPath: view.path, title: operation.title,
        enabled: false, enablement: "auto", operations: [operation.operationId]
      });
    }
  }
}

function reconcileServiceRouteMounts(
  app: BetterPortalApp, syncedServiceIds: ReadonlySet<string>, manifest: CachedManifest, normalizePaths = true
): boolean {
  if (!syncedServiceIds.size) return false;
  const before = structuredClone(app.routes);
  const manifestOperations = operationIndex(manifest);
  for (const route of app.routes.filter((candidate) => syncedServiceIds.has(candidate.serviceId))) {
    const view = (route.kind === "api"
      ? route.operations.map(id => manifestOperations.get(id)?.view).find(Boolean)
      : undefined) ?? manifest.viewIndex[route.viewId];
    if (!view) continue;
    if (route.kind === "api") route.viewId = view.viewId;
    const resolvedOperations = route.operations.map((operationId) => {
      const legacyMethod = legacyOperationMethod(operationId);
      if (!legacyMethod) return operationId;
      return view.operations.find((operation) => operation.method === legacyMethod)?.operationId ?? operationId;
    });
    if (!sameOperations(route.operations, resolvedOperations)) {
      route.operations = resolvedOperations;
    }
  }
  const staleApiRouteIds = new Set(app.routes
    .filter((route) => syncedServiceIds.has(route.serviceId)
      && route.kind === "api"
      && !route.operations.some((operationId) => manifestOperations.get(operationId)?.view.viewId === route.viewId))
    .map((route) => route.id));
  if (staleApiRouteIds.size > 0) {
    app.routes = app.routes.filter((route) => !staleApiRouteIds.has(route.id));
  }
  const routeNormalizationIds = normalizePaths ? syncedServiceIds : new Set<string>();
  for (const route of app.routes.filter((candidate) => routeNormalizationIds.has(candidate.serviceId))) {
    const view = manifest.viewIndex[route.viewId];
    if (!view) {
      if (route.enabled !== false) {
        route.enabled = false;
      }
      continue;
    }

    const validOperations = route.operations.filter((operationId) =>
      manifestOperations.get(operationId)?.view.viewId === route.viewId
    );
    if (validOperations.length === 0) {
      if (route.enabled !== false) {
        route.enabled = false;
      }
      continue;
    }
    if (!sameOperations(route.operations, validOperations)) {
      route.operations = validOperations;
    }
    const selectedOperations = validOperations.map((operationId) => manifestOperations.get(operationId)!.operation);
    const pageOperation = selectedOperations.find(isPageOperation);
    const operation = pageOperation ?? selectedOperations[0];
    if (route.operations.length > 1) {
      route.operations = [operation.operationId];
    }
    const wasApi = route.kind === "api";
    const selectedServicePath = !wasApi && pageOperation && route.servicePathVariant && [view.path, ...view.pathVariants].includes(route.servicePathVariant)
      ? route.servicePathVariant
      : view.path;
    if (route.targetPath !== selectedServicePath) {
      route.targetPath = selectedServicePath;
    }
    const routeIsApi = !pageOperation;
    if (routeIsApi) {
      const nextPath = apiRoutePath(manifest.serviceId, selectedServicePath);
      if (route.kind !== "api") {
        route.kind = "api";
      }
      if (route.path !== nextPath) {
        route.path = nextPath;
      }
      if (route.query !== undefined) {
        delete route.query;
      }
      if (route.servicePathVariant !== undefined) {
        delete route.servicePathVariant;
      }
      if (route.fixedParams !== undefined) {
        delete route.fixedParams;
      }
      if (route.title !== operation.title) {
        route.title = operation.title;
      }
    } else {
      if (wasApi) {
        route.kind = "page";
        route.enabled = false;
        route.path = pageRoutePath(manifest.serviceId, selectedServicePath);
      }
    }
    if (!route.title) {
      route.title = operation.title;
    }
  }
  for (const serviceId of routeNormalizationIds) {
    ensureApiRouteMounts(app, serviceId, manifest);
  }
  return !isDeepStrictEqual(before, app.routes);
}

export function reconcileCachedServiceRoutes(config: BetterPortalConfig, serviceIds: Iterable<string>): boolean {
  const manifests = new Map<string, CachedManifest>();
  for (const serviceId of serviceIds) {
    const manifest = getCachedManifestForService(config, serviceId, new Map());
    if (manifest) manifests.set(serviceId, manifest);
  }
  let changed = false;
  for (const app of config.apps) {
    if (config.previewEnvironmentDeployments.some(deployment => deployment.appId === app.id)) continue;
    const available = getAvailableServiceInstanceIdsForApp(config, app);
    let affected = false;
    for (const [serviceId, manifest] of manifests) {
      if (!available.has(serviceId)) continue;
      affected = true;
      if (reconcileServiceRouteMounts(app, new Set([serviceId]), manifest)) changed = true;
    }
    if (affected && reconcileDependencyRoutes(config, app)) changed = true;
  }
  return changed;
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
  config: ServiceRegistryContext & Partial<Pick<BetterPortalConfig, "manifestCache">>,
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

class SyncTrace {
  readonly started = Date.now();
  readonly id: string;
  serviceId = "";
  stage = "request";
  activityFailed = false;
  payloadBytes = 0;
  queueDepth = 0;
  active = 0;
  conflicts = 0;
  timings: Record<string, number> = {};
  private since = this.started;
  constructor(request: Request) {
    const supplied = request.headers.get("x-bp-sync-id");
    this.id = supplied && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(supplied) ? supplied : randomUUID();
  }
  enter(stage: string) {
    const now = Date.now();
    this.timings[this.stage] = (this.timings[this.stage] ?? 0) + now - this.since;
    this.stage = stage;
    this.since = now;
  }
  busy(reason: string) {
    return jsonResponse({ error: "Config sync is busy; retry submission", reason, correlationId: this.id }, 503, { "retry-after": "5" });
  }
  timeout() { return this.busy(this.stage === "queue" ? "queue_timeout" : "processing_timeout"); }
}

const metadataQueues = new WeakMap<PlatformConfigStore, Set<() => void>>();

async function updateServiceMetadata(
  store: PlatformConfigStore,
  serviceInstanceId: string,
  manifest: CachedManifest | undefined,
  onManifestUpdated?: SyncEndpointOptions["onManifestUpdated"],
  prepare?: (config: BetterPortalConfig) => Promise<void>,
  signal?: AbortSignal,
  trace?: SyncTrace
): Promise<string[]> {
  signal?.throwIfAborted();
  let queue = metadataQueues.get(store);
  if (trace) trace.queueDepth = queue?.size ?? 0;
  if (trace) trace.active = queue ? 1 : 0;
  if (queue) {
    if (queue.size >= 128 && signal) throw new DOMException("Sync queue is full", "TimeoutError");
    const waiting = queue;
    await new Promise<void>((resolve, reject) => {
      const start = () => { signal?.removeEventListener("abort", cancel); resolve(); };
      const cancel = () => { waiting.delete(start); reject(signal?.reason); };
      waiting.add(start);
      signal?.addEventListener("abort", cancel, { once: true });
    });
  } else {
    queue = new Set();
    metadataQueues.set(store, queue);
  }
  try {
    if (trace) trace.active = 1;
    for (let attempt = 0; ; attempt++) {
      try {
        signal?.throwIfAborted();
        const serviceIds = await commitServiceMetadata(store, serviceInstanceId, manifest, onManifestUpdated, prepare, signal, trace);
        if (manifest) for (const id of serviceIds) cacheManifest(id, manifest);
        return serviceIds;
      } catch (error) {
        if (trace && error instanceof ConfigRevisionConflictError) trace.conflicts++;
        if (!(error instanceof ConfigRevisionConflictError) || attempt >= 4) throw error;
        // Other replicas/admin writes still use optimistic revision checks.
        // Back off with jitter, then re-read and revalidate credentials.
        trace?.enter("revision_retry");
        await delay(25 * 2 ** attempt * (1 + Math.random()), undefined, { signal });
        store.invalidate();
      }
    }
  } finally {
    const next = queue.values().next().value;
    if (next) { queue.delete(next); next(); }
    else metadataQueues.delete(store);
  }
}

async function commitServiceMetadata(
  store: PlatformConfigStore,
  serviceInstanceId: string,
  manifest: CachedManifest | undefined,
  onManifestUpdated?: SyncEndpointOptions["onManifestUpdated"],
  prepare?: (config: BetterPortalConfig) => Promise<void>,
  signal?: AbortSignal,
  trace?: SyncTrace
): Promise<string[]> {
  trace?.enter("config_load");
  const budget = trace && signal ? { signal, deadline: trace.started + SYNC_DEADLINE_MS } : undefined;
  const config = await store.loadConfig({ budget });
  signal?.throwIfAborted();
  trace?.enter("metadata");
  const before = toJsonValue(config);
  await prepare?.(config);
  signal?.throwIfAborted();
  trace?.enter("route_reconciliation");
  const serviceIds = manifest ? applyServiceMetadata(config, serviceInstanceId, manifest, onManifestUpdated) : [];
  signal?.throwIfAborted();
  if (!isDeepStrictEqual(before, toJsonValue(config))) {
    if (manifest) config.manifestCache.find(entry => entry.serviceId === serviceInstanceId)!.fetchedAt = new Date().toISOString();
    trace?.enter("config_save");
    await store.saveConfig(config, { budget });
  }
  if (manifest) manifest.fetchedAt = Date.parse(config.manifestCache.find(entry => entry.serviceId === serviceInstanceId)!.fetchedAt);
  return serviceIds;
}

function applyServiceMetadata(
  config: BetterPortalConfig,
  serviceInstanceId: string,
  manifest: CachedManifest,
  onManifestUpdated?: SyncEndpointOptions["onManifestUpdated"]
): string[] {
  const persistedIndex = config.manifestCache.findIndex((entry) => entry.serviceId === serviceInstanceId);
  const persistedManifest = ServiceManifestCacheEntrySchema.parse({
    ...manifest,
    serviceId: serviceInstanceId,
    fetchedAt: config.manifestCache[persistedIndex]?.fetchedAt ?? new Date(manifest.fetchedAt).toISOString()
  });
  if (persistedIndex === -1) config.manifestCache.push(persistedManifest);
  else config.manifestCache[persistedIndex] = persistedManifest;
  const routeServiceIds = new Set<string>([serviceInstanceId]);
  for (const tenant of config.tenants) {
    const service = tenant.services.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
    if (!service) continue;
    routeServiceIds.add(service.id);
    service.capabilities = manifest.capabilities;
    if (manifest.authProvider) service.authProvider = manifest.authProvider;
    if (manifest.title) service.title = manifest.title;
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
  if (platform) {
    routeServiceIds.add(platform.id);
    platform.capabilities = manifest.capabilities;
    if (manifest.authProvider) platform.authProvider = manifest.authProvider;
    if (manifest.title) platform.title = manifest.title;
  }
  const shared = config.sharedServiceCatalog.find((candidate) => candidate.id === serviceInstanceId || candidate.serviceId === serviceInstanceId);
  if (shared) {
    for (const activation of config.sharedServiceActivations.filter((candidate) => candidate.enabled && candidate.sharedServiceId === shared.id)) {
      routeServiceIds.add(activation.id);
    }
    shared.tags = [...new Set([...(shared.tags ?? []), ...manifest.capabilities])];
    if (manifest.authProvider) shared.authProvider = manifest.authProvider;
    if (manifest.title) shared.title = manifest.title;
  }
  for (const app of config.apps) {
    for (const route of app.routes) {
      if (Array.isArray(route.operations) && route.operations.length > 0) continue;
      const legacyMethods = (route as unknown as { methods?: string[] }).methods ?? ["GET"];
      route.operations = legacyMethods.map((method) => legacyOperationId(route.viewId, method));
    }
    const appServiceIds = getAvailableServiceInstanceIdsForApp(config, app);
    const syncedServiceIds = new Set([...routeServiceIds].filter((id) => appServiceIds.has(id)));
    if (manifest.authProvider && app.auth && routeServiceIds.has(app.auth.serviceId)) {
      applyAuthProviderMetadata(app.auth, manifest.authProvider);
    }
    reconcileServiceRouteMounts(app, syncedServiceIds, manifest,
      !config.previewEnvironmentDeployments?.some(deployment => deployment.appId === app.id));
    reconcileDependencyRoutes(config, app);
  }
  onManifestUpdated?.(config, [...routeServiceIds], manifest);
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
