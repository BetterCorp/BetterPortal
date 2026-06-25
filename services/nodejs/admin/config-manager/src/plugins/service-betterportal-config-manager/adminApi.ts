import type {
  BetterPortalH3App,
  BetterPortalEvent,
  PlatformConfigStore,
  JsonValue
} from "@betterportal/framework";
import {
  htmlResponse,
  jsonResponse,
  signServiceConfigTicket,
  uuidv7
} from "@betterportal/framework";
import type { TenantServiceRegistration, PlatformService, BetterPortalThemeConfig, BetterPortalConfig, BetterPortalApp, BetterPortalRouteMount, DeploymentMode } from "@betterportal/framework";
import type { CpBootstrapState } from "./cpBootstrap.js";
import { generateApiKey, hashApiKey } from "./storage/index.js";
import { getManifestCache } from "./syncApi.js";

const API_BASE = "/.well-known/bp/admin";
const CONFIG_TICKET_TTL_SECONDS = 5 * 60;

async function readFormBody(event: BetterPortalEvent): Promise<Record<string, string>> {
  const fd = await event.req.formData().catch(() => null);
  if (!fd) return {};
  const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function readJsonBody(event: BetterPortalEvent): Promise<Record<string, unknown>> {
  const parsed = await event.req.json().catch(() => null);
  return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};
}

async function readFormOrJsonBody(event: BetterPortalEvent): Promise<Record<string, unknown>> {
  const contentType = event.req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return readFormBody(event);
  }
  return readJsonBody(event);
}

function wantsHtmx(event: BetterPortalEvent): boolean {
  return event.req.headers.get("hx-request") === "true"
    || (event.req.headers.get("accept") ?? "").includes("text/html");
}

function htmxReload(path: string): Response {
  return htmlResponse("", 200, "text/html; mode=fragment", {
    "HX-Location": JSON.stringify({ path, target: "#bp-main", swap: "innerHTML" })
  });
}

function htmxError(message: string, status = 400): Response {
  return htmlResponse(`<div class="alert alert-danger">${escapeHtml(message)}</div>`, status, "text/html; mode=fragment");
}

function validationError(event: BetterPortalEvent, message: string): Response {
  return wantsHtmx(event) ? htmxError(message, 400) : jsonResponse({ error: message }, 400);
}

function trimmedString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function requiredRouteString(body: Record<string, unknown>, key: string, label: string): { value?: string; error?: string } {
  const value = trimmedString(body, key);
  if (!value) return { error: `${label} is required.` };
  return { value };
}

function routeMethodsFromManifest(methods?: string[]): BetterPortalRouteMount["methods"] {
  const normalized = (methods ?? []).filter((method): method is BetterPortalRouteMount["methods"][number] =>
    method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" || method === "OPTIONS"
  );
  return normalized.length ? normalized : ["GET"];
}

function appMatchesTenantUrl(app: BetterPortalApp, tenantUrl: string): boolean {
  let host = "";
  try {
    host = new URL(tenantUrl).host.toLowerCase();
  } catch {
    host = tenantUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
  return app.hostnames.some((hostname) => {
    const value = hostname.toLowerCase();
    if (value === host) return true;
    try {
      return new URL(value).host.toLowerCase() === host;
    } catch {
      return false;
    }
  });
}

function appPublicUrl(app: BetterPortalApp | undefined): string | undefined {
  const hostname = app?.hostnames[0];
  if (!hostname) return undefined;
  return /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`;
}

function currentAppFromRequest(config: BetterPortalConfig, event: BetterPortalEvent): BetterPortalApp | undefined {
  const url = new URL(event.req.url, `http://${event.req.headers.get("host") ?? "localhost"}`);
  const appId = url.searchParams.get("appId") ?? event.req.headers.get("x-bp-app-id") ?? "";
  const tenantUrl = url.searchParams.get("tenantUrl") ?? event.req.headers.get("referer") ?? event.req.headers.get("origin") ?? "";
  return appId
    ? config.apps.find((entry) => entry.id === appId)
    : config.apps.find((entry) => tenantUrl && appMatchesTenantUrl(entry, tenantUrl));
}

function managementDiscovery(config: BetterPortalConfig, event: BetterPortalEvent): JsonValue {
  const managementApp = config.configManagement.managementAppId
    ? config.apps.find((app) => app.id === config.configManagement.managementAppId)
    : undefined;
  const base = new URL(event.req.url, `http://${event.req.headers.get("host") ?? "localhost"}`);
  const origin = base.origin;
  return {
    protocol: "betterportal-management.v1",
    managementApp: {
      tenantId: managementApp?.tenantId,
      appId: managementApp?.id ?? config.configManagement.managementAppId,
      url: appPublicUrl(managementApp)
    },
    platformAdmin: {
      available: true,
      usage: "operator-only",
      aiPolicy: "do-not-use-for-user-tasks"
    },
    endpoints: {
      current: `${origin}/.well-known/bp/manage/current`,
      services: `${origin}/.well-known/bp/manage/services`,
      routes: `${origin}/.well-known/bp/manage/routes`,
      fragments: `${origin}/.well-known/bp/manage/fragments`,
      theme: `${origin}/.well-known/bp/manage/theme`,
      webhooks: `${origin}/.well-known/bp/manage/webhooks/targets`
    }
  } as JsonValue;
}

function automationServiceCatalog(config: BetterPortalConfig, appDef: BetterPortalApp): JsonValue {
  const tenant = config.tenants.find((entry) => entry.id === appDef.tenantId);
  const manifestCache = getManifestCache();
  const sharedById = new Map(config.sharedServiceCatalog.map((service) => [service.id, service]));
  const services = [
    ...(tenant?.services ?? []).filter((service) => service.enabled).map((service) => ({
      id: service.id,
      serviceId: service.serviceId ?? service.id,
      title: service.title ?? service.serviceId ?? service.id,
      url: service.hostname,
      source: "tenant" as const
    })),
    ...config.sharedServiceActivations
      .filter((activation) => activation.enabled && activation.tenantId === appDef.tenantId && (!activation.appId || activation.appId === appDef.id))
      .map((activation) => {
        const shared = sharedById.get(activation.sharedServiceId);
        return shared && shared.enabled ? {
          id: activation.id,
          serviceId: shared.serviceId ?? shared.id,
          title: shared.title,
          url: shared.baseUrl,
          source: "shared" as const
        } : null;
      })
      .filter((service): service is NonNullable<typeof service> => service !== null)
  ];

  return {
    protocol: "betterportal-automation.v1",
    tenantId: appDef.tenantId,
    appId: appDef.id,
    services: services.map((service) => {
      const manifest = manifestCache.get(service.id) ?? manifestCache.get(service.serviceId);
      return {
        ...service,
        manifestSynced: Boolean(manifest),
        capabilities: manifest?.capabilities ?? [],
        configSchemas: manifest?.configSchemas ?? [],
        webhooks: manifest?.webhooks ?? [],
        apiContracts: manifest?.apiContracts ?? [],
        m2mRequests: manifest?.m2mRequests ?? [],
        actions: Object.values(manifest?.viewIndex ?? {}).map((view) => ({
          viewId: view.viewId,
          path: view.path,
          methods: view.methods,
          title: view.viewId,
          renderable: view.renderable,
          permissions: view.permissions,
          role: view.role,
          chrome: view.chrome,
          dependencies: view.dependencies,
          schemas: view.schemas,
          raw: view.raw === true,
          apiContracts: view.apiContracts,
          demoScenarios: view.demoScenarios
        }))
      };
    })
  } as JsonValue;
}

function parseRouteCreateBody(body: Record<string, unknown>): { route?: Omit<BetterPortalRouteMount, "id">; error?: string } {
  const serviceId = requiredRouteString(body, "serviceId", "Service");
  if (serviceId.error) return { error: serviceId.error };
  const viewId = requiredRouteString(body, "viewId", "View");
  if (viewId.error) return { error: viewId.error };
  const manifestView = getManifestCache().get(serviceId.value!)?.viewIndex[viewId.value!];
  const renderable = manifestView?.renderable !== false;

  const path = renderable ? requiredRouteString(body, "path", "Mount path") : { value: manifestView?.path ?? `/${viewId.value!}` };
  if (path.error) return { error: path.error };
  if (!path.value!.startsWith("/")) return { error: "Mount path must start with /." };

  const title = renderable ? requiredRouteString(body, "title", "Display title") : { value: manifestView?.viewId ?? viewId.value! };
  if (title.error) return { error: title.error };

  const route: Omit<BetterPortalRouteMount, "id"> = {
    path: path.value!,
    serviceId: serviceId.value!,
    viewId: viewId.value!,
    title: title.value!,
    enabled: true,
    methods: routeMethodsFromManifest(manifestView?.methods)
  };
  if (manifestView?.path) route.targetPath = manifestView.path;
  const query = trimmedString(body, "query");
  if (query && renderable) route.query = query.replace(/^\?+/, "");
  return { route };
}

function countMenuRouteReferences(items: unknown, routeId: string): number {
  if (!Array.isArray(items)) return 0;
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const menuItem = item as { routeId?: unknown; children?: unknown };
    if (menuItem.routeId === routeId) count += 1;
    count += countMenuRouteReferences(menuItem.children, routeId);
  }
  return count;
}

function removeMenuRoutes(items: unknown, routeIds: Set<string>, serviceTitle?: string): unknown[] {
  if (!Array.isArray(items)) return [];
  const out: unknown[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const menuItem = item as Record<string, unknown>;
    if (typeof menuItem.routeId === "string" && routeIds.has(menuItem.routeId)) continue;
    const next: Record<string, unknown> = { ...menuItem };
    if (Array.isArray(menuItem.children)) {
      next.children = removeMenuRoutes(menuItem.children, routeIds, serviceTitle);
      if (
        next.type === "group"
        && typeof serviceTitle === "string"
        && next.title === serviceTitle
        && Array.isArray(next.children)
        && next.children.length === 0
      ) {
        continue;
      }
    }
    out.push(next);
  }
  return out;
}

function cleanupProvisionalTenantService(config: BetterPortalConfig, tenantId: string, serviceInstanceId: string): { removed: boolean; error?: string } {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  if (!tenant) return { removed: false, error: "Tenant not found" };
  const service = tenant.services.find((candidate) => candidate.id === serviceInstanceId);
  if (!service) return { removed: false };
  if (service.apiKeyHash) return { removed: false, error: "Service is already installed and cannot be cleaned up as provisional." };

  tenant.services = tenant.services.filter((candidate) => candidate.id !== serviceInstanceId);
  for (const appDef of config.apps.filter((candidate) => candidate.tenantId === tenantId)) {
    const routeIds = new Set(appDef.routes.filter((route) => route.serviceId === serviceInstanceId).map((route) => route.id));
    if (routeIds.size === 0) continue;
    appDef.routes = appDef.routes.filter((route) => route.serviceId !== serviceInstanceId);
    (appDef as unknown as { menu?: unknown }).menu = removeMenuRoutes(
      (appDef as unknown as { menu?: unknown }).menu,
      routeIds,
      service.title
    );
  }
  return { removed: true };
}

function addRouteDependencies(appDef: BetterPortalApp, route: BetterPortalRouteMount): void {
  const manifest = getManifestCache().get(route.serviceId);
  const view = manifest?.viewIndex[route.viewId];
  if (!manifest || !view) return;

  for (const dependencyViewId of view.dependencies) {
    const dependency = manifest.viewIndex[dependencyViewId];
    if (!dependency) continue;
    if (appDef.routes.some((candidate) => candidate.serviceId === route.serviceId && candidate.viewId === dependencyViewId)) continue;
    appDef.routes.push({
      id: uuidv7(),
      path: dependency.path,
      serviceId: route.serviceId,
      viewId: dependencyViewId,
      targetPath: dependency.path,
      title: dependency.viewId,
      enabled: true,
      methods: routeMethodsFromManifest(dependency.methods)
    });
  }
}

function validateRegisteredRouteService(config: BetterPortalConfig, appDef: BetterPortalApp, serviceId: string): string | undefined {
  const tenant = config.tenants.find((candidate) => candidate.id === appDef.tenantId);
  if (!tenant) return `App tenant not found: ${appDef.tenantId}`;

  if (tenant.services.some((service) => service.enabled && service.id === serviceId)) return undefined;

  const platformService = config.platformServices.find((service) => service.enabled && service.id === serviceId);
  if (platformService && tenant.activatedPlatformServices.includes(serviceId)) return undefined;

  const sharedActivation = config.sharedServiceActivations.find((activation) =>
    activation.enabled
    && activation.id === serviceId
    && activation.tenantId === appDef.tenantId
    && (!activation.appId || activation.appId === appDef.id)
  );
  if (sharedActivation) {
    const shared = config.sharedServiceCatalog.find((service) => service.enabled && service.id === sharedActivation.sharedServiceId);
    if (shared) return undefined;
  }

  return "Route service must be registered or activated for this app's tenant.";
}

