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
  authorizeServiceToken,
  isServiceToken,
  createJwksVerifier,
  createStaticJwksVerifier,
  describeEmbeddedContextResolution,
  hostFromHeaderValue,
  registerBpWellKnownRoutes,
  registerServiceConfigRoutes,
  loadOrGenerateKeyPair,
  signServiceToken,
  resolveEmbeddedSourceHeader,
  resolveEmbeddedRequestContext,
  resolveThemeSourceHeader,
  verifySetupToken,
  verifyServiceConfigTicket,
  type AppAuthConfig,
  type AppAuthRole,
  type AuthProviderRuntimeMetadata,
  type BetterPortalResolvedRequestContext,
  type BetterPortalObservability,
  type ObservabilityAttributes,
  type BetterPortalRegistry,
  type BetterPortalShellFragmentItem,
  type RegisteredShellFragment,
  type RegisteredRoute,
  type BetterPortalThemeConfig,
  type JwtVerifier,
  type ManifestBaseFields,
  type M2MCallerMode,
  type PluginManifest,
  type ScopedApp,
  type ScopedServiceConfig,
  type RsaKeyPair,
  type ServiceTokenVerifier,
  type ScopedTenant,
  type BetterPortalRouteChrome,
  type BetterPortalConfig as PlatformConfig,
  type ServiceConfigAction,
  type ServiceConfigStore,
  type ServiceConfigTicketClaims,
  type RouteHandlerContext,
  type RouteSitemapEntry,
  type JsonValue,
  type TenantAppValidation,
  formatTraceParent,
  toHtmlString
} from "@betterportal/framework";
import { createH3Router, isBpManagementAuthPath, isBpManagementAuthRoute, type H3AuthContext } from "@betterportal/framework/lib/adapters/h3.js";
import { BootstrapStateStore, type BootstrapStateFile } from "./bootstrapState.js";
import { ScopedConfigCache } from "./scopedConfigCache.js";
import {
  createBetterPortalApp,
  createBetterPortalNodeHandler,
  annotateCoreHttpOutcome,
  eventObservability,
  eventTracePropagation,
  eventHeaders,
  getEventPeerIp,
  handleCorsRequest,
  htmlResponse,
  jsonResponse,
  withCoreHttpOutcome,
  type BetterPortalEvent,
  type BetterPortalH3App
} from "@betterportal/framework/lib/runtime/h3.js";
import { createBsbObservability } from "./index.js";
import {
  buildSeoDocuments,
  buildSitemapChunks,
  buildSitemapIndex,
  type RuntimeSitemapRoute
} from "./seo.js";

// Config constraint

const DEFAULT_BOOTSTRAP_STATE_PATH = "./.bp-bootstrap/state.enc";
const DEFAULT_SCOPED_CONFIG_CACHE_PATH = "./.bp-sync-cache/scoped.json";

function boundedDiagnosticList(values: ReadonlyArray<string>, limit = 4096): string {
  return values.join(",").slice(0, limit);
}

function coreJsonResponse(
  body: JsonValue,
  status: number,
  code: string,
  reason: string,
  attributes?: ObservabilityAttributes
): Response {
  return withCoreHttpOutcome(jsonResponse(body, status), { code, reason, attributes });
}

