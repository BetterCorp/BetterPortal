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

  return { tenant, app };
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
      return { context, candidates: attempts, matchedBy: candidate.source };
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

export function serviceBaseUrl(service: { hostname: string } | { endpointBaseUrl: string }): string {
  const url = "hostname" in service ? service.hostname : service.endpointBaseUrl;
  return url.replace(/\/+$/, "");
}

function splitRoutePath(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter((segment) => segment.length > 0);
}

function routeParamName(segment: string): string | null {
  if (segment.startsWith(":") && segment.length > 1) {
    return segment.slice(1);
  }
  const braceMatch = segment.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  return braceMatch?.[1] ?? null;
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
  return app.routes.find((route) => route.enabled && routePatternMatches(route.path, normalizedPath)) ?? null;
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

function interpolatePath(pathTemplate: string, params: Record<string, string>): string {
  const [pathPart, queryPart] = pathTemplate.split("?", 2);
  const resolvedSegments = splitRoutePath(pathPart).map((segment) => {
    const paramName = routeParamName(segment);
    return paramName ? (params[paramName] ?? segment) : segment;
  });

  const resolvedPath = resolvedSegments.length === 0 ? "/" : `/${resolvedSegments.join("/")}`;
  const resolvedQuery = queryPart?.replace(
    /(?::([A-Za-z_][A-Za-z0-9_]*)|\{([A-Za-z_][A-Za-z0-9_]*)\})/g,
    (match, colonName: string | undefined, braceName: string | undefined) => params[colonName ?? braceName ?? ""] ?? match
  );

  return resolvedQuery ? `${resolvedPath}?${resolvedQuery}` : resolvedPath;
}

export function buildServiceViewUrl(
  binding: { hostname: string } | { endpointBaseUrl: string },
  route: BetterPortalRouteMount,
  currentPath: string
): string {
  const baseUrl = serviceBaseUrl(binding);
  const params = extractRouteParams(route.path, currentPath) ?? {};
  const servicePath = route.resolvedServicePath ?? route.targetPath;
  const resolvedPath = servicePath
    ? interpolatePath(servicePath, params)
    : Object.keys(params).length > 0
      ? interpolatePath(route.path, params)
      : inferServicePathFromViewId(route.viewId);

  return `${baseUrl}${resolvedPath}`;
}
