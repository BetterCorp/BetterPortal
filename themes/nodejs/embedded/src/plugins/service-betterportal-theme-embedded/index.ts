import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import {
  buildOriginPolicy,
  buildThemeAiManifest,
  resolveThemeLlmsContext,
  renderThemeLlmsApi,
  renderThemeLlmsDev,
  renderThemeLlmsIndex,
  renderThemeLlmsUi,
  buildServiceViewUrl,
  eventHeaders,
  eventObservability,
  eventSessionId,
  htmlResponse,
  jsonResponse,
  resolveAppRoute,
  resolveRequestContextDetailed,
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
import { EmbeddedDeveloperResources } from "./resources.js";
import { renderEmbeddedHostPage, type EmbeddedRouteLink } from "./shell/index.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3110),
  betterportal: BetterPortalConfigSchema
});

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
  if (!viewUrl) {
    return {
      ok: false,
      error: "Invalid BetterPortal route: required route parameters are unresolved."
    };
  }
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
    image: "./betterportal-logo.png"
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
        pluginId: "org.betterportal.theme.embedded",
        title: "Embedded Theme",
        description: "Minimal htmx theme for embedding BetterPortal content without iframes.",
        category: "theme",
        capabilities: ["theme"],
        shell: { service: "embedded", renderer: "embedded", fragments: [] },
        developerResources: EmbeddedDeveloperResources
      }
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
    this.app.get("/llms-api.txt", (event) => this.handleLlmsApi(event));
    this.app.get("/llms-dev.txt", (event) => this.handleLlmsDev(event));
    this.app.get("/llms-ui.txt", (event) => this.handleLlmsUi(event));
    this.app.get("/.well-known/bp/manifest", (event) => this.handleManifest(event));
    this.app.get("/.well-known/bp/public", (event) => this.handlePublicDiscovery(event));
    this.app.get("/.well-known/bp/health", (event) => this.handleHealth(event));
    this.app.get("/**", (event) => this.handleIndex(event));
  }

  private resolveThemeAiContext(activeEvent: BetterPortalEvent): ReturnType<typeof resolveThemeLlmsContext> {
    const portalConfig = this.getPortalConfig();
    return portalConfig
      ? resolveThemeLlmsContext(portalConfig, eventHeaders(activeEvent), activeEvent.url.origin, this.headerTrustOptions())
      : null;
  }

  private handleLlmsDocument(
    event: BetterPortalEvent,
    name: string,
    render: (context: NonNullable<ReturnType<typeof resolveThemeLlmsContext>>) => string
  ): Promise<Response> {
    return withObservedEvent(event, this.observability, `theme.embedded.${name}`, (activeEvent) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return new Response("BetterPortal app context is not available yet.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      return new Response(render(context), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    });
  }

  private async handleAiManifest(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.ai_manifest", (activeEvent, span) => {
      const context = this.resolveThemeAiContext(activeEvent);
      return context
        ? jsonResponse(buildThemeAiManifest(context, EmbeddedDeveloperResources, span.traceId))
        : jsonResponse({ error: "Unable to resolve tenant/app AI context" }, 404);
    });
  }

  private handleLlmsTxt(event: BetterPortalEvent): Promise<Response> {
    return this.handleLlmsDocument(event, "llms_txt", renderThemeLlmsIndex);
  }

  private handleLlmsApi(event: BetterPortalEvent): Promise<Response> {
    return this.handleLlmsDocument(event, "llms_api", renderThemeLlmsApi);
  }

  private handleLlmsDev(event: BetterPortalEvent): Promise<Response> {
    return this.handleLlmsDocument(event, "llms_dev", renderThemeLlmsDev);
  }

  private handleLlmsUi(event: BetterPortalEvent): Promise<Response> {
    return this.handleLlmsDocument(event, "llms_ui", (context) => renderThemeLlmsUi(context, EmbeddedDeveloperResources));
  }

  private async handlePublicDiscovery(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.public_discovery", (activeEvent, span) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return jsonResponse({ error: "Unable to resolve tenant/app context" }, 404);
      return jsonResponse({
        protocol: "betterportal-automation.v1",
        tenantId: context.tenant.id,
        appId: context.app.id,
        tenantUrl: context.app.url,
        configManagerUrl: context.configManagerUrl,
        catalogUrl: context.catalogUrl,
        apiGuideUrl: context.apiGuideUrl,
        aiManifestUrl: "/.well-known/bp/ai.json",
        resourcesUrl: "/.well-known/bp/resources",
        managementDiscoveryUrl: context.management.discoveryUrl,
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
    const portalConfig = this.getPortalConfig();
    const resolution = portalConfig
      ? resolveRequestContextDetailed(portalConfig, eventHeaders(event), "theme", this.headerTrustOptions())
      : null;
    obs.logger.warn(
      "BetterPortal embedded context not resolved: host={host} authority={authority} origin={origin} referer={referer} altUsed={altUsed} candidates={candidates}: {reason}",
      {
        host: event.req.headers.get("host") ?? "",
        authority: event.req.headers.get("authority") ?? "",
        origin: event.req.headers.get("origin") ?? "",
        referer: event.req.headers.get("referer") ?? "",
        altUsed: event.req.headers.get("alt-used") ?? "",
        candidates: resolution?.candidates.map((candidate) =>
          `${candidate.source}:${candidate.host}${candidate.matchedAppId ? `->${candidate.matchedAppId}` : ""}`
        ).join(",") ?? "",
        reason: normalizedError?.message ?? "no active app matched request host/origin/referer"
      }
    );
  }

  private tagRequestContext(event: BetterPortalEvent, tenantId: string, appId: string): void {
    (event as unknown as { __bpTenantId?: string; __bpAppId?: string }).__bpTenantId = tenantId;
    (event as unknown as { __bpTenantId?: string; __bpAppId?: string }).__bpAppId = appId;
  }

  private async handleIndex(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.embedded.index", async (activeEvent) => {
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
        resolveThemeHostname(eventHeaders(activeEvent), this.headerTrustOptions()) ?? undefined,
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
      const discoveryUrls = this.resolveThemeAiContext(activeEvent);

      return new Response(
        renderEmbeddedHostPage({
          title: requestContext.app.title,
          assetBaseUrl: "/_themes/embedded/assets",
          initialRouteUrl,
          initialRouteError,
          initialServiceId: currentRoute?.serviceId,
          routeLinks,
          chrome: currentRoute?.chrome,
          aiManifestUrl: "/.well-known/bp/ai.json",
          automationCatalogUrl: discoveryUrls?.catalogUrl,
          managementDiscoveryUrl: discoveryUrls?.management.discoveryUrl,
          sessionId: eventSessionId(activeEvent)
        }),
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(sourceHostname ? { "x-bp-source-hostname": sourceHostname } : {}),
            "cache-control": "no-store",
            "x-bp-allowed-origin": originPolicy.allowedOrigins[0] ?? ""
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

}

export { Config, EventSchemas };
