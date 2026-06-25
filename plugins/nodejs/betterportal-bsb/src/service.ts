import {
  BSBService,
  type BSBServiceConstructor,
  type BSBEventSchemas,
  type BSBPluginConfig,
  type BSBReferencePluginConfigType,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { resolve, dirname } from "node:path";
import {
  FileBackedBetterPortalConfigProvider,
  FileBackedServiceConfigStore,
  InMemoryServiceConfigStore,
  buildOriginPolicy,
  buildManifestFromRegistry,
  buildBpSchema,
  createJwksVerifier,
  createStaticJwksVerifier,
  describeEmbeddedContextResolution,
  hostFromHeaderValue,
  registerBpWellKnownRoutes,
  registerServiceConfigRoutes,
  resolveEmbeddedSourceHeader,
  resolveEmbeddedRequestContext,
  resolveThemeSourceHeader,
  verifySetupToken,
  verifyServiceConfigTicket,
  type AppAuthConfig,
  type BetterPortalResolvedRequestContext,
  type BetterPortalObservability,
  type BetterPortalRegistry,
  type JwtVerifier,
  type ManifestBaseFields,
  type PluginManifest,
  type ScopedServiceConfig,
  type BetterPortalRouteChrome,
  type BetterPortalConfig as PlatformConfig,
  type ServiceConfigAction,
  type ServiceConfigStore,
  type ServiceConfigTicketClaims,
  type RouteHandlerContext,
  type TenantAppValidation
} from "@betterportal/framework";
import { createH3Router, type H3AuthContext } from "@betterportal/framework/lib/adapters/h3.js";
import { BootstrapStateStore, type BootstrapStateFile } from "./bootstrapState.js";
import { ScopedConfigCache } from "./scopedConfigCache.js";
import {
  createBetterPortalApp,
  createBetterPortalNodeHandler,
  eventObservability,
  eventHeaders,
  getEventPeerIp,
  handleCorsRequest,
  jsonResponse,
  type BetterPortalEvent,
  type BetterPortalH3App
} from "@betterportal/framework/lib/runtime/h3.js";
import { createBsbObservability } from "./index.js";

// Config constraint

const DEFAULT_BP_STATE_ROOT = process.env.BSB_CONTAINER === "true" ? "/data" : ".";
const DEFAULT_BOOTSTRAP_STATE_PATH = `${DEFAULT_BP_STATE_ROOT}/.bp-bootstrap/state.enc`;
const DEFAULT_SCOPED_CONFIG_CACHE_PATH = `${DEFAULT_BP_STATE_ROOT}/.bp-sync-cache/scoped.json`;

export interface BPServiceConfig {
  host: string;
  port: number;
  betterportal?: BetterPortalConfig;
  bpConfigPath?: string;
  configApiToken?: string;
  configEncryptionKey?: string;
  controlPlaneUrl?: string;
  serviceApiKey?: string;
  bootstrapStatePath?: string;
  trustedProxyHeaders?: boolean;
  cfProxy?: boolean;
  trustedProxyIps?: string[];
}

type BPServicePluginConfig = BSBPluginConfig<av.BaseSchema<unknown, BPServiceConfig>>;

export interface BetterPortalConfig {
  bpConfigPath?: string;
  configApiToken?: string;
  configEncryptionKey?: string;
  controlPlaneUrl?: string;
  serviceApiKey?: string;
  bootstrapStatePath?: string;
  /**
   * Local cache of the scoped platform config delivered by the CP. Persisted
   * on each sync so the service can serve requests immediately on restart,
   * without sharing CM's source-of-truth bp-config.yaml. Default is per-service.
   */
  scopedConfigCachePath?: string;
  trustedProxyHeaders?: boolean;
  cfProxy?: boolean;
  trustedProxyIps?: string[];
}

export const BetterPortalConfigSchema = av.optional(av.object({
  bpConfigPath: av.optional(av.string().minLength(1)),
  // Optional dev-only shared secret for the static config-token fallback. NOT
  // set by default - production verifies CP-signed tickets via the CP JWKS and
  // never needs this. The fallback is additionally gated behind
  // BP_ALLOW_DEV_CONFIG_TOKEN=true (see validateConfigTicket).
  configApiToken: av.optional(av.string().minLength(1)),
  configEncryptionKey: av.optional(av.string().minLength(16)),
  controlPlaneUrl: av.optional(av.string().minLength(1)),
  serviceApiKey: av.optional(av.string().minLength(1)),
  bootstrapStatePath: av.string().minLength(1).default(DEFAULT_BOOTSTRAP_STATE_PATH),
  scopedConfigCachePath: av.string().minLength(1).default(DEFAULT_SCOPED_CONFIG_CACHE_PATH),
  trustedProxyHeaders: av.bool().default(false),
  cfProxy: av.bool().default(false),
  // Proxy-supplied host headers (X-Forwarded-Host, Forwarded, CF-*) are only
  // honoured when the direct socket peer IP is in this allowlist. Empty list
  // (the default) means proxy headers are never trusted, even if
  // trustedProxyHeaders/cfProxy are enabled.
  trustedProxyIps: av.array(av.string().minLength(1)).default([])
}, { unknownKeys: "strip" }));

// Service definition

export interface BPServiceDefinition {
  manifest: ManifestBaseFields;
  registry: BetterPortalRegistry;
}

// Base class

export abstract class BPService<
  TConfig extends BSBReferencePluginConfigType & BPServicePluginConfig = BPServicePluginConfig,
  TEvents extends BSBEventSchemas = BSBEventSchemas
> extends BSBService<TConfig, TEvents> {

  private get service(): BPServiceConfig {
    return this.config;
  }

  protected get bp(): BetterPortalConfig {
    const cfg = this.service;
    if (cfg.betterportal) {
      return cfg.betterportal;
    }

    return {
      bpConfigPath: cfg.bpConfigPath,
      configApiToken: cfg.configApiToken,
      configEncryptionKey: cfg.configEncryptionKey,
      controlPlaneUrl: cfg.controlPlaneUrl,
      serviceApiKey: cfg.serviceApiKey,
      trustedProxyHeaders: cfg.trustedProxyHeaders,
      cfProxy: cfg.cfProxy,
      trustedProxyIps: cfg.trustedProxyIps
    };
  }

  /**
   * Resolve header-trust options for a request. Proxy-supplied host headers are
   * only honoured when the request's direct socket peer IP is in the configured
   * `trustedProxyIps` allowlist - otherwise an attacker connecting directly
   * could spoof X-Forwarded-Host/Forwarded/CF-* to impersonate another tenant.
   */
  protected headerTrustOptions(event: BetterPortalEvent): { trustedProxyHeaders?: boolean; cfProxy?: boolean } {
    const peerIp = getEventPeerIp(event);
    const allowlist = this.bp.trustedProxyIps ?? [];
    const peerIsTrustedProxy = !!peerIp && allowlist.includes(peerIp);
    if (!peerIsTrustedProxy) {
      return { trustedProxyHeaders: false, cfProxy: false };
    }
    return {
      trustedProxyHeaders: this.bp.trustedProxyHeaders,
      cfProxy: this.bp.cfProxy
    };
  }
  readonly initBeforePlugins: string[] = [];
  readonly initAfterPlugins: string[] = [];
  readonly runBeforePlugins: string[] = [];
  readonly runAfterPlugins: string[] = [];
  protected readonly requireBetterPortalConfigSource: boolean = true;

  protected app!: BetterPortalH3App;
  protected server!: Server;
  protected observability!: BetterPortalObservability;
  protected manifest!: PluginManifest;
  protected configStore: ServiceConfigStore = new InMemoryServiceConfigStore();
  private runtimeConfigEncryptionKey: string | undefined;
  private configProvider: FileBackedBetterPortalConfigProvider | null = null;
  private scopedConfig: ScopedServiceConfig | null = null;
  private scopedConfigCache!: ScopedConfigCache;
  private sseAbortController: AbortController | null = null;
  protected bootstrapState!: BootstrapStateStore;

  /**
   * Synthesize a BetterPortalConfig-shaped view from the synced scoped config.
   * Lets services that need the full-portal-config API (e.g. themes for
   * `resolveThemeRequestContext` / `resolveServiceForTenant`) operate without
   * sharing CM's bp-config.yaml. Returns null until the first sync completes.
   */
  protected getPortalConfig(): PlatformConfig | null {
    const s = this.scopedConfig;
    if (!s) return null;
    return {
      configManagement: { adminTenantId: undefined, auth: { mechanism: "none", requiredPermissions: [] } } as any,
      platformServices: [],
      sharedServiceCatalog: [],
      tenantSharedServiceActivations: [],
      manifestCache: [],
      tenants: s.tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        active: t.active,
        branding: t.branding,
        services: (t.services ?? []).map((svc) => ({ ...svc, apiKeyHash: "" })) as any,
        activatedPlatformServices: [...(t.activatedPlatformServices ?? [])]
      })) as any,
      apps: s.apps.map((a) => ({
        id: a.id,
        tenantId: a.tenantId,
        slug: a.slug,
        title: a.title,
        hostnames: [...a.hostnames],
        originOverrides: [...(a.originOverrides ?? [])],
        refererOverrides: [...(a.refererOverrides ?? [])],
        shell: a.shell,
        themeId: a.themeId,
        themeConfig: a.themeConfig,
        defaultRoute: a.defaultRoute ?? "/",
        routes: [...a.routes],
        menu: [...(a.menu ?? [])],
        slots: [...(a.slots ?? [])],
        fragments: a.fragments,
        auth: a.auth
      })) as any
    } as unknown as PlatformConfig;
  }
  private resolvedApiKey: string | null = null;
  private resolvedCpUrl: string | null = null;
  private inSetupMode: boolean = false;

  protected abstract definition(): BPServiceDefinition;

  protected onRegistered?(registry: BetterPortalRegistry, obs: Observable): void | Promise<void>;

  /**
   * Override to provide a JWT verifier for incoming requests.
   * Receives the resolved tenant/app context. Return undefined to skip auth for the request.
   */
  protected getJwtVerifier(_tenantId: string, _appId: string): JwtVerifier | undefined {
    const auth = this.getAppAuthConfig(_tenantId, _appId);
    if (!auth) return undefined;

    if (auth.publicKeys) {
      return createStaticJwksVerifier({
        jwks: auth.publicKeys,
        expectedIssuer: auth.expectedIssuer,
        expectedAudience: auth.expectedAudience,
        expectedTokenType: "access"
      });
    }

    return createJwksVerifier({
      jwksUri: auth.jwksUri,
      expectedIssuer: auth.expectedIssuer,
      expectedAudience: auth.expectedAudience,
      expectedTokenType: "access"
    });
  }

  /**
   * Override to provide the app's resolved auth config (roles[], expectedIssuer, etc).
   * Default: reads from scopedConfig synced from the control plane.
   */
  protected getAppAuthConfig(tenantId: string, appId: string): AppAuthConfig | undefined {
    if (!this.scopedConfig) return undefined;
    const app = this.scopedConfig.apps.find((a) => a.id === appId && a.tenantId === tenantId);
    return (app as unknown as { auth?: AppAuthConfig })?.auth;
  }

  /**
   * Override to provide the service-instance-id -> pluginId alias map used by the
   * permission check (role grants use instance ids, route auth uses pluginIds).
   * Default: reads the tenant's service bindings from scopedConfig.
   */
  protected getServiceIdAliases(tenantId: string): Record<string, string> | undefined {
    const tenant = this.scopedConfig?.tenants.find((t) => t.id === tenantId);
    if (!tenant) return undefined;
    const aliases: Record<string, string> = {};
    for (const svc of tenant.services) {
      if (svc.serviceId) aliases[svc.id] = svc.serviceId;
    }
    return aliases;
  }

  /**
   * Override to validate that a given (tenantId, appId) is allowed to consume this service.
   *
   * Default behavior: auto-single-tenant via lock. On first request from a tenant, the
   * tenant is stored as the lock. Subsequent requests from other tenants are blocked
   * with 426 Upgrade Required. Services wanting shared/multi-tenant behavior must override.
   */
  protected async validateTenantApp(tenantId: string, _appId: string): Promise<TenantAppValidation> {
    const state = this.bootstrapState.read();
    if (!state.tenantLock) {
      this.bootstrapState.write({ tenantLock: tenantId });
      return { allowed: true };
    }
    if (state.tenantLock === tenantId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Service locked to tenant ${state.tenantLock}; received request for ${tenantId}. Override validateTenantApp() to allow multi-tenant.`
    };
  }

  /**
   * Register this service as an auth provider by exposing a JWKS endpoint.
   *
   * Mounts `GET /.well-known/jwks.json` returning the supplied JWK set.
   * Call this from `init()` AFTER `super.init()` so the H3 app exists.
   */
  /** JWKS published by this service when it acts as an auth provider; sent
   *  to the CP at /redeem so verifiers can use static keys (no network fetch). */
  private publishedJwks: { keys: ReadonlyArray<Record<string, unknown>> } | null = null;

  protected registerAsAuthProvider(input: {
    jwks: { keys: ReadonlyArray<Record<string, unknown>> };
    cacheMaxAgeSeconds?: number;
  }): void {
    const cacheMaxAge = input.cacheMaxAgeSeconds ?? 600;
    const payload = JSON.stringify(input.jwks);
    this.publishedJwks = input.jwks;
    this.app.get("/.well-known/jwks.json", () =>
      new Response(payload, {
        status: 200,
        headers: {
          "content-type": "application/jwk-set+json",
          "cache-control": `public, max-age=${cacheMaxAge}`
        }
      })
    );
  }

  constructor(cfg: BSBServiceConstructor<TConfig, TEvents>) {
    super(cfg);
  }

  async init(obs: Observable): Promise<void> {
    const def = this.definition();
    const span = createBsbObservability(obs).startSpan("bp.plugin.init", {
      "bp.plugin.id": def.manifest.pluginId,
      "bp.plugin.category": "service"
    });
    try {

    this.bootstrapState = new BootstrapStateStore({
      filePath: this.bp.bootstrapStatePath ?? DEFAULT_BOOTSTRAP_STATE_PATH,
      encryptionKey: this.bp.configEncryptionKey
    });

    this.scopedConfigCache = new ScopedConfigCache({
      filePath: this.bp.scopedConfigCachePath ?? DEFAULT_SCOPED_CONFIG_CACHE_PATH
    });
    // Pre-load cached scoped config so the service can serve requests
    // immediately on restart, before the first sync push from the CP completes.
    const cached = this.scopedConfigCache.read();
    if (cached) {
      this.scopedConfig = cached as ScopedServiceConfig;
      obs.log.info("Loaded scoped config from local cache ({tenants} tenants, {apps} apps)", {
        tenants: this.scopedConfig?.tenants?.length ?? 0,
        apps: this.scopedConfig?.apps?.length ?? 0
      });
    }

    this.resolveCredentials(obs);
    this.validateBetterPortalConfig(obs);
    this.runtimeConfigEncryptionKey = this.resolveConfigEncryptionKey();

    this.observability = createBsbObservability(obs).setAttributes({
      "bp.plugin.id": def.manifest.pluginId,
      "bp.plugin.category": "service"
    });
    this.app = createBetterPortalApp({
      createRequestObservability: (name, attributes) =>
        createBsbObservability(this.createTrace(name, attributes))
    });
    this.server = createServer(createBetterPortalNodeHandler(this.app));
    if (this.bp.bpConfigPath) {
      this.configProvider = new FileBackedBetterPortalConfigProvider(this.bp.bpConfigPath);
    }

    this.manifest = buildManifestFromRegistry(def.registry, { version: "1.0.0" }, def.manifest);

    if (this.manifest.configSchemas.length > 0 && this.runtimeConfigEncryptionKey) {
      this.configStore = new FileBackedServiceConfigStore({
        filePath: this.serviceConfigStorePath(def.manifest.pluginId),
        configSchemas: this.manifest.configSchemas,
        encryptionKey: this.runtimeConfigEncryptionKey
      });
    }

    this.app.use("/**", (event) => this.handleWithCors(event));
    this.app.use("/**", (event) => this.requireTenantConfigSource(event));

    if (this.manifest.configSchemas.length > 0) {
      this.registerDefaultConfigRoutes();
    }

    this.registerInstallEndpoint(obs);

    createH3Router(def.registry, this.app, {
      serviceId: def.manifest.pluginId,
      resolveAuth: (event) => this.resolveAuthForRequest(event),
      validateTenantApp: (tenantId, appId) => this.validateTenantApp(tenantId, appId),
      resolveContext: (event) => this.resolveHandlerContext(event)
    });

    const bpSchema = buildBpSchema(def.registry, this.manifest);
    registerBpWellKnownRoutes(this.app, this.manifest, bpSchema, {
      health: () => this.renderHealth()
    });

    if (this.onRegistered) {
      const registeredSpan = this.observability.startSpan("bp.plugin.on_registered", {
        "bp.plugin.id": def.manifest.pluginId
      });
      try {
        await this.onRegistered(def.registry, obs);
        registeredSpan.end();
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        registeredSpan.error(normalizedError, { "error.name": normalizedError.name });
        registeredSpan.end();
        throw error;
      }
    }

    if (this.inSetupMode) {
      obs.log.warn("{pluginId} initialized in SETUP MODE - awaiting POST to /.well-known/bp/install", {
        pluginId: def.manifest.pluginId
      });
    } else {
      obs.log.info("{pluginId} initialized", { pluginId: def.manifest.pluginId });
    }
    span.end({ "bp.plugin.setup_mode": this.inSetupMode });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      span.error(normalizedError, { "error.name": normalizedError.name });
      span.end({ "bp.plugin.setup_mode": this.inSetupMode });
      throw error;
    }
  }

  async run(obs: Observable): Promise<void> {
    const pluginId = this.manifest?.pluginId ?? this.definition().manifest.pluginId;
    const span = createBsbObservability(obs).startSpan("bp.plugin.run", {
      "bp.plugin.id": pluginId,
      "bp.plugin.category": "service"
    });
    try {
    if (this.server.listening) {
      span.end({ "bp.plugin.already_listening": true });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.service.port, this.service.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    if (this.resolvedApiKey && this.resolvedCpUrl) {
      const syncSpan = createBsbObservability(obs).startSpan("bp.plugin.connect_control_plane", {
        "bp.plugin.id": pluginId,
        "bp.control_plane.url": this.resolvedCpUrl
      });
      try {
        this.connectToControlPlane(obs);
        syncSpan.end();
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        syncSpan.error(normalizedError, { "error.name": normalizedError.name });
        syncSpan.end();
        throw error;
      }
    }

    obs.log.info("{pluginId} serving at http://{host}:{port}{mode}", {
      pluginId: this.manifest.pluginId,
      host: this.service.host,
      port: this.service.port,
      mode: this.inSetupMode ? " [SETUP MODE]" : ""
    });
    span.end({
      "server.address": this.service.host,
      "server.port": this.service.port,
      "bp.plugin.setup_mode": this.inSetupMode
    });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      span.error(normalizedError, { "error.name": normalizedError.name });
      span.end({
        "server.address": this.service.host,
        "server.port": this.service.port,
        "bp.plugin.setup_mode": this.inSetupMode
      });
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.sseAbortController?.abort();
    if (this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((err?: Error) => err ? reject(err) : resolve());
      });
    }
  }

  // Control plane sync

  private connectToControlPlane(obs: Observable): void {
    const baseUrl = this.resolvedCpUrl!.replace(/\/+$/, "");
    const url = `${baseUrl}/.well-known/bp/sync`;
    const pollUrl = `${url}/poll`;
    const apiKey = this.resolvedApiKey!;

    const fetchErrorDetails = (error: unknown): Record<string, string> => {
      const err = error as {
        name?: string;
        message?: string;
        code?: string;
        errno?: string | number;
        syscall?: string;
        address?: string;
        port?: string | number;
        cause?: {
          name?: string;
          message?: string;
          code?: string;
          errno?: string | number;
          syscall?: string;
          address?: string;
          port?: string | number;
        };
      };
      const cause = err.cause;
      return {
        name: err.name ?? "",
        msg: err.message ?? String(error),
        code: err.code ?? cause?.code ?? "",
        causeName: cause?.name ?? "",
        causeMsg: cause?.message ?? "",
        errno: String(err.errno ?? cause?.errno ?? ""),
        syscall: err.syscall ?? cause?.syscall ?? "",
        address: err.address ?? cause?.address ?? "",
        port: String(err.port ?? cause?.port ?? "")
      };
    };

    const applyScopedConfig = (rawConfig: unknown, source: "poll" | "stream"): void => {
      this.scopedConfig = rawConfig as ScopedServiceConfig;
      // Persist for restart resilience - the service owns its cache; CM's
      // bp-config.yaml is never shared.
      try {
        this.scopedConfigCache.write(rawConfig);
      } catch (err) {
        obs.log.warn("Failed to persist scoped config cache: {msg}", { msg: (err as Error).message });
      }
      obs.log.info("BP SYNC CLIENT: config applied service={serviceId} source={source} tenants={tenants} apps={apps} managementOrigins={managementOrigins}", {
        serviceId: this.manifest.pluginId,
        source,
        tenants: this.scopedConfig?.tenants.length ?? 0,
        apps: this.scopedConfig?.apps.length ?? 0,
        managementOrigins: this.scopedConfig?.managementOrigins?.length ?? 0
      });
      this.logScopedConfigDebug(obs);
      if ((this.scopedConfig?.apps.length ?? 0) === 0) {
        obs.log.warn("Control plane sync returned no apps for this service; tenant/app requests will not resolve until the service is mounted in an app route or fragment.");
      }
    };

    const bootstrapFromPoll = async (): Promise<void> => {
      obs.log.info("Control plane sync bootstrap polling: {url}", { url: pollUrl });
      // POST manifest with the poll so CP can cache it for resolvedServicePath injection
      // AND surface per-view permission requirements to the admin role editor.
      const viewIndex: Record<string, {
        viewId: string; path: string; methods: string[]; role?: string;
        chrome?: BetterPortalRouteChrome;
        dependencies: string[];
        permissions: Array<{ serviceId: string; viewId: string; permissions: string[] }>;
        renderable: boolean;
        schemas?: Record<string, unknown>;
        raw?: boolean;
        apiContracts?: unknown[];
        demoScenarios?: unknown[];
      }> = {};
      for (const view of this.manifest.views) {
        const viewWithAuth = view as unknown as {
          auth?: { permissions?: Array<{ serviceId: string; viewId: string; permissions: string[] }> };
          chrome?: BetterPortalRouteChrome;
          html?: { themeRenderers?: Record<string, unknown> };
          dependencies?: string[];
          raw?: boolean;
          paramsSchema?: unknown;
          querySchema?: unknown;
          headersSchema?: unknown;
          bodySchema?: unknown;
          jsonResponseSchema?: unknown;
          metadataResponseSchema?: unknown;
          apiContracts?: unknown[];
        };
        const themeRenderers = viewWithAuth.html?.themeRenderers ?? {};
        const renderable = Object.keys(themeRenderers).length > 0;
        const schemas = Object.fromEntries(
          [
            ["params", viewWithAuth.paramsSchema],
            ["query", viewWithAuth.querySchema],
            ["headers", viewWithAuth.headersSchema],
            ["request", viewWithAuth.bodySchema],
            ["response", viewWithAuth.jsonResponseSchema],
            ["metadataResponse", viewWithAuth.metadataResponseSchema]
          ].filter((entry): entry is [string, unknown] => Boolean(entry[1]))
        );
        viewIndex[view.viewId] = {
          viewId: view.viewId,
          path: view.path,
          methods: [...view.methods],
          ...(view.role ? { role: view.role } : {}),
          ...(viewWithAuth.chrome ? { chrome: viewWithAuth.chrome } : {}),
          dependencies: [...(viewWithAuth.dependencies ?? [])],
          permissions: viewWithAuth.auth?.permissions ?? [],
          renderable,
          ...(Object.keys(schemas).length ? { schemas } : {}),
          ...(viewWithAuth.raw === true ? { raw: true } : {}),
          ...(Array.isArray(viewWithAuth.apiContracts) && viewWithAuth.apiContracts.length ? { apiContracts: viewWithAuth.apiContracts } : {}),
          ...(view.demoScenarios.length ? { demoScenarios: [...view.demoScenarios] } : {})
        };
      }
      const response = await fetch(pollUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          manifestVersion: this.manifest.version,
          title: this.manifest.title,
          capabilities: this.manifest.capabilities,
          configSchemas: this.manifest.configSchemas,
          webhooks: this.manifest.webhooks,
          apiContracts: this.manifest.apiContracts,
          m2mRequests: this.manifest.m2mRequests,
          viewIndex
        })
      });

      if (!response.ok) {
        let body = "";
        try { body = await response.text(); } catch { /* ignore */ }
        obs.log.warn("Control plane sync bootstrap failed: {status} {body}", {
          status: response.status,
          body
        });
        return;
      }

      const config = await response.json();
      obs.log.info("BP SYNC CLIENT: bootstrap poll succeeded service={serviceId} status={status}", {
        serviceId: this.manifest.pluginId,
        status: response.status
      });
      applyScopedConfig(config, "poll");
    };

    const logBootstrapPollError = (error: unknown): void => {
      const details = fetchErrorDetails(error);
      obs.log.warn("BP SYNC CLIENT: bootstrap poll error service={serviceId} url={url} name={name} code={code} errno={errno} syscall={syscall} address={address} port={port} msg={msg} cause={causeName}:{causeMsg}", {
        serviceId: this.manifest.pluginId,
        url: pollUrl,
        name: details.name,
        code: details.code,
        errno: details.errno,
        syscall: details.syscall,
        address: details.address,
        port: details.port,
        msg: details.msg,
        causeName: details.causeName,
        causeMsg: details.causeMsg
      });
    };

    const connect = () => {
      void bootstrapFromPoll().catch(logBootstrapPollError);
      this.sseAbortController = new AbortController();
      obs.log.info("BP SYNC CLIENT: opening SSE update stream service={serviceId} url={url}", {
        serviceId: this.manifest.pluginId,
        url
      });

      fetch(url, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${apiKey}`
        },
        signal: this.sseAbortController.signal
      }).then(async (response) => {
        if (!response.ok || !response.body) {
          let body = "";
          try { body = await response.text(); } catch { /* ignore */ }
          obs.log.warn("Control plane sync failed: {status} {body}", {
            status: response.status,
            body
          });
          scheduleReconnect();
          return;
        }

        obs.log.info("BP SYNC CLIENT: SSE update stream connected service={serviceId} status={status}; awaiting config changes", {
          serviceId: this.manifest.pluginId,
          status: response.status
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventType = "";
        let dataLines: string[] = [];

        const dispatchEvent = (): void => {
          const data = dataLines.join("\n");
          if (eventType === "config" && dataLines.length > 0) {
            obs.log.info("BP SYNC CLIENT: SSE config event received service={serviceId} bytes={bytes} lines={lines}", {
              serviceId: this.manifest.pluginId,
              bytes: data.length,
              lines: dataLines.length
            });
            try {
              const parsed: unknown = JSON.parse(data);
              applyScopedConfig(parsed, "stream");
            } catch (error) {
              obs.log.warn("Control plane config parse failed: {msg}", {
                msg: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (dataLines.length > 0) {
            obs.log.warn("BP SYNC CLIENT: ignored SSE event service={serviceId} event={event} bytes={bytes}", {
              serviceId: this.manifest.pluginId,
              event: eventType,
              bytes: data.length
            });
          }
          eventType = "";
          dataLines = [];
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
            if (normalizedLine.startsWith("event:")) {
              eventType = normalizedLine.slice(6).trim();
            } else if (normalizedLine.startsWith("data:")) {
              const value = normalizedLine.slice(5);
              dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
            } else if (normalizedLine === "") {
              dispatchEvent();
            }
          }
        }

        obs.log.warn("BP SYNC CLIENT: SSE update stream closed service={serviceId}; reconnecting", {
          serviceId: this.manifest.pluginId
        });
        scheduleReconnect();
      }).catch((err) => {
        if ((err as Error).name !== "AbortError") {
          const details = fetchErrorDetails(err);
          obs.log.warn("BP SYNC CLIENT: stream connection error service={serviceId} url={url} name={name} code={code} errno={errno} syscall={syscall} address={address} port={port} msg={msg} cause={causeName}:{causeMsg}", {
            serviceId: this.manifest.pluginId,
            url,
            name: details.name,
            code: details.code,
            errno: details.errno,
            syscall: details.syscall,
            address: details.address,
            port: details.port,
            msg: details.msg,
            causeName: details.causeName,
            causeMsg: details.causeMsg
          });
          scheduleReconnect();
        }
      });
    };

    const scheduleReconnect = () => {
      setTimeout(connect, 5000);
    };

    bootstrapFromPoll()
      .catch(logBootstrapPollError)
      .finally(connect);
  }

  private logScopedConfigDebug(obs: Observable): void {
    if (!this.scopedConfig) return;

    obs.log.debug("BP management origins: {origins}", {
      origins: (this.scopedConfig.managementOrigins ?? []).join(",")
    });

    for (const tenant of this.scopedConfig.tenants) {
      obs.log.debug("{tenantName}: {tenantId}", {
        tenantName: tenant.title,
        tenantId: tenant.id
      });

      for (const app of this.scopedConfig.apps.filter((entry) => entry.tenantId === tenant.id)) {
        obs.log.debug(" -> [{themeId}@{appHostnames}] {appName}: {appId}", {
          themeId: app.themeId,
          appHostnames: app.hostnames.join(","),
          appName: app.title,
          appId: app.id
        });
      }
    }
  }

  // CORS

  protected async resolveCorsContext(event: BetterPortalEvent): Promise<BetterPortalResolvedRequestContext | null> {
    if (this.scopedConfig) {
      const origin = event.req.headers.get("origin");
      if (!origin) return null;
      return this.resolveFromScopedConfig(origin);
    }

    if (!this.configProvider) {
      return null;
    }

    const portalConfig = await this.configProvider.loadConfig();
    return resolveEmbeddedRequestContext(portalConfig, eventHeaders(event), this.headerTrustOptions(event));
  }

  private resolveAuthForRequest(event: BetterPortalEvent): H3AuthContext | undefined {
    const ctx = event as unknown as { __bpTenantId?: string; __bpAppId?: string };
    if (!ctx.__bpTenantId || !ctx.__bpAppId) return undefined;
    const verifier = this.getJwtVerifier(ctx.__bpTenantId, ctx.__bpAppId);
    if (!verifier) return undefined;
    return {
      verifier,
      tenantId: ctx.__bpTenantId,
      appId: ctx.__bpAppId,
      appAuthConfig: this.getAppAuthConfig(ctx.__bpTenantId, ctx.__bpAppId),
      serviceIdAliases: this.getServiceIdAliases(ctx.__bpTenantId)
    };
  }

  private async handleWithCors(event: BetterPortalEvent): Promise<Response | undefined> {
    const requestedHeaders = event.req.headers.get("access-control-request-headers");
    const allowHeaders = requestedHeaders?.trim().length
      ? requestedHeaders.split(",").map((v) => v.trim())
      : ["Accept", "Authorization", "Content-Type", "HX-Current-URL", "HX-Request", "HX-Target", "HX-Trigger", "HX-Trigger-Name", "X-BP-App-Id", "X-BP-Tenant-Id", "BP-SetHeader", "BP-RemoveHeader"];

    const origin = event.req.headers.get("origin");
    if (origin && this.isPublicBpDiscoveryPath(event.url.pathname)) {
      // Public-discovery: CORS open to any origin, but ALSO try to resolve scope
      // so themed responses (login page, etc.) know which theme + tenant context to render under.
      try {
        const ctx = await this.resolveCorsContext(event);
        if (ctx) this.applyRequestContext(event, ctx);
      } catch {
        // ignore - public path stays open even if scope can't be resolved
      }
      const corsResult = handleCorsRequest(event, {
        origin: [origin],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        credentials: true,
        exposeHeaders: ["HX-Trigger", "HX-Trigger-After-Swap", "HX-Trigger-After-Settle", "HX-Location", "HX-Push-Url", "HX-Redirect", "HX-Refresh", "HX-Replace-Url", "HX-Reswap", "HX-Retarget", "BP-SetHeader", "BP-RemoveHeader"],
        preflight: { statusCode: 204 }
      });

      if (corsResult) return corsResult;
      return undefined;
    }

    if (origin && this.isConfigManagementPath(event.url.pathname)) {
      const allowedOrigins = await this.managementOrigins();
      if (!allowedOrigins.includes(origin)) {
        return handleCorsRequest(event, {
          origin: [],
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
          allowHeaders,
          credentials: true,
          preflight: { statusCode: 403 }
        }) || undefined;
      }

      const corsResult = handleCorsRequest(event, {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        credentials: true,
        exposeHeaders: ["HX-Trigger", "HX-Trigger-After-Swap", "HX-Trigger-After-Settle", "HX-Location", "HX-Push-Url", "HX-Redirect", "HX-Refresh", "HX-Replace-Url", "HX-Reswap", "HX-Retarget", "BP-SetHeader", "BP-RemoveHeader"],
        preflight: { statusCode: 204 }
      });

      if (corsResult) return corsResult;
      return undefined;
    }

    if (!origin) {
      return handleCorsRequest(event, {
        origin: [],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        credentials: true,
        preflight: { statusCode: 403 }
      }) || undefined;
    }

    let requestContext: BetterPortalResolvedRequestContext | null = null;
    try {
      requestContext = await this.resolveCorsContext(event);
    } catch (error) {
      this.logContextResolutionFailure(event, "embedded", error);
    }

    if (!requestContext) {
      this.logContextResolutionFailure(event, "embedded", undefined, await this.describeCorsContextFailure(event));
      return handleCorsRequest(event, {
        origin: [],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        credentials: true,
        preflight: { statusCode: 403 }
      }) || undefined;
    }

    const allowedOrigins = buildOriginPolicy(requestContext).allowedOrigins;
    this.applyRequestContext(event, requestContext);

    const corsResult = handleCorsRequest(event, {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders,
      credentials: true,
      exposeHeaders: ["HX-Trigger", "HX-Trigger-After-Swap", "HX-Trigger-After-Settle", "HX-Location", "HX-Push-Url", "HX-Redirect", "HX-Refresh", "HX-Replace-Url", "HX-Reswap", "HX-Retarget", "BP-SetHeader", "BP-RemoveHeader"],
      preflight: { statusCode: 204 }
    });

    if (corsResult) return corsResult;
    return undefined;
  }

  private isPublicBpDiscoveryPath(pathname: string): boolean {
    return [
      "/.well-known/bp/health",
      "/.well-known/bp/manifest",
      "/.well-known/bp/schema.json",
      "/.well-known/bp/config/schema",
      "/.well-known/bp/install",
      "/.well-known/bp/services/redeem",
      "/.well-known/bp/bootstrap",
      "/.well-known/bp/bootstrap/commit",
      "/.well-known/bp/admin/services/begin-install",
      "/.well-known/jwks.json",
      // Auth endpoints - explicitly cross-origin (login form posts from any app).
      "/login",
      "/logout",
      "/refresh",
      "/register"
    ].includes(pathname);
  }

  private isConfigManagementPath(pathname: string): boolean {
    return pathname === "/.well-known/bp/config" || pathname.startsWith("/.well-known/bp/config/");
  }

  private async managementOrigins(): Promise<string[]> {
    if (this.scopedConfig) {
      return [...new Set(this.scopedConfig.managementOrigins ?? [])];
    }

    if (!this.configProvider) {
      return [];
    }

    const config = await this.configProvider.loadConfig();
    const adminTenantId = config.configManagement.adminTenantId;
    if (!adminTenantId) return [];

    return [...new Set(config.apps
      .filter((app) => app.tenantId === adminTenantId)
      .flatMap((app) => [
        ...app.hostnames.flatMap((hostname) => {
          if (hostname.startsWith("http://") || hostname.startsWith("https://")) {
            return [hostname.replace(/\/+$/, "")];
          }
          return [`https://${hostname}`, `http://${hostname}`];
        }),
        ...app.originOverrides.map((originOverride) => originOverride.replace(/\/+$/, ""))
      ]))];
  }

  private resolveFromScopedConfig(origin: string): BetterPortalResolvedRequestContext | null {
    if (!this.scopedConfig) return null;

    for (const app of this.scopedConfig.apps) {
      const origins = app.hostnames.flatMap((h) => {
        if (h.startsWith("http://") || h.startsWith("https://")) return [h];
        return [`http://${h}`, `https://${h}`];
      });

      if (origins.includes(origin)) {
        const tenant = this.scopedConfig.tenants.find((t) => t.id === app.tenantId) ?? null;
        if (!tenant || !tenant.active) return null;
        return {
          tenant: {
            ...tenant,
            services: tenant.services.map((service) => ({ ...service, apiKeyHash: "" })),
            activatedPlatformServices: [...tenant.activatedPlatformServices]
          },
          app: {
            ...app,
            hostnames: [...app.hostnames],
            originOverrides: [...app.originOverrides],
            refererOverrides: [...app.refererOverrides],
            shell: app.shell,
            defaultRoute: app.defaultRoute,
            routes: [...app.routes],
            menu: [...app.menu],
            slots: [...app.slots],
            fragments: { ...app.fragments }
          }
        };
      }
    }

    return null;
  }

  protected applyRequestContext(event: BetterPortalEvent, context: BetterPortalResolvedRequestContext): void {
    const bpContext = event as unknown as {
      __bpTenantId?: string;
      __bpAppId?: string;
      __bpTenant?: BetterPortalResolvedRequestContext["tenant"];
      __bpApp?: BetterPortalResolvedRequestContext["app"];
      __bpThemeId?: string;
      __bpAppAuth?: AppAuthConfig;
    };
    bpContext.__bpTenantId = context.tenant.id;
    bpContext.__bpAppId = context.app.id;
    bpContext.__bpTenant = context.tenant;
    bpContext.__bpApp = context.app;
    bpContext.__bpThemeId = context.app.themeId ?? "bootstrap1";
    bpContext.__bpAppAuth = context.app.auth;
  }

  protected resolveHandlerContext(event: BetterPortalEvent): Partial<RouteHandlerContext> {
    const bpContext = event as unknown as {
      __bpTenantId?: string;
      __bpAppId?: string;
      __bpTenant?: BetterPortalResolvedRequestContext["tenant"];
      __bpApp?: BetterPortalResolvedRequestContext["app"];
      __bpResponseModel?: unknown;
    };
    return {
      plugin: this,
      ...(bpContext.__bpTenant ? { tenant: bpContext.__bpTenant } : {}),
      ...(bpContext.__bpApp ? { app: bpContext.__bpApp } : {}),
      config: this.effectiveServiceConfig(bpContext.__bpTenantId, bpContext.__bpAppId),
      ...(bpContext.__bpResponseModel ? { responseModel: bpContext.__bpResponseModel } : {}),
      webhook: (eventId, payload, options) => this.emitWebhook(event, eventId, payload, {
        tenantId: options?.tenantId ?? bpContext.__bpTenantId,
        appId: options?.appId ?? bpContext.__bpAppId
      })
    };
  }

  private async emitWebhook(event: BetterPortalEvent, eventId: string, payload: unknown, scope: { tenantId?: string; appId?: string }): Promise<void> {
    const cpUrl = this.bp.controlPlaneUrl?.replace(/\/+$/, "");
    const apiKey = this.bp.serviceApiKey;
    const obs = eventObservability(event);
    if (!cpUrl || !apiKey) {
      obs?.logger.warn("BP WEBHOOK: skipped event={eventId} service={serviceId} reason=missing_control_plane", {
        eventId,
        serviceId: this.manifest.pluginId
      });
      return;
    }
    const response = await fetch(`${cpUrl}/.well-known/bp/webhooks/events`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        eventId,
        payload,
        tenantId: scope.tenantId,
        appId: scope.appId
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      obs?.logger.warn("BP WEBHOOK: emit failed event={eventId} service={serviceId} status={status} body={body}", {
        eventId,
        serviceId: this.manifest.pluginId,
        status: response.status,
        body
      });
    }
  }

  private effectiveServiceConfig(tenantId?: string, appId?: string): Record<string, unknown> {
    if (!tenantId) return {};
    const state = this.configStore.read(this.internalConfigReadTicket(tenantId));
    return {
      ...state.tenant,
      ...(appId ? state.app[appId] ?? {} : {})
    };
  }

  private internalConfigReadTicket(tenantId: string): ServiceConfigTicketClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: this.manifest.pluginId,
      aud: this.manifest.pluginId,
      sub: this.manifest.pluginId,
      iat: now,
      exp: now + 60,
      jti: `${tenantId}:${now}`,
      realm: "control-plane",
      tenantId,
      serviceId: this.manifest.pluginId,
      actions: ["config.read"]
    };
  }

  protected async describeCorsContextFailure(event: BetterPortalEvent): Promise<{ candidateHosts: string; configuredAppHosts: string } | undefined> {
    const headers = eventHeaders(event);
    if (this.scopedConfig) {
      const candidateHosts = [
        hostFromHeaderValue(resolveEmbeddedSourceHeader(headers, this.headerTrustOptions(event))),
        hostFromHeaderValue(resolveThemeSourceHeader(headers, this.headerTrustOptions(event)))
      ].filter((value): value is string => !!value);

      return {
        candidateHosts: [...new Set(candidateHosts)].join(","),
        configuredAppHosts: this.scopedConfig.apps
          .map((app) => `${app.id}:[${app.hostnames.map((hostname) => hostFromHeaderValue(hostname) ?? hostname).join(",")}]`)
          .join(";")
      };
    }

    if (!this.configProvider) {
      return undefined;
    }

    const portalConfig = await this.configProvider.loadConfig();
    const details = describeEmbeddedContextResolution(portalConfig, headers, this.headerTrustOptions(event));
    return {
      candidateHosts: details.candidates.join(","),
      configuredAppHosts: details.appHosts.map((app) => `${app.appId}:[${app.hosts.join(",")}]`).join(";")
    };
  }

  private logContextResolutionFailure(
    event: BetterPortalEvent,
    mode: "embedded" | "theme",
    error?: unknown,
    details?: { candidateHosts: string; configuredAppHosts: string }
  ): void {
    const obs = eventObservability(event);
    if (!obs) return;

    const normalizedError = error instanceof Error ? error : null;
    obs.logger.warn(
      "BetterPortal {mode} context not resolved for request host={host} origin={origin} referer={referer} candidateHosts={candidateHosts} configuredAppHosts={configuredAppHosts}: {reason}",
      {
        mode,
        host: event.req.headers.get("host") ?? "",
        origin: event.req.headers.get("origin") ?? "",
        referer: event.req.headers.get("referer") ?? "",
        candidateHosts: details?.candidateHosts ?? "",
        configuredAppHosts: details?.configuredAppHosts ?? "",
        reason: normalizedError?.message ?? "no active app matched request host/origin/referer"
      }
    );
  }

  /**
   * Resolve API key + CP URL using the 3-layer chain:
   *   1. Bootstrap state store (default)
   *   2. sec-config (this.bp.serviceApiKey + this.bp.controlPlaneUrl)
   *   3. Process env BP_SERVICE_API_KEY + BP_CONTROL_PLANE_URL (arg layer)
   * If none yield credentials, enter setup mode.
   */
  private resolveCredentials(obs: Observable): void {
    // Self-hosted services (the CP itself - e.g. config-manager) don't poll a
    // remote CP and never enter setup mode.
    if (!this.requireBetterPortalConfigSource) {
      this.inSetupMode = false;
      this.resolvedApiKey = null;
      this.resolvedCpUrl = null;
      return;
    }

    const stored = this.bootstrapState.read();
    const envKey = process.env.BP_SERVICE_API_KEY;
    const envCp = process.env.BP_CONTROL_PLANE_URL;

    this.resolvedApiKey =
      stored.apiKey ?? this.bp.serviceApiKey ?? envKey ?? null;
    this.resolvedCpUrl =
      stored.cpUrl ?? this.bp.controlPlaneUrl ?? envCp ?? null;

    if (this.resolvedApiKey && this.resolvedCpUrl) {
      this.inSetupMode = false;
      const source = stored.apiKey ? "bootstrap-state"
        : this.bp.serviceApiKey ? "sec-config"
        : "env";
      obs.log.info("Credentials loaded from {source}; CP={cpUrl}", {
        source,
        cpUrl: this.resolvedCpUrl
      });
    } else {
      this.inSetupMode = true;
    }
  }

  private validateBetterPortalConfig(obs: Observable): void {
    if (!this.requireBetterPortalConfigSource) {
      return;
    }

    const bp = this.bp;
    const localPath = bp.bpConfigPath;
    const hasLocalPath = !!localPath;
    const hasSync = !!this.resolvedApiKey && !!this.resolvedCpUrl;

    if (!hasLocalPath && !hasSync) {
      // Setup mode - service will accept POST /.well-known/bp/install
      obs.log.warn(
        "No credentials available - entering setup mode. POST /.well-known/bp/install with setupToken+cpUrl to provision."
      );
      return;
    }

    if (!hasSync && hasLocalPath) {
      obs.log.warn(
        "BetterPortal control-plane sync is disabled; using local file config at {path}. Dev mode only.",
        { path: localPath }
      );
    } else if (hasLocalPath) {
      obs.log.warn(
        "BetterPortal local file config at {path} configured alongside control-plane sync; sync is authoritative after connect.",
        { path: localPath }
      );
    }
  }

  private requireTenantConfigSource(event: BetterPortalEvent): Response | undefined {
    if (!this.requireBetterPortalConfigSource) {
      return undefined;
    }

    if (this.scopedConfig || this.configProvider) {
      return undefined;
    }

    if (this.isPreSyncCorePath(event.url.pathname)) {
      return undefined;
    }

    const detail = this.inSetupMode
      ? "Service is in setup mode. POST /.well-known/bp/install with {setupToken, cpUrl} to provision."
      : "The service is running in control-plane sync mode, but no tenant/app config has been received.";

    return jsonResponse({
      error: this.inSetupMode ? "BetterPortal service awaiting setup" : "BetterPortal tenant/app config has not synced yet",
      detail
    }, 503);
  }

  private resolveConfigEncryptionKey(): string | undefined {
    const stored = this.bootstrapState.read();
    return stored.configEncryptionKey ?? this.bp.configEncryptionKey;
  }

  private isPreSyncCorePath(pathname: string): boolean {
    if (pathname === "/.well-known/bp/health") return true;
    if (pathname === "/.well-known/bp/manifest") return true;
    if (pathname === "/.well-known/bp/schema.json") return true;
    if (pathname === "/.well-known/bp/install") return true;
    if (pathname === "/.well-known/jwks.json") return true;
    if (pathname === "/.well-known/bp/bootstrap") return true;
    if (pathname === "/.well-known/bp/bootstrap/commit") return true;
    if (pathname === "/.well-known/bp/services/redeem") return true;
    if (pathname === "/.well-known/bp/admin/services/begin-install") return true;
    return false;
  }

  private renderHealth(): Response {
    const synced = Boolean(this.scopedConfig);
    const localConfig = Boolean(this.configProvider);
    const ready = !this.requireBetterPortalConfigSource || this.inSetupMode || synced || localConfig;
    const status = ready ? 200 : 503;

    return jsonResponse({
      ok: ready,
      ready,
      pluginId: this.manifest.pluginId,
      setupMode: this.inSetupMode,
      config: {
        synced,
        localConfig,
        tenants: this.scopedConfig?.tenants.length ?? 0,
        apps: this.scopedConfig?.apps.length ?? 0
      },
      sync: {
        mode: this.inSetupMode
          ? "setup"
          : !this.requireBetterPortalConfigSource
            ? "control-plane"
          : localConfig
            ? "local"
            : this.resolvedApiKey && this.resolvedCpUrl
              ? "control-plane"
              : "missing",
        state: ready
          ? this.inSetupMode
            ? "awaiting-install"
            : !this.requireBetterPortalConfigSource
              ? "source"
            : synced
              ? "synced"
              : "local-config"
          : "awaiting-sync"
      }
    }, status);
  }

  // -- Install endpoint ----------------------------------------------

  /**
   * Mounts POST /.well-known/bp/install - the browser-driven service installer.
   * Caller posts { setupToken, cpUrl }. Service fetches CP JWKS, verifies the
   * setup token, then redeems it for the real apiKey via CP /services/redeem.
   * Persists credentials and starts CP sync.
   */
  private registerInstallEndpoint(obs: Observable): void {
    this.app.post("/.well-known/bp/install", async (event) => {
      // CORS already handled by handleWithCors for public discovery paths.
      const body = await event.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return jsonResponse({ error: "Request body must be JSON object" }, 400);
      }
      const { setupToken, cpUrl } = body as { setupToken?: string; cpUrl?: string };
      if (typeof setupToken !== "string" || setupToken.length === 0) {
        return jsonResponse({ error: "Missing setupToken" }, 400);
      }
      if (typeof cpUrl !== "string" || cpUrl.length === 0) {
        return jsonResponse({ error: "Missing cpUrl" }, 400);
      }

      const normalizedCp = cpUrl.replace(/\/+$/, "");
      const jwksUri = `${normalizedCp}/.well-known/jwks.json`;

      try {
        const claims = await verifySetupToken(setupToken, {
          jwks: { jwksUri, issuer: normalizedCp },
          expectedIssuer: normalizedCp
        });

        if (claims.cpJwksUri && claims.cpJwksUri !== jwksUri) {
          return jsonResponse({ error: "Setup token cpJwksUri mismatch" }, 400);
        }

        // Redeem token at CP - exchanges single-use setup token for the real apiKey.
        // Also pushes our JWKS (if we're an auth provider) so the CP can verify
        // JWTs we issue WITHOUT fetching JWKS from us (CM cannot reach services).
        const redeemResponse = await fetch(`${normalizedCp}/.well-known/bp/services/redeem`, {
          method: "POST",
          headers: { "content-type": "application/json", "accept": "application/json" },
          body: JSON.stringify({
            setupToken,
            pluginId: this.manifest.pluginId,
            serviceUrl: this.deriveOwnUrl(event),
            ...(this.publishedJwks ? { jwks: this.publishedJwks } : {})
          })
        });
        if (!redeemResponse.ok) {
          const text = await redeemResponse.text().catch(() => "");
          obs.log.warn("CP redeem failed: status={status} body={body}", { status: redeemResponse.status, body: text });
          return jsonResponse({ error: "CP rejected redeem", detail: text }, 502);
        }
        const redeemBody = await redeemResponse.json() as { apiKey?: string; cpId?: string; cpJwksUri?: string };
        if (typeof redeemBody.apiKey !== "string" || redeemBody.apiKey.length === 0) {
          return jsonResponse({ error: "CP redeem response missing apiKey" }, 502);
        }

        // Persist + log + reconnect to CP.
        const configEncryptionKey = this.resolveConfigEncryptionKey() ?? `bp_cek_${randomBytes(32).toString("base64url")}`;
        this.bootstrapState.write({
          apiKey: redeemBody.apiKey,
          cpUrl: normalizedCp,
          cpId: redeemBody.cpId,
          cpJwksUri: redeemBody.cpJwksUri ?? jwksUri,
          configEncryptionKey,
          installedAt: new Date().toISOString()
        });
        this.runtimeConfigEncryptionKey = configEncryptionKey;
        if (this.manifest.configSchemas.length > 0) {
          this.configStore = new FileBackedServiceConfigStore({
            filePath: this.serviceConfigStorePath(this.manifest.pluginId),
            configSchemas: this.manifest.configSchemas,
            encryptionKey: configEncryptionKey
          });
        }
        this.resolvedApiKey = redeemBody.apiKey;
        this.resolvedCpUrl = normalizedCp;
        this.inSetupMode = false;

        // eslint-disable-next-line no-console
        console.log(`\n*** BP install complete for ${this.manifest.pluginId} ***\n    apiKey: ${redeemBody.apiKey}\n    cpUrl:  ${normalizedCp}\n`);
        obs.log.info("Install complete for {pluginId}; apiKey persisted; starting CP sync", { pluginId: this.manifest.pluginId });

        // Kick off CP sync (idempotent - connectToControlPlane uses resolved fields)
        this.connectToControlPlane(obs);

        return jsonResponse({
          ok: true,
          pluginId: this.manifest.pluginId,
          apiKey: redeemBody.apiKey,
          cpUrl: normalizedCp,
          manifestVersion: this.manifest.version
        }, 200);
      } catch (err) {
        obs.log.warn("Install handler error: {msg}", { msg: (err as Error).message });
        return jsonResponse({ error: "Install failed", detail: (err as Error).message }, 400);
      }
    });
  }

  private serviceConfigStorePath(pluginId: string): string {
    if (this.bp.bpConfigPath) {
      return resolve(dirname(this.bp.bpConfigPath), ".bp-config-state", `${pluginId}.json`);
    }
    return resolve(dirname(this.bp.bootstrapStatePath ?? DEFAULT_BOOTSTRAP_STATE_PATH), "config.json");
  }

  private deriveOwnUrl(event: BetterPortalEvent): string {
    const host = event.req.headers.get("host") ?? `${this.service.host}:${this.service.port}`;
    const proto = event.req.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  // Config management

  private registerDefaultConfigRoutes(): void {
    registerServiceConfigRoutes({
      app: this.app,
      serviceId: this.manifest.pluginId,
      configSchemas: this.manifest.configSchemas,
      mode: "hybrid",
      validateTicket: (ticketValue, event, action) =>
        this.validateConfigTicket(ticketValue, event, action),
      validateScope: (scope) => this.validateConfigScope(scope.tenantId, scope.appId),
      readConfig: ({ ticket }) =>
        this.configStore.read(ticket),
      writeConfig: ({ tenantId, appId, values }, { ticket }) =>
        this.configStore.write(tenantId, appId, values, ticket),
      clearConfigKey: ({ tenantId, appId, key }, { ticket }) =>
        this.configStore.clearKey?.(tenantId, appId, key, ticket) ?? this.configStore.read(ticket)
    });
  }

  protected async validateConfigScope(tenantId: string, appId?: string): Promise<boolean> {
    if (this.scopedConfig) {
      const tenant = this.scopedConfig.tenants.find((entry) => entry.id === tenantId);
      if (!tenant?.active) return false;
      if (!appId) return true;
      const configApps = this.scopedConfig.configApps ?? this.scopedConfig.apps;
      return configApps.some((entry) => entry.id === appId && entry.tenantId === tenantId);
    }

    if (!this.configProvider) {
      return false;
    }

    const config = await this.configProvider.loadConfig();
    const tenant = config.tenants.find((entry) => entry.id === tenantId);
    if (!tenant?.active) return false;
    if (!appId) return true;
    return config.apps.some((entry) => entry.id === appId && entry.tenantId === tenantId);
  }

  /**
   * Validate a service-config ticket. Primary path: verify a CP-signed RS256
   * ticket against the CP JWKS learned at install/redeem - there is no shared
   * secret and only the CP can mint tickets. Before install (no cpJwksUri yet)
   * the service fails closed: config endpoints reject every request until it has
   * been provisioned.
   */
  protected async validateConfigTicket(
    ticketValue: string | null,
    event: BetterPortalEvent,
    action: ServiceConfigAction
  ): Promise<ServiceConfigTicketClaims | null> {
    if (!ticketValue) return null;

    const { cpUrl, cpJwksUri } = this.bootstrapState.read();
    if (cpUrl && cpJwksUri) {
      try {
        return await verifyServiceConfigTicket(ticketValue, {
          jwksUri: cpJwksUri,
          issuer: cpUrl,
          serviceId: this.manifest.pluginId
        });
      } catch {
        // Not a valid CP ticket - fall through to the dev path (only if enabled).
      }
    }

    return this.validateDevConfigToken(ticketValue, event, action);
  }

  /**
   * Static shared-secret fallback for LOCAL DEVELOPMENT ONLY. Disabled unless
   * BP_ALLOW_DEV_CONFIG_TOKEN=true AND configApiToken is explicitly set. It
   * trusts the x-bp-tenant-id header to choose the tenant, so it must never be
   * enabled in production.
   */
  private validateDevConfigToken(
    ticketValue: string,
    event: BetterPortalEvent,
    action: ServiceConfigAction
  ): ServiceConfigTicketClaims | null {
    if (process.env.BP_ALLOW_DEV_CONFIG_TOKEN !== "true") return null;
    const expectedToken = this.bp.configApiToken;
    if (!expectedToken) return null;

    const expected = Buffer.from(expectedToken);
    const actual = Buffer.from(ticketValue);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const tenantId = event.req.headers.get("x-bp-tenant-id") ?? "tenant-main";
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
      serviceId: this.manifest.pluginId,
      actions: [action]
    };
  }
}