function htmxAlert(message: string, kind: "danger" | "warning" | "success" = "danger"): Response {
  return htmlResponse(`<div class="alert alert-${kind}">${escapeHtml(message)}</div>`, 200, "text/html; mode=fragment");
}

function getParam(event: BetterPortalEvent, name: string): string | undefined {
  return (event as unknown as { context: { params?: Record<string, string> } }).context?.params?.[name];
}

function signConfigTicket(cpState: CpBootstrapState, input: {
  tenantId: string;
  serviceId: string;
  actions: Array<"config.read" | "config.write">;
  subject?: string;
}): string {
  // RS256 JWT signed with the CP key. Services verify it against the CP JWKS,
  // so there is no shared secret to leak and only the CP can mint tickets.
  return signServiceConfigTicket({
    privateKeyPem: cpState.keyPair.privateKeyPem,
    kid: cpState.keyPair.kid,
    issuer: cpState.issuer,
    tenantId: input.tenantId,
    serviceId: input.serviceId,
    actions: input.actions,
    subject: input.subject ?? "admin",
    expiresInSeconds: CONFIG_TICKET_TTL_SECONDS
  });
}

function findRegisteredService(config: any, tenantId: string, hostname: string, serviceInstanceId?: string): { id?: string; serviceId?: string; hostname?: string; title?: string; capabilities?: string[] } | null {
  if (serviceInstanceId) {
    const tenant = (config.tenants ?? []).find((t: any) => t.id === tenantId);
    const tenantService = (tenant?.services ?? []).find((svc: any) => svc.id === serviceInstanceId);
    if (tenantService) return tenantService;
    const platformService = (config.platformServices ?? []).find((svc: any) => svc.id === serviceInstanceId);
    if (platformService) return platformService;
    const sharedActivation = (config.sharedServiceActivations ?? []).find((activation: any) =>
      activation.enabled
      && activation.tenantId === tenantId
      && activation.id === serviceInstanceId
    );
    if (sharedActivation) {
      const shared = (config.sharedServiceCatalog ?? []).find((svc: any) =>
        svc.enabled
        && svc.id === sharedActivation.sharedServiceId
      );
      if (shared) {
        return {
          id: sharedActivation.id,
          serviceId: shared.serviceId ?? shared.id,
          hostname: shared.baseUrl,
          title: shared.title,
          capabilities: shared.tags ?? []
        };
      }
    }
    return null;
  }

  const normalizedHostname = hostname.replace(/\/+$/, "");
  const tenant = (config.tenants ?? []).find((t: any) => t.id === tenantId);
  const tenantService = (tenant?.services ?? []).find((svc: any) => (svc.hostname ?? "").replace(/\/+$/, "") === normalizedHostname);
  if (tenantService) return tenantService;
  const platformService = (config.platformServices ?? []).find((svc: any) => (svc.hostname ?? "").replace(/\/+$/, "") === normalizedHostname);
  if (platformService) return platformService;
  const sharedActivations = (config.sharedServiceActivations ?? []).filter((activation: any) =>
    activation.enabled
    && activation.tenantId === tenantId
  );
  for (const sharedActivation of sharedActivations) {
    const shared = (config.sharedServiceCatalog ?? []).find((svc: any) =>
      svc.enabled
      && svc.id === sharedActivation.sharedServiceId
      && (svc.baseUrl ?? "").replace(/\/+$/, "") === normalizedHostname
    );
    if (shared) {
      return {
        id: sharedActivation.id,
        serviceId: shared.serviceId ?? shared.id,
        hostname: shared.baseUrl,
        title: shared.title,
        capabilities: shared.tags ?? []
      };
    }
  }
  return null;
}

