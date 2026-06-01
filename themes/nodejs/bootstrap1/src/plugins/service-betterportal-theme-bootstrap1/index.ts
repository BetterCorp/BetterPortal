import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { createServer, type Server } from "node:http";
import {
  FileBackedBetterPortalConfigProvider,
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
  createBetterPortalApp,
  createBetterPortalNodeHandler,
  eventHeaders,
  jsonResponse,
  resolveThemeHostname,
  withObservedEvent,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type BetterPortalObservability,
  type ConfigSchemaDescriptor,
  type ServiceConfigAction,
  type ServiceConfigTicketClaims
} from "@betterportal/framework-nodejs";
import { createBsbObservability } from "@betterportal/plugin-bsb-nodejs";
import { Bootstrap1Manifest, renderBootstrap1HostPage, renderNavItems, shellStyles, type Bootstrap1NavItem } from "./theme/index.js";
import { toHtmlString } from "@betterportal/framework-nodejs";
import { loadBootstrap1Asset } from "./assets.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3100),
  bpConfigPath: av.string().minLength(1),
  defaultMode: av.enum_(["light", "dark"] as const).default("light"),
  brandName: av.string().minLength(1).default("BetterPortal"),
  defaultGreetingName: av.string().minLength(1).default("Mitchell"),
  configApiToken: av.string().minLength(1).default("bp-dev-config-token")
}, { unknownKeys: "strip" });

