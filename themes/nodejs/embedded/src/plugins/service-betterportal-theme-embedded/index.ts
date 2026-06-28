import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import {
  buildOriginPolicy,
  buildServiceViewUrl,
  eventHeaders,
  eventObservability,
  htmlResponse,
  jsonResponse,
  resolveAppRoute,
  resolveServiceForTenant,
  resolveThemeHostname,
  resolveThemeRequestContext,
  serviceBaseUrl,
  withObservedEvent,
  type BetterPortalConfig as PlatformConfig,
  type BetterPortalEvent,
  type BetterPortalRegistry,
  type JsonValue
} from "@betterportal/framework";
import {
  BPService,
  BetterPortalConfigSchema,
  type BPServiceDefinition,
  type BetterPortalConfig
} from "@betterportal/plugin-bsb";
import { loadEmbeddedAsset } from "./assets.js";
import { renderEmbeddedHostPage, type EmbeddedRouteLink } from "./theme/index.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3110),
  betterportal: BetterPortalConfigSchema
}, { unknownKeys: "strip" });

type SafeServiceTarget =
  | { ok: true; origin: string; path: string; url: string }
  | { ok: false; error: string };

function parseAbsoluteHttpUrl(value: string): URL | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeOrigin(value: string): string | null {
  return parseAbsoluteHttpUrl(value)?.origin ?? null;
}

function sameOrigin(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
  } catch {
    return false;
  }
}

function resolveSafeServiceViewTarget(
  service: { hostname: string } | { endpointBaseUrl: string },
  route: Parameters<typeof buildServiceViewUrl>[1],
  currentPath: string,
  themeOrigin: string
): SafeServiceTarget {
  const viewUrl = buildServiceViewUrl(service, route, currentPath);
  const parsed = parseAbsoluteHttpUrl(viewUrl);
  if (!parsed) {
    return {
      ok: false,
      error: "Invalid BetterPortal route: content service must use an absolute http(s) origin."
    };
  }

  if (sameOrigin(parsed.origin, themeOrigin)) {
    return {
      ok: false,
      error: "Invalid BetterPortal route: content service resolves to the theme origin."
    };
  }

  return {
    ok: true,
    origin: parsed.origin,
    path: `${parsed.pathname}${parsed.search}`,
    url: viewUrl
  };
}

function resolveSafeServiceTarget(
  service: { hostname: string } | { endpointBaseUrl: string },
  path: string,
  themeOrigin: string
): SafeServiceTarget {
  const baseUrl = serviceBaseUrl(service);
  const serviceOrigin = normalizeOrigin(baseUrl);
  if (!serviceOrigin) {
    return {
      ok: false,
      error: "Invalid BetterPortal route: content service must use an absolute http(s) origin."
    };
  }

  if (sameOrigin(serviceOrigin, themeOrigin)) {
    return {
      ok: false,
      error: "Invalid BetterPortal route: content service resolves to the theme origin."
    };
  }

  const resolvedPath = path.startsWith("/") ? path : `/${path}`;
  return {
    ok: true,
    origin: serviceOrigin,
    path: resolvedPath,
    url: `${baseUrl}${resolvedPath}`
  };
}

const Config = createConfigSchema(
  {
    name: "service-betterportal-theme-embedded",
    description: "Embedded BetterPortal theme",
    tags: ["betterportal", "theme", "embedded", "htmx"],
    documentation: ["./README.md"],
    image: "./betterportal-logo.svg"
  },
  PluginConfigSchema
);

