import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  PreviewEnvironmentGroupSchema,
  PreviewEnvironmentGroupServiceSchema,
  uuidv7,
  verifyExternalOidcToken,
  type BetterPortalApp,
  type BetterPortalConfig,
  type BetterPortalMenuItem,
  type BetterPortalRouteMount,
  type BetterPortalShellFragmentItem,
  type BetterPortalShellFragmentSetting,
  type PreviewEnvironmentDeployment,
  type PreviewEnvironmentGroup,
  type ServiceManifestCacheEntry
} from "@betterportal/framework";
import { generateApiKey, hashApiKey } from "./storage/core.js";
import { apiRoutePath, pageRoutePath } from "./routeMounts.js";

export const PREVIEW_DEPLOYMENT_API_BASE = "/api/preview-groups";

type PreviewManifest = Omit<ServiceManifestCacheEntry, "fetchedAt"> & { fetchedAt: string | number };

export interface PreviewGroupInput {
  name: string;
  sourceTenantId: string;
  sourceAppId: string;
  expiresInDays: number | null;
  oidc?: PreviewEnvironmentGroup["oidc"];
}

export interface PreviewDeploymentInput {
  key: string;
  name?: string;
  hostname: string;
  expiresInDays?: number | null;
  services: Array<{ serviceId: string; url: string }>;
}

export interface IssuedPreviewCredential {
  serviceId: string;
  instanceId: string;
  url: string;
  environment: {
    BP_CONTROL_PLANE_URL: string;
    BP_SERVICE_API_KEY: string;
  };
}

export class PreviewEnvironmentError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 404 | 409 = 400) {
    super(message);
    this.name = "PreviewEnvironmentError";
  }
}

export function previewTenantIds(config: BetterPortalConfig): Set<string> {
  return new Set(config.previewEnvironmentDeployments.map((deployment) => deployment.tenantId));
}

export function previewAppIds(config: BetterPortalConfig): Set<string> {
  return new Set(config.previewEnvironmentDeployments.map((deployment) => deployment.appId));
}

export function isPreviewTenant(config: BetterPortalConfig, tenantId: string): boolean {
  return config.previewEnvironmentDeployments.some((deployment) => deployment.tenantId === tenantId);
}

export function isPreviewApp(config: BetterPortalConfig, appId: string): boolean {
  return config.previewEnvironmentDeployments.some((deployment) => deployment.appId === appId);
}

export function isPreviewService(config: BetterPortalConfig, instanceId: string): boolean {
  return config.previewEnvironmentDeployments.some((deployment) =>
    deployment.services.some((service) => service.instanceId === instanceId)
  );
}

export function visibleAdminConfig(config: BetterPortalConfig): BetterPortalConfig {
  const tenantIds = previewTenantIds(config);
  const appIds = previewAppIds(config);
  return {
    ...config,
    tenants: config.tenants.filter((tenant) => !tenantIds.has(tenant.id)),
    apps: config.apps.filter((app) => !appIds.has(app.id)),
    sharedServiceActivations: config.sharedServiceActivations.filter((activation) => !tenantIds.has(activation.tenantId)),
    m2m: {
      bindings: config.m2m.bindings.filter((binding) => !tenantIds.has(binding.tenantId)),
      grants: config.m2m.grants.filter((grant) => !tenantIds.has(grant.tenantId))
    },
    webhooks: {
      targets: config.webhooks.targets.filter((target) => !tenantIds.has(target.tenantId))
    }
  };
}

export function createPreviewGroup(
  config: BetterPortalConfig,
  input: PreviewGroupInput,
  now = new Date()
): { group: PreviewEnvironmentGroup; apiKey: string } {
  const sourceTenant = config.tenants.find((tenant) => tenant.id === input.sourceTenantId);
  const sourceApp = config.apps.find((app) => app.id === input.sourceAppId && app.tenantId === input.sourceTenantId);
  if (!sourceTenant || !sourceApp || isPreviewTenant(config, sourceTenant.id) || isPreviewApp(config, sourceApp.id)) {
    throw new PreviewEnvironmentError("Source tenant/app was not found", 404);
  }
  const apiKey = `bp_pg_${randomBytes(32).toString("base64url")}`;
  const timestamp = now.toISOString();
  const group = PreviewEnvironmentGroupSchema.parse({
    id: uuidv7(),
    name: requiredText(input.name, "Group name", 120),
    sourceTenantId: sourceTenant.id,
    sourceAppId: sourceApp.id,
    expiresInDays: normalizeExpiry(input.expiresInDays),
    apiKeyHash: hashApiKey(apiKey),
    ...(input.oidc ? { oidc: normalizeOidc(input.oidc) } : {}),
    services: [],
    createdAt: timestamp,
    updatedAt: timestamp
  });
  config.previewEnvironmentGroups.push(group);
  return { group, apiKey };
}

