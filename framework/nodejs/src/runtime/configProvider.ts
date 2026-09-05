import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { parse } from "yaml";
import {
  BetterPortalApp,
  BetterPortalConfig,
  BetterPortalConfigSchema,
  BetterPortalOriginPolicy,
  BetterPortalOriginPolicySchema,
  BetterPortalResolvedRequestContext,
  BetterPortalResolvedServiceBinding,
  BetterPortalRouteMount
} from "../contracts/platformConfig.js";
import {
  buildHostCandidates,
  type BetterPortalHeaderTrustOptions,
  HeaderMap,
  hostFromHeaderValue
} from "./http.js";

export interface BetterPortalConfigProvider {
  loadConfig(): Promise<BetterPortalConfig>;
}

export type BetterPortalConfigProviderOptions =
  | { readonly backend?: "file"; readonly configPath: string };

const EMPTY_CONFIG: BetterPortalConfig = BetterPortalConfigSchema.parse({
  configManagement: { auth: { mechanism: "none", requiredPermissions: [] } }
});

export class FileBackedBetterPortalConfigProvider implements BetterPortalConfigProvider {
  constructor(private readonly configPath: string) {}

  async loadConfig(): Promise<BetterPortalConfig> {
    const resolvedConfigPath = resolvePath(this.configPath);
    try {
      const fileContent = await readFile(resolvedConfigPath, "utf8");
      const parsed = parse(fileContent) as unknown;
      return BetterPortalConfigSchema.parse(parsed);
    } catch (err) {
      // Pre-bootstrap: file may not exist yet. Return empty config so the caller
      // can decide how to handle (typically returns 503 or empty UI).
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return EMPTY_CONFIG;
      }
      throw err;
    }
  }
}

export function createBetterPortalConfigProvider(options: BetterPortalConfigProviderOptions): BetterPortalConfigProvider {
  return new FileBackedBetterPortalConfigProvider(options.configPath);
}

function hostFromHostHeader(host?: string): string | null {
  return hostFromHeaderValue(host);
}

function findAppByHost(config: BetterPortalConfig, requestHost: string | null) {
  if (!requestHost) {
    return null;
  }

  return config.apps.find((app) => app.hostnames.some((appHostname) => {
    const appHost = hostFromHostHeader(appHostname);
    if (!appHost) {
      return false;
    }

    if (appHost === requestHost) {
      return true;
    }

    return appHost.split(":")[0] === requestHost.split(":")[0];
  })) ?? null;
}

export function describeEmbeddedContextResolution(
  config: BetterPortalConfig,
  headers: HeaderMap,
  headerTrust: BetterPortalHeaderTrustOptions = {}
): {
  candidates: string[];
  appHosts: Array<{ appId: string; hosts: string[] }>;
} {
  const candidates = buildHostCandidates(headers, "service", headerTrust).map((candidate) => candidate.host);
  return {
    candidates,
    appHosts: config.apps.map((app) => ({
      appId: app.id,
      hosts: app.hostnames
        .map((hostname) => hostFromHostHeader(hostname))
        .filter((value): value is string => !!value)
    }))
  };
}

export function resolveAppShell(config: BetterPortalConfig, app: BetterPortalApp) {
  const serviceId = app.shell?.serviceId;
  if (!serviceId) return undefined;

  const keys = new Set([serviceId]);
  const direct = config.tenants.flatMap((tenant) => tenant.services).find((service) => service.id === serviceId)
    ?? config.platformServices.find((service) => service.id === serviceId);
  if (direct?.serviceId) keys.add(direct.serviceId);

  const activation = config.sharedServiceActivations.find((candidate) => candidate.enabled && candidate.id === serviceId);
  const shared = activation
    ? config.sharedServiceCatalog.find((candidate) => candidate.enabled && candidate.id === activation.sharedServiceId)
    : undefined;
  if (shared) {
    keys.add(shared.id);
    if (shared.serviceId) keys.add(shared.serviceId);
  }

  const shell = config.manifestCache.find((entry) => keys.has(entry.serviceId))?.shell as
    | { service?: unknown; renderer?: unknown }
    | undefined;
  return typeof shell?.service === "string" && typeof shell.renderer === "string"
    ? { serviceId, service: shell.service, renderer: shell.renderer }
    : undefined;
}