function normalizeHostname(hostname: string | undefined): string {
  return (hostname ?? "").replace(/\/+$/, "");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function deploymentModes(value: unknown): DeploymentMode[] {
  const allowed = new Set<DeploymentMode>(["bp-hosted", "customer-hosted", "third-party-saas", "self-hosted", "saas-managed"]);
  return stringArray(value).filter((entry): entry is DeploymentMode => allowed.has(entry as DeploymentMode));
}

function duplicateTenantService(
  tenant: { services: Array<{ hostname: string; serviceId?: string }> },
  hostname: string,
  serviceId?: string
): string | null {
  const normalized = normalizeHostname(hostname);
  const sameHost = tenant.services.find((service) => normalizeHostname(service.hostname) === normalized);
  if (sameHost) return `Service URL is already registered for this tenant: ${normalized}`;

  if (serviceId) {
    const samePlugin = tenant.services.find((service) => service.serviceId === serviceId);
    if (samePlugin) return `Service plugin is already registered for this tenant: ${serviceId}`;
  }

  return null;
}

function collectServiceDeleteBlockers(config: BetterPortalConfig, tenantId: string, serviceId: string): string[] {
  const blockers: string[] = [];
  const apps = config.apps.filter((app) => app.tenantId === tenantId);
  const add = (app: BetterPortalApp, label: string, id: string) => {
    blockers.push(`${app.title || app.id}: ${label} ${id}`);
  };

  for (const app of apps) {
    if (app.shell?.serviceId === serviceId) add(app, "shell", serviceId);
    for (const route of app.routes) {
      if (route.serviceId === serviceId) add(app, "route", route.title ?? route.path ?? route.id);
    }
    for (const slot of app.slots) {
      if (slot.serviceId === serviceId) add(app, "slot", slot.slotId);
    }
    for (const [location, fragments] of Object.entries(app.fragments)) {
      for (const fragment of fragments) {
        if (fragment.serviceId === serviceId) add(app, "fragment", `${location}.${fragment.fragmentId}`);
      }
    }
    if (app.auth?.serviceId === serviceId) add(app, "auth provider", serviceId);
    for (const role of app.auth?.roles ?? []) {
      for (const grant of role.permissions) {
        if (grant.serviceId === serviceId) add(app, "role grant", `${role.id}:${grant.viewId}`);
      }
    }
  }

  return blockers;
}

function sharedServiceIdFor(service: TenantServiceRegistration, requested?: string): string {
  return (requested && requested.trim()) || service.serviceId || service.id;
}

function collectServiceReferences(config: BetterPortalConfig, tenantId: string, serviceId: string, appId?: string): string[] {
  const refs: string[] = [];
  const apps = config.apps.filter((app) => app.tenantId === tenantId && (!appId || app.id === appId));
  for (const app of apps) {
    const add = (kind: string, label: string): void => {
      refs.push(`${app.title ?? app.id}: ${kind} ${label}`);
    };
    if (app.shell?.serviceId === serviceId) add("shell", serviceId);
    if (app.auth?.serviceId === serviceId) add("auth provider", serviceId);
    for (const route of app.routes) {
      if (route.serviceId === serviceId) add("route", route.title ?? route.path ?? route.id);
    }
    for (const slot of app.slots) {
      if (slot.serviceId === serviceId) add("slot", slot.slotId);
    }
    for (const [location, fragments] of Object.entries(app.fragments)) {
      for (const fragment of fragments) {
        if (fragment.serviceId === serviceId) add("fragment", `${location}.${fragment.fragmentId}`);
      }
    }
    for (const role of app.auth?.roles ?? []) {
      for (const grant of role.permissions) {
        if (grant.serviceId === serviceId) add("role grant", `${role.id}:${grant.viewId}`);
      }
    }
  }
  return refs;
}

function rewriteServiceReferences(config: BetterPortalConfig, tenantId: string, fromServiceId: string, toServiceId: string, appId?: string): number {
  let count = 0;
  const apps = config.apps.filter((app) => app.tenantId === tenantId && (!appId || app.id === appId));
  const rewrite = (current: string): string => {
    if (current !== fromServiceId) return current;
    count += 1;
    return toServiceId;
  };
  for (const app of apps) {
    if (app.shell) app.shell.serviceId = rewrite(app.shell.serviceId);
    if (app.auth) app.auth.serviceId = rewrite(app.auth.serviceId);
    for (const route of app.routes) route.serviceId = rewrite(route.serviceId);
    for (const slot of app.slots) slot.serviceId = rewrite(slot.serviceId);
    for (const fragments of Object.values(app.fragments)) {
      for (const fragment of fragments) fragment.serviceId = rewrite(fragment.serviceId);
    }
    for (const role of app.auth?.roles ?? []) {
      for (const grant of role.permissions) grant.serviceId = rewrite(grant.serviceId);
    }
  }
  return count;
}

function previewTenantServiceSharedMigration(
  config: BetterPortalConfig,
  tenantId: string,
  serviceId: string,
  options: { appId?: string; sharedServiceId?: string } = {}
): {
  tenant?: BetterPortalConfig["tenants"][number];
  service?: TenantServiceRegistration;
  sharedServiceId?: string;
  references: string[];
  blockers: string[];
} {
  const tenant = config.tenants.find((candidate) => candidate.id === tenantId);
  const service = tenant?.services.find((candidate) => candidate.id === serviceId);
  const blockers: string[] = [];

  if (!tenant) blockers.push(`Tenant not found: ${tenantId}`);
  if (!service) blockers.push(`Tenant service not found: ${serviceId}`);
  if (service && !service.serviceId) blockers.push("Service is not linked to a BetterPortal plugin id.");
  if (service && !service.hostname) blockers.push("Service has no hostname.");
  if (service && service.serviceId === "service.betterportal.config-manager") {
    blockers.push("Config Manager is the control plane service and cannot be converted to shared by this migration.");
  }
  if (options.appId && !config.apps.some((app) => app.id === options.appId && app.tenantId === tenantId)) {
    blockers.push(`App ${options.appId} does not belong to tenant ${tenantId}.`);
  }

  const sharedServiceId = service ? sharedServiceIdFor(service, options.sharedServiceId) : undefined;
  if (sharedServiceId) {
    const existing = config.sharedServiceCatalog.find((candidate) => candidate.id === sharedServiceId);
    if (existing?.serviceId && service?.serviceId && existing.serviceId !== service.serviceId) {
      blockers.push(`Shared service ${sharedServiceId} is linked to plugin ${existing.serviceId}, not ${service.serviceId}.`);
    }
  }

  const references = service ? collectServiceReferences(config, tenantId, service.id, options.appId) : [];
  if (service && references.length === 0) {
    blockers.push("No app references were found to migrate.");
  }

  return { tenant, service, sharedServiceId, references, blockers };
}

function migrateTenantServiceToShared(
  config: BetterPortalConfig,
  tenantId: string,
  serviceId: string,
  options: { appId?: string; sharedServiceId?: string; removeTenantService?: boolean } = {}
): {
  sharedServiceId: string;
  activationId: string;
  rewrittenReferences: number;
  reusedCatalog: boolean;
  removedTenantService: boolean;
} {
  const preview = previewTenantServiceSharedMigration(config, tenantId, serviceId, options);
  if (preview.blockers.length > 0 || !preview.tenant || !preview.service || !preview.sharedServiceId) {
    throw new Error(preview.blockers.join("\n") || "Service cannot be migrated.");
  }

  const { tenant, service } = preview;
  const sharedServiceId = preview.sharedServiceId;
  const now = new Date().toISOString();
  let reusedCatalog = true;
  let shared = config.sharedServiceCatalog.find((candidate) => candidate.id === sharedServiceId);
  if (!shared) {
    reusedCatalog = false;
    shared = {
      id: sharedServiceId,
      serviceId: service.serviceId,
      title: service.title ?? service.serviceId ?? service.hostname,
      description: service.description,
      baseUrl: service.hostname,
      apiKeyHash: service.apiKeyHash,
      publicKeyPem: service.publicKeyPem,
      keyId: service.keyId,
      supportedDeploymentModes: [service.deploymentMode],
      owner: "bp",
      category: service.capabilities.includes("auth") ? "auth" : service.capabilities.includes("theme") ? "theme" : undefined,
      tags: [...new Set(service.capabilities)],
      enabled: true
    };
    config.sharedServiceCatalog.push(shared);
  } else {
    shared.serviceId = shared.serviceId ?? service.serviceId;
    shared.baseUrl = service.hostname;
    shared.apiKeyHash = service.apiKeyHash || shared.apiKeyHash;
    shared.publicKeyPem = service.publicKeyPem ?? shared.publicKeyPem;
    shared.keyId = service.keyId ?? shared.keyId;
    shared.title = shared.title || service.title || service.serviceId || service.hostname;
    shared.description = shared.description ?? service.description;
    shared.supportedDeploymentModes = [...new Set([...(shared.supportedDeploymentModes ?? []), service.deploymentMode])];
    shared.tags = [...new Set([...(shared.tags ?? []), ...service.capabilities])];
    shared.enabled = true;
  }

  const existingActivation = config.sharedServiceActivations.find((activation) =>
    activation.sharedServiceId === sharedServiceId
    && activation.tenantId === tenantId
    && activation.appId === options.appId
  );
  const activationId = existingActivation?.id ?? uuidv7();
  if (existingActivation) {
    existingActivation.enabled = true;
    existingActivation.activatedAt = now;
  } else {
    config.sharedServiceActivations.push({
      id: activationId,
      tenantId,
      appId: options.appId,
      sharedServiceId,
      activatedAt: now,
      enabled: true
    });
  }

  const rewrittenReferences = rewriteServiceReferences(config, tenantId, service.id, activationId, options.appId);
  const shouldRemove = options.removeTenantService !== false && collectServiceReferences(config, tenantId, service.id).length === 0;
  if (shouldRemove) tenant.services = tenant.services.filter((candidate) => candidate.id !== service.id);

  return {
    sharedServiceId,
    activationId,
    rewrittenReferences,
    reusedCatalog,
    removedTenantService: shouldRemove
  };
}

function linkedServiceError(blockers: string[]): string {
  return `Service is still linked and cannot be deleted. Remove these references first: ${blockers.slice(0, 8).join("; ")}${blockers.length > 8 ? `; and ${blockers.length - 8} more` : ""}`;
}

type WizardServiceManifest = {
  pluginId?: string;
  title?: string;
  version?: string;
  views?: unknown[];
};

function parseWizardManifest(raw: string): WizardServiceManifest {
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as WizardServiceManifest
    : {};
}

function adminApiBaseFromEvent(event: BetterPortalEvent): string {
  const requestUrl = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
  return new URL(API_BASE, requestUrl).toString().replace(/\/+$/, "");
}

export function registerAdminApiRoutes(
  app: BetterPortalH3App,
  store: PlatformConfigStore,
  cpState: CpBootstrapState
): void {
  app.get("/.well-known/bp/management", async (event) => {
    const config = await store.loadConfig();
    return jsonResponse(managementDiscovery(config, event));
  });

  app.get("/.well-known/bp/automation/catalog", async (event) => {
    const url = new URL(event.req.url, `http://${event.req.headers.get("host") ?? "localhost"}`);
    const tenantUrl = url.searchParams.get("tenantUrl") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const config = await store.loadConfig();
    const appDef = appId
      ? config.apps.find((entry) => entry.id === appId)
      : config.apps.find((entry) => tenantUrl && appMatchesTenantUrl(entry, tenantUrl));
    if (!appDef) return jsonResponse({ error: "Unable to resolve BetterPortal app from tenantUrl/appId" }, 404);
    return jsonResponse(automationServiceCatalog(config, appDef));
  });

  app.get("/.well-known/bp/manage/current", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const tenant = config.tenants.find((entry) => entry.id === appDef.tenantId);
    return jsonResponse({
      protocol: "betterportal-manage.v1",
      scope: "app",
      tenant: tenant ? { id: tenant.id, title: tenant.title } : undefined,
      app: { id: appDef.id, tenantId: appDef.tenantId, title: appDef.title, hostnames: appDef.hostnames },
      idsVisible: true,
      platformAdmin: {
        usage: "operator-only",
        aiPolicy: "do-not-use-for-user-tasks"
      },
      links: {
        services: "/.well-known/bp/manage/services",
        routes: "/.well-known/bp/manage/routes",
        fragments: "/.well-known/bp/manage/fragments",
        theme: "/.well-known/bp/manage/theme",
        webhooks: "/.well-known/bp/manage/webhooks/targets"
      }
    } as JsonValue);
  });

  app.get("/.well-known/bp/manage/services", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    return jsonResponse(automationServiceCatalog(config, appDef));
  });

  app.post("/.well-known/bp/manage/services/activate", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const body = await readFormOrJsonBody(event);
    const sharedServiceId = trimmedString(body, "sharedServiceId");
    if (!sharedServiceId) return jsonResponse({ error: "sharedServiceId is required" }, 400);
    const shared = config.sharedServiceCatalog.find((entry) => entry.id === sharedServiceId && entry.enabled);
    if (!shared) return jsonResponse({ error: "Shared service not found or disabled" }, 404);
    let activation = config.sharedServiceActivations.find((entry) =>
      entry.sharedServiceId === sharedServiceId && entry.tenantId === appDef.tenantId && entry.appId === appDef.id
    );
    if (!activation) {
      activation = {
        id: uuidv7(),
        tenantId: appDef.tenantId,
        appId: appDef.id,
        sharedServiceId,
        activatedAt: new Date().toISOString(),
        enabled: true
      };
      config.sharedServiceActivations.push(activation);
      await store.saveConfig(config);
    }
    return jsonResponse({ ok: true, activation } as JsonValue, 201);
  });

  app.get("/.well-known/bp/manage/routes", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    return jsonResponse({ appId: appDef.id, routes: appDef.routes } as unknown as JsonValue);
  });

  app.post("/.well-known/bp/manage/routes", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const body = await readFormOrJsonBody(event);
    const parsed = parseRouteCreateBody(body);
    if (parsed.error || !parsed.route) return validationError(event, parsed.error ?? "Invalid route");
    const route = { id: uuidv7(), ...parsed.route };
    appDef.routes.push(route);
    addRouteDependencies(appDef, route);
    await store.saveConfig(config);
    return jsonResponse({ ok: true } as JsonValue, 201);
  });

  app.get("/.well-known/bp/manage/fragments", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    return jsonResponse({ appId: appDef.id, fragments: appDef.fragments } as unknown as JsonValue);
  });

  app.get("/.well-known/bp/manage/theme", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    return jsonResponse({ appId: appDef.id, themeConfig: appDef.themeConfig } as unknown as JsonValue);
  });

  app.post("/.well-known/bp/manage/theme", async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const body = await readFormOrJsonBody(event);
    const mode = body.mode === "light" || body.mode === "dark" || body.mode === "system"
      ? body.mode
      : undefined;
    appDef.themeConfig = {
      ...appDef.themeConfig,
      ...(mode ? { mode } : {}),
      bootstrap: {
        ...(appDef.themeConfig.bootstrap ?? {}),
        ...Object.fromEntries(["primary", "secondary", "success", "info", "warning", "danger"].flatMap((key) =>
          typeof body[key] === "string" ? [[key, body[key]]] : []
        ))
      }
    };
    await store.saveConfig(config);
    return jsonResponse({ ok: true, themeConfig: appDef.themeConfig } as unknown as JsonValue);
  });

  // Platform services (marketplace)

  app.get(`${API_BASE}/platform-services`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config.platformServices.map((s) => ({
      id: s.id, hostname: s.hostname, serviceId: s.serviceId, capabilities: s.capabilities,
      title: s.title, description: s.description, enabled: s.enabled, createdAt: s.createdAt
    })) as JsonValue);
  });

  app.post(`${API_BASE}/platform-services`, async (event) => {
    const body = await readJsonBody(event);
    const hostname = body.hostname as string;
    const title = (body.title as string) || hostname;
    if (!hostname) return jsonResponse({ error: "hostname is required" }, 400);

    const config = await store.loadConfig();
    const apiKey = generateApiKey();
    const service: PlatformService = {
      id: uuidv7(),
      hostname,
      apiKeyHash: hashApiKey(apiKey),
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((value): value is string => typeof value === "string") : [],
      title,
      description: (body.description as string) || undefined,
      createdAt: new Date().toISOString(),
      enabled: true
    };

    config.platformServices.push(service);
    await store.saveConfig(config);
    return jsonResponse({ id: service.id, hostname, apiKey, title } as JsonValue, 201);
  });

  app.post(`${API_BASE}/shared-services`, async (event) => {
    const body = await readFormOrJsonBody(event);
    const manifest = objectValue(body.manifest);
    const manifestPluginId = typeof manifest?.pluginId === "string" ? manifest.pluginId.trim() : "";
    const manifestTitle = typeof manifest?.title === "string" ? manifest.title.trim() : "";
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : manifestPluginId;
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : manifestTitle;
    const baseUrl = typeof body.baseUrl === "string" ? normalizeHostname(body.baseUrl.trim()) : "";
    if (!id || !title || !baseUrl) {
      return wantsHtmx(event) ? htmxError("baseUrl and a valid service manifest are required") : jsonResponse({ error: "baseUrl and a valid service manifest are required" }, 400);
    }

    const config = await store.loadConfig();
    if (config.sharedServiceCatalog.some((service) => service.id === id)) {
      return wantsHtmx(event) ? htmxError(`Shared service already exists: ${id}`, 409) : jsonResponse({ error: `Shared service already exists: ${id}` }, 409);
    }

    const explicitTags = typeof body.tags === "string"
      ? body.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : stringArray(body.tags);
    const capabilities = stringArray(manifest?.capabilities);
    const supportedThemes = stringArray(manifest?.supportedThemes).map((theme) => `theme.${theme}`);
    const tags = [...new Set([...explicitTags, ...capabilities, ...supportedThemes])];
    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : typeof manifest?.category === "string" && manifest.category.trim()
        ? manifest.category.trim()
        : undefined;
    const supportedDeploymentModes = deploymentModes(manifest?.deploymentModes);
    config.sharedServiceCatalog.push({
      id,
      serviceId: manifestPluginId || id,
      title,
      baseUrl,
      apiKeyHash: "",
      description: typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : typeof manifest?.description === "string" && manifest.description.trim()
          ? manifest.description.trim()
          : undefined,
      category,
      tags,
      owner: body.owner === "3p" ? "3p" : "bp",
      supportedDeploymentModes: supportedDeploymentModes.length > 0 ? supportedDeploymentModes : ["bp-hosted"],
      enabled: !(body.enabled === "false" || body.enabled === false)
    });
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload("/services");
    return jsonResponse({ ok: true, id, title, baseUrl }, 201);
  });

  app.put(`${API_BASE}/shared-services/:sharedServiceId`, async (event) => {
    const sharedServiceId = getParam(event, "sharedServiceId");
    if (!sharedServiceId) return jsonResponse({ error: "sharedServiceId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const config = await store.loadConfig();
    const service = config.sharedServiceCatalog.find((candidate) => candidate.id === sharedServiceId);
    if (!service) return wantsHtmx(event) ? htmxError("Shared service not found", 404) : jsonResponse({ error: "Shared service not found" }, 404);

    if (typeof body.title === "string" && body.title.trim()) service.title = body.title.trim();
    if (typeof body.baseUrl === "string" && body.baseUrl.trim()) service.baseUrl = normalizeHostname(body.baseUrl.trim());
    if (typeof body.description === "string") service.description = body.description.trim() || undefined;
    if (typeof body.category === "string") service.category = body.category.trim() || undefined;
    if (typeof body.tags === "string") service.tags = body.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (body.owner === "bp" || body.owner === "3p") service.owner = body.owner;
    if (body.enabled === "true" || body.enabled === true) service.enabled = true;
    if (body.enabled === "false" || body.enabled === false) service.enabled = false;
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload("/services");
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/shared-services/:sharedServiceId`, async (event) => {
    const sharedServiceId = getParam(event, "sharedServiceId");
    if (!sharedServiceId) return jsonResponse({ error: "sharedServiceId required" }, 400);
    const config = await store.loadConfig();
    const activations = config.sharedServiceActivations.filter((activation) => activation.sharedServiceId === sharedServiceId && activation.enabled);
    if (activations.length > 0) {
      const message = `Shared service is activated for ${activations.length} tenant/app binding(s). Deactivate it before deleting.`;
      return wantsHtmx(event) ? htmxError(message, 409) : jsonResponse({ error: message }, 409);
    }
    const before = config.sharedServiceCatalog.length;
    config.sharedServiceCatalog = config.sharedServiceCatalog.filter((service) => service.id !== sharedServiceId);
    if (config.sharedServiceCatalog.length === before) {
      return wantsHtmx(event) ? htmxError("Shared service not found", 404) : jsonResponse({ error: "Shared service not found" }, 404);
    }
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload("/services");
    return jsonResponse({ ok: true });
  });

  app.post(`${API_BASE}/shared-services/:sharedServiceId/activations`, async (event) => {
    const sharedServiceId = getParam(event, "sharedServiceId");
    if (!sharedServiceId) return jsonResponse({ error: "sharedServiceId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const appId = typeof body.appId === "string" && body.appId ? body.appId : undefined;
    if (!tenantId) return wantsHtmx(event) ? htmxError("tenantId required") : jsonResponse({ error: "tenantId required" }, 400);

    const config = await store.loadConfig();
    const service = config.sharedServiceCatalog.find((candidate) => candidate.id === sharedServiceId && candidate.enabled);
    if (!service) return wantsHtmx(event) ? htmxError("Shared service not found or disabled", 404) : jsonResponse({ error: "Shared service not found or disabled" }, 404);
    if (!config.tenants.some((tenant) => tenant.id === tenantId)) {
      return wantsHtmx(event) ? htmxError("Tenant not found", 404) : jsonResponse({ error: "Tenant not found" }, 404);
    }
    if (appId && !config.apps.some((candidate) => candidate.id === appId && candidate.tenantId === tenantId)) {
      return wantsHtmx(event) ? htmxError("App not found for tenant", 404) : jsonResponse({ error: "App not found for tenant" }, 404);
    }
    const existing = config.sharedServiceActivations.find((activation) =>
      activation.sharedServiceId === sharedServiceId
      && activation.tenantId === tenantId
      && activation.appId === appId
    );
    if (existing) {
      existing.enabled = true;
      existing.activatedAt = new Date().toISOString();
    } else {
      config.sharedServiceActivations.push({
        id: uuidv7(),
        tenantId,
        appId,
        sharedServiceId,
        activatedAt: new Date().toISOString(),
        enabled: true
      });
    }
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/services?tenantId=${encodeURIComponent(tenantId)}`);
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/shared-services/:sharedServiceId/activations`, async (event) => {
    const sharedServiceId = getParam(event, "sharedServiceId");
    if (!sharedServiceId) return jsonResponse({ error: "sharedServiceId required" }, 400);
    const url = new URL(event.req.url ?? "", "http://localhost");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? undefined;
    if (!tenantId) return wantsHtmx(event) ? htmxError("tenantId required") : jsonResponse({ error: "tenantId required" }, 400);

    const config = await store.loadConfig();
    config.sharedServiceActivations = config.sharedServiceActivations.filter((activation) =>
      !(activation.sharedServiceId === sharedServiceId && activation.tenantId === tenantId && activation.appId === appId)
    );
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/services?tenantId=${encodeURIComponent(tenantId)}`);
    return jsonResponse({ ok: true });
  });

  // Tenants
  app.get(`${API_BASE}/tenants/:tenantId/services`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    if (!tenantId) return jsonResponse({ error: "tenantId required" }, 400);
    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    return jsonResponse(tenant.services.map((s) => ({
      id: s.id, hostname: s.hostname, serviceId: s.serviceId,
      title: s.title, enabled: s.enabled, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt
    })) as JsonValue);
  });

  app.post(`${API_BASE}/tenants/:tenantId/services`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    if (!tenantId) return jsonResponse({ error: "tenantId required" }, 400);
    const body = await readJsonBody(event);
    const hostname = body.hostname as string;
    if (!hostname) return jsonResponse({ error: "hostname is required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);
    const postedServiceId = typeof body.serviceId === "string" && body.serviceId.length > 0 ? body.serviceId : undefined;
    const duplicate = duplicateTenantService(tenant, hostname, postedServiceId);
    if (duplicate) return jsonResponse({ error: duplicate }, 409);

    const apiKey = generateApiKey();
    const service: TenantServiceRegistration = {
      id: uuidv7(),
      hostname: normalizeHostname(hostname),
      apiKeyHash: hashApiKey(apiKey),
      title: (body.title as string) || undefined,
      serviceId: postedServiceId,
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((value): value is string => typeof value === "string") : [],
      description: typeof body.description === "string" && body.description.length > 0 ? body.description : undefined,
      deploymentMode: "self-hosted",
      createdAt: new Date().toISOString(),
      enabled: true
    };

    tenant.services.push(service);
    await store.saveConfig(config);
    return jsonResponse({ id: service.id, hostname: service.hostname, serviceId: service.serviceId, apiKey } as JsonValue, 201);
  });

  app.delete(`${API_BASE}/tenants/:tenantId/services/:serviceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const serviceId = getParam(event, "serviceId");
    if (!tenantId || !serviceId) return jsonResponse({ error: "tenantId and serviceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);
    const blockers = collectServiceDeleteBlockers(config, tenantId, serviceId);
    if (blockers.length > 0) {
      const message = linkedServiceError(blockers);
      return wantsHtmx(event) ? htmxError(message, 409) : jsonResponse({ error: message, blockers }, 409);
    }

    tenant.services = tenant.services.filter((s) => s.id !== serviceId);
    await store.saveConfig(config);
    const accept = event.req.headers.get("accept") ?? "";
    if (accept.includes("text/html") || event.req.headers.get("hx-request")) {
      return htmlResponse("", 200, "text/html; mode=fragment", {
        "HX-Location": JSON.stringify({ path: "/services", target: "#bp-main", swap: "innerHTML" })
      });
    }
    return jsonResponse({ ok: true });
  });

  // Activate/deactivate platform services for tenant

  app.get(`${API_BASE}/tenants/:tenantId/services/:serviceId/migrate-to-shared/preview`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const serviceId = getParam(event, "serviceId");
    if (!tenantId || !serviceId) return jsonResponse({ error: "tenantId and serviceId required" }, 400);

    const url = new URL(event.req.url ?? "", "http://localhost");
    const appId = url.searchParams.get("appId") ?? undefined;
    const sharedServiceId = url.searchParams.get("sharedServiceId") ?? undefined;
    const config = await store.loadConfig();
    const preview = previewTenantServiceSharedMigration(config, tenantId, serviceId, { appId, sharedServiceId });

    return jsonResponse({
      ok: preview.blockers.length === 0,
      tenantId,
      serviceId,
      sharedServiceId: preview.sharedServiceId,
      title: preview.service?.title ?? preview.service?.serviceId ?? preview.service?.hostname,
      pluginId: preview.service?.serviceId,
      hostname: preview.service?.hostname,
      references: preview.references,
      blockers: preview.blockers
    } as JsonValue);
  });

  app.post(`${API_BASE}/tenants/:tenantId/services/:serviceId/migrate-to-shared`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const serviceId = getParam(event, "serviceId");
    if (!tenantId || !serviceId) return jsonResponse({ error: "tenantId and serviceId required" }, 400);

    const body = await readFormOrJsonBody(event);
    const appId = typeof body.appId === "string" && body.appId.length > 0 ? body.appId : undefined;
    const sharedServiceId = typeof body.sharedServiceId === "string" && body.sharedServiceId.length > 0 ? body.sharedServiceId : undefined;
    const removeTenantService = body.removeTenantService === undefined
      ? true
      : body.removeTenantService === true || body.removeTenantService === "true";

    const config = await store.loadConfig();
    const preview = previewTenantServiceSharedMigration(config, tenantId, serviceId, { appId, sharedServiceId });
    if (preview.blockers.length > 0) {
      const message = preview.blockers.join("\n");
      return wantsHtmx(event) ? htmxError(message, 409) : jsonResponse({ error: message, blockers: preview.blockers }, 409);
    }

    let result: ReturnType<typeof migrateTenantServiceToShared>;
    try {
      result = migrateTenantServiceToShared(config, tenantId, serviceId, { appId, sharedServiceId, removeTenantService });
      await store.saveConfig(config);
    } catch (err) {
      return wantsHtmx(event)
        ? htmxError((err as Error).message, 409)
        : jsonResponse({ error: (err as Error).message }, 409);
    }

    if (wantsHtmx(event)) return htmxReload(`/services?tenantId=${encodeURIComponent(tenantId)}`);
    return jsonResponse({ ok: true, ...result } as JsonValue);
  });

  app.post(`${API_BASE}/tenants/:tenantId/activate/:platformServiceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const psId = getParam(event, "platformServiceId");
    if (!tenantId || !psId) return jsonResponse({ error: "tenantId and platformServiceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    if (!tenant.activatedPlatformServices.includes(psId)) {
      tenant.activatedPlatformServices.push(psId);
      await store.saveConfig(config);
    }
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/tenants/:tenantId/activate/:platformServiceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const psId = getParam(event, "platformServiceId");
    if (!tenantId || !psId) return jsonResponse({ error: "tenantId and platformServiceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    tenant.activatedPlatformServices = tenant.activatedPlatformServices.filter((id) => id !== psId);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // Apps
  app.post(`${API_BASE}/apps/:id/theme-config/bootstrap1`, async (event) => {
    const id = getParam(event, "id");
    if (!id) return htmlResponse(`<div class="alert alert-danger">app id required</div>`, 200, "text/html; mode=fragment");

    const form = await readFormBody(event);
    const tenantId = form.tenantId ?? "";
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === id);
    if (!appDef) return htmlResponse(`<div class="alert alert-danger">App not found</div>`, 200, "text/html; mode=fragment");
    if (tenantId && appDef.tenantId !== tenantId) {
      return htmlResponse(`<div class="alert alert-danger">App does not belong to tenant</div>`, 200, "text/html; mode=fragment");
    }

    const key = form.resetKey;
    const nextThemeConfig: BetterPortalThemeConfig = {
      ...appDef.themeConfig,
      bootstrap: { ...appDef.themeConfig.bootstrap },
      light: { ...appDef.themeConfig.light },
      dark: { ...appDef.themeConfig.dark }
    };

    if (key) {
      if (key === "brandName" || key === "mode") {
        delete (nextThemeConfig as Record<string, unknown>)[key];
      } else if (key in nextThemeConfig.bootstrap) {
        delete (nextThemeConfig.bootstrap as Record<string, unknown>)[key];
      }
    } else {
      if (form.brandName !== undefined) nextThemeConfig.brandName = form.brandName;
      if (form.mode === "light" || form.mode === "dark" || form.mode === "system") nextThemeConfig.mode = form.mode;
      for (const colorKey of ["primary", "secondary", "success", "info", "warning", "danger"] as const) {
        const colorValue = form[colorKey];
        if (colorValue) nextThemeConfig.bootstrap[colorKey] = colorValue;
      }
    }

    appDef.themeConfig = nextThemeConfig;
    await store.saveConfig(config);
    return htmlResponse(
      `<div id="bp-theme-save-status" class="alert alert-success py-2 mb-0">Saved</div>`,
      200,
      "text/html; mode=fragment",
      { "HX-Trigger": "bp:theme-changed" }
    );
  });
  // Roles (per app.auth.roles)

  type AppAuthRoleEntry = {
    id: string;
    title: string;
    description?: string;
    permissions: Array<{
      serviceId: string;
      viewId: string;
      permissions: Array<"read" | "create" | "update" | "delete">;
    }>;
  };

  const getAppOr404 = async (appId: string) => {
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    return { config, appDef };
  };

  const requireAuthBlock = (
    event: BetterPortalEvent,
    appDef: { auth?: { roles?: AppAuthRoleEntry[] } }
  ): { auth?: { roles: AppAuthRoleEntry[] }; response?: Response } => {
    const withAuth = appDef as {
      auth?: {
        serviceId?: string;
        expectedIssuer?: string;
        expectedAudience?: string;
        jwksUri?: string;
        roles?: AppAuthRoleEntry[];
      };
    };
    const configured = Boolean(
      withAuth.auth?.serviceId
      && withAuth.auth.expectedIssuer
      && withAuth.auth.expectedAudience
      && withAuth.auth.jwksUri
    );
    if (!configured) {
      const message = "Configure an auth provider for this app before creating roles.";
      return {
        response: wantsHtmx(event)
          ? htmxError(message, 409)
          : jsonResponse({ error: message }, 409)
      };
    }
    withAuth.auth!.roles ??= [];
    return { auth: withAuth.auth as { roles: AppAuthRoleEntry[] } };
  };

  app.get(`${API_BASE}/apps/:appId/auth/roles`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const { appDef } = await getAppOr404(appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const auth = (appDef as { auth?: { roles?: AppAuthRoleEntry[] } }).auth;
    return jsonResponse((auth?.roles ?? []) as unknown as JsonValue);
  });

  app.post(`${API_BASE}/apps/:appId/auth/roles`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const title = body.title as string;
    if (!title) return wantsHtmx(event) ? htmxError("title required") : jsonResponse({ error: "title required" }, 400);
    const { config, appDef } = await getAppOr404(appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const authResult = requireAuthBlock(event, appDef);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;
    const role: AppAuthRoleEntry = {
      id: (body.id as string) || uuidv7(),
      title,
      description: body.description as string | undefined,
      permissions: Array.isArray(body.permissions) ? body.permissions as AppAuthRoleEntry["permissions"] : []
    };
    if (auth.roles.some((r) => r.id === role.id)) {
      return wantsHtmx(event) ? htmxError("role id already exists", 409) : jsonResponse({ error: "role id already exists" }, 409);
    }
    auth.roles.push(role);
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/auth?appId=${encodeURIComponent(appId)}`);
    return jsonResponse(role as unknown as JsonValue, 201);
  });

  app.put(`${API_BASE}/apps/:appId/auth/roles/:roleId`, async (event) => {
    const appId = getParam(event, "appId");
    const roleId = getParam(event, "roleId");
    if (!appId || !roleId) return jsonResponse({ error: "appId + roleId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const { config, appDef } = await getAppOr404(appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const authResult = requireAuthBlock(event, appDef);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;
    const role = auth.roles.find((r) => r.id === roleId);
    if (!role) return wantsHtmx(event) ? htmxError("Role not found", 404) : jsonResponse({ error: "Role not found" }, 404);
    if (typeof body.title === "string") role.title = body.title;
    if (typeof body.description === "string" || body.description === null) role.description = body.description ?? undefined;
    if (Array.isArray(body.permissions)) {
      role.permissions = body.permissions as AppAuthRoleEntry["permissions"];
    } else if (typeof body.grant === "string" || Array.isArray(body.grant)) {
      const grants = Array.isArray(body.grant) ? body.grant : [body.grant];
      const byView = new Map<string, AppAuthRoleEntry["permissions"][number]>();
      for (const grant of grants) {
        const [serviceId, viewId, action] = String(grant).split("|");
        if (!serviceId || !viewId || !["read", "create", "update", "delete"].includes(action)) continue;
        const key = `${serviceId}::${viewId}`;
        if (!byView.has(key)) byView.set(key, { serviceId, viewId, permissions: [] });
        byView.get(key)!.permissions.push(action as "read" | "create" | "update" | "delete");
      }
      role.permissions = Array.from(byView.values());
    }
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/auth?appId=${encodeURIComponent(appId)}`);
    return jsonResponse(role as unknown as JsonValue);
  });

  app.delete(`${API_BASE}/apps/:appId/auth/roles/:roleId`, async (event) => {
    const appId = getParam(event, "appId");
    const roleId = getParam(event, "roleId");
    if (!appId || !roleId) return jsonResponse({ error: "appId + roleId required" }, 400);
    const { config, appDef } = await getAppOr404(appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const authResult = requireAuthBlock(event, appDef);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;
    const before = auth.roles.length;
    auth.roles = auth.roles.filter((r) => r.id !== roleId);
    if (auth.roles.length === before) return wantsHtmx(event) ? htmxError("Role not found", 404) : jsonResponse({ error: "Role not found" }, 404);
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/auth?appId=${encodeURIComponent(appId)}`);
    return jsonResponse({ ok: true });
  });

  // Routes (per app)

  app.get(`${API_BASE}/apps/:appId/routes`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    return jsonResponse(appDef.routes as unknown as JsonValue);
  });

  app.post(`${API_BASE}/apps/:appId/routes`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const parsed = parseRouteCreateBody(body);
    if (parsed.error || !parsed.route) return validationError(event, parsed.error ?? "Invalid route.");
    const serviceError = validateRegisteredRouteService(config, appDef, parsed.route.serviceId);
    if (serviceError) return validationError(event, serviceError);
    const route: BetterPortalRouteMount = { ...parsed.route, id: uuidv7() };
    appDef.routes.push(route);
    addRouteDependencies(appDef, route);
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/routes?appId=${encodeURIComponent(appId)}`);
    return jsonResponse({ ok: true, id: route.id } as unknown as JsonValue, 201);
  });

  app.put(`${API_BASE}/apps/:appId/routes/:routeId`, async (event) => {
    const appId = getParam(event, "appId");
    const routeId = getParam(event, "routeId");
    if (!appId || !routeId) return jsonResponse({ error: "appId and routeId required" }, 400);
    const body = await readFormOrJsonBody(event);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const route = appDef.routes.find((r) => r.id === routeId);
    if (!route) return wantsHtmx(event) ? htmxError("Route not found", 404) : jsonResponse({ error: "Route not found" }, 404);

    if (body.path !== undefined) {
      const path = trimmedString(body, "path");
      if (!path) return validationError(event, "Mount path is required.");
      if (!path.startsWith("/")) return validationError(event, "Mount path must start with /.");
      route.path = path;
    }
    if (body.serviceId !== undefined) {
      const serviceId = trimmedString(body, "serviceId");
      if (!serviceId) return validationError(event, "Service is required.");
      const serviceError = validateRegisteredRouteService(config, appDef, serviceId);
      if (serviceError) return validationError(event, serviceError);
      route.serviceId = serviceId;
    }
    if (body.viewId !== undefined) {
      const viewId = trimmedString(body, "viewId");
      if (!viewId) return validationError(event, "View is required.");
      route.viewId = viewId;
    }
    const manifestView = getManifestCache().get(route.serviceId)?.viewIndex[route.viewId];
    if (manifestView) {
      route.methods = routeMethodsFromManifest(manifestView.methods);
      route.targetPath = manifestView.path;
      if (manifestView.renderable === false) {
        route.path = manifestView.path;
        route.title = manifestView.viewId;
        delete route.query;
      }
    }
    if (body.targetPath !== undefined) {
      const targetPath = trimmedString(body, "targetPath");
      if (targetPath) route.targetPath = targetPath;
      else delete route.targetPath;
    }
    if (body.query !== undefined) {
      const query = trimmedString(body, "query");
      if (query) route.query = query.replace(/^\?+/, "");
      else delete route.query;
    }
    if (body.title !== undefined) {
      const title = trimmedString(body, "title");
      if (!title) return validationError(event, "Display title is required.");
      route.title = title;
    }
    if (body.enabled !== undefined) route.enabled = body.enabled === true || body.enabled === "true" || body.enabled === "on";

    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/routes?appId=${encodeURIComponent(appId)}`);
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/apps/:appId/routes/:routeId`, async (event) => {
    const appId = getParam(event, "appId");
    const routeId = getParam(event, "routeId");
    if (!appId || !routeId) return jsonResponse({ error: "appId and routeId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return wantsHtmx(event) ? htmxError("App not found", 404) : jsonResponse({ error: "App not found" }, 404);
    const route = appDef.routes.find((r) => r.id === routeId);
    if (!route) return wantsHtmx(event) ? htmxAlert("Route not found.") : jsonResponse({ error: "Route not found" }, 404);
    const menuReferenceCount = countMenuRouteReferences((appDef as unknown as { menu?: unknown }).menu, routeId);
    if (menuReferenceCount > 0) {
      const message = `Cannot delete route "${route.title ?? route.path}" because ${menuReferenceCount} menu item${menuReferenceCount === 1 ? "" : "s"} reference it. Remove the menu reference first.`;
      return wantsHtmx(event) ? htmxAlert(message, "warning") : jsonResponse({ error: message }, 409);
    }
    appDef.routes = appDef.routes.filter((r) => r.id !== routeId);
    await store.saveConfig(config);
    if (wantsHtmx(event)) return htmxReload(`/routes?appId=${encodeURIComponent(appId)}`);
    return jsonResponse({ ok: true });
  });

  // Menu (per app)

  app.get(`${API_BASE}/apps/:appId/menu`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    return jsonResponse(((appDef as any).menu ?? []) as unknown as JsonValue);
  });

  app.put(`${API_BASE}/apps/:appId/menu`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const body = await readJsonBody(event);
    const items = Array.isArray(body.items) ? body.items : [];
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    (appDef as any).menu = items.map((m: any) => ({
      id: m.id ?? uuidv7(),
      type: m.type ?? "link",
      title: m.title,
      icon: m.icon,
      routeId: m.routeId,
      href: m.href,
      enabled: m.enabled !== false,
      children: m.children ?? []
    }));
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // Full config (read-only)

  app.get(`${API_BASE}/config`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config as unknown as JsonValue);
  });

  // HTMX wizard: verify service
  // Browser-mediated: the admin UI fetches the manifest from the service
  // (CM cannot reach services) and POSTs the parsed payload here.

  app.post(`${API_BASE}/wizard/verify`, async (event) => {
    const adminApiBase = adminApiBaseFromEvent(event);
    const form = await readFormBody(event);
    const tenantId = form.tenantId ?? "";
    const hostname = normalizeHostname(form.hostname);
    if (!tenantId || !hostname) {
      return htmlResponse(renderWizardStep1(await store.loadConfig(), "Tenant and hostname are required.", undefined, adminApiBase), 200, "text/html; mode=fragment");
    }

    let manifest: WizardServiceManifest;
    try {
      if (!form.manifest) throw new Error("Manifest was not provided by the browser.");
      manifest = parseWizardManifest(form.manifest);
    } catch (error) {
      const config = await store.loadConfig();
      const message = error instanceof Error ? error.message : "Manifest field is not valid JSON.";
      return htmlResponse(
        renderWizardStep1(config, message, { tenantId, hostname }, adminApiBase),
        200, "text/html; mode=fragment"
      );
    }
    if (!manifest.pluginId || !manifest.title) {
      const config = await store.loadConfig();
      return htmlResponse(renderWizardStep1(config, "Not a valid BetterPortal service manifest.", { tenantId, hostname }, adminApiBase), 200, "text/html; mode=fragment");
    }

    let schema = form.schema ?? "";
    if (!schema) {
      schema = JSON.stringify({ manifest, routes: [] });
    }

    return htmlResponse(renderWizardStep2({
      tenantId, hostname,
      pluginId: manifest.pluginId,
      version: manifest.version ?? "unknown",
      viewCount: Array.isArray(manifest.views) ? manifest.views.length : 0,
      title: manifest.title,
      schema,
      adminApiBase
    }), 200, "text/html; mode=fragment");
  });

  // HTMX wizard: register service

  app.post(`${API_BASE}/wizard/register`, async (event) => {
    const form = await readFormBody(event);
    const tenantId = form.tenantId ?? "";
    const hostname = (form.hostname ?? "").replace(/\/+$/, "");
    const title = form.title || hostname;
    if (!tenantId || !hostname) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or hostname</div>`, 200, "text/html; mode=fragment");
    }

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      return htmlResponse(`<div class="alert alert-danger">Tenant not found</div>`, 200, "text/html; mode=fragment");
    }

    // Schema is fetched by the browser from the service (CM cannot reach services)
    // and posted to us as a JSON string in form.schema.
    let serviceId: string | undefined;
    let capabilities: string[] = [];
    let serviceRoutes: Array<{ viewId: string; path: string }> = [];
    let viewMeta = new Map<string, string>();
    if (form.schema) {
      try {
        const schema = JSON.parse(form.schema) as {
          manifest?: { pluginId?: string; capabilities?: string[]; views?: Array<{ viewId: string; title: string }> };
          routes?: Array<{ viewId: string; path: string }>;
        };
        serviceId = schema.manifest?.pluginId;
        capabilities = Array.isArray(schema.manifest?.capabilities) ? schema.manifest.capabilities.filter((value): value is string => typeof value === "string") : [];
        serviceRoutes = schema.routes ?? [];
        viewMeta = new Map((schema.manifest?.views ?? []).map((v) => [v.viewId, v.title]));
      } catch { /* malformed schema - register without routes */ }
    }

    const duplicate = duplicateTenantService(tenant, hostname, serviceId);
    if (duplicate) {
      return htmlResponse(`<div class="alert alert-warning">${escapeHtml(duplicate)}</div>`, 200, "text/html; mode=fragment");
    }

    const newServiceId = uuidv7();
    const service: TenantServiceRegistration = {
      id: newServiceId,
      hostname,
      apiKeyHash: "",
      title,
      serviceId,
      capabilities,
      deploymentMode: "self-hosted",
      createdAt: new Date().toISOString(),
      enabled: true
    };
    tenant.services.push(service);

    // Auto-add routes + menu group to each app in tenant
    if (serviceRoutes.length > 0) {
      const tenantApps = config.apps.filter((a) => a.tenantId === tenantId);
      for (const appDef of tenantApps) {
        const groupId = uuidv7();
        const groupChildren: Array<{ id: string; type: string; title: string; routeId: string; enabled: boolean }> = [];
        const existingPaths = new Set(appDef.routes.map((r) => r.path));

        for (const r of serviceRoutes) {
          // Default mounting path is the service's own path; skip collisions
          const mountPath = existingPaths.has(r.path) ? `/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${r.path}` : r.path;
          if (existingPaths.has(mountPath)) continue;

          const routeId = uuidv7();
          const routeTitle = viewMeta.get(r.viewId) ?? r.viewId;
          appDef.routes.push({
            id: routeId,
            path: mountPath,
            serviceId: newServiceId,
            viewId: r.viewId,
            targetPath: r.path,
            title: routeTitle,
            enabled: true,
            methods: ["GET"]
          } as any);
          existingPaths.add(mountPath);
          groupChildren.push({
            id: uuidv7(),
            type: "link",
            title: routeTitle,
            routeId,
            enabled: true
          });
        }

        if (groupChildren.length > 0) {
          const menu = ((appDef as any).menu ?? []) as Array<Record<string, unknown>>;
          menu.push({
            id: groupId,
            type: "group",
            title,
            enabled: true,
            children: groupChildren
          });
          (appDef as any).menu = menu;
        }
      }
    }

    await store.saveConfig(config);
    const adminApiBase = adminApiBaseFromEvent(event);
    return htmlResponse(renderWizardStep3({
      apiKey: "",
      deploymentMode: service.deploymentMode,
      tenantId,
      serviceInstanceId: newServiceId,
      serviceUrl: hostname,
      title,
      adminApiBase
    }), 200, "text/html; mode=fragment");
  });

  app.post(`${API_BASE}/wizard/cleanup-provisional-service`, async (event) => {
    const body = await readJsonBody(event);
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const serviceInstanceId = typeof body.serviceInstanceId === "string" ? body.serviceInstanceId : "";
    if (!tenantId || !serviceInstanceId) {
      return jsonResponse({ error: "tenantId and serviceInstanceId are required" }, 400);
    }
    const config = await store.loadConfig();
    const result = cleanupProvisionalTenantService(config, tenantId, serviceInstanceId);
    if (result.error) return jsonResponse({ error: result.error }, 409);
    if (result.removed) await store.saveConfig(config);
    return jsonResponse({ ok: true, removed: result.removed } as JsonValue);
  });

  app.get(`${API_BASE}/wizard/step1`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const tenantId = url.searchParams.get("tenantId") ?? undefined;
    const hostname = url.searchParams.get("hostname") ?? undefined;
    const config = await store.loadConfig();
    return htmlResponse(renderWizardStep1(config, undefined, { tenantId, hostname }, adminApiBaseFromEvent(event)), 200, "text/html; mode=fragment");
  });

  // HTMX configure: load form

  app.get(`${API_BASE}/configure`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const serviceInstanceId = url.searchParams.get("serviceInstanceId") ?? undefined;
    const hostname = (url.searchParams.get("hostname") ?? "").replace(/\/+$/, "");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const serviceTitle = url.searchParams.get("title") ?? "Service";
    const adminApiBase = url.searchParams.get("adminApiBase") || new URL(API_BASE, url).toString();
    if (!hostname || !tenantId) {
      return htmlResponse(`<div class="alert alert-danger">Missing hostname or tenantId</div>`, 200, "text/html; mode=fragment");
    }

    const config = await store.loadConfig();
    const service = findRegisteredService(config, tenantId, hostname, serviceInstanceId);
    if (!service?.serviceId) {
      return htmlResponse(`<div class="alert alert-danger">Service is not linked to a BetterPortal service id yet. Re-register or sync the service first.</div>`, 200, "text/html; mode=fragment");
    }

    const tenantApps = config.apps
      .filter((a) => a.tenantId === tenantId)
      .map((a) => ({
        id: a.id,
        title: a.title,
        routes: a.routes
          .filter((route) => route.enabled)
          .map((route) => ({ path: route.path, title: route.title || route.path }))
      }));

    return htmlResponse(renderConfigClientShell({
      hostname,
      tenantId,
      appId,
      serviceInstanceId,
      serviceId: service.serviceId,
      serviceTitle,
      adminApiBase,
      tenantApps
    }), 200, "text/html; mode=fragment");
  });

  // HTMX configure: save

  app.post(`${API_BASE}/config-ticket`, async (event) => {
    const body = await readJsonBody(event);
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const serviceInstanceId = typeof body.serviceInstanceId === "string" ? body.serviceInstanceId : "";
    const hostname = typeof body.hostname === "string" ? body.hostname.replace(/\/+$/, "") : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const actions = Array.isArray(body.actions)
      ? body.actions.filter((action): action is "config.read" | "config.write" => action === "config.read" || action === "config.write")
      : [];
    if (!tenantId || (!serviceInstanceId && !hostname) || !serviceId || actions.length === 0) {
      return jsonResponse({ error: "tenantId, serviceInstanceId or hostname, serviceId, and actions are required" }, 400);
    }

    const config = await store.loadConfig();
    const service = findRegisteredService(config, tenantId, hostname, serviceInstanceId);
    if (!service || service.serviceId !== serviceId) {
      return jsonResponse({ error: "Service is not registered for this tenant/hostname/service id" }, 403);
    }

    return jsonResponse({
      token: signConfigTicket(cpState, { tenantId, serviceId, actions }),
      expiresInSeconds: CONFIG_TICKET_TTL_SECONDS
    });
  });

  app.post(`${API_BASE}/configure-save`, async () => {
    return htmlResponse(`<div class="alert alert-danger">Service config saves must be sent directly from the browser to the service using a BetterPortal config ticket.</div>`, 200, "text/html; mode=fragment");
  });
}

// HTML fragment renderers

function renderWizardStep1(
  config: { tenants: Array<{ id: string; title: string }> },
  error?: string,
  prefill?: { tenantId?: string; hostname?: string },
  adminApiBase = API_BASE
): string {
  const selectedTenant = prefill?.tenantId
    ? config.tenants.find((t) => t.id === prefill.tenantId)
    : undefined;
  const tenantOptions = config.tenants
    .map((t) => `<option value="${escapeHtml(t.id)}"${prefill?.tenantId === t.id ? " selected" : ""}>${escapeHtml(t.title)} (${escapeHtml(t.id)})</option>`)
    .join("");
  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 1 of 3</div>
  <form data-bp-wizard-verify-form="" action="${escapeHtml(adminApiBase)}/wizard/verify" method="post">
    ${selectedTenant ? `
      <input type="hidden" name="tenantId" value="${escapeHtml(selectedTenant.id)}" />
      <div class="mb-3">
        <label class="form-label">Tenant</label>
        <div class="form-control bg-body-tertiary">${escapeHtml(selectedTenant.title)} <span class="font-monospace small text-secondary">${escapeHtml(selectedTenant.id)}</span></div>
      </div>
    ` : `
      <div class="mb-3">
        <label class="form-label">Tenant</label>
        <select class="form-select" name="tenantId" required>
          <option value="">Select tenant...</option>
          ${tenantOptions}
        </select>
        <div class="form-text">Which tenant owns this service?</div>
      </div>
    `}
    <input type="hidden" name="manifest" />
    <input type="hidden" name="schema" />
    <div class="mb-3">
      <label class="form-label">Service URL</label>
      <input type="url" class="form-control" name="hostname" value="${escapeHtml(prefill?.hostname ?? "")}" placeholder="http://localhost:3200" required />
      <div class="form-text">We'll verify it's a valid BetterPortal service.</div>
    </div>
    ${error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ""}
    <button type="submit" class="btn btn-primary w-100">
      <span id="bp-wizard-spinner" class="spinner-border spinner-border-sm htmx-indicator" role="status"></span>
      Verify Service -&gt;
    </button>
  </form>
  <script>
(() => {
  const form = document.querySelector("[data-bp-wizard-verify-form]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  const step = document.getElementById("bp-wizard-step");
  const submit = form.querySelector("button[type='submit']");
  const setError = (message) => {
    const existing = form.querySelector("[data-bp-wizard-error]");
    if (existing) existing.remove();
    form.insertAdjacentHTML("beforeend", '<div class="alert alert-danger mt-3" data-bp-wizard-error>' + String(message).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]) + '</div>');
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hostname = String(new FormData(form).get("hostname") || "").replace(/\\/+$/, "");
    if (!hostname) return setError("Service URL is required.");
    if (submit) submit.disabled = true;
    try {
      const manifestResponse = await fetch(hostname + "/.well-known/bp/manifest", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!manifestResponse.ok) throw new Error("Manifest HTTP " + manifestResponse.status);
      const manifest = await manifestResponse.json();
      form.elements.manifest.value = JSON.stringify(manifest);
      try {
        const schemaResponse = await fetch(hostname + "/.well-known/bp/schema.json", { headers: { Accept: "application/json" }, cache: "no-store" });
        form.elements.schema.value = schemaResponse.ok
          ? JSON.stringify(await schemaResponse.json())
          : JSON.stringify({ manifest, routes: [] });
      } catch {
        form.elements.schema.value = JSON.stringify({ manifest, routes: [] });
      }
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "text/html" } });
      const html = await response.text();
      if (!response.ok) throw new Error("Verify HTTP " + response.status);
      if (step) step.outerHTML = html;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
  </script>
</div>`;
}

function renderWizardStep2(d: { tenantId: string; hostname: string; pluginId: string; version: string; viewCount: number; title: string; schema: string; adminApiBase: string }): string {
  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 2 of 3</div>
  <div class="alert alert-success mb-3">
    <h6 class="alert-heading">Service Verified</h6>
    <div class="small mb-1"><strong>Plugin ID:</strong> <code>${escapeHtml(d.pluginId)}</code></div>
    <div class="small mb-1"><strong>Version:</strong> ${escapeHtml(d.version)}</div>
    <div class="small mb-0"><strong>Views:</strong> ${d.viewCount}</div>
  </div>
  <form data-bp-wizard-register-form="" action="${escapeHtml(d.adminApiBase)}/wizard/register" method="post">
    <input type="hidden" name="tenantId" value="${escapeHtml(d.tenantId)}" />
    <input type="hidden" name="hostname" value="${escapeHtml(d.hostname)}" />
    <input type="hidden" name="schema" value="${escapeHtml(d.schema)}" />
    <div class="mb-3">
      <label class="form-label">Display Name</label>
      <input type="text" class="form-control" name="title" value="${escapeHtml(d.title)}" required />
      <div class="form-text">Auto-filled from manifest. Edit if needed.</div>
    </div>
    <div class="d-flex gap-2">
      <button type="button" class="btn btn-outline-secondary" hx-get="/.well-known/bp/admin/wizard/step1" hx-target="#bp-wizard-step" hx-swap="outerHTML"><- Back</button>
      <button type="submit" class="btn btn-primary flex-grow-1">Register Service</button>
    </div>
  </form>
  <script>
(() => {
  const form = document.querySelector("[data-bp-wizard-register-form]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  const step = document.getElementById("bp-wizard-step");
  const submit = form.querySelector("button[type='submit']");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit) submit.disabled = true;
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "text/html" } });
      const html = await response.text();
      if (!response.ok) throw new Error("Register HTTP " + response.status);
      if (step) step.outerHTML = html;
    } catch (error) {
      form.insertAdjacentHTML("beforeend", '<div class="alert alert-danger mt-3">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</div>');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  const back = form.querySelector("[hx-get]");
  if (back) {
    back.removeAttribute("hx-get");
    back.removeAttribute("hx-target");
    back.removeAttribute("hx-swap");
    back.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const url = ${JSON.stringify(d.adminApiBase)} + "/wizard/step1?tenantId=" + encodeURIComponent(${JSON.stringify(d.tenantId)}) + "&hostname=" + encodeURIComponent(${JSON.stringify(d.hostname)});
      const response = await fetch(url, { headers: { Accept: "text/html" } });
      const html = await response.text();
      if (step) step.outerHTML = html;
    });
  }
})();
  </script>
</div>`;
}

function renderWizardStep3(d: { apiKey: string; deploymentMode: string; title: string; tenantId?: string; serviceInstanceId?: string; serviceUrl?: string; adminApiBase?: string }): string {
  if (d.tenantId && d.serviceInstanceId && d.serviceUrl) {
    return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 3 of 3</div>
  <div class="alert alert-secondary" id="bp-install-status">
    <h6 class="alert-heading">Installing Service</h6>
    <p class="mb-0 small">Provisioning ${escapeHtml(d.title)} with the control plane...</p>
  </div>
  <button class="btn btn-primary w-100" id="bp-install-done" disabled data-bs-dismiss="offcanvas">Done</button>
  <script>
(() => {
  const status = document.getElementById("bp-install-status");
  const done = document.getElementById("bp-install-done");
  const setStatus = (kind, heading, message) => {
    if (!status) return;
    status.className = "alert alert-" + kind;
    status.innerHTML = '<h6 class="alert-heading">' + heading + '</h6><p class="mb-0 small">' + message + '</p>';
  };
  const postJson = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
    return data;
  };
  (async () => {
    try {
      const install = await postJson(${JSON.stringify((d.adminApiBase ?? API_BASE).replace(/\/+$/, ""))} + "/services/begin-install", {
        serviceUrl: ${JSON.stringify(d.serviceUrl)},
        tenantId: ${JSON.stringify(d.tenantId)},
        instanceId: ${JSON.stringify(d.serviceInstanceId)}
      });
      await postJson(${JSON.stringify(d.serviceUrl)} + "/.well-known/bp/install", {
        setupToken: install.setupToken,
        cpUrl: install.cpUrl
      });
      setStatus("success", "Service Installed", "The service is provisioned and will sync from the control plane.");
      if (done) done.disabled = false;
    } catch (error) {
      try {
        await postJson(${JSON.stringify((d.adminApiBase ?? API_BASE).replace(/\/+$/, ""))} + "/wizard/cleanup-provisional-service", {
          tenantId: ${JSON.stringify(d.tenantId)},
          serviceInstanceId: ${JSON.stringify(d.serviceInstanceId)}
        });
      } catch { /* cleanup best effort */ }
      setStatus("danger", "Install Failed", error instanceof Error ? error.message : String(error));
      if (done) {
        done.disabled = false;
        done.textContent = "Close";
      }
    }
  })();
})();
  </script>
</div>`;
  }
  if (!d.apiKey || d.deploymentMode !== "self-hosted") {
    return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 3 of 3</div>
  <div class="alert alert-success">
    <h6 class="alert-heading">Service Registered</h6>
    <p class="mb-0 small">${escapeHtml(d.title)} is now available for this tenant.</p>
  </div>
  <button class="btn btn-primary w-100" data-bs-dismiss="offcanvas">Done</button>
</div>`;
  }

  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 3 of 3</div>
  <div class="alert alert-success">
    <h6 class="alert-heading">Service Registered</h6>
    <p class="mb-2 small">The service was registered. Use the install flow to provision credentials.</p>
    <div class="input-group mb-3">
      <input type="text" class="form-control font-monospace small" value="${escapeHtml(d.title)}" readonly />
      <button class="btn btn-outline-secondary" type="button"
        onclick="navigator.clipboard.writeText(this.previousElementSibling.value); this.textContent='Copied!'; setTimeout(()=>{this.textContent='Copy';},1500)">Copy</button>
    </div>
    <p class="small text-secondary mb-2">Install credentials are provisioned by the control-plane install flow.</p>
    <pre class="small bg-body-tertiary border rounded p-2 mb-0"><code>betterportal:
  status: registered
  serviceUrl: ${escapeHtml(d.title)}</code></pre>
  </div>
  <button class="btn btn-primary w-100" data-bs-dismiss="offcanvas">Done</button>
</div>`;
}