export function updatePreviewGroup(
  config: BetterPortalConfig,
  groupId: string,
  input: Pick<PreviewGroupInput, "name" | "expiresInDays" | "oidc">,
  now = new Date()
): PreviewEnvironmentGroup {
  const group = requireGroup(config, groupId);
  group.name = requiredText(input.name, "Group name", 120);
  group.expiresInDays = normalizeExpiry(input.expiresInDays);
  if (input.oidc) group.oidc = normalizeOidc(input.oidc);
  else delete group.oidc;
  group.updatedAt = now.toISOString();
  return group;
}

export function rotatePreviewGroupApiKey(
  config: BetterPortalConfig,
  groupId: string,
  now = new Date()
): string {
  const group = requireGroup(config, groupId);
  const apiKey = `bp_pg_${randomBytes(32).toString("base64url")}`;
  group.apiKeyHash = hashApiKey(apiKey);
  group.updatedAt = now.toISOString();
  return apiKey;
}

export async function authenticatePreviewGroup(group: PreviewEnvironmentGroup, authorization: string | null): Promise<void> {
  const token = bearerToken(authorization);
  if (!token) throw new PreviewEnvironmentError("A bearer credential is required", 401);
  if (token.startsWith("bp_pg_")) {
    if (!safeHashEqual(group.apiKeyHash, hashApiKey(token))) {
      throw new PreviewEnvironmentError("Invalid preview group API key", 401);
    }
    return;
  }
  const oidc = group.oidc;
  if (!oidc) throw new PreviewEnvironmentError("OIDC is not configured for this preview group", 401);
  let claims: Record<string, unknown>;
  try {
    claims = await verifyExternalOidcToken(token, oidc);
  } catch {
    throw new PreviewEnvironmentError("Invalid OIDC token", 401);
  }
  if (oidc.subjectPrefix && (typeof claims.sub !== "string" || !claims.sub.startsWith(oidc.subjectPrefix))) {
    throw new PreviewEnvironmentError("OIDC token subject is not allowed", 401);
  }
  for (const [name, expected] of Object.entries(oidc.requiredClaims)) {
    if (claims[name] !== expected) throw new PreviewEnvironmentError(`OIDC claim ${name} is not allowed`, 401);
  }
}