const THEME_CONFIG_SCHEMAS: ConfigSchemaDescriptor[] = [
  {
    id: "theme.bootstrap1.app",
    title: "Theme — Branding & Palette",
    description: "Per-app branding, palette, and mode for the bootstrap1 theme.",
    scope: "app",
    jsonSchema: {
      brandName: "string", mode: "string",
      primary: "string", secondary: "string", success: "string",
      info: "string", warning: "string", danger: "string"
    },
    fields: [
      { key: "brandName", title: "Brand Name", description: "Name shown in the top bar.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "mode", title: "Default Mode", description: "light / dark / system", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "primary", title: "Primary Color", description: "Bootstrap primary palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "secondary", title: "Secondary Color", description: "Bootstrap secondary palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "success", title: "Success Color", description: "Bootstrap success palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "info", title: "Info Color", description: "Bootstrap info palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "warning", title: "Warning Color", description: "Bootstrap warning palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
      { key: "danger", title: "Danger Color", description: "Bootstrap danger palette color (hex).", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false }
    ]
  }
];

const Config = createConfigSchema(
  {
    name: "service-betterportal-theme-bootstrap1",
    description: "Bootstrap 5 and HTMX based BetterPortal theme",
    tags: ["betterportal", "theme", "bootstrap", "htmx"],
    documentation: ["./README.md"]
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

export class Plugin extends BSBService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  readonly initBeforePlugins: string[] = [];
  readonly initAfterPlugins: string[] = [];
  readonly runBeforePlugins: string[] = [];
  readonly runAfterPlugins: string[] = [];
  private app!: BetterPortalH3App;
  private server!: Server;
  private observability!: BetterPortalObservability;
  private configStore = new InMemoryServiceConfigStore();

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  async init(obs: Observable): Promise<void> {
    this.observability = createBsbObservability(obs).setAttributes({
      "bp.plugin.id": "service-betterportal-theme-bootstrap1",
      "bp.plugin.category": "theme"
    });
    this.app = createBetterPortalApp();
    this.server = createServer(createBetterPortalNodeHandler(this.app));
    this.registerRoutes();
    obs.log.info("Bootstrap1 theme initialized with default mode {mode}", {
      mode: this.config.defaultMode
    });
  }

  private registerRoutes(): void {
    this.app.get("/_themes/bootstrap1/assets/**", (event) => this.handleAsset(event));
    this.app.get("/.well-known/bp/manifest", (event) => this.handleManifest(event));
    this.app.get("/.well-known/bp/health", (event) => this.handleHealth(event));

    registerServiceConfigRoutes({
      app: this.app,
      serviceId: "service.betterportal.theme-bootstrap1",
      configSchemas: THEME_CONFIG_SCHEMAS,
      mode: "hybrid",
      customUiPath: "/.well-known/bp/config/ui",
      writeSuccessHeaders: { "HX-Trigger": "bp:theme-changed" },
      validateTicket: (ticketValue, event, action) => this.validateDevToken(ticketValue, event, action),
      readConfig: ({ ticket }) => this.configStore.read(ticket),
      writeConfig: ({ tenantId, appId, values }, { ticket }) =>
        this.configStore.write(tenantId, appId, values, ticket)
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

  private async resolveEffectiveTheme(event: BetterPortalEvent): Promise<{ brandName: string; mode: "light" | "dark"; themeConfig: any; tenantId: string; appId: string } | null> {
    const configProvider = new FileBackedBetterPortalConfigProvider(this.config.bpConfigPath);
    const portalConfig = await configProvider.loadConfig();
    const reqCtx = resolveThemeRequestContext(portalConfig, eventHeaders(event), event.req.headers.get("host") ?? undefined);
    if (!reqCtx) return null;

    const now = Math.floor(Date.now() / 1000);
    const stored = (this.configStore.read({
      iss: "internal", aud: ["theme"], sub: "render", exp: now + 60, iat: now,
      jti: `read-${now}`, realm: "control-plane",
      tenantId: reqCtx.tenant.id, appId: reqCtx.app.id,
      serviceId: "service.betterportal.theme-bootstrap1",
      actions: ["config.read"]
    }).app[reqCtx.app.id] ?? {}) as Record<string, unknown>;

    const base = reqCtx.app.themeConfig;
    const storedBrand = typeof stored.brandName === "string" ? stored.brandName : undefined;
    const storedMode = typeof stored.mode === "string" ? stored.mode : undefined;

    const themeConfig = {
      ...base,
      ...(storedMode ? { mode: storedMode } : {}),
      bootstrap: {
        ...base.bootstrap,
        ...Object.fromEntries(
          ["primary","secondary","success","info","warning","danger","light","dark"]
            .filter((k) => typeof stored[k] === "string")
            .map((k) => [k, stored[k]])
        )
      }
    };

    const effectiveMode = themeConfig.mode === "dark" ? "dark" :
      themeConfig.mode === "system" ? this.config.defaultMode :
      themeConfig.mode === "light" ? "light" : this.config.defaultMode;

    return {
      brandName: storedBrand ?? reqCtx.tenant.branding.brandName ?? this.config.brandName,
      mode: effectiveMode as "light" | "dark",
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
      "text/html; mode=fragment"
    );
  }

  private async handleThemeBrand(event: BetterPortalEvent): Promise<Response> {
    const eff = await this.resolveEffectiveTheme(event);
    if (!eff) return new Response("", { status: 404 });
    const escaped = eff.brandName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return htmlResponse(escaped, 200, "text/html; mode=fragment");
  }

  private async handleThemeNav(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const mobile = url.searchParams.get("mobile") === "1";

    const configProvider = new FileBackedBetterPortalConfigProvider(this.config.bpConfigPath);
    const portalConfig = await configProvider.loadConfig();
    const requestContext = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(event),
      event.req.headers.get("host") ?? undefined
    );
    if (!requestContext) return htmlResponse("", 200, "text/html; mode=fragment");

    const currentPath = event.req.headers.get("hx-current-url")
      ? new URL(event.req.headers.get("hx-current-url")!).pathname
      : requestContext.app.defaultRoute;

    const navItems = this.buildAppNavItems(portalConfig, requestContext, currentPath);
    const rendered = renderNavItems(navItems, mobile);
    const html = Array.isArray(rendered) ? rendered.map((r) => toHtmlString(r as any)).join("") : toHtmlString(rendered as any);
    return htmlResponse(html, 200, "text/html; mode=fragment");
  }

  private buildLocationFragments(
    portalConfig: any,
    requestContext: any,
    location: string
  ): Array<{ fragmentId: string; serviceId: string; url: string; fragmentKey: string }> {
    const appFragments = (requestContext.app as any).fragments as Record<string, Array<{ serviceId: string; fragmentId: string; targetPath: string; enabled: boolean }>> | undefined;
    const assignments = appFragments?.[location] ?? [];
    return assignments
      .filter((a) => a.enabled)
      .map((a) => {
        const binding = resolveServiceForTenant(portalConfig, a.serviceId, requestContext);
        if (!binding) return null;
        // Emit RELATIVE service path. Client absolutizes via data-bp-service.
        return {
          fragmentId: a.fragmentId,
          serviceId: a.serviceId,
          url: a.targetPath,
          fragmentKey: `${location}.${a.fragmentId}`
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  private async handleThemeFragments(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const location = url.searchParams.get("location") ?? "nav";
    const configProvider = new FileBackedBetterPortalConfigProvider(this.config.bpConfigPath);
    const portalConfig = await configProvider.loadConfig();
    const requestContext = resolveThemeRequestContext(
      portalConfig,
      eventHeaders(event),
      event.req.headers.get("host") ?? undefined
    );
    if (!requestContext) return htmlResponse("", 200, "text/html; mode=fragment");

    const frags = this.buildLocationFragments(portalConfig, requestContext, location);
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const html = frags.map((f) =>
      `<div data-bp-fragment="${escape(f.fragmentId)}" data-bp-fragment-location="${escape(location)}" data-bp-service="${escape(f.serviceId)}" hx-get="${escape(f.url)}?_f=${escape(f.fragmentKey)}" hx-trigger="load" hx-target="this" hx-swap="innerHTML"><span class="placeholder-glow"><span class="placeholder col-12 rounded-pill"></span></span></div>`
    ).join("");
    return htmlResponse(html, 200, "text/html; mode=fragment");
  }

  private buildAppNavItems(
    portalConfig: any,
    requestContext: any,
    currentPath: string
  ): Bootstrap1NavItem[] {
    const routesById = new Map(requestContext.app.routes.map((r: any) => [r.id, r])) as Map<string, any>;

    const buildLinkFromRoute = (route: any, displayTitle?: string) => {
      const routeBinding = resolveServiceForTenant(portalConfig, route.serviceId, requestContext);
      if (!routeBinding) return null;
      // Emit RELATIVE service path. Client-side resolveServiceLinks (with
      // data-bp-service ancestor) absolutizes to the correct service origin.
      return {
        id: route.id,
        title: displayTitle ?? route.title ?? route.id,
        href: route.path,
        requestUrl: route.targetPath ?? route.path,
        serviceId: route.serviceId,
        active: route.path === currentPath
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

  private renderConfigUiForm(themeBase: string, tenantId: string, appId: string, eff: { brandName: string; mode: string; primary: string; secondary: string; success: string; info: string; warning: string; danger: string }, storedKeys: Set<string>, savedFlash = false): string {
    const safeAttr = (v: string) => String(v).replace(/"/g, "&quot;");
    const isStored = (k: string) => storedKeys.has(k);
    const base = themeBase.replace(/\/+$/, "");

    const resetForm = (key: string) => isStored(key)
      ? `<form hx-post="${base}/.well-known/bp/config/ui/reset" hx-target="#bp-theme-designer" hx-swap="outerHTML" class="d-inline">
           <input type="hidden" name="tenantId" value="${safeAttr(tenantId)}" />
           <input type="hidden" name="appId" value="${safeAttr(appId)}" />
           <input type="hidden" name="key" value="${safeAttr(key)}" />
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
  <form hx-post="${base}/.well-known/bp/config/ui/save" hx-target="#bp-theme-designer" hx-swap="outerHTML">
    <input type="hidden" name="tenantId" value="${safeAttr(tenantId)}" />
    <input type="hidden" name="appId" value="${safeAttr(appId)}" />

    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="mb-1">Theme Designer</h2>
        <p class="text-secondary mb-0">Tenant: <code>${safeAttr(tenantId)}</code> · App: <code>${safeAttr(appId)}</code></p>
      </div>
      ${savedFlash
        ? `<button type="submit" class="btn btn-success">Saved ✓</button>`
        : `<button type="submit" class="btn btn-success">Save Theme</button>`}
    </div>

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
    const configProvider = new FileBackedBetterPortalConfigProvider(this.config.bpConfigPath);
    const portalConfig = await configProvider.loadConfig();
    const appDef = portalConfig.apps.find((a) => a.id === appId);
    const tenant = portalConfig.tenants.find((t) => t.id === tenantId);
    if (!appDef || !tenant) return { eff: {}, storedKeys: new Set(), valid: false };

    const now = Math.floor(Date.now() / 1000);
    const stored = (this.configStore.read({
      iss: "internal", aud: ["theme"], sub: "render", exp: now + 60, iat: now,
      jti: `read-${now}`, realm: "control-plane",
      tenantId, appId,
      serviceId: "service.betterportal.theme-bootstrap1",
      actions: ["config.read"]
    }).app[appId] ?? {}) as Record<string, unknown>;

    const base = appDef.themeConfig;
    const eff = {
      brandName: (stored.brandName as string) ?? tenant.branding.brandName ?? this.config.brandName,
      mode: (stored.mode as string) ?? base.mode ?? "system",
      primary: (stored.primary as string) ?? base.bootstrap.primary ?? "#3b82f6",
      secondary: (stored.secondary as string) ?? base.bootstrap.secondary ?? "#64748b",
      success: (stored.success as string) ?? base.bootstrap.success ?? "#22c55e",
      info: (stored.info as string) ?? base.bootstrap.info ?? "#38bdf8",
      warning: (stored.warning as string) ?? base.bootstrap.warning ?? "#f59e0b",
      danger: (stored.danger as string) ?? base.bootstrap.danger ?? "#ef4444"
    };

    return { eff, storedKeys: new Set(Object.keys(stored)), valid: true };
  }

  private themeBaseUrl(event: BetterPortalEvent): string {
    const proto = event.req.headers.get("x-forwarded-proto") ?? "http";
    const host = event.req.headers.get("host") ?? `localhost:${this.config.port}`;
    return `${proto}://${host}`;
  }

  private async handleConfigUi(event: BetterPortalEvent): Promise<Response> {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";

    if (!tenantId || !appId) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or appId.</div>`, 200, "text/html; mode=fragment");
    }
    const { eff, storedKeys, valid } = await this.computeEffectiveAndStored(tenantId, appId);
    if (!valid) {
      return htmlResponse(`<div class="alert alert-danger">App or tenant not found.</div>`, 200, "text/html; mode=fragment");
    }

    return htmlResponse(this.renderConfigUiForm(this.themeBaseUrl(event), tenantId, appId, eff, storedKeys), 200, "text/html; mode=fragment");
  }

  private async handleConfigUiSave(event: BetterPortalEvent): Promise<Response> {
    const formData = await event.req.formData();
    const tenantId = String(formData.get("tenantId") ?? "");
    const appId = String(formData.get("appId") ?? "");
    if (!tenantId || !appId) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or appId.</div>`, 200, "text/html; mode=fragment");
    }

    const values: Record<string, unknown> = {};
    formData.forEach((v, k) => {
      if (k === "tenantId" || k === "appId") return;
      if (typeof v === "string" && v !== "") values[k] = v;
    });

    const now = Math.floor(Date.now() / 1000);
    this.configStore.write(tenantId, appId, values, {
      iss: "internal", aud: ["theme"], sub: "save", exp: now + 60, iat: now,
      jti: `save-${now}`, realm: "control-plane",
      tenantId, appId,
      serviceId: "service.betterportal.theme-bootstrap1",
      actions: ["config.write"]
    });

    const { eff, storedKeys } = await this.computeEffectiveAndStored(tenantId, appId);
    return htmlResponse(
      this.renderConfigUiForm(this.themeBaseUrl(event), tenantId, appId, eff, storedKeys, true),
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
    if (!tenantId || !appId || !key) {
      return htmlResponse(`<div class="alert alert-danger">Missing fields.</div>`, 200, "text/html; mode=fragment");
    }

    const now = Math.floor(Date.now() / 1000);
    const ticket = {
      iss: "internal", aud: ["theme"], sub: "reset", exp: now + 60, iat: now,
      jti: `reset-${now}`, realm: "control-plane" as const,
      tenantId, appId,
      serviceId: "service.betterportal.theme-bootstrap1",
      actions: ["config.write" as const]
    };
    this.configStore.clearKey?.(tenantId, appId, key, ticket);

    const { eff, storedKeys } = await this.computeEffectiveAndStored(tenantId, appId);
    return htmlResponse(
      this.renderConfigUiForm(this.themeBaseUrl(event), tenantId, appId, eff, storedKeys, true),
      200,
      "text/html; mode=fragment",
      { "HX-Trigger": "bp:theme-changed" }
    );
  }

  private validateDevToken(
    ticketValue: string | null,
    event: BetterPortalEvent,
    action: ServiceConfigAction
  ): ServiceConfigTicketClaims | null {
    if (!ticketValue || ticketValue !== this.config.configApiToken) return null;
    const tenantId = event.req.headers.get("x-bp-tenant-id") ?? "tenant-main";
    const appId = event.req.headers.get("x-bp-app-id") ?? undefined;
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: "betterportal-dev",
      aud: ["betterportal-service-config"],
      sub: "admin.dev",
      exp: now + 300,
      iat: now,
      jti: `bp-config-${now}`,
      realm: "control-plane",
      tenantId,
      ...(appId ? { appId } : {}),
      serviceId: "service.betterportal.theme-bootstrap1",
      actions: [action]
    };
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

      return htmlResponse(asset.body, 200, asset.contentType, {
        "cache-control": "public, max-age=3600"
      });
    });
  }

  private async handleIndex(event: BetterPortalEvent): Promise<Response> {
    return withObservedEvent(event, this.observability, "theme.bootstrap1.index", async (activeEvent, span) => {
      const sourceHostname = resolveThemeHostname(eventHeaders(activeEvent));
      const configProvider = new FileBackedBetterPortalConfigProvider(this.config.bpConfigPath);
      const portalConfig = await configProvider.loadConfig();
      const requestContext = resolveThemeRequestContext(
        portalConfig,
        eventHeaders(activeEvent),
        activeEvent.req.headers.get("host") ?? undefined
      );

      if (!requestContext) {
        return jsonResponse({
          error: "Unable to resolve tenant/app context for theme request"
        }, 404);
      }

      const currentRoute = resolveAppRoute(requestContext.app, activeEvent.url.pathname) ??
        resolveAppRoute(requestContext.app, requestContext.app.defaultRoute);

      const routesById = new Map(requestContext.app.routes.map((r) => [r.id, r]));
      const enabledRoutes = requestContext.app.routes.filter((r) => r.enabled);

      const buildLinkFromRoute = (route: typeof enabledRoutes[number], displayTitle?: string) => {
        const routeBinding = resolveServiceForTenant(portalConfig, route.serviceId, requestContext);
        if (!routeBinding) return null;
        return {
          id: route.id,
          title: displayTitle ?? route.title ?? route.id,
          href: route.path,
          requestUrl: buildServiceViewUrl(routeBinding.service, route, route.path),
          serviceId: route.serviceId,
          active: route.path === (currentRoute?.path ?? requestContext.app.defaultRoute)
        };
      };

      // Nav is driven exclusively by app.menu. Empty menu → empty nav.
      type MenuItem = {
        id: string; type: string; title?: string; routeId?: string; href?: string;
        enabled?: boolean; children?: MenuItem[];
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
                active: leaves.some((x) => x.route.active)
              };
            }
            const leaf = buildLeafFromMenu(m);
            return leaf && leaf.route ? leaf : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      };

      const navItems = buildNavTree(menu);

      // routeLinks: flat list of all leaves (for serviceMap, fragment lookup, etc.)
      const collectLeaves = (items: ReturnType<typeof buildNavTree>): NonNullable<ReturnType<typeof buildLinkFromRoute>>[] => {
        const out: NonNullable<ReturnType<typeof buildLinkFromRoute>>[] = [];
        for (const it of items) {
          if ((it as any).kind === "route") out.push((it as any).route);
          else if ((it as any).kind === "group") {
            for (const inner of (it as any).items) {
              if (inner.kind === "route") out.push(inner.route);
            }
          }
        }
        return out;
      };
      const routeLinks = collectLeaves(navItems);

      const initialRouteBinding = currentRoute
        ? resolveServiceForTenant(portalConfig, currentRoute.serviceId, requestContext)
        : null;
      // Emit RELATIVE service path; client absolutizes via data-bp-service.
      const initialRouteUrl = currentRoute && initialRouteBinding
        ? (currentRoute.targetPath ?? currentRoute.path)
        : undefined;

      const resolvedFragments: Record<string, Array<{
        fragmentId: string;
        serviceId: string;
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
              // Emit RELATIVE service path; client absolutizes via data-bp-service.
              return {
                fragmentId: a.fragmentId,
                serviceId: a.serviceId,
                url: a.targetPath,
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
          // Relative path; client absolutizes.
          resolvedFragments[location].push({
            fragmentId: id,
            serviceId: slot.serviceId,
            url: viewPath,
            fragmentKey: slot.slotId
          });
        }
      }

      const originPolicy = buildOriginPolicy(requestContext);

      // Merge theme config from store over bp-config.yaml themeConfig
      const now = Math.floor(Date.now() / 1000);
      const storeRead = this.configStore.read({
        iss: "internal", aud: ["theme"], sub: "render", exp: now + 60, iat: now,
        jti: `read-${now}`, realm: "control-plane",
        tenantId: requestContext.tenant.id,
        appId: requestContext.app.id,
        serviceId: "service.betterportal.theme-bootstrap1",
        actions: ["config.read"]
      });
      const storedAppValues = storeRead.app[requestContext.app.id] ?? {};

      const baseTheme = requestContext.app.themeConfig;
      const storedBrand = typeof storedAppValues.brandName === "string" ? storedAppValues.brandName : undefined;
      const storedMode = typeof storedAppValues.mode === "string" ? storedAppValues.mode : undefined;

      const mergedThemeConfig = {
        ...baseTheme,
        ...(storedMode ? { mode: storedMode as typeof baseTheme.mode } : {}),
        bootstrap: {
          ...baseTheme.bootstrap,
          ...Object.fromEntries(
            ["primary","secondary","success","info","warning","danger","light","dark"]
              .filter((k) => typeof storedAppValues[k] === "string")
              .map((k) => [k, storedAppValues[k]])
          )
        }
      };

      const effectiveMode = mergedThemeConfig.mode === "dark" ? "dark" :
        mergedThemeConfig.mode === "system" ? this.config.defaultMode :
        mergedThemeConfig.mode === "light" ? "light" : this.config.defaultMode;

      return new Response(
        renderBootstrap1HostPage({
          title: requestContext.app.title,
          brandName: storedBrand ?? requestContext.tenant.branding.brandName ?? this.config.brandName,
          themeMode: effectiveMode,
          themeConfig: mergedThemeConfig,
          assetBaseUrl: "/_themes/bootstrap1/assets",
          currentPath: activeEvent.url.pathname,
          initialRouteUrl,
          initialServiceId: currentRoute?.serviceId,
          routeLinks,
          navItems: navItems as any,
          resolvedFragments
        }),
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(sourceHostname ? { "x-bp-source-hostname": sourceHostname } : {}),
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
        pluginId: Bootstrap1Manifest.pluginId,
        category: Bootstrap1Manifest.category,
        version: Bootstrap1Manifest.version,
        traceId: span.traceId
      });
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
    if (this.server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    obs.log.info("Bootstrap1 theme serving at http://{host}:{port}", {
      host: this.config.host,
      port: this.config.port
    });
  }

  async dispose(): Promise<void> {
    if (this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  }
}

export { Config, EventSchemas };