function buildResolvedContext(config: BetterPortalConfig, appId: string | null): BetterPortalResolvedRequestContext | null {
  if (!appId) {
    return null;
  }

  const app = config.apps.find((entry) => entry.id === appId) ?? null;
  if (!app) {
    return null;
  }

  const tenant = config.tenants.find((entry) => entry.id === app.tenantId) ?? null;
  if (!tenant || !tenant.active) {
    return null;
  }

  return {
    tenant,
    app: {
      ...app,
      shell: resolveAppShell(config, app)
    }
  };
}

export interface BetterPortalContextResolutionCandidate {
  source: string;
  host: string;
  matchedAppId?: string;
}

export interface BetterPortalContextResolutionResult {
  context: BetterPortalResolvedRequestContext | null;
  candidates: BetterPortalContextResolutionCandidate[];
  matchedBy?: string;
  matchedHost?: string;
}

export function resolveRequestContextDetailed(
  config: BetterPortalConfig,
  headers: HeaderMap,
  mode: "theme" | "service",
  headerTrust: BetterPortalHeaderTrustOptions = {}
): BetterPortalContextResolutionResult {
  const candidates = buildHostCandidates(headers, mode, headerTrust);
  const attempts: BetterPortalContextResolutionCandidate[] = [];

  for (const candidate of candidates) {
    const app = findAppByHost(config, candidate.host);
    attempts.push({
      source: candidate.source,
      host: candidate.host,
      ...(app ? { matchedAppId: app.id } : {})
    });
    const context = buildResolvedContext(config, app?.id ?? null);
    if (context) {
      return { context, candidates: attempts, matchedBy: candidate.source, matchedHost: candidate.host };
    }
  }

  return { context: null, candidates: attempts };
}

export function resolveThemeRequestContext(
  config: BetterPortalConfig,
  headers: HeaderMap,
  requestHost?: string,
  headerTrust: BetterPortalHeaderTrustOptions = {}
): BetterPortalResolvedRequestContext | null {
  const requestHostHeaders = requestHost
    ? headers instanceof Headers
      ? new Headers(headers)
      : { ...headers }
    : headers;
  if (requestHost) {
    if (requestHostHeaders instanceof Headers) {
      requestHostHeaders.set("host", requestHost);
    } else {
      requestHostHeaders.host = requestHost;
    }
  }
  return resolveRequestContextDetailed(config, requestHostHeaders, "theme", headerTrust).context;
}

export function resolveEmbeddedRequestContext(
  config: BetterPortalConfig,
  headers: HeaderMap,
  headerTrust: BetterPortalHeaderTrustOptions = {}
): BetterPortalResolvedRequestContext | null {
  return resolveRequestContextDetailed(config, headers, "service", headerTrust).context;
}

export function resolveServiceForTenant(
  config: BetterPortalConfig,
  serviceId: string,
  context: BetterPortalResolvedRequestContext
): BetterPortalResolvedServiceBinding | null {
  const activation = config.sharedServiceActivations.find(candidate => candidate.id === serviceId);
  if (activation) {
    if (!activation.enabled || activation.tenantId !== context.tenant.id
      || (activation.appId && activation.appId !== context.app.id)) return null;
    const shared = config.sharedServiceCatalog.find(candidate => candidate.enabled && candidate.id === activation.sharedServiceId);
    if (!shared) return null;
    return { tenant: context.tenant, app: context.app, service: {
      id: activation.id, hostname: shared.baseUrl, apiKeyHash: shared.apiKeyHash,
      serviceId: shared.serviceId, title: shared.title, description: shared.description,
      capabilities: shared.tags, authProvider: shared.authProvider,
      deploymentMode: "bp-hosted", createdAt: activation.activatedAt, enabled: true
    } };
  }
  const tenantService = context.tenant.services.find(
    (s) => s.enabled && (s.id === serviceId || s.serviceId === serviceId)
  );

  if (tenantService) {
    return { tenant: context.tenant, app: context.app, service: tenantService };
  }

  if (context.tenant.activatedPlatformServices.includes(serviceId)) {
    const platformService = config.platformServices.find(
      (ps) => ps.enabled && (ps.id === serviceId || ps.serviceId === serviceId)
    );
    if (platformService) {
      return {
        tenant: context.tenant,
        app: context.app,
        service: {
          id: platformService.id,
          hostname: platformService.hostname,
          apiKeyHash: platformService.apiKeyHash,
          serviceId: platformService.serviceId,
          capabilities: platformService.capabilities,
          title: platformService.title,
          description: platformService.description,
          deploymentMode: "bp-hosted" as const,
          createdAt: platformService.createdAt,
          enabled: true
        }
      };
    }
  }

  return null;
}