export interface BPServiceConfig {
  host: string;
  port: number;
  betterportal?: BetterPortalConfig;
  bpConfigPath?: string;
  configApiToken?: string;
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
  // NOTE: there is deliberately no operator-supplied config encryption key.
  // The key is generated (256-bit, CSPRNG) at install and persisted in the
  // bootstrap state; see resolveConfigEncryptionKey.
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

export type AuthoritativeServiceType = "auth" | "theme";

export type AuthoritativeServiceMutation<T extends AuthoritativeServiceType> =
  T extends "auth"
    ? { roles: AppAuthRole[] }
    : { themeConfig: BetterPortalThemeConfig };

export interface BPServiceDefinition {
  manifest: ManifestBaseFields;
  registry: BetterPortalRegistry;
}

export interface BPServiceClientRuntime {
  readonly baseUrl: string;
  readonly headers: Record<string, string> | (() => Record<string, string>);
  readonly token: () => string;
  readonly fetch: typeof globalThis.fetch;
}

// Base class

export abstract class BPService<
  TConfig extends BSBReferencePluginConfigType & BPServicePluginConfig = BPServicePluginConfig,
  TEvents extends BSBEventSchemas = BSBEventSchemas
> extends BSBService<TConfig, TEvents> {

  /** Build-time metadata extraction without constructing or starting the service. */
  static getBPDefinition(this: { prototype: { definition(): BPServiceDefinition } }): BPServiceDefinition {
    return this.prototype.definition.call(Object.create(this.prototype));
  }

  private readonly bpPluginVersion: string;

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
  private registeredRoutes: ReadonlyArray<RegisteredRoute> = [];
  private scopedConfigCache!: ScopedConfigCache;
  private s2sKeyPair: RsaKeyPair | null = null;
  private s2sIdentityReady = false;
  private sseAbortController: AbortController | null = null;
  private readonly seoProbeCache = new Map<string, {
    expiresAt: number;
    data?: RuntimeSitemapRoute[];
    error?: Error;
    pending?: Promise<RuntimeSitemapRoute[]>;
  }>();
  protected bootstrapState!: BootstrapStateStore;

  /**
   * Synthesize a BetterPortalConfig-shaped view from the synced scoped config.
   * Lets shell services that need the full-portal-config API (for
   * `resolveThemeRequestContext` / `resolveServiceForTenant`) operate without
   * sharing CM's bp-config.yaml. Returns null until the first sync completes.
   */
  protected getPortalConfig(): PlatformConfig | null {
    const s = this.scopedConfig;
    if (!s) return null;
    const manifestCache = [...new Map(s.apps
      .filter((app) => app.shell)
      .map((app) => [app.shell!.serviceId, {
        serviceId: app.shell!.serviceId,
        shell: {
          service: app.shell!.service,
          renderer: app.shell!.renderer,
          fragments: []
        }
      }])).values()];
    return {
      configManagement: {
        adminTenantId: s.configManagement?.adminTenantId,
        managementAppId: s.configManagement?.managementAppId,
        auth: { mechanism: "none", requiredPermissions: [] }
      } as any,
      platformServices: [],
      sharedServiceCatalog: [],
      sharedServiceActivations: [],
      manifestCache,
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
        shell: a.shell ? { serviceId: a.shell.serviceId } : undefined,
        themeConfig: a.themeConfig,
        defaultRoute: a.defaultRoute ?? "/",
        routes: [...a.routes],
        menu: [...(a.menu ?? [])],
        slots: [...(a.slots ?? [])],
        fragments: a.fragments,
        shellFragments: a.shellFragments,
        auth: a.auth
      })) as any
    } as unknown as PlatformConfig;
  }
  private resolvedApiKey: string | null = null;
  private resolvedCpUrl: string | null = null;
  private inSetupMode: boolean = false;

  protected abstract definition(): BPServiceDefinition;

  protected onRegistered?(registry: BetterPortalRegistry, obs: Observable): void | Promise<void>;

  private registerShellFragmentRoutes(registry: BetterPortalRegistry): void {
    if (!registry.shellFragments?.length) return;
    this.app.get("/.well-known/bp/shell/fragment/**", async (event) => {
      let id: string;
      try {
        id = decodeURIComponent(event.url.pathname.slice("/.well-known/bp/shell/fragment/".length));
      } catch {
        return withCoreHttpOutcome(new Response("", { status: 400 }), {
          code: "fragment.request_invalid",
          reason: "Shell fragment identifier is not valid URL encoding"
        });
      }
      const definition = registry.shellFragments!.find((fragment) => fragment.id === id);
      if (!definition) {
        return withCoreHttpOutcome(new Response("", { status: 404 }), {
          code: "fragment.definition_not_found",
          reason: "Shell fragment is not defined by this service",
          attributes: { "bp.fragment.id": id }
        });
      }
      const requestContext = this.resolveHandlerContext(event);
      const activeShell = (requestContext.app as BetterPortalResolvedRequestContext["app"] | undefined)?.shell;
      if (!requestContext.tenant || !requestContext.app || activeShell?.service !== this.manifest.shell?.service) {
        return withCoreHttpOutcome(new Response("", { status: 404 }), {
          code: "fragment.shell_mismatch",
          reason: "Shell fragment is unavailable for the resolved app shell",
          attributes: {
            "bp.fragment.id": id,
            "bp.shell.requested": activeShell?.service ?? "",
            "bp.shell.service": this.manifest.shell?.service ?? ""
          }
        });
      }
      const app = requestContext.app;
      const activeShellServiceId = app.shell!.serviceId;
      const settings = app.shellFragments?.[activeShellServiceId] ?? {};
      const setting = settings[id];
      if (setting?.mode === "none") return new Response(null, { status: 204 });

      const renderBuiltIn = (fragment: RegisteredShellFragment): string => toHtmlString(fragment.render({
        tenant: requestContext.tenant!,
        app,
        config: this.effectiveServiceConfig(requestContext.tenant!.id, app.id),
        request: { url: event.url.toString() },
        fragmentId: fragment.id,
        items: []
      }));
      const renderItem = (item: any): string => {
        if (item?.source === "shell") {
          const child = registry.shellFragments!.find((fragment) => fragment.id === item.fragmentId && fragment.kind === "fragment");
          return child ? renderBuiltIn(child) : "";
        }
        if (item?.source !== "service") return "";
        if (typeof item.targetPath !== "string" || !item.targetPath.startsWith("/")) return "";
        const service = requestContext.tenant!.services.find((candidate) => candidate.enabled && candidate.id === item.serviceId);
        const mounted = app.routes.some((route) => route.enabled !== false
          && route.serviceId === item.serviceId
          && (route.resolvedServicePath ?? route.targetPath) === item.targetPath);
        if (!service || !mounted) return "";
        const serviceUrl = new URL(service.hostname);
        const target = new URL(item.targetPath, serviceUrl);
        if (target.origin !== serviceUrl.origin) return "";
        target.searchParams.set("_f", item.fragmentId);
        const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]!);
        return `<bp-element data-bp-element data-bp-state="loading" aria-busy="true" data-bp-service="${escape(item.serviceId)}" hx-get="${escape(target.toString())}" hx-trigger="load, bp:element-retry" hx-target="this" hx-swap="none"></bp-element>`;
      };

      if (definition.kind === "fragment") {
        const html = setting?.mode === "override" ? renderItem(setting.item) : renderBuiltIn(definition);
        return htmlResponse(html, 200, "text/html; mode=fragment", { "cache-control": "no-store" });
      }
      const legacyFragments = app.fragments[definition.id] ?? [];
      const legacySlots = app.slots.flatMap((slot) => {
        if (!slot.enabled || !slot.slotId.startsWith(`${definition.id}.`)) return [];
        const route = app.routes.find((candidate) => candidate.enabled !== false
          && candidate.serviceId === slot.serviceId
          && candidate.viewId === slot.viewId);
        const targetPath = route?.resolvedServicePath ?? route?.targetPath;
        return targetPath ? [{ source: "service" as const, serviceId: slot.serviceId, fragmentId: slot.slotId, targetPath }] : [];
      });
      let configuredItems: BetterPortalShellFragmentItem[];
      if (setting?.mode === "items") configuredItems = setting.items;
      else if (setting?.mode === "override") configuredItems = [setting.item];
      else if (setting === undefined && legacyFragments.length > 0) configuredItems = legacyFragments
        .filter((item) => item.enabled)
        .map((item) => ({
          source: "service" as const,
          ...item,
          fragmentId: item.fragmentId.includes(".") ? item.fragmentId : `${definition.id}.${item.fragmentId}`
        }));
      else if (setting === undefined && legacySlots.length > 0) configuredItems = legacySlots;
      else configuredItems = (definition.defaultItems ?? []).map((fragmentId) => ({ source: "shell" as const, fragmentId }));
      const html = toHtmlString(definition.render({
        tenant: requestContext.tenant,
        app,
        config: this.effectiveServiceConfig(requestContext.tenant.id, app.id),
        request: { url: event.url.toString() },
        fragmentId: definition.id,
        items: configuredItems.map(renderItem)
      }));
      return htmlResponse(html, 200, "text/html; mode=fragment", { "cache-control": "no-store" });
    });
  }

  protected controlPlaneCredentials(): { url: string; apiKey: string } | null {
    if (!this.resolvedCpUrl || !this.resolvedApiKey) return null;
    return { url: this.resolvedCpUrl.replace(/\/+$/, ""), apiKey: this.resolvedApiKey };
  }

  /**
   * Resolve an installed-service dependency from the last-known-good snapshot.
   * The returned shape is accepted directly by generated BP clients.
   */
  public m2mClient(
    requestId: string,
    ctx: Pick<RouteHandlerContext, "tenant" | "app" | "obs" | "rawEvent">
  ): BPServiceClientRuntime;
  public m2mClient(requestId: string, tenantId: string, appId: string): BPServiceClientRuntime;
  public m2mClient(
    requestId: string,
    tenantOrContext: string | Pick<RouteHandlerContext, "tenant" | "app" | "obs" | "rawEvent">,
    appIdArgument?: string
  ): BPServiceClientRuntime {
    const tenantId = typeof tenantOrContext === "string" ? tenantOrContext : tenantOrContext.tenant.id;
    const appId = typeof tenantOrContext === "string" ? appIdArgument : tenantOrContext.app.id;
    if (!appId) throw new Error("BetterPortal app id is required for S2S calls");
    const parent = typeof tenantOrContext === "string" ? undefined : tenantOrContext.obs;
    const event = typeof tenantOrContext === "string" ? undefined : tenantOrContext.rawEvent as BetterPortalEvent | undefined;
    const { keyPair, binding, target } = this.resolveM2MClient(requestId, tenantId, appId, "service");
    return {
      baseUrl: target.hostname.replace(/\/+$/, ""),
      headers: {
        "X-BP-Service-Id": binding.sourceServiceId,
        "X-BP-Tenant-Id": tenantId,
        "X-BP-App-Id": appId
      },
      token: () => signServiceToken({
        keyPair,
        sourceServiceId: binding.sourceServiceId,
        targetServiceId: binding.targetServiceId,
        tenantId,
        appId,
        bindingId: binding.id
      }),
      fetch: this.m2mFetch({ requestId, mode: "service", tenantId, appId, binding, target }, parent, event)
    };
  }

  /** Resolve an installed-service dependency while preserving the current BP user identity. */
  public delegatedM2mClient(requestId: string, ctx: Pick<RouteHandlerContext, "tenant" | "app" | "user" | "obs" | "rawEvent">): BPServiceClientRuntime {
    if (!ctx.user) throw new Error("Delegated S2S calls require an authenticated BP user");
    const event = ctx.rawEvent as BetterPortalEvent | undefined;
    const authorization = event?.req.headers.get("authorization") ?? "";
    const userToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!userToken || isServiceToken(userToken)) throw new Error("Delegated S2S calls require the original BP user bearer token");

    const tenantId = ctx.tenant.id;
    const appId = ctx.app.id;
    const { keyPair, binding, target } = this.resolveM2MClient(requestId, tenantId, appId, "delegated");
    return {
      baseUrl: target.hostname.replace(/\/+$/, ""),
      headers: () => ({
        "X-BP-Service-Authorization": `Bearer ${signServiceToken({
          keyPair,
          sourceServiceId: binding.sourceServiceId,
          targetServiceId: binding.targetServiceId,
          tenantId,
          appId,
          bindingId: binding.id
        })}`,
        "X-BP-Service-Id": binding.sourceServiceId,
        "X-BP-Tenant-Id": tenantId,
        "X-BP-App-Id": appId
      }),
      token: () => userToken,
      fetch: this.m2mFetch({ requestId, mode: "delegated", tenantId, appId, binding, target }, ctx.obs, event)
    };
  }

  private m2mFetch(
    context: {
      requestId: string;
      mode: M2MCallerMode;
      tenantId: string;
      appId: string;
      binding: { sourceServiceId: string; targetServiceId: string };
      target: { hostname: string };
    },
    parent?: BetterPortalObservability,
    event?: BetterPortalEvent
  ): typeof globalThis.fetch {
    return async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const attributes = {
        "http.request.method": request.method,
        "server.address": url.host,
        "url.path": url.pathname,
        "bp.s2s.request_id": context.requestId,
        "bp.s2s.mode": context.mode,
        "bp.s2s.source_service_id": context.binding.sourceServiceId,
        "bp.s2s.target_service_id": context.binding.targetServiceId,
        "bp.tenant.id": context.tenantId,
        "bp.app.id": context.appId
      };
      const span = parent?.startSpan("bp.s2s.request", attributes)
        ?? createBsbObservability(this.createTrace("bp.s2s.request", attributes));
      const propagation = event ? eventTracePropagation(event) : {};
      const headers = new Headers(request.headers);
      headers.set("traceparent", formatTraceParent({
        traceId: span.traceId,
        spanId: span.spanId,
        traceFlags: propagation.parent?.traceFlags ?? 1
      }));
      if (propagation.parent?.traceState) headers.set("tracestate", propagation.parent.traceState);
      else headers.delete("tracestate");
      if (propagation.baggage) headers.set("baggage", propagation.baggage);
      else headers.delete("baggage");
      const tracedRequest = new Request(request, { headers });
      const startedAt = performance.now();
      try {
        const response = await globalThis.fetch(tracedRequest);
        span.end({
          "http.response.status_code": response.status,
          "duration.ms": Math.round((performance.now() - startedAt) * 100) / 100
        });
        return response;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        span.error(normalized, { "error.name": normalized.name });
        span.end({ "duration.ms": Math.round((performance.now() - startedAt) * 100) / 100 });
        throw error;
      }
    };
  }

  private resolveM2MClient(requestId: string, tenantId: string, appId: string, mode: M2MCallerMode) {
    const policy = this.scopedConfig?.m2m;
    const keyPair = this.s2sKeyPair;
    if (!policy || !keyPair || !this.s2sIdentityReady) {
      throw new Error("BetterPortal S2S identity is not registered in the current config snapshot");
    }
    const binding = policy.bindings.find((candidate) =>
      candidate.enabled
      && candidate.mode === mode
      && candidate.requestId === requestId
      && candidate.tenantId === tenantId
      && (!candidate.appId || candidate.appId === appId)
      && policy.localServiceIds.includes(candidate.sourceServiceId)
    );
    if (!binding) throw new Error(`No enabled ${mode} S2S binding for request ${requestId}`);
    const grant = policy.grants.find((candidate) =>
      candidate.enabled
      && candidate.bindingId === binding.id
      && candidate.tenantId === tenantId
      && (!candidate.appId || candidate.appId === appId)
    );
    if (!grant) throw new Error(`No enabled ${mode} S2S grant for request ${requestId}`);
    const target = policy.services.find((candidate) => candidate.id === binding.targetServiceId);
    if (!target) throw new Error("S2S target service is missing from the current config snapshot");
    return { keyPair, binding, target };
  }
  private initializeS2SIdentity(obs: Observable): void {
    if (!this.requireBetterPortalConfigSource || this.inSetupMode || this.s2sKeyPair) return;
    const bootstrapPath = resolve(this.bp.bootstrapStatePath ?? DEFAULT_BOOTSTRAP_STATE_PATH);
    const keyPath = resolve(dirname(bootstrapPath), "s2s-key.json");
    this.s2sKeyPair = loadOrGenerateKeyPair(keyPath);
    this.updateS2SIdentityState(obs);
  }

  private updateS2SIdentityState(obs: Observable): void {
    const registered = this.scopedConfig?.serviceIdentity;
    this.s2sIdentityReady = Boolean(
      this.s2sKeyPair
      && registered?.publicKeyPem === this.s2sKeyPair.publicKeyPem
      && registered?.keyId === this.s2sKeyPair.kid
    );
    if (registered?.publicKeyPem && this.s2sKeyPair && !this.s2sIdentityReady) {
      obs.log.error("Local S2S key does not match the registered service identity; outbound S2S calls are disabled");
    }
  }

  private getServiceTokenVerifier(): ServiceTokenVerifier | undefined {
    const policy = this.scopedConfig?.m2m;
    if (!policy) return undefined;
    return {
      verify: async (token, context) => {
        const authorized = await authorizeServiceToken(token, {
          policy,
          tenantId: context.tenantId,
          appId: context.appId,
          viewId: context.viewId,
          method: context.method,
          mode: context.mode,
          sourceServiceId: context.sourceServiceId,
          requiredPermissions: context.requiredPermissions
        });
        return authorized.claims;
      }
    };
  }

  protected isAuthoritativeService(tenantId: string, appId: string, serviceType: AuthoritativeServiceType): boolean {
    const scoped = this.scopedConfig;
    if (!scoped) return false;
    const tenant = scoped.tenants.find((candidate) => candidate.id === tenantId && candidate.active);
    const app = scoped.apps.find((candidate) => candidate.id === appId && candidate.tenantId === tenantId);
    if (!tenant || !app) return false;

    const mountedServiceId = serviceType === "auth" ? app.auth?.serviceId : app.shell?.serviceId;
    if (!mountedServiceId) return false;

    return tenant.services.some((service) =>
      service.enabled !== false
      && service.id === mountedServiceId
      && (
        service.serviceId === this.manifest.pluginId
        || service.sharedServiceId === this.manifest.pluginId
      )
    );
  }

  protected async updateAuthoritativeService<T extends AuthoritativeServiceType>(
    tenantId: string,
    appId: string,
    serviceType: T,
    mutation: AuthoritativeServiceMutation<T>
  ): Promise<void> {
    const credentials = this.controlPlaneCredentials();
    if (!credentials) throw new Error("BetterPortal control-plane credentials are unavailable.");

    const response = await fetch(`${credentials.url}/.well-known/bp/admin/services/self-mutation`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`
      },
      body: JSON.stringify({
        tenantId,
        appId,
        type: serviceType,
        mutation
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Config Manager self-mutation failed: ${response.status} ${body}`);
    }
  }

  /**
   * Override to provide a JWT verifier for incoming requests.
   * Receives the resolved tenant/app context. Return undefined to skip auth for the request.
   */
  protected getJwtVerifier(_tenantId: string, _appId: string): JwtVerifier | undefined {
    return this.getConfiguredJwtVerifier(_tenantId, _appId);
  }

  private getConfiguredJwtVerifier(tenantId: string, appId: string): JwtVerifier | undefined {
    const auth = this.getAppAuthConfig(tenantId, appId);
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
    const managementApp = this.scopedConfig.configManagement?.context?.app;
    const app = managementApp?.id === appId && managementApp.tenantId === tenantId
      ? managementApp
      : this.scopedConfig.apps.find((candidate) => candidate.id === appId && candidate.tenantId === tenantId);
    return (app as unknown as { auth?: AppAuthConfig })?.auth;
  }

  /**
   * Override to provide the service-instance-id -> pluginId alias map used by the
   * permission check (role grants use instance ids, route auth uses pluginIds).
   * Default: reads the tenant's service bindings from scopedConfig.
   */
  protected getServiceIdAliases(tenantId: string): Record<string, string> | undefined {
    const managementTenant = this.scopedConfig?.configManagement?.context?.tenant;
    const tenant = managementTenant?.id === tenantId
      ? managementTenant
      : this.scopedConfig?.tenants.find((candidate) => candidate.id === tenantId);
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
  /** Runtime auth metadata published when this service acts as an auth provider.
   *  Sent during install and sync so config-manager can configure app verifiers
   *  without guessing issuer/audience/JWKS from hostnames. */
  private publishedJwks: { keys: ReadonlyArray<Record<string, unknown>> } | null = null;
  private publishedAuthProvider: AuthProviderRuntimeMetadata | null = null;

  protected registerAsAuthProvider(input: {
    issuer: string;
    audience: string;
    jwksUri: string;
    jwks: { keys: ReadonlyArray<Record<string, unknown>> };
    cacheMaxAgeSeconds?: number;
  }): void {
    const cacheMaxAge = input.cacheMaxAgeSeconds ?? 600;
    const payload = JSON.stringify(input.jwks);
    this.publishedJwks = input.jwks;
    this.publishedAuthProvider = {
      issuer: input.issuer.replace(/\/+$/, ""),
      audience: input.audience,
      jwksUri: input.jwksUri,
      publicKeys: { keys: input.jwks.keys.map((key) => ({ ...key })) }
    };
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
    this.bpPluginVersion = cfg.pluginVersion;
  }

  async init(obs: Observable): Promise<void> {
    const def = this.definition();
    this.registeredRoutes = def.registry.routes;
    const span = createBsbObservability(obs).startSpan("bp.plugin.init", {
      "bp.plugin.id": def.manifest.pluginId,
      "bp.plugin.category": "service"
    });
    try {

    this.bootstrapState = new BootstrapStateStore({
      filePath: this.bp.bootstrapStatePath ?? DEFAULT_BOOTSTRAP_STATE_PATH
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
    this.initializeS2SIdentity(obs);
    this.validateBetterPortalConfig(obs);
    this.runtimeConfigEncryptionKey = this.resolveConfigEncryptionKey();

    this.observability = createBsbObservability(obs).setAttributes({
      "bp.plugin.id": def.manifest.pluginId,
      "bp.plugin.category": "service"
    });
    this.app = createBetterPortalApp({
      createRequestObservability: (name, attributes, parent) => parent
        ? createBsbObservability(this.createObservable({ t: parent.traceId, s: parent.spanId }, attributes).startSpan(name, attributes))
        : createBsbObservability(this.createTrace(name, attributes))
    });
    this.server = createServer(createBetterPortalNodeHandler(this.app));
    if (this.bp.bpConfigPath) {
      this.configProvider = new FileBackedBetterPortalConfigProvider(this.bp.bpConfigPath);
    }

    this.manifest = buildManifestFromRegistry(def.registry, { version: this.bpPluginVersion }, def.manifest);

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
    this.registerHostnameChangeEndpoint(obs);

    createH3Router(def.registry, this.app, {
      serviceId: def.manifest.pluginId,
      resolveAuth: (event, route) => this.resolveAuthForRequest(event, route),
      validateTenantApp: (tenantId, appId) => this.validateTenantApp(tenantId, appId),
      resolveContext: (event, route) => this.resolveHandlerContext(event, route)
    });

    const bpSchema = buildBpSchema(def.registry, this.manifest);
    registerBpWellKnownRoutes(this.app, this.manifest, bpSchema, {
      health: () => this.renderHealth()
    });
    this.registerShellFragmentRoutes(def.registry);
    this.registerSeoRoutes();

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

  private connectToControlPlane(obs: Observable): Promise<boolean> {
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
      this.seoProbeCache.clear();
      this.updateS2SIdentityState(obs);
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

    const bootstrapFromPoll = async (): Promise<boolean> => {
      obs.log.info("Control plane sync bootstrap polling: {url}", { url: pollUrl });
      // POST manifest with the poll so CP can cache it for resolvedServicePath injection
      // AND surface per-view permission requirements to the admin role editor.
      const viewIndex: Record<string, unknown> = {};
      for (const view of this.manifest.views) {
        const fragments: Array<{ fragmentId: string; targetPath: string }> = [];
        const seenFragments = new Set<string>();
        for (const operation of view.operations) {
          for (const theme of Object.values(operation.html.renderers)) {
            for (const renderer of theme.renderers) {
              if (renderer.slotId === "main" || seenFragments.has(renderer.slotId)) continue;
              seenFragments.add(renderer.slotId);
              fragments.push({ fragmentId: renderer.slotId, targetPath: view.path });
            }
          }
        }
        viewIndex[view.viewId] = {
          viewId: view.viewId,
          title: view.title,
          description: view.description,
          path: view.path,
          pathVariants: [...view.pathVariants],
          paramsSchema: view.paramsSchema,
          operations: view.operations.map((operation) => ({
            operationId: operation.operationId,
            method: operation.method,
            title: operation.title,
            description: operation.description,
            renderers: Object.keys(operation.html.renderers),
            ...(operation.role ? { role: operation.role } : {}),
            authRequired: operation.auth.required,
            ...(operation.sitemap ? { sitemap: operation.sitemap } : {}),
            robots: [...operation.robots],
            ...(operation.chrome ? { chrome: operation.chrome } : {}),
            dependencies: [...operation.dependencies],
            permissions: operation.auth.permissions,
            renderable: operation.renderable,
            schemas: {
              query: operation.querySchema,
              headers: operation.headersSchema,
              request: operation.bodySchema,
              response: operation.jsonResponseSchema,
              metadataResponse: operation.metadataResponseSchema
            },
            ...(operation.raw === true ? { raw: true } : {}),
            apiContracts: [...operation.apiContracts],
            demoScenarios: [...operation.demoScenarios]
          })),
          ...(fragments.length ? { fragments } : {})
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
          ...(this.s2sKeyPair ? {
            publicKeyPem: this.s2sKeyPair.publicKeyPem,
            keyId: this.s2sKeyPair.kid
          } : {}),
          title: this.manifest.title,
          capabilities: this.manifest.capabilities,
          configSchemas: this.manifest.configSchemas,
          webhooks: this.manifest.webhooks,
          apiContracts: this.manifest.apiContracts,
          m2mRequests: this.manifest.m2mRequests,
          developerResources: this.manifest.developerResources,
          shell: this.manifest.shell,
          ...(this.publishedAuthProvider ? { authProvider: this.publishedAuthProvider } : {}),
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
        return false;
      }

      const config = await response.json();
      obs.log.info("BP SYNC CLIENT: bootstrap poll succeeded service={serviceId} status={status}", {
        serviceId: this.manifest.pluginId,
        status: response.status
      });
      applyScopedConfig(config, "poll");
      return true;
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

    const connect = (): Promise<boolean> => {
      const bootstrap = bootstrapFromPoll().catch((error) => {
        logBootstrapPollError(error);
        return false;
      });
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
      return bootstrap;
    };

    const scheduleReconnect = () => {
      setTimeout(() => void connect(), 5000);
    };

    return connect();
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
        obs.log.debug(" -> [{renderer}@{appHostnames}] {appName}: {appId}", {
          renderer: app.shell?.renderer ?? "unresolved",
          appHostnames: app.hostnames.join(","),
          appName: app.title,
          appId: app.id
        });
      }
    }
  }

  // CORS

  protected async resolveRequestContext(event: BetterPortalEvent): Promise<BetterPortalResolvedRequestContext | null> {
    if (this.scopedConfig) {
      const portalConfig = this.getPortalConfig();
      const context = portalConfig
        ? resolveEmbeddedRequestContext(portalConfig, eventHeaders(event), this.headerTrustOptions(event))
        : null;
      return context ? this.resolveScopedContextById(context.tenant.id, context.app.id) : null;
    }

    if (!this.configProvider) {
      return null;
    }

    const portalConfig = await this.configProvider.loadConfig();
    return resolveEmbeddedRequestContext(portalConfig, eventHeaders(event), this.headerTrustOptions(event));
  }

  private resolveAuthForRequest(event: BetterPortalEvent, route: RegisteredRoute): H3AuthContext | undefined {
    const ctx = event as unknown as { __bpTenantId?: string; __bpAppId?: string };
    if (isBpManagementAuthRoute(route)) {
      const management = this.managementRequestContext();
      if (management) this.applyRequestContext(event, management);
    }
    if (!ctx.__bpTenantId || !ctx.__bpAppId) return undefined;
    const verifier = isBpManagementAuthRoute(route)
      ? this.getConfiguredJwtVerifier(ctx.__bpTenantId, ctx.__bpAppId)
      : this.getJwtVerifier(ctx.__bpTenantId, ctx.__bpAppId);
    const serviceVerifier = this.getServiceTokenVerifier();
    if (!verifier && !serviceVerifier) return undefined;
    return {
      ...(verifier ? { verifier } : {}),
      ...(serviceVerifier ? { serviceVerifier } : {}),
      tenantId: ctx.__bpTenantId,
      appId: ctx.__bpAppId,
      appAuthConfig: this.getAppAuthConfig(ctx.__bpTenantId, ctx.__bpAppId),
      serviceIdAliases: this.getServiceIdAliases(ctx.__bpTenantId),
      platformRoot: this.getPlatformRootAuthScope(ctx.__bpTenantId, ctx.__bpAppId)
    };
  }

  protected getPlatformRootAuthScope(_tenantId: string, _appId: string): { tenantId?: string; appId?: string } | undefined {
    return {
      tenantId: this.scopedConfig?.configManagement?.adminTenantId,
      appId: this.scopedConfig?.configManagement?.managementAppId
    };
  }

  private rejectCors(
    event: BetterPortalEvent,
    allowHeaders: string[],
    code: string,
    reason: string,
    attributes: ObservabilityAttributes = {}
  ): Response | undefined {
    annotateCoreHttpOutcome(event, { code, reason, attributes });
    return handleCorsRequest(event, {
      origin: [],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders,
      credentials: true,
      exposeHeaders: [],
      preflight: { statusCode: 403 }
    }) || undefined;
  }

  private async handleWithCors(event: BetterPortalEvent): Promise<Response | undefined> {
    const requestedHeaders = event.req.headers.get("access-control-request-headers");
    const allowHeaders = requestedHeaders?.trim().length
      ? requestedHeaders.split(",").map((v) => v.trim())
      : ["Accept", "Authorization", "Content-Type", "HX-Current-URL", "HX-Request", "HX-Target", "HX-Trigger", "HX-Trigger-Name", "X-BP-App-Id", "X-BP-Tenant-Id", "X-BP-Service-Id", "X-BP-Service-Authorization", "BP-SetHeader", "BP-RemoveHeader", "traceparent", "tracestate", "baggage"];

    const origin = event.req.headers.get("origin");
    const authorization = event.req.headers.get("authorization");
    const primaryToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const secondaryAuthorization = event.req.headers.get("x-bp-service-authorization");
    const sourceServiceId = event.req.headers.get("x-bp-service-id");
    const isServiceEnvelope = secondaryAuthorization !== null || sourceServiceId !== null || isServiceToken(primaryToken);
    if (isServiceEnvelope) {
      const secondaryToken = secondaryAuthorization?.startsWith("Bearer ") ? secondaryAuthorization.slice(7) : "";
      const delegated = secondaryAuthorization !== null;
      if (delegated ? (!secondaryToken || !primaryToken || isServiceToken(primaryToken)) : !isServiceToken(primaryToken)) {
        return withCoreHttpOutcome(
          jsonResponse({ error: "Invalid S2S authorization envelope" }, 401),
          { code: "s2s.envelope_invalid", reason: "Invalid S2S authorization envelope" }
        );
      }
      const tenantId = event.req.headers.get("x-bp-tenant-id");
      const appId = event.req.headers.get("x-bp-app-id");
      if (!sourceServiceId || !tenantId || !appId) {
        return withCoreHttpOutcome(
          jsonResponse({ error: "X-BP-Service-Id, X-BP-Tenant-Id, and X-BP-App-Id are required for S2S calls" }, 401),
          { code: "s2s.headers_missing", reason: "Service, tenant, and app headers are required for S2S calls" }
        );
      }
      const context = this.resolveScopedContextById(tenantId, appId);
      if (!context) {
        return withCoreHttpOutcome(
          jsonResponse({ error: "S2S tenant/app context is unavailable" }, 401),
          { code: "s2s.context_unavailable", reason: "S2S tenant/app context is unavailable" }
        );
      }
      this.applyRequestContext(event, context);
      return undefined;
    }
    if (origin && this.isPublicBpDiscoveryPath(event.url.pathname)) {
      // Public-discovery: CORS open to any origin, but ALSO try to resolve scope
      // so themed responses (login page, etc.) know which theme + tenant context to render under.
      try {
        const ctx = await this.resolveRequestContext(event);
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
        return this.rejectCors(
          event,
          allowHeaders,
          "cors.management_origin_denied",
          "Request Origin is not allowed for BetterPortal config management",
          {
            "bp.cors.origin": origin,
            "bp.cors.allowed_origins": boundedDiagnosticList(allowedOrigins)
          }
        );
      }

      const context = this.managementRequestContext() ?? await this.resolveRequestContext(event);
      if (context) this.applyRequestContext(event, context);

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
      try {
        const context = await this.resolveRequestContext(event);
        if (context) this.applyRequestContext(event, context);
      } catch (error) {
        this.logContextResolutionFailure(event, "embedded", error);
      }
      const corsResult = handleCorsRequest(event, {
        origin: [],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        credentials: true,
        exposeHeaders: [],
        preflight: { statusCode: 403 }
      });
      return corsResult
        ? withCoreHttpOutcome(corsResult, {
            code: "cors.origin_missing",
            reason: "CORS preflight request is missing the Origin header"
          })
        : undefined;
    }

    let requestContext: BetterPortalResolvedRequestContext | null = null;
    try {
      requestContext = await this.resolveRequestContext(event);
    } catch (error) {
      this.logContextResolutionFailure(event, "embedded", error);
    }

    if (!requestContext) {
      const details = await this.describeCorsContextFailure(event);
      this.logContextResolutionFailure(event, "embedded", undefined, details);
      return this.rejectCors(
        event,
        allowHeaders,
        "cors.context_unresolved",
        "No active BetterPortal app matched the request Origin, Referer, or trusted host candidates",
        {
          "bp.cors.origin": origin,
          "bp.cors.candidate_hosts": details?.candidateHosts.slice(0, 4096) ?? "",
          "bp.cors.configured_app_hosts": details?.configuredAppHosts.slice(0, 4096) ?? ""
        }
      );
    }

    const allowedOrigins = buildOriginPolicy(requestContext).allowedOrigins;
    this.applyRequestContext(event, requestContext);

    if (!allowedOrigins.includes(origin)) {
      return this.rejectCors(
        event,
        allowHeaders,
        "cors.origin_denied",
        "Request Origin is not allowed for the resolved BetterPortal app",
        {
          "bp.cors.origin": origin,
          "bp.cors.allowed_origins": boundedDiagnosticList(allowedOrigins),
          "bp.tenant.id": requestContext.tenant.id,
          "bp.app.id": requestContext.app.id
        }
      );
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

  private isPublicBpDiscoveryPath(pathname: string): boolean {
    return [
      "/.well-known/bp/health",
      "/.well-known/bp/manifest",
      "/.well-known/bp/schema.json",
      "/.well-known/bp/config/schema",
      "/.well-known/bp/install",
      "/.well-known/bp/hostname-change",
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
    return pathname === "/.well-known/bp/config"
      || pathname.startsWith("/.well-known/bp/config/")
      || isBpManagementAuthPath(this.registeredRoutes, pathname);
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

  private resolveScopedContextById(tenantId: string, appId: string): BetterPortalResolvedRequestContext | null {
    const tenant = this.scopedConfig?.tenants.find((candidate) => candidate.active && candidate.id === tenantId);
    const app = this.scopedConfig?.apps.find((candidate) => candidate.tenantId === tenantId && candidate.id === appId);
    return tenant && app ? this.resolveScopedRequestContext(tenant, app) : null;
  }

  private managementRequestContext(): BetterPortalResolvedRequestContext | null {
    const context = this.scopedConfig?.configManagement?.context;
    return context ? this.resolveScopedRequestContext(context.tenant, context.app) : null;
  }

  private resolveScopedRequestContext(
    tenant: ScopedTenant,
    app: ScopedApp
  ): BetterPortalResolvedRequestContext {
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
        appRoutes: [...(app.appRoutes ?? app.routes)],
        menu: [...app.menu],
        slots: [...app.slots],
        fragments: { ...app.fragments },
        appFragments: { ...(app.appFragments ?? app.fragments) },
        shellFragments: { ...app.shellFragments }
      }
    };
  }

  protected applyRequestContext(event: BetterPortalEvent, context: BetterPortalResolvedRequestContext): void {
    const bpContext = event as unknown as {
      __bpTenantId?: string;
      __bpAppId?: string;
      __bpTenant?: BetterPortalResolvedRequestContext["tenant"];
      __bpApp?: BetterPortalResolvedRequestContext["app"];
      __bpAppAuth?: AppAuthConfig;
    };
    bpContext.__bpTenantId = context.tenant.id;
    bpContext.__bpAppId = context.app.id;
    bpContext.__bpTenant = context.tenant;
    bpContext.__bpApp = context.app;
    bpContext.__bpAppAuth = context.app.auth;
  }

  protected resolveHandlerContext(event: BetterPortalEvent, route?: RegisteredRoute): Partial<RouteHandlerContext> {
    if (route && isBpManagementAuthRoute(route)) {
      const management = this.managementRequestContext();
      if (management) this.applyRequestContext(event, management);
    }
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
    const credentials = this.controlPlaneCredentials();
    const obs = eventObservability(event);
    if (!credentials) {
      obs?.logger.warn("BP WEBHOOK: skipped event={eventId} service={serviceId} reason=missing_control_plane", {
        eventId,
        serviceId: this.manifest.pluginId
      });
      return;
    }
    const response = await fetch(`${credentials.url}/.well-known/bp/webhooks/events`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`
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

    return coreJsonResponse({
      error: this.inSetupMode ? "BetterPortal service awaiting setup" : "BetterPortal tenant/app config has not synced yet",
      detail
    }, 503,
    this.inSetupMode ? "service.setup_required" : "service.config_not_synced",
    detail);
  }

  private resolveConfigEncryptionKey(): string | undefined {
    return this.bootstrapState.read().configEncryptionKey;
  }

  private isPreSyncCorePath(pathname: string): boolean {
    if (pathname === "/.well-known/bp/health") return true;
    if (pathname === "/.well-known/bp/manifest") return true;
    if (pathname === "/.well-known/bp/schema.json") return true;
    if (pathname === "/.well-known/bp/install") return true;
    if (pathname === "/.well-known/bp/hostname-change") return true;
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

    const response = jsonResponse({
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
    return ready
      ? response
      : withCoreHttpOutcome(response, {
          code: "discovery.health_unready",
          reason: "BetterPortal tenant/app config has not synced yet"
        });
  }

  private localServiceInstanceIds(context: BetterPortalResolvedRequestContext): Set<string> {
    const ids = new Set(this.scopedConfig?.m2m?.localServiceIds ?? []);
    if (this.scopedConfig?.serviceIdentity?.id) ids.add(this.scopedConfig.serviceIdentity.id);
    return ids;
  }

  private normalizeSitemapEntries(value: unknown): RouteSitemapEntry[] {
    if (!Array.isArray(value)) throw new TypeError("sitemap provider must return an array");
    return value.map((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new TypeError(`sitemap entry ${index} must be an object`);
      }
      const entry = raw as Record<string, unknown>;
      const params: Record<string, string | number | boolean> = {};
      if (entry.params !== undefined) {
        if (!entry.params || typeof entry.params !== "object" || Array.isArray(entry.params)) {
          throw new TypeError(`sitemap entry ${index}.params must be an object`);
        }
        for (const [name, value] of Object.entries(entry.params as Record<string, unknown>)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
            || !["string", "number", "boolean"].includes(typeof value)
            || String(value).length < 1
            || String(value).length > 100) {
            throw new TypeError(`sitemap entry ${index} has invalid parameter ${name}`);
          }
          params[name] = value as string | number | boolean;
        }
      }
      let lastModified: string | undefined;
      if (entry.lastModified !== undefined) {
        const date = entry.lastModified instanceof Date ? entry.lastModified : new Date(String(entry.lastModified));
        if (Number.isNaN(date.getTime())) throw new TypeError(`sitemap entry ${index}.lastModified is invalid`);
        lastModified = date.toISOString();
      }
      const frequencies = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);
      if (entry.changeFrequency !== undefined && !frequencies.has(String(entry.changeFrequency))) {
        throw new TypeError(`sitemap entry ${index}.changeFrequency is invalid`);
      }
      if (entry.priority !== undefined
        && (typeof entry.priority !== "number" || entry.priority < 0 || entry.priority > 1)) {
        throw new TypeError(`sitemap entry ${index}.priority must be between 0 and 1`);
      }
      return {
        ...(Object.keys(params).length ? { params } : {}),
        ...(lastModified ? { lastModified } : {}),
        ...(entry.changeFrequency ? { changeFrequency: entry.changeFrequency as RouteSitemapEntry["changeFrequency"] } : {}),
        ...(typeof entry.priority === "number" ? { priority: entry.priority } : {})
      };
    });
  }

  private async serviceSeoRoutes(
    context: BetterPortalResolvedRequestContext,
    signal: AbortSignal
  ): Promise<RuntimeSitemapRoute[]> {
    const localIds = this.localServiceInstanceIds(context);
    const appRoutes = context.app.appRoutes ?? context.app.routes;
    const providers = new Map(this.registeredRoutes.flatMap((route) => {
      const operation = route.methodRoutes?.GET;
      return operation && typeof operation.sitemap === "function"
        ? [[route.viewId, { route, operation }] as const]
        : [];
    }));
    const results: RuntimeSitemapRoute[] = [];
    for (const mount of appRoutes) {
      if (!localIds.has(mount.serviceId) || mount.enabled === false || mount.authRequired !== false) continue;
      const provider = providers.get(mount.viewId);
      if (!provider || !mount.operations.includes(provider.operation.operationId) || typeof provider.operation.sitemap !== "function") continue;
      const entries = await provider.operation.sitemap({
        plugin: this,
        tenant: context.tenant,
        app: context.app,
        config: this.effectiveServiceConfig(context.tenant.id, context.app.id),
        route: {
          viewId: provider.route.viewId,
          path: mount.resolvedServicePath ?? mount.servicePathVariant ?? mount.targetPath ?? provider.route.path
        },
        signal
      });
      results.push({ routeId: mount.id, entries: this.normalizeSitemapEntries(entries) });
    }
    return results;
  }

  private appRequestOrigin(app: BetterPortalResolvedRequestContext["app"], event: BetterPortalEvent): string {
    const requestHost = hostFromHeaderValue(event.req.headers.get("host") ?? undefined) ?? "";
    const configured = app.hostnames.find((hostname) => hostFromHeaderValue(hostname) === requestHost)
      ?? app.hostnames[0]
      ?? "";
    if (configured.startsWith("http://") || configured.startsWith("https://")) return configured.replace(/\/+$/, "");
    return `https://${configured.replace(/\/+$/, "")}`;
  }

  private seoCacheTtl(app: BetterPortalResolvedRequestContext["app"]): number {
    switch (app.seo?.serviceCache ?? "24h") {
      case "none": return 0;
      case "1h": return 60 * 60_000;
      case "7d": return 7 * 24 * 60 * 60_000;
      default: return 24 * 60 * 60_000;
    }
  }

  private probeServiceSeo(
    context: BetterPortalResolvedRequestContext,
    serviceId: string,
    origin: string
  ): Promise<RuntimeSitemapRoute[]> {
    const key = `${context.tenant.id}:${context.app.id}:${serviceId}`;
    const now = Date.now();
    const cached = this.seoProbeCache.get(key);
    if (cached?.pending) return cached.pending;
    if (cached && cached.expiresAt > now) {
      if (cached.error) return Promise.reject(cached.error);
      return Promise.resolve(cached.data ?? []);
    }

    const pending = (async () => {
      const service = context.tenant.services.find((candidate) => candidate.id === serviceId && candidate.enabled);
      if (!service) throw new Error(`SEO service instance unavailable: ${serviceId}`);
      const allowedRouteIds = new Set((context.app.appRoutes ?? context.app.routes)
        .filter((route) => route.serviceId === serviceId)
        .map((route) => route.id));
      const response = await fetch(`${service.hostname.replace(/\/+$/, "")}/.well-known/bp/seo`, {
        method: "GET",
        headers: { Accept: "application/json", Origin: origin },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`SEO service probe failed: ${serviceId} returned ${response.status}`);
      const allowedOrigin = response.headers.get("access-control-allow-origin");
      if (allowedOrigin !== "*" && allowedOrigin !== origin) {
        throw new Error(`SEO service probe failed: ${serviceId} is not browser-accessible from ${origin}`);
      }
      const payload = await response.json() as { routes?: unknown };
      if (!Array.isArray(payload.routes)) throw new Error(`SEO service probe returned invalid payload: ${serviceId}`);
      return payload.routes.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new TypeError(`SEO service route ${index} is invalid`);
        }
        const route = raw as { routeId?: unknown; entries?: unknown };
        if (typeof route.routeId !== "string") throw new TypeError(`SEO service route ${index}.routeId is invalid`);
        if (!allowedRouteIds.has(route.routeId)) {
          throw new TypeError(`SEO service route ${index}.routeId does not belong to service ${serviceId}`);
        }
        return { routeId: route.routeId, entries: this.normalizeSitemapEntries(route.entries) };
      });
    })();
    this.seoProbeCache.set(key, { expiresAt: Number.POSITIVE_INFINITY, pending });
    return pending.then((data) => {
      this.seoProbeCache.set(key, { expiresAt: Date.now() + this.seoCacheTtl(context.app), data });
      return data;
    }).catch((error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.seoProbeCache.set(key, { expiresAt: Date.now() + 5 * 60_000, error: normalized });
      throw normalized;
    });
  }

  private async shellSeoDocuments(event: BetterPortalEvent): Promise<{
    context: BetterPortalResolvedRequestContext;
    origin: string;
    documents: ReturnType<typeof buildSeoDocuments>;
  } | Response> {
    const context = await this.resolveRequestContext(event);
    if (!context) {
      return coreJsonResponse(
        { error: "BetterPortal tenant/app context required" },
        400,
        "seo.context_unresolved",
        "BetterPortal tenant/app context is required to build SEO documents"
      );
    }
    this.applyRequestContext(event, context);
    const requestOrigin = this.appRequestOrigin(context.app, event);
    const canonicalOrigin = context.app.seo?.canonicalOrigin?.replace(/\/+$/, "") ?? requestOrigin;
    const seoServiceIds = new Set((context.app.appRoutes ?? context.app.routes)
      .filter((route) =>
        route.enabled !== false
        && route.authRequired === false
        && (route.kind ?? "page") === "page"
      )
      .map((route) => route.serviceId));
    const runtime: RuntimeSitemapRoute[] = [];
    const failed = new Set<string>();
    const localIds = this.localServiceInstanceIds(context);
    let localSeoNeeded = false;
    await Promise.all([...seoServiceIds].map(async (serviceId) => {
      if (localIds.has(serviceId)) {
        localSeoNeeded = true;
        return;
      }
      try {
        runtime.push(...await this.probeServiceSeo(context, serviceId, requestOrigin));
      } catch (error) {
        failed.add(serviceId);
        eventObservability(event)?.logger.warn("BP SEO: service probe failed service={serviceId} app={appId} reason={reason}", {
          serviceId,
          appId: context.app.id,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }));
    if (localSeoNeeded) {
      try {
        runtime.push(...await this.serviceSeoRoutes(context, AbortSignal.timeout(15_000)));
      } catch (error) {
        for (const serviceId of seoServiceIds) {
          if (localIds.has(serviceId)) failed.add(serviceId);
        }
        eventObservability(event)?.logger.warn("BP SEO: local provider failed app={appId} reason={reason}", {
          appId: context.app.id,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (failed.size && (context.app.seo?.serviceFailure ?? "omit-service") === "error") {
      return coreJsonResponse(
        { error: "Sitemap service data unavailable", services: [...failed] },
        503,
        "seo.service_data_unavailable",
        "One or more services required for the sitemap were unavailable",
        { "bp.seo.failed_services": boundedDiagnosticList([...failed]) }
      );
    }
    return {
      context,
      origin: canonicalOrigin,
      documents: buildSeoDocuments(context.app, canonicalOrigin, runtime, failed)
    };
  }

  private registerSeoRoutes(): void {
    this.app.get("/.well-known/bp/seo", async (event) => {
      const context = await this.resolveRequestContext(event);
      if (!context) {
        return coreJsonResponse(
          { error: "BetterPortal tenant/app context required" },
          400,
          "seo.context_unresolved",
          "BetterPortal tenant/app context is required to build service SEO data"
        );
      }
      this.applyRequestContext(event, context);
      try {
        const routes = await this.serviceSeoRoutes(context, AbortSignal.timeout(15_000));
        return jsonResponse({ routes } as unknown as JsonValue);
      } catch (error) {
        return coreJsonResponse({
          error: "Unable to build service sitemap data",
          detail: error instanceof Error ? error.message : String(error)
        }, 500, "seo.generation_failed", "Unable to build service sitemap data");
      }
    });

    if (!this.manifest.shell) return;
    this.app.get("/robots.txt", async (event) => {
      const result = await this.shellSeoDocuments(event);
      if (result instanceof Response) return result;
      return new Response(result.documents.robots, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=300"
        }
      });
    });
    this.app.get("/sitemap.xml", async (event) => {
      const result = await this.shellSeoDocuments(event);
      if (result instanceof Response) return result;
      const chunks = buildSitemapChunks(result.documents.sitemap);
      const body = chunks.length === 1 ? chunks[0] : buildSitemapIndex(result.origin, chunks.length);
      return new Response(body, {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=300"
        }
      });
    });
    this.app.get("/sitemaps/:chunk", async (event) => {
      const result = await this.shellSeoDocuments(event);
      if (result instanceof Response) return result;
      const chunks = buildSitemapChunks(result.documents.sitemap);
      const value = (event as unknown as { context?: { params?: { chunk?: string } } }).context?.params?.chunk;
      const index = Number(value?.replace(/\.xml$/, "")) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= chunks.length || chunks.length === 1) {
        return withCoreHttpOutcome(new Response("Not found", { status: 404 }), {
          code: "seo.chunk_not_found",
          reason: "Requested sitemap chunk does not exist",
          attributes: { "bp.seo.chunk": value ?? "" }
        });
      }
      return new Response(chunks[index], {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=300"
        }
      });
    });
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
        return coreJsonResponse(
          { error: "Request body must be JSON object" },
          400,
          "service.install_payload_invalid",
          "Install request body must be a JSON object"
        );
      }
      const { setupToken, cpUrl } = body as { setupToken?: string; cpUrl?: string };
      if (typeof setupToken !== "string" || setupToken.length === 0) {
        return coreJsonResponse(
          { error: "Missing setupToken" },
          400,
          "service.install_payload_invalid",
          "Install request is missing setupToken"
        );
      }
      if (typeof cpUrl !== "string" || cpUrl.length === 0) {
        return coreJsonResponse(
          { error: "Missing cpUrl" },
          400,
          "service.install_payload_invalid",
          "Install request is missing cpUrl"
        );
      }

      const normalizedCp = cpUrl.replace(/\/+$/, "");
      const jwksUri = `${normalizedCp}/.well-known/jwks.json`;

      try {
        const claims = await verifySetupToken(setupToken, {
          jwks: { jwksUri, issuer: normalizedCp },
          expectedIssuer: normalizedCp
        });

        if (claims.cpJwksUri && claims.cpJwksUri !== jwksUri) {
          return coreJsonResponse(
            { error: "Setup token cpJwksUri mismatch" },
            400,
            "service.install_token_mismatch",
            "Setup token control-plane JWKS URI does not match cpUrl"
          );
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
            ...(this.publishedAuthProvider ? { authProvider: this.publishedAuthProvider } : {}),
            ...(this.publishedJwks ? { jwks: this.publishedJwks } : {})
          })
        });
        if (!redeemResponse.ok) {
          const text = await redeemResponse.text().catch(() => "");
          obs.log.warn("CP redeem failed: status={status} body={body}", { status: redeemResponse.status, body: text });
          return coreJsonResponse(
            { error: "CP rejected redeem", detail: text },
            502,
            "service.install_redeem_failed",
            "Control plane rejected the install token",
            { "http.response.status_code.upstream": redeemResponse.status }
          );
        }
        const redeemBody = await redeemResponse.json() as { apiKey?: string; cpId?: string; cpJwksUri?: string };
        if (typeof redeemBody.apiKey !== "string" || redeemBody.apiKey.length === 0) {
          return coreJsonResponse(
            { error: "CP redeem response missing apiKey" },
            502,
            "service.install_redeem_failed",
            "Control-plane install response did not contain an API key"
          );
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
        this.initializeS2SIdentity(obs);

        // eslint-disable-next-line no-console
        console.log(`\n*** BP install complete for ${this.manifest.pluginId} ***\n    apiKey: ${redeemBody.apiKey}\n    cpUrl:  ${normalizedCp}\n`);
        obs.log.info("Install complete for {pluginId}; apiKey persisted; starting CP sync", { pluginId: this.manifest.pluginId });

        // The install handshake is not complete until the CP has cached this
        // service's manifest and returned its scoped config. In particular,
        // bootstrap shells must be resolvable before the wizard redirects.
        const synced = await this.connectToControlPlane(obs);
        if (!synced) {
          return coreJsonResponse({
            error: "Install completed, but initial control-plane sync failed",
            installed: true,
            pluginId: this.manifest.pluginId
          }, 503, "service.install_sync_failed", "Initial control-plane sync failed after installation");
        }

        return jsonResponse({
          ok: true,
          pluginId: this.manifest.pluginId,
          apiKey: redeemBody.apiKey,
          cpUrl: normalizedCp,
          manifestVersion: this.manifest.version
        }, 200);
      } catch (err) {
        obs.log.warn("Install handler error: {msg}", { msg: (err as Error).message });
        return coreJsonResponse(
          { error: "Install failed", detail: (err as Error).message },
          400,
          "service.install_failed",
          (err as Error).message || "Service installation failed"
        );
      }
    });
  }

  private registerHostnameChangeEndpoint(obs: Observable): void {
    this.app.post("/.well-known/bp/hostname-change", async (event) => {
      const body = await event.req.json().catch(() => null) as { changeToken?: string } | null;
      if (!body || typeof body.changeToken !== "string" || body.changeToken.length === 0) {
        return coreJsonResponse(
          { error: "Missing changeToken" },
          400,
          "service.hostname_token_missing",
          "Hostname-change request is missing changeToken"
        );
      }
      const credentials = this.controlPlaneCredentials();
      if (!credentials) {
        return coreJsonResponse(
          { error: "Service is not installed" },
          409,
          "service.setup_required",
          "Service must be installed before confirming a hostname change"
        );
      }

      try {
        const response = await fetch(`${credentials.url}/.well-known/bp/services/confirm-hostname-change`, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "authorization": `Bearer ${credentials.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            changeToken: body.changeToken,
            serviceUrl: this.deriveOwnUrl(event)
          })
        });
        const responseBody = await response.json().catch(() => ({ error: `Control plane returned HTTP ${response.status}` }));
        const result = jsonResponse(responseBody, response.status);
        return response.status >= 200 && response.status < 400
          ? result
          : withCoreHttpOutcome(result, {
              code: "service.hostname_control_plane_rejected",
              reason: "Control plane rejected the hostname change",
              attributes: { "http.response.status_code.upstream": response.status }
            });
      } catch (error) {
        obs.log.warn("Hostname change confirmation failed: {msg}", { msg: (error as Error).message });
        return coreJsonResponse(
          { error: "Could not verify this service with the control plane" },
          502,
          "service.hostname_verification_failed",
          (error as Error).message || "Could not verify this service with the control plane"
        );
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