export function provisionPreviewDeployment(
  config: BetterPortalConfig,
  groupId: string,
  input: PreviewDeploymentInput,
  controlPlaneUrl: string,
  now = new Date()
): { deployment: PreviewEnvironmentDeployment; credentials: IssuedPreviewCredential[]; created: boolean } {
  deleteExpiredPreviewDeployments(config, now);
  const group = requireGroup(config, groupId);
  const key = requiredText(input.key, "Preview key", 255);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(key)) {
    throw new PreviewEnvironmentError("Preview key must start with a letter or number and contain only letters, numbers, dot, underscore, colon or hyphen");
  }
  const requestedServices = normalizeRequestedServices(input.services);
  const existing = config.previewEnvironmentDeployments.find((deployment) =>
    deployment.groupId === group.id && deployment.key === key
  );
  if (existing) {
    requireExactServiceSet(existing, requestedServices);
    return updateDeployment(config, existing, requestedServices, controlPlaneUrl, now);
  }

  const sourceTenant = config.tenants.find((tenant) => tenant.id === group.sourceTenantId);
  const sourceApp = config.apps.find((app) => app.id === group.sourceAppId && app.tenantId === group.sourceTenantId);
  if (!sourceTenant || !sourceApp || isPreviewTenant(config, sourceTenant.id) || isPreviewApp(config, sourceApp.id)) {
    throw new PreviewEnvironmentError("The preview group's source tenant/app is unavailable", 409);
  }
  requireUnambiguousSourceServices(sourceTenant, sourceApp, requestedServices);
  const hostname = normalizeAppHostname(input.hostname);
  if (config.apps.some((app) => app.hostnames.some((candidate) => sameHostname(candidate, hostname)))) {
    throw new PreviewEnvironmentError("Preview hostname is already assigned to another app", 409);
  }

  const timestamp = now.toISOString();
  const tenantId = uuidv7();
  const appId = uuidv7();
  const serviceMap = new Map<string, string>();
  const credentials: IssuedPreviewCredential[] = [];
  const discovered = [...requestedServices.keys()].flatMap((serviceId) => group.services.some((service) => service.serviceId === serviceId) ? [] : [PreviewEnvironmentGroupServiceSchema.parse({
    serviceId,
    title: sourceServiceForPreview(sourceTenant, sourceApp, serviceId)?.title ?? serviceId,
    config: { tenant: {}, app: {} }
  })]);
  const services = [...requestedServices].map(([serviceId, requested]) => {
    const configured = group.services.find((service) => service.serviceId === serviceId) ?? discovered.find((service) => service.serviceId === serviceId)!;
    const source = sourceServiceForPreview(sourceTenant, sourceApp, serviceId);
    const instanceId = uuidv7();
    const apiKey = generateApiKey();
    if (source) serviceMap.set(source.id, instanceId);
    credentials.push(issuedCredential(serviceId, instanceId, requested, apiKey, controlPlaneUrl));
    return {
      id: instanceId,
      hostname: requested,
      apiKeyHash: hashApiKey(apiKey),
      serviceId,
      capabilities: source?.capabilities ?? [],
      title: configured.title ?? source?.title ?? serviceId,
      ...(source?.description ? { description: source.description } : {}),
      deploymentMode: "self-hosted" as const,
      createdAt: timestamp,
      enabled: true
    };
  });

  const referenced = collectAppServiceReferences(sourceApp);
  const activatedPlatformServices = sourceTenant.activatedPlatformServices.filter((serviceId) => referenced.has(serviceId));
  for (const serviceId of activatedPlatformServices) serviceMap.set(serviceId, serviceId);

  const clonedActivations = config.sharedServiceActivations
    .filter((activation) =>
      activation.enabled
      && activation.tenantId === sourceTenant.id
      && referenced.has(activation.id)
      && (!activation.appId || activation.appId === sourceApp.id)
    )
    .map((activation) => {
      const id = uuidv7();
      serviceMap.set(activation.id, id);
      return {
        id,
        tenantId,
        appId,
        sharedServiceId: activation.sharedServiceId,
        activatedAt: timestamp,
        enabled: true
      };
    });

  const tenant = {
    id: tenantId,
    slug: `preview-${tenantId}`,
    title: `${group.name}: ${input.name?.trim() || key}`,
    active: true,
    branding: structuredClone(sourceTenant.branding),
    services,
    activatedPlatformServices
  };
  const app = clonePreviewApp(sourceApp, appId, tenantId, input.name?.trim() || key, hostname, serviceMap);
  const expiresInDays = effectiveExpiry(group.expiresInDays, input.expiresInDays);
  const deployment: PreviewEnvironmentDeployment = {
    id: uuidv7(),
    groupId: group.id,
    key,
    name: input.name?.trim() || key,
    hostname,
    tenantId,
    appId,
    expiresInDays,
    ...(expiryDate(now, expiresInDays) ? { expiresAt: expiryDate(now, expiresInDays) } : {}),
    services: services.map((service) => ({
      serviceId: service.serviceId!,
      instanceId: service.id,
      url: service.hostname
    })),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  config.tenants.push(tenant);
  config.apps.push(app);
  config.sharedServiceActivations.push(...clonedActivations);
  group.services.push(...discovered);
  if (discovered.length) group.updatedAt = timestamp;
  config.previewEnvironmentDeployments.push(deployment);
  reconcilePreviewDeploymentFromCache(config, deployment);
  return { deployment, credentials, created: true };
}

export function updatePreviewDeploymentExpiry(
  config: BetterPortalConfig,
  deploymentId: string,
  expiresInDays: number | null,
  now = new Date()
): PreviewEnvironmentDeployment {
  const deployment = config.previewEnvironmentDeployments.find((candidate) => candidate.id === deploymentId);
  if (!deployment) throw new PreviewEnvironmentError("Preview deployment was not found", 404);
  deployment.expiresInDays = normalizeExpiry(expiresInDays);
  const expiresAt = expiryDate(now, deployment.expiresInDays);
  if (expiresAt) deployment.expiresAt = expiresAt;
  else delete deployment.expiresAt;
  deployment.updatedAt = now.toISOString();
  return deployment;
}