/**
 * Resolve the credential-destination map for a tenant's application.
 *
 * @remarks
 * Includes enabled routes, slots, fragments, auth and the active shell's bindings.
 * Each binding must resolve through tenant authorization. Invalid URLs and URLs
 * containing credentials are omitted; the browser separately enforces HTTPS.
 * This map must come from trusted configuration, never service-rendered HTML.
 *
 * @param config - Platform snapshot used to resolve service registrations.
 * @param context - Resolved tenant and application for the shell request.
 * @returns Service binding IDs mapped to normalized HTTP(S) origins.
 */
export function resolveAppServiceOrigins(config: BetterPortalConfig, context: BetterPortalResolvedRequestContext): Record<string, string> {
  const app = context.app;
  const ids = new Set([
    ...app.routes.filter(binding => binding.enabled).map(binding => binding.serviceId),
    ...app.slots.filter(binding => binding.enabled).map(binding => binding.serviceId),
    ...Object.values(app.fragments).flat().filter(binding => binding.enabled).map(binding => binding.serviceId)
  ]);
  if (app.auth?.serviceId) ids.add(app.auth.serviceId);
  if (app.shell?.serviceId) ids.add(app.shell.serviceId);
  for (const setting of Object.values(app.shellFragments[app.shell?.serviceId ?? ""] ?? {})) {
    const items = setting.mode === "items" ? setting.items : setting.mode === "override" ? [setting.item] : [];
    for (const item of items) if (item.source === "service") ids.add(item.serviceId);
  }
  const origins: Record<string, string> = {};
  for (const id of ids) {
    const binding = resolveServiceForTenant(config, id, context);
    if (!binding) continue;
    try {
      const url = new URL(serviceBaseUrl(binding.service));
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) origins[id] = url.origin;
    } catch { /* Invalid service URLs are not credential destinations. */ }
  }
  return origins;
}

function ensureAllowedOrigins(app: BetterPortalResolvedRequestContext["app"]): string[] {
  const generated = app.hostnames.flatMap((hostname) => {
    if (hostname.startsWith("http://") || hostname.startsWith("https://")) {
      return [hostname];
    }

    return [
      `https://${hostname}`,
      `http://${hostname}`
    ];
  });

  return [...new Set([...generated, ...app.originOverrides])];
}

export function buildOriginPolicy(context: BetterPortalResolvedRequestContext): BetterPortalOriginPolicy {
  return BetterPortalOriginPolicySchema.parse({
    allowedOrigins: ensureAllowedOrigins(context.app),
    allowedReferers: [...new Set([
      ...ensureAllowedOrigins(context.app),
      ...context.app.refererOverrides
    ])]
  });
}

export function isAllowedOriginForContext(
  context: BetterPortalResolvedRequestContext,
  origin: string | null
): boolean {
  if (!origin) {
    return false;
  }

  return buildOriginPolicy(context).allowedOrigins.includes(origin);
}

export function isAllowedRefererForContext(
  context: BetterPortalResolvedRequestContext,
  referer: string | null
): boolean {
  if (!referer) {
    return false;
  }

  return buildOriginPolicy(context).allowedReferers.includes(referer);
}

