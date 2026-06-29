import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import {
  InMemoryServiceConfigStore,
  buildServiceViewUrl,
  buildOriginPolicy,
  htmlResponse,
  inferServicePathFromViewId,
  registerServiceConfigRoutes,
  resolveServiceForTenant,
  resolveAppRoute,
  resolveThemeRequestContext,
  serviceBaseUrl,
  eventObservability,
  eventHeaders,
  jsonResponse,
  resolveThemeHostname,
  withObservedEvent,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type BetterPortalObservability,
  type BetterPortalConfig as PlatformConfig,
  type BetterPortalRegistry,
  type ConfigSchemaDescriptor,
  type JsonValue,
  type ServiceConfigAction,
  type ServiceConfigTicketClaims
} from "@betterportal/framework";
import {
  BPService,
  BetterPortalConfigSchema,
  type BPServiceDefinition,
  type BetterPortalConfig
} from "@betterportal/plugin-bsb";
import { renderBootstrap1HostPage, renderNavItems, shellStyles, renderBrand, type Bootstrap1NavItem } from "./theme/index.js";
import { toHtmlString } from "@betterportal/framework";
import { loadBootstrap1Asset } from "./assets.js";

// Parse-only base for relative request URLs. Never emit this origin.
const RELATIVE_URL_PARSE_BASE = "http://betterportal.invalid";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3100),
  betterportal: BetterPortalConfigSchema,
  defaultMode: av.enum_(["light", "dark", "system"] as const).default("system"),
  brandName: av.string().minLength(1).default("BetterPortal"),
  defaultGreetingName: av.string().minLength(1).default("User")
}, { unknownKeys: "strip" });