export function deleteExpiredPreviewDeployments(config: BetterPortalConfig, now = new Date()): string[] {
  const expired = config.previewEnvironmentDeployments
    .filter((deployment) => deployment.expiresAt && Date.parse(deployment.expiresAt) <= now.getTime())
    .map((deployment) => deployment.id);
  for (const deploymentId of expired) deletePreviewDeployment(config, deploymentId);
  return expired;
}

export function deletePreviewDeployment(config: BetterPortalConfig, deploymentId: string): boolean {
  const deployment = config.previewEnvironmentDeployments.find((candidate) => candidate.id === deploymentId);
  if (!deployment) return false;
  const serviceIds = new Set(deployment.services.map((service) => service.instanceId));
  const activationIds = new Set(config.sharedServiceActivations
    .filter((activation) => activation.tenantId === deployment.tenantId)
    .map((activation) => activation.id));
  const bindingIds = new Set(config.m2m.bindings
    .filter((binding) => binding.tenantId === deployment.tenantId)
    .map((binding) => binding.id));
  config.m2m.grants = config.m2m.grants.filter((grant) => !bindingIds.has(grant.bindingId) && grant.tenantId !== deployment.tenantId);
  config.m2m.bindings = config.m2m.bindings.filter((binding) => binding.tenantId !== deployment.tenantId);
  config.webhooks.targets = config.webhooks.targets.filter((target) => target.tenantId !== deployment.tenantId);
  config.manifestCache = config.manifestCache.filter((entry) => !serviceIds.has(entry.serviceId) && !activationIds.has(entry.serviceId));
  config.sharedServiceActivations = config.sharedServiceActivations.filter((activation) => activation.tenantId !== deployment.tenantId);
  config.apps = config.apps.filter((app) => app.id !== deployment.appId && app.tenantId !== deployment.tenantId);
  config.tenants = config.tenants.filter((tenant) => tenant.id !== deployment.tenantId);
  config.previewEnvironmentDeployments = config.previewEnvironmentDeployments.filter((candidate) => candidate.id !== deployment.id);
  return true;
}

export function deletePreviewGroup(config: BetterPortalConfig, groupId: string): boolean {
  const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
  if (!group) return false;
  for (const deployment of [...config.previewEnvironmentDeployments.filter((candidate) => candidate.groupId === groupId)]) {
    deletePreviewDeployment(config, deployment.id);
  }
  config.previewEnvironmentGroups = config.previewEnvironmentGroups.filter((candidate) => candidate.id !== groupId);
  return true;
}

export function reconcilePreviewService(
  config: BetterPortalConfig,
  serviceInstanceId: string,
  manifest: PreviewManifest
): boolean {
  const deployments = config.previewEnvironmentDeployments.filter((deployment) =>
    deployment.services.some((service) => service.instanceId === serviceInstanceId)
    || previewAppUsesService(config, deployment.appId, serviceInstanceId)
  );
  let changed = false;
  for (const deployment of deployments) {
    const app = config.apps.find((candidate) => candidate.id === deployment.appId);
    if (!app) continue;
    const before = JSON.stringify({ routes: app.routes, menu: app.menu });
    reconcileRoutesForService(app, serviceInstanceId, manifest);
    rebuildPreviewMenu(config, app);
    if (before !== JSON.stringify({ routes: app.routes, menu: app.menu })) changed = true;
  }
  return changed;
}

