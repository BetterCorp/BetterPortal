import {
  type BSBServiceConstructor,
  createBroadcastEvent,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { BPService, BetterPortalConfigSchema } from "@betterportal/plugin-bsb";
import { resolve } from "node:path";
import { createStaticJwksVerifier } from "@betterportal/framework";
import type { JwtVerifier, AppAuthConfig } from "@betterportal/framework";
import { registry } from "./.bp-generated/registry.js";
import {
  cpBootstrap,
  type CpBootstrapState
} from "./cpBootstrap.js";
import { registerSetupEndpoints } from "./setupTokens.js";
import { registerBootstrapEndpoint } from "./bootstrapEndpoint.js";
import { registerAdminApiRoutes } from "./adminApi.js";
import { registerMenuEditorRoutes } from "./menuEditor.js";
import { registerFragmentsEditorRoutes } from "./fragmentsEditor.js";
import { registerWebhookRoutes } from "./webhooks.js";
import { getManifestCache, reconcileServiceRegistry, registerSyncEndpoint } from "./syncApi.js";
import { setConfigManagerRouteContext } from "./routeContext.js";
import { isApiRoute } from "./routeMounts.js";
import {
  describeEmbeddedContextResolution,
  eventHeaders,
  resolveEmbeddedRequestContext,
  type BetterPortalEvent,
  type BetterPortalResolvedRequestContext,
  type BetterPortalRegistry,
  type PlatformConfigStore,
  uuidv7
} from "@betterportal/framework";
import {
  createStorageFromConfig,
  PlatformConfigStorageSchema
} from "./storage/index.js";
import BetterportalConfigManagerClient from "../../.bsb/clients/service-betterportal-config-manager.js";

// Parse-only base for relative request URLs. Never emit this origin.
const RELATIVE_URL_PARSE_BASE = "http://betterportal.invalid";

function applyWellKnownCors(event: BetterPortalEvent): Response | undefined {
  const origin = event.req.headers.get("origin") ?? "*";
  event.res.headers.set("Access-Control-Allow-Origin", origin);
  event.res.headers.set("Vary", "Origin");
  event.res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  event.res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Accept,HX-Request,HX-Current-URL,HX-Target,HX-Trigger,HX-Trigger-Name,X-BP-Tenant-Id,X-BP-App-Id,X-BP-Trace-Id"
  );
  event.res.headers.set(
    "Access-Control-Expose-Headers",
    "HX-Location,HX-Redirect,HX-Refresh,HX-Push-Url,HX-Replace-Url,BP-SetHeader,BP-RemoveHeader"
  );
  event.res.headers.set("Access-Control-Max-Age", "600");
  if (event.req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  return undefined;
}

/** Tenant service-instance id (UUIDv7) -> pluginId, for the auth permission check. */
function buildServiceIdAliases(
  config: {
    tenants: Array<{ id: string; services: Array<{ id: string; serviceId?: string }> }>;
    sharedServiceActivations?: Array<{ id: string; tenantId: string; sharedServiceId: string; enabled?: boolean }>;
  },
  tenantId: string
): Record<string, string> {
  const aliases: Record<string, string> = {};
  const tenant = config.tenants.find((t) => t.id === tenantId);
  for (const svc of tenant?.services ?? []) {
    if (svc.serviceId) aliases[svc.id] = svc.serviceId;
  }
  for (const activation of config.sharedServiceActivations ?? []) {
    if (activation.enabled !== false && activation.tenantId === tenantId) {
      aliases[activation.id] = activation.sharedServiceId;
    }
  }
  return aliases;
}

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3300),
  betterportal: BetterPortalConfigSchema,
  storage: PlatformConfigStorageSchema,
  requestTimeoutMs: av.int().min(1).default(2000),
  /** Path to RSA keypair JSON used to sign envelope/setup tokens. Auto-generated on first boot. */
  cpKeyStorePath: av.string().minLength(1).default("./.bp-cp-state/keys.json"),
  /** Public issuer URL (matches token `iss` claim). Must be externally reachable by services and browsers. */
  cpIssuer: av.string().minLength(1),
  /** Required audience for tokens issued by this CP. */
  cpAudience: av.string().minLength(1).default("betterportal-control-plane")
}, { unknownKeys: "strip" });