/**
 * Remove trailing slashes with a linear scan, avoiding regex backtracking.
 *
 * @param service - Service hostname or endpoint binding.
 * @returns Base URL with only trailing slashes removed.
 */
export function serviceBaseUrl(service: { hostname: string } | { endpointBaseUrl: string }): string {
  const url = "hostname" in service ? service.hostname : service.endpointBaseUrl;
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

function splitRoutePath(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter((segment) => segment.length > 0);
}

function routeParamName(segment: string): string | null {
  if (segment.startsWith(":") && segment.length > 1) {
    return segment.slice(1);
  }
  return null;
}

function routePatternMatches(routePath: string, pathname: string): boolean {
  if (routePath === pathname) {
    return true;
  }

  const routeSegments = splitRoutePath(routePath);
  const pathSegments = splitRoutePath(pathname);
  if (routeSegments.length !== pathSegments.length) {
    return false;
  }

  return routeSegments.every((segment, index) => routeParamName(segment) !== null || segment === pathSegments[index]);
}

export function resolveAppRoute(app: BetterPortalApp, pathname: string): BetterPortalRouteMount | null {
  const normalizedPath = pathname.trim().length > 0 ? pathname : "/";
  const matches = app.routes.filter((route) => route.enabled && routePatternMatches(route.path, normalizedPath));
  return matches.sort((a, b) => {
    const dynamic = (path: string) => splitRoutePath(path).filter((segment) => routeParamName(segment)).length;
    return dynamic(a.path) - dynamic(b.path);
  })[0] ?? null;
}

export function inferServicePathFromViewId(viewId: string): string {
  const normalized = viewId.replace(/\.index$/, "").replace(/\./g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function extractRouteParams(routePath: string, currentPath: string): Record<string, string> | null {
  const routeSegments = splitRoutePath(routePath);
  const currentSegments = splitRoutePath(currentPath);

  if (routeSegments.length !== currentSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegments.length; i++) {
    const paramName = routeParamName(routeSegments[i]);
    if (paramName) {
      params[paramName] = currentSegments[i];
    } else if (routeSegments[i] !== currentSegments[i]) {
      return null;
    }
  }
  return params;
}

function interpolatePath(pathTemplate: string, params: Record<string, string>): string | null {
  const [pathPart, queryPart] = pathTemplate.split("?", 2);
  const resolvedSegments: string[] = [];
  for (const segment of splitRoutePath(pathPart)) {
    const paramName = routeParamName(segment);
    if (paramName && params[paramName] === undefined) return null;
    resolvedSegments.push(paramName ? encodeURIComponent(params[paramName]) : segment);
  }

  const resolvedPath = resolvedSegments.length === 0 ? "/" : `/${resolvedSegments.join("/")}`;
  let unresolvedQuery = false;
  const resolvedQuery = queryPart?.replace(
    /:([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, name: string) => {
      const value = params[name];
      if (value === undefined) {
        unresolvedQuery = true;
        return "";
      }
      return encodeURIComponent(value);
    }
  );
  if (unresolvedQuery) return null;

  return resolvedQuery ? `${resolvedPath}?${resolvedQuery}` : resolvedPath;
}

export function buildServiceViewUrl(
  binding: { hostname: string } | { endpointBaseUrl: string },
  route: BetterPortalRouteMount,
  currentPath: string
): string | null {
  const baseUrl = serviceBaseUrl(binding);
  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  } catch { return null; }
  const params = { ...route.fixedParams, ...(extractRouteParams(route.path, currentPath) ?? {}) };
  const servicePath = route.resolvedServicePath ?? route.servicePathVariant ?? route.targetPath;
  const resolvedPath = servicePath
    ? interpolatePath(servicePath, params)
    : Object.keys(params).length > 0
      ? interpolatePath(route.path, params)
      : inferServicePathFromViewId(route.viewId);

  return resolvedPath ? `${baseUrl}${resolvedPath}` : null;
}