function updateDeployment(
  config: BetterPortalConfig,
  deployment: PreviewEnvironmentDeployment,
  requestedServices: Map<string, string>,
  controlPlaneUrl: string,
  now: Date
): { deployment: PreviewEnvironmentDeployment; credentials: IssuedPreviewCredential[]; created: false } {
  const tenant = config.tenants.find((candidate) => candidate.id === deployment.tenantId);
  if (!tenant) throw new PreviewEnvironmentError("Preview deployment tenant is missing", 409);
  const credentials: IssuedPreviewCredential[] = [];
  for (const binding of deployment.services) {
    const nextUrl = requestedServices.get(binding.serviceId)!;
    if (sameOrigin(binding.url, nextUrl)) continue;
    const service = tenant.services.find((candidate) => candidate.id === binding.instanceId);
    if (!service) throw new PreviewEnvironmentError(`Preview service ${binding.serviceId} is missing`, 409);
    const apiKey = generateApiKey();
    binding.url = nextUrl;
    service.hostname = nextUrl;
    service.apiKeyHash = hashApiKey(apiKey);
    delete service.publicKeyPem;
    delete service.keyId;
    delete service.lastSeenAt;
    delete service.lastSyncAt;
    config.manifestCache = config.manifestCache.filter((entry) => entry.serviceId !== service.id);
    const app = config.apps.find((candidate) => candidate.id === deployment.appId);
    if (app) {
      for (const route of app.routes.filter((candidate) => candidate.serviceId === service.id)) route.enabled = false;
      rebuildPreviewMenu(config, app);
    }
    credentials.push(issuedCredential(binding.serviceId, binding.instanceId, nextUrl, apiKey, controlPlaneUrl));
  }
  const expiresAt = expiryDate(now, deployment.expiresInDays);
  if (expiresAt) deployment.expiresAt = expiresAt;
  else delete deployment.expiresAt;
  deployment.updatedAt = now.toISOString();
  return { deployment, credentials, created: false };
}

function clonePreviewApp(
  source: BetterPortalApp,
  id: string,
  tenantId: string,
  name: string,
  hostname: string,
  serviceMap: Map<string, string>
): BetterPortalApp {
  const mapId = (value: string): string | undefined => serviceMap.get(value);
  const routeIds = new Map<string, string>();
  const routes = source.routes.flatMap((route) => {
    const serviceId = mapId(route.serviceId);
    if (!serviceId) return [];
    const routeId = uuidv7();
    routeIds.set(route.id, routeId);
    return [{ ...structuredClone(route), id: routeId, serviceId, enabled: false }];
  });
  const slots = source.slots.flatMap((slot) => {
    const serviceId = mapId(slot.serviceId);
    return serviceId ? [{ ...structuredClone(slot), serviceId }] : [];
  });
  const fragments = Object.fromEntries(Object.entries(source.fragments).flatMap(([location, values]) => {
    const mapped = values.flatMap((fragment) => {
      const serviceId = mapId(fragment.serviceId);
      return serviceId ? [{ ...structuredClone(fragment), serviceId }] : [];
    });
    return mapped.length ? [[location, mapped]] : [];
  }));
  const shellFragments = Object.fromEntries(Object.entries(source.shellFragments).flatMap(([shellServiceId, settings]) => {
    const mappedShell = mapId(shellServiceId);
    if (!mappedShell) return [];
    const mappedSettings = Object.fromEntries(Object.entries(settings).flatMap(([fragmentId, setting]) => {
      const mapped = mapShellFragmentSetting(setting, serviceMap);
      return mapped ? [[fragmentId, mapped]] : [];
    }));
    return [[mappedShell, mappedSettings]];
  }));
  const shellServiceId = source.shell ? mapId(source.shell.serviceId) : undefined;
  const authServiceId = source.auth ? mapId(source.auth.serviceId) : undefined;
  const auth = source.auth && authServiceId ? structuredClone(source.auth) : undefined;
  if (auth) {
    auth.serviceId = authServiceId!;
    auth.redirects = auth.redirects ? Object.fromEntries(Object.entries(auth.redirects).flatMap(([key, target]) => {
      if (!target) return [];
      const serviceId = mapId(target.serviceId);
      return serviceId ? [[key, { ...target, serviceId }]] : [];
    })) : undefined;
    auth.roles = auth.roles.map((role) => ({
      ...role,
      permissions: role.permissions.flatMap((permission) => {
        const serviceId = mapId(permission.serviceId);
        return serviceId ? [{ ...permission, serviceId }] : [];
      })
    }));
    delete auth.publicKeys;
  }
  return {
    ...structuredClone(source),
    id,
    tenantId,
    slug: `preview-${id}`,
    title: name,
    hostnames: [hostname],
    originOverrides: [],
    refererOverrides: [],
    ...(shellServiceId ? { shell: { serviceId: shellServiceId } } : { shell: undefined }),
    seo: {
      visibility: "private",
      serviceFailure: source.seo?.serviceFailure ?? "omit-service",
      serviceCache: source.seo?.serviceCache ?? "24h"
    },
    routes,
    menu: [],
    slots,
    fragments,
    shellFragments,
    ...(auth ? { auth } : { auth: undefined })
  };
}