function renderConfigForm(d: {
  hostname: string;
  tenantId: string;
  appId: string;
  serviceTitle: string;
  fields: Array<{ key: string; title: string; description?: string; visibility?: string; ui?: ConfigFieldUiHint }>;
  values: Record<string, unknown>;
  tenantApps: Array<{ id: string; title: string; routes?: Array<{ path: string; title: string }> }>;
  needsApp: boolean;
}): string {
  const appSelector = d.needsApp
    ? `<div class="mb-3">
      <label class="form-label">App</label>
      <select class="form-select" name="appId" required
        hx-get="/.well-known/bp/admin/configure"
        hx-trigger="change"
        hx-target="#bp-config-edit-form"
        hx-swap="innerHTML"
        hx-include="closest form"
        hx-vals='{"hostname":"${escapeHtml(d.hostname)}","tenantId":"${escapeHtml(d.tenantId)}","title":"${escapeHtml(d.serviceTitle)}"}'>
        <option value="">Select app...</option>
        ${d.tenantApps.map((a) => `<option value="${escapeHtml(a.id)}"${a.id === d.appId ? " selected" : ""}>${escapeHtml(a.title)}</option>`).join("")}
      </select>
    </div>`
    : "";

  if (d.needsApp && !d.appId) {
    return `<div class="small text-secondary mb-3">${escapeHtml(d.serviceTitle)} - <span class="font-monospace">${escapeHtml(d.hostname)}</span></div>
${appSelector}
<div class="alert alert-info">Select an app to load its config</div>`;
  }

  const fieldsHtml = d.fields.map((f) => {
    const val = d.values[f.key] ?? "";
    const placeholder = f.visibility === "secret" && val === "__redacted__" ? "(unchanged)" : "";
    const renderedVal = f.visibility === "secret" && val === "__redacted__" ? "" : String(val);
    return `<div class="mb-3">
      <label class="form-label">${escapeHtml(f.title)}</label>
      ${renderConfigControl(f, renderedVal, placeholder, false)}
      ${f.description ? `<div class="form-text">${escapeHtml(f.description)}</div>` : ""}
    </div>`;
  }).join("");

  return `<div class="small text-secondary mb-3">${escapeHtml(d.serviceTitle)} - <span class="font-monospace">${escapeHtml(d.hostname)}</span></div>
${appSelector}
<form hx-post="/.well-known/bp/admin/configure-save" hx-target="#bp-config-save-status" hx-swap="innerHTML"
  hx-on::after-request="if(event.detail.successful) setTimeout(()=>bootstrap.Offcanvas.getInstance(document.getElementById('bp-config-edit-panel'))?.hide(), 800)">
  <input type="hidden" name="hostname" value="${escapeHtml(d.hostname)}" />
  <input type="hidden" name="tenantId" value="${escapeHtml(d.tenantId)}" />
  <input type="hidden" name="appId" value="${escapeHtml(d.appId)}" />
  <input type="hidden" name="serviceTitle" value="${escapeHtml(d.serviceTitle)}" />
  ${fieldsHtml}
  <div id="bp-config-save-status"></div>
  <button type="submit" class="btn btn-primary w-100">Save Configuration</button>
</form>`;
}