const EventSchemas = createEventSchemas({
  emitEvents: {},
  onEvents: {},
  emitReturnableEvents: {},
  onReturnableEvents: {},
  emitBroadcast: {},
  onBroadcast: {}
});

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "service.betterportal.theme.embedded",
        title: "Embedded Theme",
        description: "Minimal htmx theme for embedding BetterPortal content without iframes.",
        category: "theme",
        capabilities: ["theme"]
      },
      registry: { routes: [] }
    };
  }

  private get betterportal(): BetterPortalConfig {
    return this.bp;
  }

  protected headerTrustOptions(): { trustedProxyHeaders?: boolean; cfProxy?: boolean } {
    return {
      trustedProxyHeaders: this.betterportal.trustedProxyHeaders,
      cfProxy: this.betterportal.cfProxy
    };
  }

  protected async onRegistered(_registry: BetterPortalRegistry, obs: Observable): Promise<void> {
    this.registerRoutes();
    obs.log.info("Embedded theme initialized");
  }

  private requirePortalConfig(): PlatformConfig {
    const cfg = this.getPortalConfig();
    if (!cfg) {
      throw new Error(
        "Embedded theme has no portal config yet - waiting for control-plane sync. Verify the theme is installed and the CP is reachable."
      );
    }
    return cfg;
  }

  private registerRoutes(): void {
    this.app.get("/_themes/embedded/assets/**", (event) => this.handleAsset(event));
    this.app.get("/llms.txt", (event) => this.handleLlmsTxt(event));
    this.app.get("/.well-known/bp/ai.json", (event) => this.handleAiManifest(event));
    this.app.get("/.well-known/bp/manifest", (event) => this.handleManifest(event));
    this.app.get("/.well-known/bp/public", (event) => this.handlePublicDiscovery(event));
    this.app.get("/.well-known/bp/health", (event) => this.handleHealth(event));
    this.app.get("/**", (event) => this.handleIndex(event));
  }

  private appPublicUrl(app: { hostnames: string[] } | undefined): string | undefined {
    const hostname = app?.hostnames[0];
    if (!hostname) return undefined;
    return /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`;
  }

  private resolveManagementApp(portalConfig: PlatformConfig): { appId?: string; tenantId?: string; url?: string } {
    const appId = portalConfig.configManagement.managementAppId;
    const app = appId ? portalConfig.apps.find((entry) => entry.id === appId) : undefined;
    return { appId, tenantId: app?.tenantId, url: this.appPublicUrl(app) };
  }

  private resolveConfigManagerUrl(portalConfig: PlatformConfig, tenantId: string): string | undefined {
    const tenant = portalConfig.tenants.find((entry) => entry.id === tenantId);
    const direct = tenant?.services.find((service) => service.enabled && service.serviceId === "service.betterportal.config-manager");
    if (direct) return direct.hostname;
    for (const activation of portalConfig.sharedServiceActivations.filter((entry) => entry.tenantId === tenantId && entry.enabled)) {
      const shared = portalConfig.sharedServiceCatalog.find((service) =>
        service.id === activation.sharedServiceId && service.enabled && service.serviceId === "service.betterportal.config-manager"
      );
      if (shared) return shared.baseUrl;
    }
    return undefined;
  }

  private discoveryUrls(portalConfig: PlatformConfig, tenantId: string, tenantUrl: string): { configManagerUrl?: string; catalogUrl?: string; managementDiscoveryUrl?: string; managementCurrentUrl?: string } {
    const configManagerUrl = this.resolveConfigManagerUrl(portalConfig, tenantId);
    return {
      configManagerUrl,
      catalogUrl: configManagerUrl ? `${configManagerUrl}/.well-known/bp/automation/catalog?tenantUrl=${encodeURIComponent(tenantUrl)}` : undefined,
      managementDiscoveryUrl: configManagerUrl ? `${configManagerUrl}/.well-known/bp/management` : undefined,
      managementCurrentUrl: configManagerUrl ? `${configManagerUrl}/.well-known/bp/manage/current?tenantUrl=${encodeURIComponent(tenantUrl)}` : undefined
    };
  }

  private resolveThemeAiContext(activeEvent: BetterPortalEvent): { tenant: { id: string; title: string }; app: { id: string; title: string }; tenantUrl: string; urls: ReturnType<Plugin["discoveryUrls"]>; management: ReturnType<Plugin["resolveManagementApp"]> } | null {
    const portalConfig = this.getPortalConfig();
    if (!portalConfig) return null;
    const context = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(activeEvent),
      activeEvent.req.headers.get("host") ?? undefined,
      this.headerTrustOptions()
    );
    if (!context) return null;
    const tenantUrl = activeEvent.url.origin;
    return {
      tenant: { id: context.tenant.id, title: context.tenant.title },
      app: { id: context.app.id, title: context.app.title },
      tenantUrl,
      urls: this.discoveryUrls(portalConfig, context.tenant.id, tenantUrl),
      management: this.resolveManagementApp(portalConfig)
    };
  }

  private aiManifest(context: NonNullable<ReturnType<Plugin["resolveThemeAiContext"]>>, traceId?: string): JsonValue {
    return {
      protocol: "betterportal-ai.v1",
      tenant: context.tenant,
      app: { ...context.app, url: context.tenantUrl },
      configManagerUrl: context.urls.configManagerUrl,
      automation: { catalogUrl: context.urls.catalogUrl },
      management: {
        appUrl: context.management.url,
        appId: context.management.appId,
        tenantId: context.management.tenantId,
        discoveryUrl: context.urls.managementDiscoveryUrl,
        currentUrl: context.urls.managementCurrentUrl,
        platformAdmin: {
          available: true,
          usage: "operator-only",
          aiPolicy: "do-not-use-for-user-tasks"
        }
      },
      ...(traceId ? { traceId } : {})
    } as JsonValue;
  }

  private async handleAiManifest(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.ai_manifest", (activeEvent, span) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return jsonResponse({ error: "Unable to resolve tenant/app AI context" }, 404);
      return jsonResponse(this.aiManifest(context, span.traceId));
    });
  }

  private async handleLlmsTxt(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.llms_txt", (activeEvent) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return new Response("BetterPortal app context is not available yet.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      const lines = [
        `# ${context.app.title}`,
        "",
        "This is a BetterPortal tenant app.",
        "",
        `Tenant ID: ${context.tenant.id}`,
        `Tenant Title: ${context.tenant.title}`,
        `App ID: ${context.app.id}`,
        `App URL: ${context.tenantUrl}`,
        "",
        "Discovery:",
        "- AI manifest: /.well-known/bp/ai.json",
        `- Automation catalog: ${context.urls.catalogUrl ?? "not available"}`,
        `- Management discovery: ${context.urls.managementDiscoveryUrl ?? "not available"}`,
        `- Management app URL: ${context.management.url ?? "not configured"}`,
        "",
        "Use the automation catalog for business/service actions.",
        "Use management discovery and the management app URL for user-owned app, tenant, service, route, menu, fragment, and theme configuration.",
        "Platform admin is operator-only. AI agents must not use platform admin for user tasks.",
        "If an action schema has missing required values, ask the user for those values before calling the API.",
        "Persist BetterPortal response headers from BP-SetHeader until expiry and send live headers on later BP API calls. Apply BP-RemoveHeader when returned.",
        "Referer and Origin help BetterPortal resolve tenant/app context; explicit discovered URLs and BP headers are preferred for API calls.",
        ""
      ];
      return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    });
  }

  private async handlePublicDiscovery(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.public_discovery", (activeEvent, span) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return jsonResponse({ error: "Unable to resolve tenant/app context" }, 404);
      return jsonResponse({
        protocol: "betterportal-automation.v1",
        tenantId: context.tenant.id,
        appId: context.app.id,
        tenantUrl: context.tenantUrl,
        configManagerUrl: context.urls.configManagerUrl,
        catalogUrl: context.urls.catalogUrl,
        aiManifestUrl: "/.well-known/bp/ai.json",
        managementDiscoveryUrl: context.urls.managementDiscoveryUrl,
        traceId: span.traceId
      } as JsonValue);
    });
  }

  private async handleAsset(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.asset", async (activeEvent) => {
      const assetPath = activeEvent.url.pathname.replace(/^\/_themes\/embedded\/assets\/?/, "");
      const asset = await loadEmbeddedAsset(assetPath);
      if (!asset) {
        return jsonResponse({ error: "Asset not found" }, 404);
      }

      return htmlResponse(asset.body, 200, asset.contentType, {
        "cache-control": assetPath === "embedded-core.js"
          ? "no-store"
          : "public, max-age=3600"
      });
    });
  }

  private logThemeContextResolutionFailure(event: BetterPortalEvent, error?: unknown): void {
    const obs = eventObservability(event);
    if (!obs) return;

    const normalizedError = error instanceof Error ? error : null;
    obs.logger.warn(
      "BetterPortal embedded context not resolved for request host={host} origin={origin} referer={referer}: {reason}",
      {
        host: event.req.headers.get("host") ?? "",
        origin: event.req.headers.get("origin") ?? "",
        referer: event.req.headers.get("referer") ?? "",
        reason: normalizedError?.message ?? "no active app matched request host/origin/referer"
      }
    );
  }

  private tagRequestContext(event: BetterPortalEvent, tenantId: string, appId: string): void {
    (event as unknown as { __bpTenantId?: string; __bpAppId?: string }).__bpTenantId = tenantId;
    (event as unknown as { __bpTenantId?: string; __bpAppId?: string }).__bpAppId = appId;
  }

  private async handleIndex(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.index", async (activeEvent, span) => {
      const sourceHostname = resolveThemeHostname(eventHeaders(activeEvent), this.headerTrustOptions());
      const portalConfig = this.getPortalConfig();
      if (!portalConfig) {
        return new Response(
          "<!doctype html><html><body style=\"font-family:sans-serif;padding:1rem;\">" +
          "<strong>BetterPortal embedded theme is waiting for control-plane sync.</strong>" +
          "</body></html>",
          { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
        );
      }

      const requestContext = resolveThemeRequestContext(
        portalConfig,
        eventHeaders(activeEvent),
        activeEvent.req.headers.get("host") ?? undefined,
        this.headerTrustOptions()
      );

      if (!requestContext) {
        this.logThemeContextResolutionFailure(activeEvent);
        return jsonResponse({
          error: "Unable to resolve tenant/app context for embedded theme request"
        }, 404);
      }
      this.tagRequestContext(activeEvent, requestContext.tenant.id, requestContext.app.id);

      const themeOrigin = activeEvent.url.origin;
      const currentRoute = resolveAppRoute(requestContext.app, activeEvent.url.pathname) ??
        resolveAppRoute(requestContext.app, requestContext.app.defaultRoute);

      const enabledRoutes = requestContext.app.routes.filter((route) => route.enabled);
      const routeLinks: EmbeddedRouteLink[] = enabledRoutes
        .map((route): EmbeddedRouteLink | null => {
          const routeBinding = resolveServiceForTenant(portalConfig, route.serviceId, requestContext);
          if (!routeBinding) return null;
          const safeTarget = resolveSafeServiceViewTarget(
            routeBinding.service,
            route,
            route.path,
            themeOrigin
          );
          return {
            id: route.id,
            href: route.path,
            requestUrl: safeTarget.ok ? safeTarget.url : undefined,
            serviceId: route.serviceId,
            active: route.path === (currentRoute?.path ?? requestContext.app.defaultRoute),
            error: safeTarget.ok ? undefined : safeTarget.error
          };
        })
        .filter((route): route is EmbeddedRouteLink => route !== null);
      const backgroundServices = Array.from(new Map(
        routeLinks
          .filter((route) => route.requestUrl)
          .map((route) => [route.serviceId, {
            serviceId: route.serviceId,
            origin: new URL(route.requestUrl!).origin
          }])
      ).values());

      const initialRouteBinding = currentRoute
        ? resolveServiceForTenant(portalConfig, currentRoute.serviceId, requestContext)
        : null;
      const initialSafeTarget = currentRoute && initialRouteBinding
        ? resolveSafeServiceViewTarget(
          initialRouteBinding.service,
          currentRoute,
          activeEvent.url.pathname,
          themeOrigin
        )
        : null;
      const initialRouteUrl = initialSafeTarget?.ok
        ? initialSafeTarget.url + activeEvent.url.search
        : undefined;
      const initialRouteError = initialSafeTarget && !initialSafeTarget.ok
        ? initialSafeTarget.error
        : undefined;

      const appFragments = (requestContext.app as any).fragments as Record<string, Array<{ serviceId: string; fragmentId: string; targetPath: string; enabled: boolean }>> | undefined;
      const embeddedFragments = appFragments?.embedded ?? [];
      for (const fragment of embeddedFragments.filter((entry) => entry.enabled)) {
        const binding = resolveServiceForTenant(portalConfig, fragment.serviceId, requestContext);
        if (!binding) continue;
        const safeTarget = resolveSafeServiceTarget(binding.service, fragment.targetPath, themeOrigin);
        if (!safeTarget.ok) continue;
        routeLinks.push({
          id: `fragment:${fragment.fragmentId}`,
          href: fragment.targetPath,
          requestUrl: safeTarget.url,
          serviceId: fragment.serviceId,
          active: false
        });
      }

      const originPolicy = buildOriginPolicy(requestContext);
      const discoveryUrls = this.discoveryUrls(portalConfig, requestContext.tenant.id, activeEvent.url.origin);

      return new Response(
        renderEmbeddedHostPage({
          title: requestContext.app.title,
          assetBaseUrl: "/_themes/embedded/assets",
          initialRouteUrl,
          initialRouteError,
          initialServiceId: currentRoute?.serviceId,
          routeLinks,
          backgroundServices,
          aiManifestUrl: "/.well-known/bp/ai.json",
          automationCatalogUrl: discoveryUrls.catalogUrl,
          managementDiscoveryUrl: discoveryUrls.managementDiscoveryUrl
        }),
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(sourceHostname ? { "x-bp-source-hostname": sourceHostname } : {}),
            "cache-control": "no-store",
            "x-bp-allowed-origin": originPolicy.allowedOrigins[0] ?? "",
            "x-bp-trace-id": span.traceId
          }
        }
      );
    });
  }

  private async handleManifest(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.manifest", (_activeEvent, span) => {
      return jsonResponse({
        ...this.manifest,
        traceId: span.traceId
      } as JsonValue);
    });
  }

  private async handleHealth(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.health", () => {
      return jsonResponse({
        ok: true,
        plugin: "service-betterportal-theme-embedded",
        port: this.config.port
      });
    });
  }

  async run(obs: Observable): Promise<void> {
    await super.run(obs);
  }

  async dispose(): Promise<void> {
    await super.dispose();
  }
}

export { Config, EventSchemas };