function mapShellFragmentSetting(
  setting: BetterPortalShellFragmentSetting,
  serviceMap: Map<string, string>
): BetterPortalShellFragmentSetting | undefined {
  if (setting.mode === "none") return setting;
  const mapItem = (item: BetterPortalShellFragmentItem): BetterPortalShellFragmentItem | undefined => {
    if (item.source === "shell") return item;
    const serviceId = serviceMap.get(item.serviceId);
    return serviceId ? { ...item, serviceId } : undefined;
  };
  if (setting.mode === "override") {
    const item = mapItem(setting.item);
    return item ? { mode: "override", item } : undefined;
  }
  return { mode: "items", items: setting.items.flatMap((item) => mapItem(item) ?? []) };
}

function reconcilePreviewDeploymentFromCache(config: BetterPortalConfig, deployment: PreviewEnvironmentDeployment): void {
  const app = config.apps.find((candidate) => candidate.id === deployment.appId);
  if (!app) return;
  for (const serviceId of collectAppServiceReferences(app)) {
    if (deployment.services.some((service) => service.instanceId === serviceId)) continue;
    const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId);
    const manifestId = activation?.sharedServiceId ?? serviceId;
    const manifest = config.manifestCache.find((entry) => entry.serviceId === manifestId);
    if (manifest) reconcileRoutesForService(app, serviceId, { ...manifest, serviceId: servicePluginId(config, serviceId) ?? manifest.serviceId });
  }
  rebuildPreviewMenu(config, app);
}

function reconcileRoutesForService(app: BetterPortalApp, serviceInstanceId: string, manifest: PreviewManifest): void {
  const existing = app.routes.filter((route) => route.serviceId === serviceInstanceId);
  const desired: BetterPortalRouteMount[] = [];
  for (const view of Object.values(manifest.viewIndex)) {
    const pageOperations = view.operations.filter((operation) =>
      operation.method === "GET" && operation.renderable && operation.renderModes.includes("page")
    );
    const pageIds = new Set(pageOperations.map((operation) => operation.operationId));
    const apiOperations = view.operations.filter((operation) => !pageIds.has(operation.operationId));
    for (const [kind, operations] of [["page", pageOperations], ["api", apiOperations]] as const) {
      if (operations.length === 0) continue;
      const previous = existing.find((route) =>
        (route.kind ?? "page") === kind
        && route.viewId === view.viewId
        && route.operations.some((operationId) => operations.some((operation) => operation.operationId === operationId))
      );
      const operation = operations[0]!;
      desired.push({
        ...(previous ? structuredClone(previous) : {
          id: uuidv7(),
          serviceId: serviceInstanceId,
          viewId: view.viewId,
          operations: []
        }),
        kind,
        path: previous?.path ?? (kind === "page"
          ? pageRoutePath(manifest.serviceId, view.path)
          : apiRoutePath(manifest.serviceId, view.path)),
        serviceId: serviceInstanceId,
        viewId: view.viewId,
        targetPath: view.path,
        title: operation.title,
        authRequired: operation.authRequired,
        ...(operation.sitemap ? { sitemap: operation.sitemap } : {}),
        robots: [...operation.robots],
        ...(operation.chrome ? { chrome: operation.chrome } : {}),
        enabled: true,
        enablement: "enabled",
        operations: operations.map((candidate) => candidate.operationId)
      });
    }
  }
  app.routes = [...app.routes.filter((route) => route.serviceId !== serviceInstanceId), ...desired];
}

function rebuildPreviewMenu(config: BetterPortalConfig, app: BetterPortalApp): void {
  const previousGroups = new Map<string, BetterPortalMenuItem>();
  const previousItems = new Map<string, BetterPortalMenuItem>();
  for (const group of app.menu) {
    const route = group.children.map((item) => app.routes.find((candidate) => candidate.id === item.routeId)).find(Boolean);
    if (route) previousGroups.set(route.serviceId, group);
    for (const item of group.children) if (item.routeId) previousItems.set(item.routeId, item);
  }
  const routes = app.routes
    .filter((route) => route.enabled && (route.kind ?? "page") === "page")
    .sort((left, right) => left.path.localeCompare(right.path));
  const byService = new Map<string, BetterPortalRouteMount[]>();
  for (const route of routes) byService.set(route.serviceId, [...(byService.get(route.serviceId) ?? []), route]);
  app.menu = [...byService.entries()]
    .sort(([left], [right]) => serviceTitle(config, app.tenantId, left).localeCompare(serviceTitle(config, app.tenantId, right)))
    .map(([serviceId, serviceRoutes]) => ({
      id: previousGroups.get(serviceId)?.id ?? uuidv7(),
      type: "group" as const,
      title: serviceTitle(config, app.tenantId, serviceId),
      enabled: true,
      serviceStatus: "show" as const,
      authStatus: "show" as const,
      defaultExpanded: true,
      children: serviceRoutes.map((route) => ({
        id: previousItems.get(route.id)?.id ?? uuidv7(),
        type: "link" as const,
        title: route.title ?? route.viewId,
        routeId: route.id,
        enabled: true,
        serviceStatus: "show" as const,
        authStatus: "show" as const,
        children: []
      }))
    }));
}