type ConfigFieldUiHint = {
  control?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  optionsSource?: "app.routes";
  min?: string | number;
  max?: string | number;
  step?: number;
  rows?: number;
};

function renderConfigControl(
  field: { key: string; visibility?: string; ui?: ConfigFieldUiHint },
  value: string,
  placeholder: string,
  disabled: boolean
): string {
  const ui = field.ui ?? {};
  const control = field.visibility === "secret" ? "password" : ui.control ?? "text";
  const name = escapeHtml(field.key);
  const disabledAttr = disabled ? " disabled" : "";
  const placeholderAttr = escapeHtml(placeholder || ui.placeholder || "");
  const attrs = [
    ui.min !== undefined ? `min="${escapeHtml(String(ui.min))}"` : "",
    ui.max !== undefined ? `max="${escapeHtml(String(ui.max))}"` : "",
    ui.step !== undefined ? `step="${escapeHtml(String(ui.step))}"` : ""
  ].filter(Boolean).join(" ");
  if (control === "textarea") {
    return `<textarea class="form-control" name="${name}" rows="${escapeHtml(String(ui.rows ?? 3))}" placeholder="${placeholderAttr}"${disabledAttr}>${escapeHtml(value)}</textarea>`;
  }
  if (control === "select" || control === "multiselect") {
    const selectedValues = new Set(control === "multiselect" ? value.split(",").map((entry) => entry.trim()) : [value]);
    const options = (ui.options ?? []).map((option) =>
      `<option value="${escapeHtml(option.value)}"${selectedValues.has(option.value) ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    ).join("");
    return `<select class="form-select" name="${name}"${control === "multiselect" ? " multiple" : ""}${disabledAttr}>${options}</select>`;
  }
  if (control === "checkbox") {
    const checked = value === "true" || value === "1" || value === "on";
    return `<input class="form-check-input" type="checkbox" name="${name}" value="true"${checked ? " checked" : ""}${disabledAttr} />`;
  }
  const inputType = ["number", "color", "date", "time", "datetime-local", "url", "email", "password"].includes(control) ? control : "text";
  return `<input class="form-control" type="${inputType}" name="${name}" value="${escapeHtml(value)}" placeholder="${placeholderAttr}" ${attrs}${disabledAttr} />`;
}

function renderConfigClientShell(d: {
  hostname: string;
  tenantId: string;
  appId: string;
  serviceInstanceId?: string;
  serviceId: string;
  serviceTitle: string;
  adminApiBase: string;
  tenantApps: Array<{ id: string; title: string }>;
}): string {
  const payload = JSON.stringify({
    hostname: d.hostname,
    tenantId: d.tenantId,
    appId: d.appId,
    serviceInstanceId: d.serviceInstanceId,
    serviceId: d.serviceId,
    serviceTitle: d.serviceTitle,
    tenantApps: d.tenantApps,
    ticketUrl: `${d.adminApiBase.replace(/\/+$/, "")}/config-ticket`
  }).replace(/</g, "\\u003c");

  return `<div data-bp-config-client-editor data-config="${escapeHtml(payload)}">
  <div class="small text-secondary mb-3">${escapeHtml(d.serviceTitle)} - <span class="font-monospace">${escapeHtml(d.hostname)}</span></div>
  <div data-bp-config-status class="alert alert-secondary py-2">Loading configuration...</div>
  <div data-bp-config-body></div>
</div>
<script>
(() => {
  const script = document.currentScript;
  const root = script?.previousElementSibling?.matches?.("[data-bp-config-client-editor]")
    ? script.previousElementSibling
    : null;
  if (!root) return;
  const cfg = JSON.parse(root.dataset.config || "{}");
  const status = root.querySelector("[data-bp-config-status]");
  const body = root.querySelector("[data-bp-config-body]");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const setStatus = (kind, message) => {
    if (!status) return;
    status.className = "alert py-2 " + (kind === "error" ? "alert-danger" : kind === "ok" ? "alert-success" : "alert-secondary");
    status.textContent = message;
  };
  const readJson = async (response, label) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    const text = await response.text().catch(() => "");
    throw new Error(label + " returned " + (contentType || "non-JSON") + " HTTP " + response.status + (text ? ": " + text.slice(0, 160) : ""));
  };
  const bpHeaders = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("bp.headers") || "{}");
      const auth = stored.Authorization;
      return auth && typeof auth.value === "string" ? { Authorization: auth.value } : {};
    } catch {
      return {};
    }
  };
  const requestTicket = async () => {
    const response = await fetch(cfg.ticketUrl, {
      method: "POST",
      headers: { ...bpHeaders(), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        hostname: cfg.hostname,
        tenantId: cfg.tenantId,
        serviceInstanceId: cfg.serviceInstanceId,
        serviceId: cfg.serviceId,
        actions: ["config.read", "config.write"]
      })
    });
    const data = await readJson(response, "ticket");
    if (!response.ok) throw new Error(data.error || data.message || "ticket HTTP " + response.status);
    if (!data.token) throw new Error("ticket missing");
    return data.token;
  };
  const serviceBase = () => cfg.hostname.replace(/\\/+$/, "");
  const loadValues = async (token, appId) => {
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + token,
      "x-bp-tenant-id": cfg.tenantId
    };
    if (appId) headers["x-bp-app-id"] = appId;
    const response = await fetch(serviceBase() + "/.well-known/bp/config", { method: "GET", headers, cache: "no-store" });
    const data = await readJson(response, "config");
    if (!response.ok) throw new Error(data.error || data.message || "config HTTP " + response.status);
    return data.values || {};
  };
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
  const compareOrder = (left, right) => {
    const leftOrder = typeof left.order === "number" ? left.order : 0;
    const rightOrder = typeof right.order === "number" ? right.order : 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.title || left.key || left.id || "").localeCompare(String(right.title || right.key || right.id || ""));
  };
  const fieldControl = (field) => field.visibility === "secret" ? "password" : field.ui?.control || "text";
  const fieldOptions = (field, appId) => {
    const ui = field.ui || {};
    if (ui.optionsSource === "app.routes") {
      const app = (cfg.tenantApps || []).find((entry) => entry.id === appId);
      return [{ value: "", label: "Default (/)" }].concat((app?.routes || []).map((route) => ({
        value: route.path,
        label: (route.title || route.path) + " (" + route.path + ")"
      })));
    }
    return ui.options || [];
  };
  const renderControl = (field, value, placeholder, disabled, selectedAppId) => {
    const ui = field.ui || {};
    const control = fieldControl(field);
    const name = escapeHtml(field.key);
    const disabledAttr = disabled ? " disabled" : "";
    const placeholderAttr = escapeHtml(placeholder || ui.placeholder || "");
    const attrs = [
      ui.min !== undefined ? 'min="' + escapeHtml(ui.min) + '"' : "",
      ui.max !== undefined ? 'max="' + escapeHtml(ui.max) + '"' : "",
      ui.step !== undefined ? 'step="' + escapeHtml(ui.step) + '"' : ""
    ].filter(Boolean).join(" ");
    if (control === "textarea") {
      return '<textarea class="form-control" name="' + name + '" rows="' + escapeHtml(ui.rows || 3) + '" placeholder="' + placeholderAttr + '"' + disabledAttr + '>' + escapeHtml(value) + '</textarea>';
    }
    if (control === "select" || control === "multiselect") {
      const selected = new Set(control === "multiselect" ? String(value || "").split(",").map((entry) => entry.trim()) : [String(value || "")]);
      const options = fieldOptions(field, selectedAppId || "").map((option) =>
        '<option value="' + escapeHtml(option.value) + '"' + (selected.has(String(option.value)) ? " selected" : "") + '>' + escapeHtml(option.label) + '</option>'
      ).join("");
      return '<select class="form-select" name="' + name + '"' + (control === "multiselect" ? " multiple" : "") + disabledAttr + '>' + options + '</select>';
    }
    if (control === "checkbox") {
      const checked = value === true || value === "true" || value === "1" || value === "on";
      return '<input class="form-check-input" type="checkbox" name="' + name + '" value="true"' + (checked ? " checked" : "") + disabledAttr + ' />';
    }
    const type = ["number", "color", "date", "time", "datetime-local", "url", "email", "password"].includes(control) ? control : "text";
    return '<input class="form-control" type="' + type + '" name="' + name + '" value="' + escapeHtml(value) + '" placeholder="' + placeholderAttr + '" ' + attrs + disabledAttr + ' />';
  };
  const readFieldValue = (form, field) => {
    const control = fieldControl(field);
    const input = form.querySelector('[name="' + CSS.escape(field.key) + '"]');
    if (!input) return undefined;
    if (control === "checkbox") return input.checked ? "true" : "false";
    if (control === "multiselect") return Array.from(input.selectedOptions || []).map((option) => option.value).join(",");
    return input.value;
  };
  const schemaLayout = (schema) => {
    const byKey = new Map();
    const groupsById = new Map();
    for (const entry of schema.configSchemas || []) {
      for (const group of entry.groups || []) {
        if (group && typeof group.id === "string" && !groupsById.has(group.id)) groupsById.set(group.id, group);
      }
      for (const field of entry.fields || []) {
        if (field && typeof field.key === "string" && !byKey.has(field.key)) byKey.set(field.key, field);
      }
    }
    const fields = Array.from(byKey.values()).sort(compareOrder);
    const ungrouped = [];
    const fieldsByGroupId = new Map();
    for (const field of fields) {
      if (!field.groupId) {
        ungrouped.push(field);
        continue;
      }
      if (!fieldsByGroupId.has(field.groupId)) fieldsByGroupId.set(field.groupId, []);
      fieldsByGroupId.get(field.groupId).push(field);
    }
    const sections = [];
    if (ungrouped.length > 0) {
      sections.push({ id: "", title: "", description: "", order: -1000, optional: false, fields: ungrouped });
    }
    for (const [groupId, groupFields] of fieldsByGroupId.entries()) {
      const group = groupsById.get(groupId) || {};
      sections.push({
        id: groupId,
        title: group.title || groupId,
        description: group.description || "",
        order: typeof group.order === "number" ? group.order : 0,
        optional: group.optional === true,
        fields: groupFields.sort(compareOrder)
      });
    }
    sections.sort(compareOrder);
    return { fields, sections };
  };
  const renderForm = async (schema, token, selectedScope, appId) => {
    const layout = schemaLayout(schema);
    const fields = layout.fields;
    const scope = selectedScope === "app" ? "app" : "tenant";
    const selectedAppId = scope === "app" ? appId : "";
    const tenantValues = await loadValues(token, "");
    const appValues = selectedAppId ? await loadValues(token, selectedAppId) : {};
    const scopeSelector = '<div class="row g-2 mb-3"><div class="col-5"><label class="form-label">Scope</label>' +
      '<select class="form-select" data-bp-config-scope><option value="tenant"' + (scope === "tenant" ? " selected" : "") + '>Tenant defaults</option><option value="app"' + (scope === "app" ? " selected" : "") + '>App override</option></select></div>' +
      '<div class="col-7"><label class="form-label">App</label><select class="form-select" data-bp-config-app ' + (scope === "app" ? "" : "disabled") + '><option value="">Select app...</option>' +
      (cfg.tenantApps || []).map((app) => '<option value="' + escapeHtml(app.id) + '"' + (app.id === selectedAppId ? " selected" : "") + '>' + escapeHtml(app.title) + '</option>').join("") +
      '</select></div></div>';
    if (scope === "app" && !selectedAppId) {
      body.innerHTML = scopeSelector + '<div class="alert alert-info">Select an app to edit overrides.</div>';
      wireScopeControls(schema, token);
      setStatus("info", "Select an app.");
      return;
    }
    const renderField = (field) => {
      const override = scope === "app" && hasOwn(appValues, field.key);
      const fallbackValue = hasOwn(field, "defaultValue") ? field.defaultValue : "";
      const rawValue = scope === "app"
        ? (override ? appValues[field.key] : tenantValues[field.key] ?? fallbackValue)
        : tenantValues[field.key] ?? fallbackValue;
      const secret = field.visibility === "secret";
      const redacted = secret && rawValue === "__redacted__";
      const disabled = scope === "app" && !override;
      const checkbox = scope === "app"
        ? '<input class="form-check-input me-2" type="checkbox" data-bp-override-key="' + escapeHtml(field.key) + '"' + (override ? " checked" : "") + ' />'
        : "";
      const resetButton = scope === "tenant"
        ? '<button type="button" class="btn btn-link btn-sm p-0 ms-auto" data-bp-reset-key="' + escapeHtml(field.key) + '"' + (hasOwn(tenantValues, field.key) ? "" : " disabled") + '>Reset</button>'
        : "";
      const inherited = scope === "app" && !override ? '<div class="form-text">Using tenant default.</div>' : "";
      return '<div class="mb-3" data-bp-field="' + escapeHtml(field.key) + '">' +
        '<label class="form-label d-flex align-items-center">' + checkbox + '<span>' + escapeHtml(field.title || field.key) + '</span>' + resetButton + '</label>' +
        renderControl(field, redacted ? "" : rawValue, redacted ? "(unchanged)" : "", disabled, selectedAppId) +
        (field.description ? '<div class="form-text">' + escapeHtml(field.description) + '</div>' : "") +
        inherited +
        '</div>';
    };
    const sectionsHtml = layout.sections.map((section) => {
      const sectionFields = section.fields || [];
      const groupOverride = scope === "app" && section.optional && sectionFields.some((field) => hasOwn(appValues, field.key));
      const groupCheckbox = scope === "app" && section.optional
        ? '<input class="form-check-input me-2" type="checkbox" data-bp-override-group="' + escapeHtml(section.id) + '"' + (groupOverride ? " checked" : "") + ' />'
        : "";
      const header = section.title
        ? '<div class="mb-3"><div class="fw-semibold d-flex align-items-center">' + groupCheckbox + '<span>' + escapeHtml(section.title) + '</span></div>' + (section.description ? '<div class="form-text">' + escapeHtml(section.description) + '</div>' : "") + '</div>'
        : "";
      const content = sectionFields.map(renderField).join("");
      return '<div class="border rounded p-3 mb-3" data-bp-config-section="' + escapeHtml(section.id) + '">' + header + content + '</div>';
    }).join("");
    body.innerHTML = scopeSelector + '<form data-bp-config-form>' + sectionsHtml + '<div data-bp-save-status></div><button type="submit" class="btn btn-primary w-100">Save Configuration</button></form>';
    wireScopeControls(schema, token);
    root.querySelectorAll("[data-bp-override-key]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const field = checkbox.closest("[data-bp-field]");
        const input = field?.querySelector("[name]");
        if (input) input.disabled = !checkbox.checked;
      });
    });
    root.querySelectorAll("[data-bp-override-group]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const section = checkbox.closest("[data-bp-config-section]");
        section?.querySelectorAll("[data-bp-override-key]").forEach((fieldCheckbox) => {
          fieldCheckbox.checked = checkbox.checked;
          fieldCheckbox.dispatchEvent(new Event("change"));
        });
      });
    });
    root.querySelectorAll("[data-bp-reset-key]").forEach((button) => {
      button.addEventListener("click", async () => {
        const key = button.getAttribute("data-bp-reset-key");
        if (!key) return;
        button.disabled = true;
        setStatus("info", "Resetting " + key + "...");
        const response = await fetch(serviceBase() + "/.well-known/bp/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: "Bearer " + token,
            "x-bp-tenant-id": cfg.tenantId
          },
          body: JSON.stringify({ tenantId: cfg.tenantId, values: {}, clearKeys: [key] })
        });
        if (!response.ok) {
          const error = await readJson(response, "reset").catch((err) => ({ error: err.message || "HTTP " + response.status }));
          setStatus("error", error.error || "Reset failed.");
          button.disabled = false;
          return;
        }
        document.body.dispatchEvent(new CustomEvent("bp:config-saved"));
        await renderForm(schema, token, "tenant", "");
      });
    });
    root.querySelector("[data-bp-config-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = event.target.querySelector('button[type="submit"]');
      const saveStatus = root.querySelector("[data-bp-save-status]");
      if (submitButton) submitButton.disabled = true;
      setStatus("info", "Saving configuration...");
      const valuesToSave = {};
      const clearKeys = [];
      if (scope === "app") {
        for (const field of fields) {
          const checkbox = root.querySelector('[data-bp-override-key="' + CSS.escape(field.key) + '"]');
          if (!checkbox?.checked) {
            clearKeys.push(field.key);
            continue;
          }
          const value = readFieldValue(event.target, field);
          if (value !== undefined && !(field.visibility === "secret" && value === "" && appValues[field.key] === "__redacted__")) {
            valuesToSave[field.key] = value;
          }
        }
      } else {
        for (const field of fields) {
          const value = readFieldValue(event.target, field);
          if (value !== undefined && value !== "(unchanged)") valuesToSave[field.key] = value;
        }
      }
      const payload = { tenantId: cfg.tenantId, values: valuesToSave };
      if (selectedAppId) payload.appId = selectedAppId;
      if (clearKeys.length > 0) payload.clearKeys = clearKeys;
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "x-bp-tenant-id": cfg.tenantId
      };
      if (selectedAppId) headers["x-bp-app-id"] = selectedAppId;
      const response = await fetch(serviceBase() + "/.well-known/bp/config", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await readJson(response, "save").catch((err) => ({ error: err.message || "HTTP " + response.status }));
        if (saveStatus) saveStatus.innerHTML = '<div class="alert alert-danger">' + escapeHtml(error.error || "Save failed") + '</div>';
        setStatus("error", error.error || "Save failed.");
        if (submitButton) submitButton.disabled = false;
        return;
      }
      document.body.dispatchEvent(new CustomEvent("bp:config-saved"));
      await renderForm(schema, token, scope, selectedAppId);
      setStatus("ok", "Configuration saved.");
    });
    setStatus("ok", "Configuration loaded.");
  };
  const wireScopeControls = (schema, token) => {
    root.querySelector("[data-bp-config-scope]")?.addEventListener("change", (event) => renderForm(schema, token, event.target.value, ""));
    root.querySelector("[data-bp-config-app]")?.addEventListener("change", (event) => renderForm(schema, token, "app", event.target.value));
  };
  (async () => {
    try {
      const token = await requestTicket();
      const schemaResponse = await fetch(serviceBase() + "/.well-known/bp/config/schema", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const schema = await readJson(schemaResponse, "schema");
      if (!schemaResponse.ok) throw new Error(schema.error || schema.message || "schema HTTP " + schemaResponse.status);
      await renderForm(schema, token, "tenant", "");
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : String(error));
    }
  })();
})();
</script>`;
}
