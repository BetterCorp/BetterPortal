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
import { HeaderMap, resolveEmbeddedSourceHeader, resolveThemeSourceHeader } from "./http.js";

export interface BetterPortalConfigProvider {
  loadConfig(): Promise<BetterPortalConfig>;
}

export class FileBackedBetterPortalConfigProvider implements BetterPortalConfigProvider {
  constructor(private readonly configPath: string) {}

  async loadConfig(): Promise<BetterPortalConfig> {
    const resolvedConfigPath = resolvePath(this.configPath);
    const fileContent = await readFile(resolvedConfigPath, "utf8");
    const parsed = parse(fileContent) as unknown;
    return BetterPortalConfigSchema.parse(parsed);
  }
}

function normalizeUrlCandidate(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostFromUrlValue(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsedUrl = normalizeUrlCandidate(value);
  return parsedUrl?.host ?? null;
}

function hostFromHostHeader(host?: string): string | null {
  if (!host || host.trim().length === 0) {
    return null;
  }

  const normalized = host.includes("://") ? host : `https://${host}`;
  return hostFromUrlValue(normalized);
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

export function resolveThemeRequestContext(
  config: BetterPortalConfig,
  headers: HeaderMap,
  requestHost?: string
): BetterPortalResolvedRequestContext | null {
  const originHostname = hostFromUrlValue(resolveThemeSourceHeader(headers));
  const refererHostname = hostFromUrlValue(resolveEmbeddedSourceHeader(headers));
  const hostHostname = hostFromHostHeader(requestHost);

  const app =
    findAppByHost(config, hostHostname) ??
    findAppByHost(config, originHostname) ??
    findAppByHost(config, refererHostname);

  return buildResolvedContext(config, app?.id ?? null);
}

export function resolveEmbeddedRequestContext(
  config: BetterPortalConfig,
  headers: HeaderMap
): BetterPortalResolvedRequestContext | null {
  const refererHostname = hostFromUrlValue(resolveEmbeddedSourceHeader(headers));
  const originHostname = hostFromUrlValue(resolveThemeSourceHeader(headers));
  const app =
    findAppByHost(config, refererHostname) ??
    findAppByHost(config, originHostname);

  return buildResolvedContext(config, app?.id ?? null);
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

function routePatternMatches(routePath: string, pathname: string): boolean {
  if (routePath === pathname) {
    return true;
  }

  const routeSegments = splitRoutePath(routePath);
  const pathSegments = splitRoutePath(pathname);
  if (routeSegments.length !== pathSegments.length) {
    return false;
  }

  return routeSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

export function resolveAppRoute(app: BetterPortalApp, pathname: string): BetterPortalRouteMount | null {
  const normalizedPath = pathname.trim().length > 0 ? pathname : "/";
  return app.routes.find((route) => route.enabled && routePatternMatches(route.path, normalizedPath)) ?? null;
}

export function inferServicePathFromViewId(viewId: string): string {
  const normalized = viewId.replace(/\.index$/, "").replace(/\./g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function interpolatePath(pathTemplate: string, currentPath: string): string {
  const templateSegments = splitRoutePath(pathTemplate);
  const currentSegments = splitRoutePath(currentPath);

  if (templateSegments.length !== currentSegments.length) {
    return currentPath;
  }

  const resolvedSegments = templateSegments.map((segment, index) =>
    segment.startsWith(":") ? currentSegments[index] : segment
  );

  return resolvedSegments.length === 0 ? "/" : `/${resolvedSegments.join("/")}`;
}

export function buildServiceViewUrl(
  binding: { hostname: string } | { endpointBaseUrl: string },
  route: BetterPortalRouteMount,
  currentPath: string
): string {
  const baseUrl = serviceBaseUrl(binding);
  const resolvedPath = route.targetPath
    ? (route.targetPath.includes(":") ? interpolatePath(route.targetPath, currentPath) : route.targetPath)
    : route.path.includes(":")
      ? interpolatePath(route.path, currentPath)
      : inferServicePathFromViewId(route.viewId);

  return `${baseUrl}${resolvedPath}`;
}