function collectAppServiceReferences(app: BetterPortalApp): Set<string> {
  const ids = new Set<string>();
  if (app.shell) ids.add(app.shell.serviceId);
  for (const route of app.routes) ids.add(route.serviceId);
  for (const slot of app.slots) ids.add(slot.serviceId);
  for (const fragments of Object.values(app.fragments)) for (const fragment of fragments) ids.add(fragment.serviceId);
  for (const [shellServiceId, settings] of Object.entries(app.shellFragments)) {
    ids.add(shellServiceId);
    for (const setting of Object.values(settings)) {
      if (setting.mode === "override" && setting.item.source === "service") ids.add(setting.item.serviceId);
      if (setting.mode === "items") for (const item of setting.items) if (item.source === "service") ids.add(item.serviceId);
    }
  }
  if (app.auth) {
    ids.add(app.auth.serviceId);
    for (const target of Object.values(app.auth.redirects ?? {})) if (target) ids.add(target.serviceId);
    for (const role of app.auth.roles) for (const permission of role.permissions) ids.add(permission.serviceId);
  }
  return ids;
}

function requireUnambiguousSourceServices(
  tenant: BetterPortalConfig["tenants"][number],
  app: BetterPortalApp,
  requested: Map<string, string>
): void {
  const referenced = collectAppServiceReferences(app);
  for (const serviceId of requested.keys()) {
    if (tenant.services.filter((service) => service.serviceId === serviceId && referenced.has(service.id)).length > 1) {
      throw new PreviewEnvironmentError(`Source app uses multiple instances of ${serviceId}; previews require one instance per service ID`);
    }
  }
}

function sourceServiceForPreview(
  tenant: BetterPortalConfig["tenants"][number],
  app: BetterPortalApp,
  serviceId: string
): BetterPortalConfig["tenants"][number]["services"][number] | undefined {
  const referenced = collectAppServiceReferences(app);
  return tenant.services.find((service) => service.serviceId === serviceId && referenced.has(service.id))
    ?? tenant.services.find((service) => service.serviceId === serviceId);
}

function previewAppUsesService(config: BetterPortalConfig, appId: string, serviceId: string): boolean {
  const app = config.apps.find((candidate) => candidate.id === appId);
  return app ? collectAppServiceReferences(app).has(serviceId) : false;
}

function servicePluginId(config: BetterPortalConfig, serviceId: string): string | undefined {
  for (const tenant of config.tenants) {
    const service = tenant.services.find((candidate) => candidate.id === serviceId);
    if (service) return service.serviceId;
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceId);
  if (platform) return platform.serviceId;
  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId);
  return activation
    ? config.sharedServiceCatalog.find((candidate) => candidate.id === activation.sharedServiceId)?.serviceId
    : undefined;
}

function serviceTitle(config: BetterPortalConfig, tenantId: string, serviceId: string): string {
  const tenantService = config.tenants.find((tenant) => tenant.id === tenantId)?.services.find((service) => service.id === serviceId);
  if (tenantService) return tenantService.title ?? tenantService.serviceId ?? serviceId;
  const platform = config.platformServices.find((service) => service.id === serviceId);
  if (platform) return platform.title;
  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId);
  return config.sharedServiceCatalog.find((service) => service.id === activation?.sharedServiceId)?.title ?? serviceId;
}

function requireGroup(config: BetterPortalConfig, groupId: string): PreviewEnvironmentGroup {
  const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
  if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
  return group;
}

function normalizeRequestedServices(values: Array<{ serviceId: string; url: string }>): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of values) {
    const serviceId = value.serviceId.trim();
    if (!serviceId || result.has(serviceId)) throw new PreviewEnvironmentError("Service plugin IDs must be present and unique");
    result.set(serviceId, normalizeServiceOrigin(value.url));
  }
  if (result.size === 0) throw new PreviewEnvironmentError("At least one service is required");
  return result;
}