const PlatformConfigChangedEventSchema = av.object({
  sourceId: av.string().minLength(1),
  backend: av.enum_(["file", "postgres"] as const)
}, { unknownKeys: "strip" });

const Config = createConfigSchema(
  {
    name: "service-betterportal-config-manager",
    description: "BetterPortal config management admin service",
    tags: ["betterportal", "service", "admin", "config"],
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
  emitBroadcast: {
    "platform-config.changed": createBroadcastEvent(
      PlatformConfigChangedEventSchema,
      "Emitted after platform config is saved by this config-manager instance."
    )
  },
  onBroadcast: {}
});

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  protected readonly requireBetterPortalConfigSource = false;
  private storage!: PlatformConfigStore;
  private webhookRuntime?: { start(): void; stop(): void };
  private readonly changeSourceId = uuidv7();
  private readonly selfClient: BetterportalConfigManagerClient;
  /** CP-side signing keypair + issuer/audience info. Built on first init. */
  private cpState!: CpBootstrapState;
  /** Cache of (tenantId, appId) -> app.auth config + JWT verifier from synced storage. */
  private readonly authConfigCache = new Map<string, { auth: AppAuthConfig; verifier: JwtVerifier; aliases: Record<string, string>; cachedAt: number }>();
  private readonly authCacheTtlMs = 60 * 1000;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
    this.selfClient = new BetterportalConfigManagerClient(this);
  }

  protected definition() {
    return {
      manifest: {
        pluginId: "service.betterportal.config-manager",
        title: "BetterPortal Config Manager",
        description: "Admin-facing BetterPortal service for discovering and managing service config surfaces.",
        cacheHints: { metadataTtlSeconds: 300 }
      },
      registry
    };
  }

  /**
   * CM uses its own storage as the source of app.auth config (it IS the CP).
   * Loads sync - async load via cached promise to keep getJwtVerifier signature simple.
   */
  protected getAppAuthConfig(tenantId: string, appId: string): AppAuthConfig | undefined {
    return this.readAuthCacheEntry(tenantId, appId)?.auth;
  }

  protected getJwtVerifier(tenantId: string, appId: string): JwtVerifier | undefined {
    return this.readAuthCacheEntry(tenantId, appId)?.verifier;
  }

  protected getServiceIdAliases(tenantId: string): Record<string, string> | undefined {
    for (const [key, entry] of this.authConfigCache) {
      if (key.startsWith(`${tenantId}::`)) return entry.aliases;
    }
    return undefined;
  }

  /**
   * Stale-while-revalidate read of the auth cache. Returns any cached entry
   * (even past its TTL) and kicks off a background refresh when stale, so an
   * expired entry never causes a transient "Auth context unavailable" 401. The
   * cache is warmed at startup and on every config change (see warmAuthCache),
   * so a missing entry means the app genuinely has no auth configured.
   */
  private readAuthCacheEntry(tenantId: string, appId: string): { auth: AppAuthConfig; verifier: JwtVerifier } | undefined {
    const key = `${tenantId}::${appId}`;
    const cached = this.authConfigCache.get(key);
    if (!cached) return undefined;
    if ((Date.now() - cached.cachedAt) >= this.authCacheTtlMs) {
      void this.refreshAuthCache(tenantId, appId);
    }
    return cached;
  }

  /**
   * Eagerly build verifiers for every app that already has pushed JWKS in
   * persisted config. Called at startup (publicKeys survive restarts) and after
   * each config change (e.g. an auth service installing and pushing its JWKS),
   * so the first authenticated request never races an empty cache.
   */
  private async warmAuthCache(obs?: Observable): Promise<void> {
    try {
      const config = await this.storage.loadConfig();
      let warmed = 0;
      for (const app of config.apps) {
        const auth = (app as unknown as { auth?: AppAuthConfig }).auth;
        if (!auth?.publicKeys || !Array.isArray(auth.publicKeys.keys) || auth.publicKeys.keys.length === 0) {
          continue;
        }
        this.authConfigCache.set(`${app.tenantId}::${app.id}`, {
          auth,
          verifier: createStaticJwksVerifier({
            jwks: auth.publicKeys,
            expectedIssuer: auth.expectedIssuer,
            expectedAudience: auth.expectedAudience,
            expectedTokenType: "access"
          }),
          aliases: buildServiceIdAliases(config, app.tenantId),
          cachedAt: Date.now()
        });
        warmed += 1;
      }
      if (warmed > 0) obs?.log.debug("Warmed auth verifier cache for {count} app(s)", { count: warmed });
    } catch {
      // Non-fatal - getJwtVerifier falls back to lazy refresh on demand.
    }
  }

  private async refreshAuthCache(tenantId: string, appId: string): Promise<void> {
    const key = `${tenantId}::${appId}`;
    try {
      const config = await this.storage.loadConfig();
      const app = config.apps.find((a) => a.id === appId && a.tenantId === tenantId);
      const auth = (app as unknown as { auth?: AppAuthConfig })?.auth;
      if (!auth) return;
      // CM cannot reach services - must use the JWKS the auth service pushed at /install.
      if (!auth.publicKeys || !Array.isArray(auth.publicKeys.keys) || auth.publicKeys.keys.length === 0) {
        return;
      }
      const verifier = createStaticJwksVerifier({
        jwks: auth.publicKeys,
        expectedIssuer: auth.expectedIssuer,
        expectedAudience: auth.expectedAudience,
        expectedTokenType: "access"
      });
      this.authConfigCache.set(key, { auth, verifier, aliases: buildServiceIdAliases(config, tenantId), cachedAt: Date.now() });
    } catch {
      // silent - next request retries
    }
  }

  protected async resolveCorsContext(event: BetterPortalEvent): Promise<BetterPortalResolvedRequestContext | null> {
    const config = await this.storage.loadConfig();
    const context = resolveEmbeddedRequestContext(config, eventHeaders(event));
    if (!context) {
      return null;
    }

    const adminTenantId = config.configManagement.adminTenantId ?? "betterportal";
    if (context.tenant.id !== adminTenantId) {
      return null;
    }

    return context;
  }

  protected async describeCorsContextFailure(event: BetterPortalEvent): Promise<{ candidateHosts: string; configuredAppHosts: string } | undefined> {
    const config = await this.storage.loadConfig();
    const details = describeEmbeddedContextResolution(config, eventHeaders(event));
    return {
      candidateHosts: details.candidates.join(","),
      configuredAppHosts: details.appHosts.map((app) => `${app.appId}:[${app.hosts.join(",")}]`).join(";")
    };
  }

  protected async onRegistered(_registry: BetterPortalRegistry, _obs: Observable): Promise<void> {
    const resolvedStorage = createStorageFromConfig(this.config.storage, this.cwd);
    this.storage = this.withChangeBroadcasts(resolvedStorage.store, _obs, {
      backend: resolvedStorage.backend
    });

    // Initialize CP keypair + JWKS (P7).
    const cwd = this.cwd ?? ".";
    this.cpState = cpBootstrap({
      keyStorePath: resolve(cwd, this.config.cpKeyStorePath ?? "./.bp-cp-state/keys.json"),
      issuer: this.config.cpIssuer,
      audience: this.config.cpAudience ?? "betterportal-control-plane",
      host: this.config.host ?? "0.0.0.0",
      port: this.config.port ?? 3300
    });
    this.registerAsAuthProvider({
      jwks: { keys: [this.cpState.jwk] }
    });
    _obs.log.info("CP issuer={issuer} kid={kid} cpId={cpId}; JWKS exposed at /.well-known/jwks.json", {
      issuer: this.cpState.issuer,
      kid: this.cpState.keyPair.kid,
      cpId: this.cpState.cpId
    });

    await this.selfClient.onPlatformConfigChanged(_obs, async (eventObs, event) => {
      if (event.sourceId === this.changeSourceId) return;
      this.storage.invalidate();
      // A config change may carry a freshly-pushed auth JWKS - rebuild verifiers.
      await this.warmAuthCache(eventObs);
    });

    setConfigManagerRouteContext({
      storage: this.storage,
      cpState: this.cpState,
      serviceBaseUrl: this.cpState.issuer
    });

    await reconcileServiceRegistry(this.storage, this.manifest.pluginId, registry, {
      manifestVersion: "local",
      title: "BetterPortal Config Manager",
      capabilities: ["config", "view.json", "view.metadata", "view.html", "theme.bootstrap1"]
    });

    this.app.use("/config", (event) => this.populateConfigAdminContext(event));
    this.app.use("/services", (event) => this.populateServicesContext(event));
    this.app.use("/routes", (event) => this.populateRoutesContext(event));
    this.app.use("/menu", (event) => this.populateMenuContext(event));
    this.app.use("/fragments", (event) => this.populateFragmentsContext(event));
    this.app.use("/preview", (event) => this.populatePreviewContext(event));
    this.app.use("/auth", (event) => this.populateAdminAuthContext(event));
    this.app.use("/settings", (event) => this.populateSettingsContext(event));
    this.app.use("/.well-known/bp", (event) => applyWellKnownCors(event));

    registerAdminApiRoutes(this.app, this.storage, this.cpState);
    registerMenuEditorRoutes(this.app, this.storage);
    registerFragmentsEditorRoutes(this.app, this.storage);
    this.webhookRuntime = registerWebhookRoutes(this.app, this.storage);
    registerSyncEndpoint(this.app, this.storage);

    // Setup token mint + redeem endpoints (P4)
    registerSetupEndpoints({ app: this.app, storage: this.storage, cpState: this.cpState });

    // Bootstrap detection + endpoint (P6) - opens vanilla HTML wizard on empty DB
    await registerBootstrapEndpoint({
      app: this.app,
      storage: this.storage,
      cpState: this.cpState,
      logger: _obs
    });

    // Warm auth verifiers from persisted JWKS so the first authenticated request
    // after a restart never races an empty cache (#6).
    await this.warmAuthCache(_obs);
    this.webhookRuntime.start();
  }

  private withChangeBroadcasts(
    store: PlatformConfigStore,
    obs: Observable,
    metadata: { backend: "file" | "postgres" }
  ): PlatformConfigStore {
    return {
      loadConfig: () => store.loadConfig(),
      saveConfig: async (config) => {
        await store.saveConfig(config);
        await this.events.emitBroadcast("platform-config.changed", obs, {
          sourceId: this.changeSourceId,
          backend: metadata.backend
        });
      },
      validateApiKey: (apiKey) => store.validateApiKey(apiKey),
      getScopedConfig: (serviceId, scope, tenantId) => store.getScopedConfig(serviceId, scope, tenantId),
      invalidate: () => store.invalidate(),
      onChange: (listener) => store.onChange(listener)
    };
  }

  private async populateConfigAdminContext(event: BetterPortalEvent): Promise<void> {
    const portalConfig = await this.storage.loadConfig();
    const requestContext = resolveEmbeddedRequestContext(portalConfig, eventHeaders(event));

    if (requestContext) {
      const tenant = requestContext.tenant;
      const allServices = [
        ...tenant.services.filter((s) => s.enabled).map((s) => ({
          serviceId: s.serviceId ?? s.id,
          hostname: s.hostname,
          deploymentMode: s.deploymentMode,
          title: s.title,
          scope: "tenant" as const
        })),
        ...tenant.activatedPlatformServices
          .map((psId) => portalConfig.platformServices.find((ps) => ps.id === psId && ps.enabled))
          .filter((ps): ps is NonNullable<typeof ps> => ps !== null && ps !== undefined)
          .map((ps) => ({
            serviceId: ps.serviceId ?? ps.id,
            hostname: ps.hostname,
            deploymentMode: "bp-hosted" as const,
            title: ps.title,
            scope: "platform" as const
          })),
        ...portalConfig.sharedServiceActivations
          .filter((activation) => activation.enabled && activation.tenantId === tenant.id && (!activation.appId || activation.appId === requestContext.app.id))
          .map((activation) => {
            const shared = portalConfig.sharedServiceCatalog.find((service) => service.enabled && service.id === activation.sharedServiceId);
            if (!shared) return undefined;
            return {
              serviceId: shared.serviceId ?? shared.id,
              hostname: shared.baseUrl,
              deploymentMode: "bp-hosted" as const,
              title: shared.title,
              scope: "shared" as const
            };
          })
          .filter((service): service is NonNullable<typeof service> => !!service)
      ];

      const responseModel = {
        title: "Config Manager",
        tenantId: tenant.id,
        appId: requestContext.app.id,
        requestTimeoutMs: this.config.requestTimeoutMs,
        services: allServices.map((svc) => ({
          serviceId: svc.serviceId,
          bindingId: svc.serviceId,
          endpointBaseUrl: svc.hostname,
          deploymentMode: svc.deploymentMode,
          healthUrl: `${svc.hostname.replace(/\/+$/, "")}/.well-known/bp/health`,
          schemaUrl: `${svc.hostname.replace(/\/+$/, "")}/.well-known/bp/config/schema`,
          manifestUrl: `${svc.hostname.replace(/\/+$/, "")}/.well-known/bp/manifest`
        }))
      };

      (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = responseModel;
    }
  }

  private async populateServicesContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const requestedTenantId = url.searchParams.get("tenantId") ?? undefined;
    const selectedTenantId = config.tenants.some((tenant) => tenant.id === requestedTenantId)
      ? requestedTenantId
      : config.tenants[0]?.id;

    const tenantApps: Record<string, Array<{ id: string; title: string; shellServiceId?: string }>> = {};
    for (const t of config.tenants) {
      tenantApps[t.id] = config.apps
        .filter((a) => a.tenantId === t.id)
        .map((a) => ({ id: a.id, title: a.title, shellServiceId: a.shell?.serviceId }));
    }

    const manifestCache = getManifestCache();
    const configMetadata = (serviceInstanceId: string, pluginId?: string) => {
      const cached = manifestCache.get(serviceInstanceId) ?? (pluginId ? manifestCache.get(pluginId) : undefined);
      const configManifestKnown = Boolean(cached) || pluginId === this.manifest.pluginId;
      const hasConfigSchemas = (cached?.configSchemas?.length ?? 0) > 0;
      return {
        supportsCustomUi: false,
        customUiPath: undefined as string | undefined,
        configManifestKnown,
        hasConfigurableOptions: hasConfigSchemas
      };
    };

    const tenantSvcsRaw = config.tenants.flatMap((t) =>
      t.services.map((s) => {
        const cached = manifestCache.get(s.id);
        const capabilities = cached?.capabilities?.length ? cached.capabilities : (s.capabilities ?? []);
        const isTheme = capabilities.includes("theme");
        return {
          id: s.id, hostname: s.hostname, serviceId: s.serviceId, capabilities,
          title: cached?.title ?? s.title, description: s.description,
          createdAt: s.createdAt, lastSeenAt: s.lastSeenAt,
          enabled: s.enabled,
          scope: isTheme ? "theme" as const : "tenant" as const,
          themeId: undefined,
          tenantId: t.id as string | undefined,
          pushBase: `/settings/service/${s.id}`,
          ...configMetadata(s.id, s.serviceId)
        };
      })
    );

    const platformSvcsRaw = config.platformServices.map((ps) => ({
      id: ps.id, hostname: ps.hostname, serviceId: ps.serviceId, capabilities: ps.capabilities ?? [],
      title: ps.title, description: ps.description,
      createdAt: ps.createdAt, lastSeenAt: undefined as string | undefined,
      enabled: ps.enabled, scope: "platform" as const, tenantId: undefined as string | undefined,
      pushBase: `/settings/platform/${ps.id}`,
      ...configMetadata(ps.id, ps.serviceId)
    }));

    const sharedSvcsRaw = config.sharedServiceActivations
      .filter((activation) => activation.enabled)
      .map((activation) => {
        const shared = config.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId && service.enabled);
        if (!shared) return undefined;
        const capabilities = shared.tags ?? [];
        return {
          id: activation.id,
          hostname: shared.baseUrl,
          serviceId: shared.serviceId ?? shared.id,
          capabilities,
          title: shared.title,
          description: shared.description,
          createdAt: activation.activatedAt,
          lastSeenAt: undefined as string | undefined,
          enabled: activation.enabled,
          scope: "shared" as const,
          themeId: undefined,
          tenantId: activation.tenantId as string | undefined,
          pushBase: `/settings/shared/${activation.id}`,
          ...configMetadata(activation.id, shared.id)
        };
      })
      .filter((service): service is NonNullable<typeof service> => !!service);

    const allServices = [...tenantSvcsRaw, ...sharedSvcsRaw, ...platformSvcsRaw];
    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Service Registry",
      services: allServices,
      tenants: config.tenants.map((t) => ({ id: t.id, title: t.title })),
      selectedTenantId,
      sharedServiceCatalog: config.sharedServiceCatalog.map((service) => ({
        ...service,
        installed: typeof service.apiKeyHash === "string" && service.apiKeyHash.length > 0
      })),
      sharedServiceActivations: config.sharedServiceActivations,
      apps: config.apps.map((a) => ({ id: a.id, tenantId: a.tenantId, title: a.title })),
      tenantApps,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: this.cpState.issuer
    };
  }

  private async populateRoutesContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;
    const selectedApp = selectedAppId ? config.apps.find((a) => a.id === selectedAppId) : undefined;
    const selectedTenant = selectedApp ? config.tenants.find((t) => t.id === selectedApp.tenantId) : undefined;

    const cache = getManifestCache();
    const viewsForService = (serviceInstanceId: string | undefined): Array<{ viewId: string; title: string; path: string; methods: string[]; renderable: boolean; dependencies: string[] }> => {
      if (!serviceInstanceId) return [];
      const manifest = cache.get(serviceInstanceId);
      if (!manifest) return [];
      return Object.values(manifest.viewIndex)
        .map((v) => ({ viewId: v.viewId, title: v.viewId, path: v.path, methods: v.methods, renderable: v.renderable, dependencies: v.dependencies }));
    };

    const availableServices = selectedTenant
      ? [
          ...selectedTenant.services.filter((s) => s.enabled).map((s) => ({
            id: s.id,
            title: s.title ?? s.serviceId ?? s.hostname,
            hostname: s.hostname,
            serviceId: s.serviceId ?? s.id,
            views: viewsForService(s.id)
          })),
          ...selectedTenant.activatedPlatformServices
            .map((psId) => config.platformServices.find((ps) => ps.id === psId && ps.enabled))
            .filter((ps): ps is NonNullable<typeof ps> => !!ps)
            .map((ps) => ({
              id: ps.id,
              title: `${ps.title} (platform)`,
              hostname: ps.hostname,
              serviceId: ps.serviceId ?? ps.id,
              views: viewsForService(ps.id)
            })),
          ...config.sharedServiceActivations
            .filter((activation) =>
              activation.enabled
              && activation.tenantId === selectedTenant.id
              && (!activation.appId || activation.appId === selectedApp?.id)
            )
            .map((activation) => {
              const shared = config.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId && service.enabled);
              if (!shared) return undefined;
              return {
                id: activation.id,
                title: `${shared.title} (shared)`,
                hostname: shared.baseUrl,
                serviceId: shared.serviceId ?? shared.id,
                views: viewsForService(shared.id)
              };
            })
            .filter((service): service is NonNullable<typeof service> => !!service)
        ]
      : [];

    const routeModel = (selectedApp?.routes ?? []).map((r) => {
      const view = cache.get(r.serviceId)?.viewIndex[r.viewId];
      const renderable = view?.renderable ?? r.kind !== "api";
      return {
        id: r.id,
        kind: isApiRoute(r, view?.renderable) ? "api" : "page",
        path: r.path,
        serviceId: r.serviceId,
        viewId: r.viewId,
        targetPath: r.targetPath ?? view?.path,
        methods: r.methods,
        query: r.query,
        title: r.title,
        renderable,
        enabled: r.enabled
      };
    });

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Route Designer",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      routes: routeModel,
      availableServices,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: this.cpState.issuer
    };
  }

  private async populateMenuContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;
    const selectedApp = selectedAppId ? config.apps.find((a) => a.id === selectedAppId) : undefined;

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Menu Designer",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      menu: (selectedApp?.menu ?? []).map((m) => ({
        id: m.id, type: m.type, title: m.title,
        routeId: m.routeId, href: m.href, enabled: m.enabled !== false
      })),
      routes: (selectedApp?.routes ?? [])
        .filter((r) => {
          const view = getManifestCache().get(r.serviceId)?.viewIndex[r.viewId];
          return r.enabled && !isApiRoute(r, view?.renderable);
        })
        .map((r) => ({
          id: r.id, path: r.path, title: r.title ?? r.path
        })),
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: this.cpState.issuer
    };
  }

  private async populateFragmentsContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Fragments",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: this.cpState.issuer
    };
  }

  private async populatePreviewContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const services: Array<{
      serviceId: string;
      endpointBaseUrl: string;
      views: Array<{
        viewId: string; title: string; path: string;
        themes: string[]; components: string[];
        hasFragments: boolean;
        demoScenarios: Array<{ id: string; title: string }>;
      }>;
    }> = [];

    const allServiceHostnames = [
      ...config.tenants.flatMap((t) => t.services.filter((s) => s.enabled).map((s) => ({
        serviceId: s.serviceId ?? s.id, hostname: s.hostname
      }))),
      ...config.platformServices.filter((ps) => ps.enabled).map((ps) => ({
        serviceId: ps.serviceId ?? ps.id, hostname: ps.hostname
      }))
    ];

    const seen = new Set<string>();
    for (const svc of allServiceHostnames) {
      if (seen.has(svc.hostname)) continue;
      seen.add(svc.hostname);
      services.push({
        serviceId: svc.serviceId,
        endpointBaseUrl: svc.hostname,
        views: []
      });
    }

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Component Preview",
      services
    };
  }

  private async populateAdminAuthContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;
    const selectedApp = selectedAppId
      ? config.apps.find((a) => a.id === selectedAppId)
      : config.apps[0];
    const selectedTenantId = selectedApp?.tenantId;

    // All services known to CP (tenant-registered + platform) with their manifest permissions.
    const allServices = [
      ...config.tenants.flatMap((t) => t.services.filter((s) => s.enabled).map((s) => ({
        id: s.id,
        serviceId: s.serviceId ?? s.id,
        hostname: s.hostname,
        title: s.title ?? s.serviceId ?? s.id
      }))),
      ...config.platformServices.filter((ps) => ps.enabled).map((ps) => ({
        id: ps.id,
        serviceId: ps.serviceId ?? ps.id,
        hostname: ps.hostname,
        title: ps.title
      })),
      ...config.sharedServiceActivations
        .filter((activation) => activation.enabled && (!selectedTenantId || activation.tenantId === selectedTenantId))
        .map((activation) => {
          const shared = config.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId && service.enabled);
          if (!shared) return undefined;
          return {
            id: activation.id,
            serviceId: shared.serviceId ?? shared.id,
            hostname: shared.baseUrl,
            title: shared.title
          };
        })
        .filter((service): service is NonNullable<typeof service> => !!service)
    ];

    // De-dupe by service instance id.
    const servicesById = new Map<string, { id: string; serviceId: string; hostname: string; title: string }>();
    for (const svc of allServices) {
      if (!servicesById.has(svc.id)) servicesById.set(svc.id, svc);
    }

    // Pull per-view permissions from the manifest cache (populated when services poll).
    const cache = getManifestCache();
    const servicePermissions = Array.from(servicesById.values()).map((svc) => {
      const cachedManifest = cache.get(svc.id);
      const views = cachedManifest
        ? Object.values(cachedManifest.viewIndex).map((v) => ({
            viewId: v.viewId,
            path: v.path,
            methods: v.methods,
            ...(v.role ? { role: v.role } : {}),
            requiredPermissions: v.permissions
          }))
        : [];
      return {
        serviceId: svc.id,
        title: svc.title,
        hostname: svc.hostname,
        manifestVersion: cachedManifest?.manifestVersion,
        views
      };
    });

    type AppRole = { id: string; title: string; description?: string; permissions: unknown[] };
    const appWithAuth = selectedApp as unknown as {
      auth?: {
        serviceId?: string;
        expectedIssuer?: string;
        expectedAudience?: string;
        jwksUri?: string;
        roles?: AppRole[];
      };
    } | undefined;
    const authConfigured = Boolean(
      appWithAuth?.auth?.serviceId
      && appWithAuth.auth.expectedIssuer
      && appWithAuth.auth.expectedAudience
      && appWithAuth.auth.jwksUri
    );
    const currentRoles: AppRole[] = appWithAuth?.auth?.roles ?? [];

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Permission Manager",
      apps: config.apps.map((a) => ({ id: a.id, tenantId: a.tenantId, title: a.title })),
      selectedAppId: selectedApp?.id,
      selectedTenantId,
      authConfigured,
      servicePermissions,
      currentRoles,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: this.cpState.issuer
    };
  }

  private async populateSettingsContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.storage.loadConfig();
    const url = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE);
    const requestContext = resolveEmbeddedRequestContext(config, eventHeaders(event));
    const requestedAppId = url.searchParams.get("appId") ?? undefined;
    const app = requestContext?.app
      ?? (requestedAppId ? config.apps.find((candidate) => candidate.id === requestedAppId) : undefined)
      ?? config.apps[0];
    if (!app) return;

    const tenant = requestContext?.tenant
      ?? config.tenants.find((candidate) => candidate.id === app.tenantId);
    if (!tenant) return;

    const activeSharedServiceIds = new Set(
      config.sharedServiceActivations
        .filter((activation) =>
          activation.enabled
          && activation.tenantId === tenant.id
          && (!activation.appId || activation.appId === app.id)
        )
        .map((activation) => activation.sharedServiceId)
    );

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "App Settings",
      tenant: { id: tenant.id, title: tenant.title },
      app: { id: app.id, tenantId: app.tenantId, title: app.title, hostnames: app.hostnames },
      idsVisible: true,
      managementDiscoveryUrl: "/.well-known/bp/management",
      automationCatalogUrl: `/.well-known/bp/automation/catalog?appId=${encodeURIComponent(app.id)}`,
      endpoints: {
        current: "/.well-known/bp/manage/current",
        services: "/.well-known/bp/manage/services",
        activateService: "/.well-known/bp/manage/services/activate",
        routes: "/.well-known/bp/manage/routes",
        fragments: "/.well-known/bp/manage/fragments",
        theme: "/.well-known/bp/manage/theme",
        webhooks: "/.well-known/bp/manage/webhooks/targets",
        webhookEvents: "/.well-known/bp/manage/webhooks/events"
      },
      sharedServices: config.sharedServiceCatalog.map((service) => ({
        id: service.id,
        serviceId: service.serviceId,
        title: service.title,
        description: service.description,
        baseUrl: service.baseUrl,
        category: service.category,
        tags: service.tags,
        enabled: service.enabled,
        active: activeSharedServiceIds.has(service.id)
      })),
      routeCount: app.routes.length,
      fragmentCount: app.fragments.length
    };
  }
}

export { Config, EventSchemas };