const THEME_CONFIG_SCHEMAS: ConfigSchemaDescriptor[] = [
  {
    id: "theme.bootstrap1.app",
    title: "Theme - Branding & Palette",
    description: "Per-app branding, palette, and mode for the bootstrap1 theme.",
    scope: "app",
    jsonSchema: {
      brandName: "string", lightLogoUrl: "string", darkLogoUrl: "string", faviconUrl: "string", mode: "string",
      primary: "string", secondary: "string", success: "string",
      info: "string", warning: "string", danger: "string"
    },
    fields: [
      { key: "brandName", title: "Brand Name", description: "Name shown in the top bar.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "lightLogoUrl", title: "Light Logo URL", description: "Logo used in light mode.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, ui: { control: "url" } },
      { key: "darkLogoUrl", title: "Dark Logo URL", description: "Logo used in dark mode. Falls back to light logo when empty.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, ui: { control: "url" } },
      { key: "faviconUrl", title: "Favicon URL", description: "Browser tab icon. Falls back to the BetterPortal favicon when empty.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, ui: { control: "url" } },
      { key: "mode", title: "Default Mode", description: "Theme mode.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "system", ui: { control: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }] } },
      { key: "primary", title: "Primary Color", description: "Bootstrap primary palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#3b82f6", ui: { control: "color" } },
      { key: "secondary", title: "Secondary Color", description: "Bootstrap secondary palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#64748b", ui: { control: "color" } },
      { key: "success", title: "Success Color", description: "Bootstrap success palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#22c55e", ui: { control: "color" } },
      { key: "info", title: "Info Color", description: "Bootstrap info palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#38bdf8", ui: { control: "color" } },
      { key: "warning", title: "Warning Color", description: "Bootstrap warning palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#f59e0b", ui: { control: "color" } },
      { key: "danger", title: "Danger Color", description: "Bootstrap danger palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false, defaultValue: "#ef4444", ui: { control: "color" } }
    ]
  }
];

const BOOTSTRAP1_ASSET_BASE_URL = "/_themes/bootstrap1/assets";
const DEFAULT_BOOTSTRAP1_LOGO_URL = `${BOOTSTRAP1_ASSET_BASE_URL}/betterportal-logo.png`;
const DEFAULT_BOOTSTRAP1_FAVICON_16_URL = `${BOOTSTRAP1_ASSET_BASE_URL}/betterportal-favicon-16.png`;
const DEFAULT_BOOTSTRAP1_FAVICON_URL = `${BOOTSTRAP1_ASSET_BASE_URL}/betterportal-favicon-32.png`;

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
  const parsed = parseAbsoluteHttpUrl(value);
  return parsed?.origin ?? null;
}

function sameOrigin(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
  } catch {
    return false;
  }
}

function resolveConcreteMode(mode: unknown, fallback: unknown): "light" | "dark" {
  if (mode === "dark" || mode === "light") return mode;
  if (fallback === "dark" || fallback === "light") return fallback;
  return "light";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/**
 * hx-trigger spec for a fragment wrapper. Besides the initial load, every
 * fragment listens for conventional reload events on <body>:
 *   bp:fragment:<location>.<fragmentId>  - reload one specific fragment
 *   bp:fragments:<pluginId>              - reload all fragments of a service
 * Any service response can fire these via the HX-Trigger header (e.g. auth
 * after login/logout); fragments that listen reload, everyone else ignores.
 */
function fragmentTriggerSpec(fragmentKey: string, pluginId?: string): string {
  const triggers = ["load", `bp:fragment:${fragmentKey} from:body`];
  if (pluginId) triggers.push(`bp:fragments:${pluginId} from:body`);
  return triggers.join(", ");
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

const Config = createConfigSchema(
  {
    name: "service-betterportal-theme-bootstrap1",
    description: "Bootstrap 5 and HTMX based BetterPortal theme",
    tags: ["betterportal", "theme", "bootstrap", "htmx"],
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
  protected configStore = new InMemoryServiceConfigStore();

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "service.betterportal.theme.bootstrap1",
        title: "Bootstrap1 Theme",
        description: "Bootstrap 5 + htmx theme that renders BetterPortal app shells.",
        category: "theme",
        capabilities: ["theme"],
        configSchemas: THEME_CONFIG_SCHEMAS as any
      },
      // Theme exposes manual routes (not bp-routes/) - registered in onRegistered.
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

  // Called by BPService.init after framework setup. Theme registers its
  // manual routes here so they sit alongside the auto-mounted /.well-known/* set.
  protected async onRegistered(_registry: BetterPortalRegistry, obs: Observable): Promise<void> {
    this.registerRoutes();
    obs.log.info("Bootstrap1 theme initialized with default mode {mode}", {
      mode: this.config.defaultMode
    });
  }

  private requirePortalConfig(): PlatformConfig {
    const cfg = this.getPortalConfig();
    if (!cfg) {
      throw new Error(
        "Bootstrap1 theme has no portal config yet - waiting for control-plane sync. Verify the theme is installed and the CP is reachable."
      );
    }
    return cfg;
  }

  private internalConfigTicket(tenantId: string): ServiceConfigTicketClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: "internal",
      aud: ["theme"],
      sub: "theme-render",
      exp: now + 60,
      iat: now,
      jti: `theme-render-${now}`,
      realm: "control-plane",
      tenantId,
      serviceId: "service.betterportal.theme.bootstrap1",
      actions: ["config.read"]
    };
  }

  private readStoredThemeValues(tenantId: string, appId: string): Record<string, unknown> {
    return this.configStore.read(this.internalConfigTicket(tenantId)).app[appId] ?? {};
  }

  private applyThemeServiceConfig(base: any, values: Record<string, unknown>): any {
    const next = {
      ...base,
      bootstrap: { ...base.bootstrap },
      light: { ...base.light },
      dark: { ...base.dark }
    };
    if (typeof values.brandName === "string") next.brandName = values.brandName;
    if (typeof values.lightLogoUrl === "string") next.lightLogoUrl = values.lightLogoUrl;
    if (typeof values.darkLogoUrl === "string") next.darkLogoUrl = values.darkLogoUrl;
    if (typeof values.faviconUrl === "string") next.faviconUrl = values.faviconUrl;
    if (values.mode === "light" || values.mode === "dark" || values.mode === "system") next.mode = values.mode;
    for (const colorKey of ["primary", "secondary", "success", "info", "warning", "danger"] as const) {
      if (typeof values[colorKey] === "string") next.bootstrap[colorKey] = values[colorKey];
    }
    return next;
  }

  private registerRoutes(): void {
    this.app.get("/_themes/bootstrap1/assets/**", (event) => this.handleAsset(event));
    this.app.get("/llms.txt", (event) => this.handleLlmsTxt(event));
    this.app.get("/.well-known/bp/ai.json", (event) => this.handleAiManifest(event));
    this.app.get("/.well-known/bp/manifest", (event) => this.handleManifest(event));
    this.app.get("/.well-known/bp/public", (event) => this.handlePublicDiscovery(event));
    this.app.get("/.well-known/bp/health", (event) => this.handleHealth(event));

    registerServiceConfigRoutes({
      app: this.app,
      serviceId: "service.betterportal.theme.bootstrap1",
      configSchemas: THEME_CONFIG_SCHEMAS,
      mode: "hybrid",
      customUiPath: "/.well-known/bp/config/ui",
      writeSuccessHeaders: { "HX-Trigger": "bp:theme-changed" },
      validateTicket: (ticketValue, event, action) => this.validateConfigTicket(ticketValue, event, action),
      validateScope: (scope) => this.validateConfigScope(scope.tenantId, scope.appId),
      readConfig: ({ ticket }) => this.configStore.read(ticket),
      writeConfig: ({ tenantId, appId, values }, { ticket }) =>
        this.configStore.write(tenantId, appId, values, ticket),
      clearConfigKey: ({ tenantId, appId, key }, { ticket }) =>
        this.configStore.clearKey?.(tenantId, appId, key, ticket) ?? this.configStore.read(ticket)
    });

    this.app.get("/.well-known/bp/config/ui", (event) => this.handleConfigUi(event));
    this.app.post("/.well-known/bp/config/ui/save", (event) => this.handleConfigUiSave(event));
    this.app.post("/.well-known/bp/config/ui/reset", (event) => this.handleConfigUiReset(event));
    this.app.get("/.well-known/bp/theme/style", (event) => this.handleThemeStyle(event));
    this.app.get("/.well-known/bp/theme/brand", (event) => this.handleThemeBrand(event));
    this.app.get("/.well-known/bp/theme/nav", (event) => this.handleThemeNav(event));
    this.app.get("/.well-known/bp/theme/fragments", (event) => this.handleThemeFragments(event));

    this.app.get("/**", (event) => this.handleIndex(event));
  }

  private resolveConfigManagerUrl(portalConfig: PlatformConfig, tenantId: string): string | undefined {
    const tenants = Array.isArray(portalConfig.tenants) ? portalConfig.tenants : [];
    const sharedServiceActivations = Array.isArray(portalConfig.sharedServiceActivations)
      ? portalConfig.sharedServiceActivations
      : [];
    const sharedServiceCatalog = Array.isArray(portalConfig.sharedServiceCatalog)
      ? portalConfig.sharedServiceCatalog
      : [];

    const tenant = tenants.find((entry) => entry.id === tenantId);
    const tenantServices = Array.isArray(tenant?.services) ? tenant.services : [];
    const direct = tenantServices.find((service) => service.enabled && service.serviceId === "service.betterportal.config-manager");
    if (direct) return direct.hostname;
    for (const activation of sharedServiceActivations.filter((entry) => entry.tenantId === tenantId && entry.enabled)) {
      const shared = sharedServiceCatalog.find((service) =>
        service.id === activation.sharedServiceId && service.enabled && service.serviceId === "service.betterportal.config-manager"
      );
      if (shared) return shared.baseUrl;
    }
    return undefined;
  }

  private appPublicUrl(app: { hostnames: string[] } | undefined): string | undefined {
    const hostname = app?.hostnames[0];
    if (!hostname) return undefined;
    return /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`;
  }

  private resolveManagementApp(portalConfig: PlatformConfig): { appId?: string; tenantId?: string; url?: string } {
    const appId = portalConfig.configManagement?.managementAppId;
    const apps = Array.isArray(portalConfig.apps) ? portalConfig.apps : [];
    const app = appId ? apps.find((entry) => entry.id === appId) : undefined;
    return { appId, tenantId: app?.tenantId, url: this.appPublicUrl(app) };
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
      resolveThemeHostname(eventHeaders(activeEvent), this.headerTrustOptions()) ?? undefined,
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
    return withObservedEvent(event, this.observability, "theme.bootstrap1.ai_manifest", (activeEvent, span) => {
      const context = this.resolveThemeAiContext(activeEvent);
      if (!context) return jsonResponse({ error: "Unable to resolve tenant/app AI context" }, 404);
      return jsonResponse(this.aiManifest(context, span.traceId));
    });
  }

  private async handleLlmsTxt(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.bootstrap1.llms_txt", (activeEvent) => {
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
    return withObservedEvent(event, this.observability, "theme.bootstrap1.public_discovery", (activeEvent, span) => {
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

  private async resolveEffectiveTheme(event: BetterPortalEvent): Promise<{ brandName: string; logoUrl?: string; faviconUrl: string; mode: "light" | "dark"; themeConfig: any; tenantId: string; appId: string } | null> {
    const portalConfig = this.requirePortalConfig();
    const reqCtx = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(event),
      resolveThemeHostname(eventHeaders(event), this.headerTrustOptions()) ?? undefined,
      this.headerTrustOptions()
    );
    if (!reqCtx) {
      this.logThemeContextResolutionFailure(event);
      return null;
    }
    this.tagRequestContext(event, reqCtx.tenant.id, reqCtx.app.id);

    const base = this.applyThemeServiceConfig(
      reqCtx.app.themeConfig,
      this.readStoredThemeValues(reqCtx.tenant.id, reqCtx.app.id)
    );

    const themeConfig = {
      ...base,
      bootstrap: { ...base.bootstrap }
    };

    const effectiveMode = resolveConcreteMode(themeConfig.mode, this.config.defaultMode);

    return {
      brandName: base.brandName ?? reqCtx.tenant.branding.brandName ?? this.config.brandName,
      logoUrl: effectiveMode === "dark"
        ? base.darkLogoUrl ?? base.lightLogoUrl
        : base.lightLogoUrl ?? base.darkLogoUrl,
      faviconUrl: base.faviconUrl ?? DEFAULT_BOOTSTRAP1_FAVICON_URL,
      mode: effectiveMode,
      themeConfig,
      tenantId: reqCtx.tenant.id,
      appId: reqCtx.app.id
    };
  }

  private async handleThemeStyle(event: BetterPortalEvent): Promise<Response> {
    const eff = await this.resolveEffectiveTheme(event);
    if (!eff) return new Response("", { status: 404 });
    const css = shellStyles(eff.mode, eff.themeConfig);
    return htmlResponse(
      `<style id="bp-theme-style" hx-get="/.well-known/bp/theme/style" hx-trigger="bp:theme-changed from:body" hx-swap="outerHTML">${css}</style>`,
      200,
      "text/html; mode=fragment",
      { "cache-control": "no-store" }
    );
  }

  private async handleThemeBrand(event: BetterPortalEvent): Promise<Response> {
    const eff = await this.resolveEffectiveTheme(event);
    if (!eff) return new Response("", { status: 404 });
    return htmlResponse(
      toHtmlString(renderBrand(eff.brandName, eff.logoUrl) as any),
      200,
      "text/html; mode=fragment",
      { "cache-control": "no-store" }
    );
  }

  private async handleThemeNav(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const mobile = url.searchParams.get("mobile") === "1";

    const portalConfig = this.requirePortalConfig();
    const requestContext = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(event),
      resolveThemeHostname(eventHeaders(event), this.headerTrustOptions()) ?? undefined,
      this.headerTrustOptions()
    );
    if (!requestContext) {
      this.logThemeContextResolutionFailure(event);
      return htmlResponse("", 200, "text/html; mode=fragment");
    }
    this.tagRequestContext(event, requestContext.tenant.id, requestContext.app.id);

    const currentPath = event.req.headers.get("hx-current-url")
      ? new URL(event.req.headers.get("hx-current-url")!).pathname
      : requestContext.app.defaultRoute;

    const navItems = this.buildAppNavItems(portalConfig, requestContext, currentPath, url.origin);
    const rendered = renderNavItems(navItems, mobile);
    const html = Array.isArray(rendered) ? rendered.map((r) => toHtmlString(r as any)).join("") : toHtmlString(rendered as any);
    return htmlResponse(html, 200, "text/html; mode=fragment", { "cache-control": "no-store" });
  }

  private buildLocationFragments(
    portalConfig: any,
    requestContext: any,
    location: string,
    themeOrigin: string
  ): Array<{ fragmentId: string; serviceId: string; pluginId?: string; url: string; fragmentKey: string }> {
    const appFragments = (requestContext.app as any).fragments as Record<string, Array<{ serviceId: string; fragmentId: string; targetPath: string; enabled: boolean }>> | undefined;
    const assignments = appFragments?.[location] ?? [];
    return assignments
      .filter((a) => a.enabled)
      .map((a) => {
        const binding = resolveServiceForTenant(portalConfig, a.serviceId, requestContext);
        if (!binding) return null;
        const safeTarget = resolveSafeServiceTarget(binding.service, a.targetPath, themeOrigin);
        if (!safeTarget.ok) return null;
        // Load-triggered fragments must be absolute before client JS runs.
        return {
          fragmentId: a.fragmentId,
          serviceId: a.serviceId,
          pluginId: (binding.service as { serviceId?: string }).serviceId,
          url: safeTarget.url,
          fragmentKey: `${location}.${a.fragmentId}`
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  private async handleThemeFragments(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const location = url.searchParams.get("location") ?? "nav";
    const portalConfig = this.requirePortalConfig();
    const requestContext = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(event),
      resolveThemeHostname(eventHeaders(event), this.headerTrustOptions()) ?? undefined,
      this.headerTrustOptions()
    );
    if (!requestContext) {
      this.logThemeContextResolutionFailure(event);
      return htmlResponse("", 200, "text/html; mode=fragment");
    }
    this.tagRequestContext(event, requestContext.tenant.id, requestContext.app.id);

    const frags = this.buildLocationFragments(portalConfig, requestContext, location, url.origin);
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const appendFragmentKey = (targetUrl: string, fragmentKey: string) =>
      `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}_f=${fragmentKey}`;
    const html = frags.map((f) =>
      `<div data-bp-fragment="${escape(f.fragmentId)}" data-bp-fragment-location="${escape(location)}" data-bp-service="${escape(f.serviceId)}" hx-get="${escape(appendFragmentKey(f.url, f.fragmentKey))}" hx-trigger="${escape(fragmentTriggerSpec(f.fragmentKey, f.pluginId))}" hx-target="this" hx-swap="innerHTML"><span class="placeholder-glow"><span class="placeholder col-12 rounded-pill"></span></span></div>`
    ).join("");
    return htmlResponse(html, 200, "text/html; mode=fragment", { "cache-control": "no-store" });
  }

  private logThemeContextResolutionFailure(event: BetterPortalEvent, error?: unknown): void {
    const obs = eventObservability(event);
    if (!obs) return;

    const normalizedError = error instanceof Error ? error : null;
    obs.logger.warn(
      "BetterPortal theme context not resolved for request host={host} origin={origin} referer={referer}: {reason}",
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

  private renderBootstrapErrorPage(input: {
    status: number;
    title: string;
    heading: string;
    message: string;
    detail?: string;
    requestUrl?: URL;
  }): Response {
    const brandName = this.config.brandName || "BetterPortal";
    const path = input.requestUrl ? `${input.requestUrl.pathname}${input.requestUrl.search}` : "";
    const html = `<!doctype html>
<html lang="en" data-bs-theme="${this.config.defaultMode === "dark" ? "dark" : "light"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)} - ${escapeHtml(brandName)}</title>
  <link rel="icon" type="image/png" sizes="16x16" href="${DEFAULT_BOOTSTRAP1_FAVICON_16_URL}">
  <link rel="icon" type="image/png" sizes="32x32" href="${DEFAULT_BOOTSTRAP1_FAVICON_URL}">
  <link rel="stylesheet" href="${BOOTSTRAP1_ASSET_BASE_URL}/bootstrap.min.css">
  <style>
    :root {
      color-scheme: light dark;
      --bp-error-bg: #f6f8fb;
      --bp-error-card: #ffffff;
      --bp-error-border: rgba(15, 23, 42, 0.1);
      --bp-error-text: #0f172a;
      --bp-error-muted: #64748b;
      --bp-error-accent: #2563eb;
    }
    [data-bs-theme="dark"] {
      --bp-error-bg: #0f172a;
      --bp-error-card: #111827;
      --bp-error-border: rgba(148, 163, 184, 0.22);
      --bp-error-text: #e5e7eb;
      --bp-error-muted: #94a3b8;
      --bp-error-accent: #60a5fa;
    }
    body {
      min-height: 100vh;
      margin: 0;
      background: var(--bp-error-bg);
      color: var(--bp-error-text);
    }
    .bp-error-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
    }
    .bp-error-card {
      width: min(100%, 44rem);
      background: var(--bp-error-card);
      border: 1px solid var(--bp-error-border);
      border-radius: 0.75rem;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.14);
      padding: clamp(1.5rem, 4vw, 2.5rem);
    }
    .bp-error-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      font-weight: 700;
      letter-spacing: 0;
    }
    .bp-error-logo {
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      display: block;
      object-fit: contain;
    }
    .bp-error-status {
      color: var(--bp-error-accent);
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    .bp-error-message {
      color: var(--bp-error-muted);
      font-size: 1.05rem;
      max-width: 36rem;
    }
    .bp-error-detail {
      margin-top: 1.5rem;
      padding: 0.875rem 1rem;
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--bp-error-muted) 10%, transparent);
      color: var(--bp-error-muted);
      font-size: 0.9rem;
    }
    .bp-error-path {
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <main class="bp-error-shell">
    <section class="bp-error-card" aria-labelledby="bp-error-title">
      <div class="bp-error-brand">
        <img class="bp-error-logo" src="${DEFAULT_BOOTSTRAP1_LOGO_URL}" alt="" width="32" height="32" loading="eager" decoding="async">
        <span>${escapeHtml(brandName)}</span>
      </div>
      <div class="bp-error-status">${input.status}</div>
      <h1 id="bp-error-title" class="h3 mb-3">${escapeHtml(input.heading)}</h1>
      <p class="bp-error-message mb-0">${escapeHtml(input.message)}</p>
      ${input.detail || path ? `<div class="bp-error-detail">
        ${input.detail ? `<div>${escapeHtml(input.detail)}</div>` : ""}
        ${path ? `<div class="bp-error-path mt-2">${escapeHtml(path)}</div>` : ""}
      </div>` : ""}
    </section>
  </main>
</body>
</html>`;
    return htmlResponse(html, input.status, "text/html", { "cache-control": "no-store" });
  }

  private buildAppNavItems(
    portalConfig: any,
    requestContext: any,
    currentPath: string,
    themeOrigin: string
  ): Bootstrap1NavItem[] {
    const routesById = new Map(requestContext.app.routes.map((r: any) => [r.id, r])) as Map<string, any>;

    const buildLinkFromRoute = (route: any, displayTitle?: string) => {
      const routeBinding = resolveServiceForTenant(portalConfig, route.serviceId, requestContext);
      if (!routeBinding) return null;
      const safeTarget = resolveSafeServiceViewTarget(routeBinding.service, route, route.path, themeOrigin);
      // Nav links keep absolute service URLs so route metadata can build the
      // service map, but unsafe theme-origin targets are withheld.
      return {
        id: route.id,
        title: displayTitle ?? route.title ?? route.id,
        href: route.path,
        requestUrl: safeTarget.ok ? safeTarget.url : undefined,
        serviceId: route.serviceId,
        active: route.path === currentPath,
        error: safeTarget.ok ? undefined : safeTarget.error
      };
    };

    type MenuItem = {
      id: string; type: string; title?: string; routeId?: string; href?: string;
      enabled?: boolean; children?: MenuItem[];
    };
    const menu = ((requestContext.app as any).menu ?? []) as MenuItem[];

    const buildLeaf = (m: MenuItem): any => {
      if (m.type !== "link" || !m.routeId) return null;
      const r = routesById.get(m.routeId);
      if (!r || !r.enabled) return null;
      const link = buildLinkFromRoute(r, m.title);
      if (!link) return null;
      return { kind: "route", route: link, breadcrumb: "" };
    };

    const buildTree = (items: MenuItem[]): any[] => items
      .filter((m) => m.enabled !== false)
      .map((m): any => {
        if (m.type === "group") {
          const leaves = (m.children ?? [])
            .filter((c) => c.enabled !== false)
            .map((c) => {
              const leaf = buildLeaf(c);
              if (!leaf) return null;
              return { kind: "route", route: leaf.route, breadcrumb: `${m.title ?? ""} / ${leaf.route.title}` };
            })
            .filter((x) => x !== null);
          if (leaves.length === 0) return null;
          return { kind: "group", id: m.id, title: m.title ?? "Group", items: leaves, active: leaves.some((x: any) => x.route.active) };
        }
        return buildLeaf(m);
      })
      .filter((x) => x !== null);

    return buildTree(menu) as Bootstrap1NavItem[];
  }

  private renderConfigUiForm(adminApiBase: string, tenantId: string, appId: string, eff: { brandName: string; lightLogoUrl: string; darkLogoUrl: string; faviconUrl: string; mode: string; primary: string; secondary: string; success: string; info: string; warning: string; danger: string }, storedKeys: Set<string>, savedFlash = false): string {
    const safeAttr = (v: string) => String(v).replace(/"/g, "&quot;");
    const isStored = (k: string) => storedKeys.has(k);
    const saveUrl = `${adminApiBase.replace(/\/+$/, "")}/apps/${encodeURIComponent(appId)}/theme-config/bootstrap1`;

    const resetForm = (key: string) => isStored(key)
      ? `<form hx-post="${saveUrl}" hx-target="#bp-theme-save-status" hx-swap="outerHTML" class="d-inline">
           <input type="hidden" name="tenantId" value="${safeAttr(tenantId)}" />
           <input type="hidden" name="appId" value="${safeAttr(appId)}" />
           <input type="hidden" name="adminApiBase" value="${safeAttr(adminApiBase)}" />
           <input type="hidden" name="resetKey" value="${safeAttr(key)}" />
           <button type="submit" class="btn btn-sm btn-link p-0">Reset to default</button>
         </form>`
      : "";

    const colorRow = (key: "primary" | "secondary" | "success" | "info" | "warning" | "danger", label: string) => `
      <div class="mb-3">
        <label class="form-label d-flex justify-content-between align-items-center">
          <span>${label}</span>
          ${resetForm(key)}
        </label>
        <div class="input-group">
          <input type="color" class="form-control form-control-color" style="width:3.5rem" value="${safeAttr(eff[key])}"
            oninput="this.nextElementSibling.value=this.value" />
          <input type="text" class="form-control font-monospace" name="${key}" value="${safeAttr(eff[key])}"
            pattern="^#[0-9a-fA-F]{6}$"
            oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))this.previousElementSibling.value=this.value" />
        </div>
      </div>`;

    return `<div id="bp-theme-designer" class="container-fluid px-0">
  <form hx-post="${saveUrl}" hx-target="#bp-theme-save-status" hx-swap="outerHTML">
    <input type="hidden" name="adminApiBase" value="${safeAttr(adminApiBase)}" />
    <input type="hidden" name="tenantId" value="${safeAttr(tenantId)}" />
    <input type="hidden" name="appId" value="${safeAttr(appId)}" />

    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="mb-1">Theme Designer</h2>
        <p class="text-secondary mb-0">Tenant: <code>${safeAttr(tenantId)}</code> - App: <code>${safeAttr(appId)}</code></p>
      </div>
      ${savedFlash
        ? `<button type="submit" class="btn btn-success">Saved OK</button>`
        : `<button type="submit" class="btn btn-success">Save Theme</button>`}
    </div>
    <div id="bp-theme-save-status" class="mb-3"></div>

    <div class="row g-4">
      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header"><strong>Branding</strong></div>
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Brand Name</span>
                ${resetForm("brandName")}
              </label>
              <input type="text" class="form-control" name="brandName" value="${safeAttr(eff.brandName)}" />
              <div class="form-text">Shown in the top bar.</div>
            </div>
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Light Logo URL</span>
                ${resetForm("lightLogoUrl")}
              </label>
              <input type="url" class="form-control" name="lightLogoUrl" value="${safeAttr(eff.lightLogoUrl)}" />
            </div>
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Dark Logo URL</span>
                ${resetForm("darkLogoUrl")}
              </label>
              <input type="url" class="form-control" name="darkLogoUrl" value="${safeAttr(eff.darkLogoUrl)}" />
              <div class="form-text">Falls back to the light logo when empty.</div>
            </div>
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Favicon URL</span>
                ${resetForm("faviconUrl")}
              </label>
              <input type="url" class="form-control" name="faviconUrl" value="${safeAttr(eff.faviconUrl)}" />
              <div class="form-text">Falls back to the BetterPortal favicon when empty.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header"><strong>Display</strong></div>
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Default Mode</span>
                ${resetForm("mode")}
              </label>
              <select class="form-select" name="mode">
                <option value="light"${eff.mode === "light" ? " selected" : ""}>Light</option>
                <option value="dark"${eff.mode === "dark" ? " selected" : ""}>Dark</option>
                <option value="system"${eff.mode === "system" ? " selected" : ""}>System (follow OS)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card border-0 shadow-sm">
          <div class="card-header"><strong>Bootstrap Palette</strong></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6 col-xl-4">${colorRow("primary", "Primary")}</div>
              <div class="col-md-6 col-xl-4">${colorRow("secondary", "Secondary")}</div>
              <div class="col-md-6 col-xl-4">${colorRow("success", "Success")}</div>
              <div class="col-md-6 col-xl-4">${colorRow("info", "Info")}</div>
              <div class="col-md-6 col-xl-4">${colorRow("warning", "Warning")}</div>
              <div class="col-md-6 col-xl-4">${colorRow("danger", "Danger")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</div>`;
  }

  private async computeEffectiveAndStored(tenantId: string, appId: string): Promise<{ eff: any; storedKeys: Set<string>; valid: boolean }> {
    const portalConfig = this.requirePortalConfig();
    const apps = Array.isArray(portalConfig.apps) ? portalConfig.apps : [];
    const tenants = Array.isArray(portalConfig.tenants) ? portalConfig.tenants : [];
    const appDef = apps.find((a) => a.id === appId);
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!appDef || !tenant) return { eff: {}, storedKeys: new Set(), valid: false };

    const storedValues = this.readStoredThemeValues(tenantId, appId);
    const base = this.applyThemeServiceConfig(appDef.themeConfig, storedValues);
    const eff = {
      brandName: base.brandName ?? tenant.branding.brandName ?? this.config.brandName,
      lightLogoUrl: base.lightLogoUrl ?? "",
      darkLogoUrl: base.darkLogoUrl ?? "",
      faviconUrl: base.faviconUrl ?? "",
      mode: base.mode ?? "system",
      primary: base.bootstrap.primary ?? "#3b82f6",
      secondary: base.bootstrap.secondary ?? "#64748b",
      success: base.bootstrap.success ?? "#22c55e",
      info: base.bootstrap.info ?? "#38bdf8",
      warning: base.bootstrap.warning ?? "#f59e0b",
      danger: base.bootstrap.danger ?? "#ef4444"
    };

    return {
      eff,
      storedKeys: new Set([
        ...Object.keys(storedValues)
      ]),
      valid: true
    };
  }

  private async handleConfigUi(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const adminApiBase = url.searchParams.get("adminApiBase") ?? "/.well-known/bp/admin";

    if (!tenantId || !appId) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or appId.</div>`, 200, "text/html; mode=fragment");
    }
    const { eff, storedKeys, valid } = await this.computeEffectiveAndStored(tenantId, appId);
    if (!valid) {
      return htmlResponse(`<div class="alert alert-danger">App or tenant not found.</div>`, 200, "text/html; mode=fragment");
    }

    return htmlResponse(this.renderConfigUiForm(adminApiBase, tenantId, appId, eff, storedKeys), 200, "text/html; mode=fragment");
  }

  private async handleConfigUiSave(event: BetterPortalEvent): Promise<Response> {
    const formData = await event.req.formData();
    const tenantId = String(formData.get("tenantId") ?? "");
    const appId = String(formData.get("appId") ?? "");
    const adminApiBase = String(formData.get("adminApiBase") ?? "/.well-known/bp/admin");
    if (!tenantId || !appId) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or appId.</div>`, 200, "text/html; mode=fragment");
    }
    if (!(await this.validateConfigScope(tenantId, appId))) {
      return htmlResponse(`<div class="alert alert-danger">App or tenant not found.</div>`, 200, "text/html; mode=fragment");
    }

    const values: Record<string, unknown> = {};
    formData.forEach((v, k) => {
      if (k === "tenantId" || k === "appId" || k === "adminApiBase") return;
      if (typeof v === "string" && v !== "") values[k] = v;
    });

    const now = Math.floor(Date.now() / 1000);
    this.configStore.write(tenantId, appId, values, {
      iss: "internal", aud: ["theme"], sub: "save", exp: now + 60, iat: now,
      jti: `save-${now}`, realm: "control-plane",
      tenantId,
      serviceId: "service.betterportal.theme.bootstrap1",
      actions: ["config.write"]
    });

    const { eff, storedKeys } = await this.computeEffectiveAndStored(tenantId, appId);
    return htmlResponse(
      this.renderConfigUiForm(adminApiBase, tenantId, appId, eff, storedKeys, true),
      200,
      "text/html; mode=fragment",
      { "HX-Trigger": "bp:theme-changed" }
    );
  }

  private async handleConfigUiReset(event: BetterPortalEvent): Promise<Response> {
    const formData = await event.req.formData();
    const tenantId = String(formData.get("tenantId") ?? "");
    const appId = String(formData.get("appId") ?? "");
    const key = String(formData.get("key") ?? "");
    const adminApiBase = String(formData.get("adminApiBase") ?? "/.well-known/bp/admin");
    if (!tenantId || !appId || !key) {
      return htmlResponse(`<div class="alert alert-danger">Missing fields.</div>`, 200, "text/html; mode=fragment");
    }
    if (!(await this.validateConfigScope(tenantId, appId))) {
      return htmlResponse(`<div class="alert alert-danger">App or tenant not found.</div>`, 200, "text/html; mode=fragment");
    }

    const now = Math.floor(Date.now() / 1000);
    const ticket = {
      iss: "internal", aud: ["theme"], sub: "reset", exp: now + 60, iat: now,
      jti: `reset-${now}`, realm: "control-plane" as const,
      tenantId, appId,
      serviceId: "service.betterportal.theme.bootstrap1",
      actions: ["config.write" as const]
    };
    this.configStore.clearKey?.(tenantId, appId, key, ticket);

    const { eff, storedKeys } = await this.computeEffectiveAndStored(tenantId, appId);
    return htmlResponse(
      this.renderConfigUiForm(adminApiBase, tenantId, appId, eff, storedKeys, true),
      200,
      "text/html; mode=fragment",
      { "HX-Trigger": "bp:theme-changed" }
    );
  }

  private async handleAsset(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.bootstrap1.asset", async (activeEvent) => {
      const assetPath = activeEvent.url.pathname.replace(/^\/_themes\/bootstrap1\/assets\/?/, "");
      const asset = await loadBootstrap1Asset(assetPath);
      if (!asset) {
        return jsonResponse({
          error: "Theme asset not found"
        }, 404);
      }

      return new Response(asset.body, {
        status: 200,
        headers: {
          "content-type": asset.contentType,
          // The shell runtime (standalone or inside the core bundle) changes with
          // theme deploys - never let browsers serve a stale copy.
          "cache-control": assetPath === "bootstrap1-shell.js" || assetPath === "bootstrap1-core.js"
            ? "no-store"
            : "public, max-age=3600"
        }
      });
    });
  }

  private async handleIndex(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.bootstrap1.index", async (activeEvent, span) => {
      const sourceHostname = resolveThemeHostname(eventHeaders(activeEvent), this.headerTrustOptions());
      // Theme reads config from the synced cache delivered by CM. If the first sync
      // hasn't completed yet (fresh service, CP unreachable), surface a friendly hint.
      const portalConfig = this.getPortalConfig();
      if (!portalConfig) {
        return this.renderBootstrapErrorPage({
          status: 503,
          title: "Portal unavailable",
          heading: "BetterPortal is not ready yet",
          message: "The theme has not received app configuration from the control plane.",
          detail: "Complete bootstrap in config-manager or check the control-plane sync for this service.",
          requestUrl: activeEvent.url
        });
      }
      const requestContext = resolveThemeRequestContext(
        portalConfig,
        eventHeaders(activeEvent),
        resolveThemeHostname(eventHeaders(activeEvent), this.headerTrustOptions()) ?? undefined,
        this.headerTrustOptions()
      );

      if (!requestContext) {
        this.logThemeContextResolutionFailure(activeEvent);
        return this.renderBootstrapErrorPage({
          status: 404,
          title: "Portal not found",
          heading: "This portal is not configured",
          message: "The request hostname, origin, or referer did not match an active BetterPortal tenant app.",
          detail: "Check that this domain is configured on the app and that the app and tenant are enabled.",
          requestUrl: activeEvent.url
        });
      }
      this.tagRequestContext(activeEvent, requestContext.tenant.id, requestContext.app.id);

      const themeOrigin = activeEvent.url.origin;
      const currentRoute = resolveAppRoute(requestContext.app, activeEvent.url.pathname);
      const routeNotFound = !currentRoute;

      const routesById = new Map(requestContext.app.routes.map((r) => [r.id, r]));
      const enabledRoutes = requestContext.app.routes.filter((r) => r.enabled);

      const buildLinkFromRoute = (route: typeof enabledRoutes[number], displayTitle?: string) => {
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
          title: displayTitle ?? route.title ?? route.id,
          href: route.path,
          requestUrl: safeTarget.ok ? safeTarget.url : undefined,
          serviceId: route.serviceId,
          active: route.path === (currentRoute?.path ?? requestContext.app.defaultRoute),
          error: safeTarget.ok ? undefined : safeTarget.error
        };
      };

      // Nav is driven exclusively by app.menu. Empty menu -> empty nav.
      type MenuItem = {
        id: string; type: string; title?: string; routeId?: string; href?: string;
        enabled?: boolean; defaultExpanded?: boolean; children?: MenuItem[];
      };
      const menu = ((requestContext.app as any).menu ?? []) as MenuItem[];

      const buildLeafFromMenu = (m: MenuItem): { kind: "route"; route: ReturnType<typeof buildLinkFromRoute>; breadcrumb: string } | null => {
        if (m.type !== "link" || !m.routeId) return null;
        const r = routesById.get(m.routeId);
        if (!r || !r.enabled) return null;
        const link = buildLinkFromRoute(r, m.title);
        if (!link) return null;
        return { kind: "route", route: link, breadcrumb: "" };
      };

      const buildNavTree = (items: MenuItem[]): Array<Record<string, unknown>> => {
        return items
          .filter((m) => m.enabled !== false)
          .map((m) => {
            if (m.type === "group") {
              const leaves = (m.children ?? [])
                .filter((c) => c.enabled !== false)
                .map((c) => {
                  const leaf = buildLeafFromMenu(c);
                  if (!leaf || !leaf.route) return null;
                  return {
                    kind: "route" as const,
                    route: leaf.route,
                    breadcrumb: `${m.title ?? ""} / ${leaf.route.title}`
                  };
                })
                .filter((x): x is NonNullable<typeof x> => x !== null);
              if (leaves.length === 0) return null;
              return {
                kind: "group" as const,
                id: m.id,
                title: m.title ?? "Group",
                items: leaves,
                active: leaves.some((x) => x.route.active),
                defaultExpanded: m.defaultExpanded === true
              };
            }
            const leaf = buildLeafFromMenu(m);
            return leaf && leaf.route ? leaf : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      };

      const navItems = buildNavTree(menu);

      // routeLinks: every enabled app route - NOT just menu leaves - so the
      // client service map (data-bp-services) covers all bound services. Menu-
      // less routes like the auth service's /login and /register must still
      // resolve a service origin for header ownership/scoping on the client.
      const routeLinks = enabledRoutes
        .map((r) => buildLinkFromRoute(r))
        .filter((x): x is NonNullable<ReturnType<typeof buildLinkFromRoute>> => x !== null);

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
      // Carry the query string through to the service (e.g. /login?next=...) -
      // the tenant URL's search params belong to the view, not the shell.
      const initialRouteUrl = initialSafeTarget?.ok
        ? initialSafeTarget.url + activeEvent.url.search
        : undefined;
      const initialRouteError = routeNotFound
        ? "No enabled route matches this path."
        : initialSafeTarget && !initialSafeTarget.ok
          ? initialSafeTarget.error
          : undefined;

      const resolvedFragments: Record<string, Array<{
        fragmentId: string;
        serviceId: string;
        pluginId?: string;
        url: string;
        fragmentKey: string;
      }>> = {};

      // New fragments config
      const appFragments = (requestContext.app as any).fragments as Record<string, Array<{ serviceId: string; fragmentId: string; targetPath: string; enabled: boolean }>> | undefined;

      if (appFragments && Object.keys(appFragments).length > 0) {
        for (const [location, assignments] of Object.entries(appFragments)) {
          resolvedFragments[location] = assignments
            .filter(a => a.enabled)
            .map(a => {
              const binding = resolveServiceForTenant(portalConfig, a.serviceId, requestContext);
              if (!binding) return null;
              const safeTarget = resolveSafeServiceTarget(binding.service, a.targetPath, themeOrigin);
              if (!safeTarget.ok) return null;
              // Load-triggered fragments must be absolute before client JS runs.
              return {
                fragmentId: a.fragmentId,
                serviceId: a.serviceId,
                pluginId: (binding.service as { serviceId?: string }).serviceId,
                url: safeTarget.url,
                fragmentKey: `${location}.${a.fragmentId}`
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
        }
      } else {
        // Backward compat: map old slots to fragments
        for (const slot of requestContext.app.slots) {
          if (!slot.enabled) continue;
          const dotIdx = slot.slotId.indexOf(".");
          if (dotIdx === -1) continue;
          const location = slot.slotId.slice(0, dotIdx);
          const id = slot.slotId.slice(dotIdx + 1);
          const binding = resolveServiceForTenant(portalConfig, slot.serviceId, requestContext);
          if (!binding) continue;
          if (!resolvedFragments[location]) resolvedFragments[location] = [];
          const viewPath = inferServicePathFromViewId(slot.viewId);
          const safeTarget = resolveSafeServiceTarget(binding.service, viewPath, themeOrigin);
          if (!safeTarget.ok) continue;
          resolvedFragments[location].push({
            fragmentId: id,
            serviceId: slot.serviceId,
            pluginId: (binding.service as { serviceId?: string }).serviceId,
            url: safeTarget.url,
            fragmentKey: slot.slotId
          });
        }
      }

      const originPolicy = buildOriginPolicy(requestContext);

      const baseTheme = this.applyThemeServiceConfig(
        requestContext.app.themeConfig,
        this.readStoredThemeValues(requestContext.tenant.id, requestContext.app.id)
      );

      const mergedThemeConfig = {
        ...baseTheme,
        bootstrap: { ...baseTheme.bootstrap }
      };

      const effectiveMode = resolveConcreteMode(mergedThemeConfig.mode, this.config.defaultMode);

      // Resolve the login URL from the app's auth config. The theme is the only
      // party that knows where the auth provider lives - services only know its
      // JWKS for token validation, not a URL to navigate to. The client shell
      // redirects here on a 401 (see assets.ts htmx_before_swap).
      let loginUrl: string | undefined;
      const appAuth = (requestContext.app as { auth?: { serviceId?: string; loginViewId?: string } }).auth;
      const fullScreen = currentRoute?.chrome?.fullScreen === true;
      const discoveryUrls = this.discoveryUrls(portalConfig, requestContext.tenant.id, activeEvent.url.origin);
      if (appAuth?.serviceId) {
        const authBinding = resolveServiceForTenant(portalConfig, appAuth.serviceId, requestContext);
        if (authBinding) {
          const loginPath = appAuth.loginViewId
            ? inferServicePathFromViewId(appAuth.loginViewId)
            : "/login";
          const safeLogin = resolveSafeServiceTarget(authBinding.service, loginPath, themeOrigin);
          if (safeLogin.ok) loginUrl = safeLogin.url;
        }
      }

      return new Response(
        renderBootstrap1HostPage({
          title: requestContext.app.title,
          brandName: baseTheme.brandName ?? requestContext.tenant.branding.brandName ?? this.config.brandName,
          logoUrl: effectiveMode === "dark"
            ? baseTheme.darkLogoUrl ?? baseTheme.lightLogoUrl
            : baseTheme.lightLogoUrl ?? baseTheme.darkLogoUrl,
          faviconUrl: baseTheme.faviconUrl ?? DEFAULT_BOOTSTRAP1_FAVICON_URL,
          themeMode: effectiveMode,
          themeConfig: mergedThemeConfig,
          assetBaseUrl: "/_themes/bootstrap1/assets",
          currentPath: activeEvent.url.pathname,
          initialRouteUrl,
          initialRouteError,
          initialRouteStatus: routeNotFound ? 404 : undefined,
          initialServiceId: currentRoute?.serviceId,
          routeLinks,
          navItems: navItems as any,
          resolvedFragments,
          loginUrl,
          fullScreen,
          aiManifestUrl: "/.well-known/bp/ai.json",
          automationCatalogUrl: discoveryUrls.catalogUrl,
          managementDiscoveryUrl: discoveryUrls.managementDiscoveryUrl
        }),
        {
          status: routeNotFound ? 404 : 200,
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
    return withObservedEvent(event, this.observability, "theme.bootstrap1.manifest", (_activeEvent, span) => {
      return jsonResponse({
        ...this.manifest,
        traceId: span.traceId
      } as JsonValue);
    });
  }

  private async handleHealth(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.bootstrap1.health", () => {
      return jsonResponse({
        ok: true,
        plugin: "service-betterportal-theme-bootstrap1",
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