function requireExactServiceSet(deployment: PreviewEnvironmentDeployment, requested: Map<string, string>): void {
  const expected = deployment.services.map((service) => service.serviceId).sort();
  const received = [...requested.keys()].sort();
  if (expected.length !== received.length || expected.some((serviceId, index) => serviceId !== received[index])) {
    throw new PreviewEnvironmentError(`Services must exactly match the existing preview: ${expected.join(", ")}`, 409);
  }
}

function normalizeOidc(oidc: NonNullable<PreviewEnvironmentGroup["oidc"]>): NonNullable<PreviewEnvironmentGroup["oidc"]> {
  return {
    issuer: requiredText(oidc.issuer, "OIDC issuer", 2048).replace(/\/+$/, ""),
    audience: requiredText(oidc.audience, "OIDC audience", 255),
    jwksUri: normalizeServiceOriginOrUrl(oidc.jwksUri, "OIDC JWKS URL"),
    ...(oidc.subjectPrefix?.trim() ? { subjectPrefix: oidc.subjectPrefix.trim() } : {}),
    requiredClaims: Object.fromEntries(Object.entries(oidc.requiredClaims ?? {}).map(([key, value]) => [
      requiredText(key, "OIDC claim name", 128),
      requiredText(value, `OIDC claim ${key}`, 512)
    ]))
  };
}

function normalizeExpiry(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new PreviewEnvironmentError("Expiry must be between 1 and 3650 days, or never");
  }
  return value;
}

function effectiveExpiry(limit: number | null, requested: number | null | undefined): number | null {
  if (requested !== undefined) normalizeExpiry(requested);
  if (limit === null) return requested === undefined ? null : requested;
  if (requested === undefined || requested === null) return limit;
  return Math.min(limit, requested);
}

function expiryDate(now: Date, days: number | null): string | undefined {
  return days === null ? undefined : new Date(now.getTime() + days * 86_400_000).toISOString();
}

function normalizeServiceOrigin(value: string): string {
  const raw = requiredText(value, "Service URL", 2048);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new PreviewEnvironmentError(`Invalid service URL: ${raw}`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new PreviewEnvironmentError(`Service URL must be an HTTP(S) origin without credentials, path, query or fragment: ${raw}`);
  }
  return parsed.origin;
}

function normalizeServiceOriginOrUrl(value: string, label: string): string {
  const raw = requiredText(value, label, 2048);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new PreviewEnvironmentError(`${label} is invalid`); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new PreviewEnvironmentError(`${label} must be an HTTPS URL without credentials or a fragment`);
  }
  return parsed.toString();
}

function normalizeAppHostname(value: string): string {
  const raw = requiredText(value, "Preview hostname", 2048).replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error();
    }
    return parsed.origin;
  } catch {
    if (!/^[A-Za-z0-9.-]+(?::\d+)?$/.test(raw) || raw.includes("..")) {
      throw new PreviewEnvironmentError("Preview hostname must be a hostname or HTTP(S) origin without a path");
    }
    return raw.toLowerCase();
  }
}

function sameHostname(left: string, right: string): boolean {
  const host = (value: string) => {
    try { return new URL(value).host.toLowerCase(); } catch { return value.toLowerCase().replace(/^https?:\/\//, ""); }
  };
  return host(left) === host(right);
}

function sameOrigin(left: string, right: string): boolean {
  return normalizeServiceOrigin(left) === normalizeServiceOrigin(right);
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new PreviewEnvironmentError(`${label} is required`);
  if (normalized.length > maxLength) throw new PreviewEnvironmentError(`${label} must be at most ${maxLength} characters`);
  return normalized;
}

function bearerToken(value: string | null): string | undefined {
  if (!value?.startsWith("Bearer ")) return undefined;
  const token = value.slice("Bearer ".length).trim();
  return token && token.length <= 16_384 ? token : undefined;
}

function safeHashEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function issuedCredential(
  serviceId: string,
  instanceId: string,
  url: string,
  apiKey: string,
  controlPlaneUrl: string
): IssuedPreviewCredential {
  return {
    serviceId,
    instanceId,
    url,
    environment: {
      BP_CONTROL_PLANE_URL: controlPlaneUrl.replace(/\/+$/, ""),
      BP_SERVICE_API_KEY: apiKey
    }
  };
}
