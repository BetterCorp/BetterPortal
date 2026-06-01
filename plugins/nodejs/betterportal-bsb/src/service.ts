import {
  BSBService,
  type BSBServiceConstructor,
  type BSBEventSchemas,
  type Observable
} from "@bsb/base";
import { createServer, type Server } from "node:http";
import { resolve, dirname } from "node:path";
import {
  FileBackedBetterPortalConfigProvider,
  FileBackedServiceConfigStore,
  InMemoryServiceConfigStore,
  buildOriginPolicy,
  buildManifestFromRegistry,
  buildBpSchema,
  createBetterPortalApp,
  createBetterPortalNodeHandler,
  createH3Router,
  eventHeaders,
  handleCorsRequest,
  jsonResponse,
  registerBpWellKnownRoutes,
  registerServiceConfigRoutes,
  resolveEmbeddedRequestContext,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type BetterPortalObservability,
  type BetterPortalRegistry,
  type ManifestBaseFields,
  type PluginManifest,
  type ScopedServiceConfig,
  type ServiceConfigAction,
  type ServiceConfigStore,
  type ServiceConfigTicketClaims
} from "@betterportal/framework";
import { createBsbObservability } from "./index.js";

// ── Config constraint ────────────────────────────────────────────────

export interface BPServiceConfig {
  host: string;
  port: number;
  bpConfigPath: string;
  configApiToken?: string;
  configEncryptionKey?: string;
  controlPlaneUrl?: string;
  serviceApiKey?: string;
}

// ── Service definition ───────────────────────────────────────────────

export interface BPServiceDefinition {
  manifest: ManifestBaseFields;
  registry: BetterPortalRegistry;
}

// ── Base class ───────────────────────────────────────────────────────

export abstract class BPService<
  TConfig = any,
  TEvents extends BSBEventSchemas = BSBEventSchemas
> extends BSBService<any, TEvents> {

  private get bp(): BPServiceConfig {
    return this.config as unknown as BPServiceConfig;
  }
  readonly initBeforePlugins: string[] = [];
  readonly initAfterPlugins: string[] = [];
  readonly runBeforePlugins: string[] = [];
  readonly runAfterPlugins: string[] = [];

  protected app!: BetterPortalH3App;
  protected server!: Server;
  protected observability!: BetterPortalObservability;
  protected manifest!: PluginManifest;
  protected configStore: ServiceConfigStore = new InMemoryServiceConfigStore();
  private configProvider!: FileBackedBetterPortalConfigProvider;
  private scopedConfig: ScopedServiceConfig | null = null;
  private sseAbortController: AbortController | null = null;

  protected abstract definition(): BPServiceDefinition;

  protected onRegistered?(registry: BetterPortalRegistry, obs: Observable): void | Promise<void>;

  constructor(cfg: BSBServiceConstructor<any, TEvents>) {
    super(cfg as any);
  }

  async init(obs: Observable): Promise<void> {
    const def = this.definition();

    this.observability = createBsbObservability(obs).setAttributes({
      "bp.plugin.id": def.manifest.pluginId,
      "bp.plugin.category": "service"
    });
    this.app = createBetterPortalApp();
    this.server = createServer(createBetterPortalNodeHandler(this.app));
    this.configProvider = new FileBackedBetterPortalConfigProvider(this.bp.bpConfigPath);

    this.manifest = buildManifestFromRegistry(def.registry, { version: "1.0.0" }, def.manifest);

    if (this.bp.configEncryptionKey && this.manifest.configSchemas.length > 0) {
      const stateDir = resolve(dirname(this.bp.bpConfigPath), ".bp-config-state");
      this.configStore = new FileBackedServiceConfigStore({
        filePath: resolve(stateDir, `${def.manifest.pluginId}.json`),
        configSchemas: this.manifest.configSchemas,
        encryptionKey: this.bp.configEncryptionKey
      });
    }

    this.app.use("/**", (event) => this.handleWithCors(event));

    if (this.manifest.configSchemas.length > 0) {
      this.registerDefaultConfigRoutes();
    }

    createH3Router(def.registry, this.app);

    const bpSchema = buildBpSchema(def.registry, this.manifest);
    registerBpWellKnownRoutes(this.app, this.manifest, bpSchema);

    await this.onRegistered?.(def.registry, obs);

    obs.log.info("{pluginId} initialized", { pluginId: def.manifest.pluginId });
  }

  async run(obs: Observable): Promise<void> {
    if (this.server.listening) return;

    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.bp.port, this.bp.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    if (this.bp.controlPlaneUrl && this.bp.serviceApiKey) {
      this.connectToControlPlane(obs);
    }

    obs.log.info("{pluginId} serving at http://{host}:{port}", {
      pluginId: this.manifest.pluginId,
      host: this.bp.host,
      port: this.bp.port
    });
  }

  async dispose(): Promise<void> {
    this.sseAbortController?.abort();
    if (this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((err?: Error) => err ? reject(err) : resolve());
      });
    }
  }

  // ── Control plane sync ─────────────────────────────────────────────

  private connectToControlPlane(obs: Observable): void {
    const url = `${this.bp.controlPlaneUrl!.replace(/\/+$/, "")}/.well-known/bp/sync`;
    const apiKey = this.bp.serviceApiKey!;

    const connect = () => {
      this.sseAbortController = new AbortController();

      fetch(url, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${apiKey}`
        },
        signal: this.sseAbortController.signal
      }).then(async (response) => {
        if (!response.ok || !response.body) {
          obs.log.warn("Control plane sync failed: {status}", { status: response.status });
          scheduleReconnect();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          let dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            } else if (line === "") {
              if (eventType === "config" && dataLines.length > 0) {
                try {
                  this.scopedConfig = JSON.parse(dataLines.join("\n"));
                  obs.log.info("Control plane config synced ({tenants} tenants, {apps} apps)", {
                    tenants: this.scopedConfig?.tenants.length ?? 0,
                    apps: this.scopedConfig?.apps.length ?? 0
                  });
                } catch { /* ignore parse errors */ }
              }
              eventType = "";
              dataLines = [];
            }
          }
        }

        scheduleReconnect();
      }).catch((err) => {
        if ((err as Error).name !== "AbortError") {
          obs.log.warn("Control plane connection error: {msg}", { msg: (err as Error).message });
          scheduleReconnect();
        }
      });
    };

    const scheduleReconnect = () => {
      setTimeout(connect, 5000);
    };

    connect();
  }

  // ── CORS ─────────────────────────────────────────────────────────

  private async handleWithCors(event: BetterPortalEvent): Promise<Response | undefined> {
    const requestedHeaders = event.req.headers.get("access-control-request-headers");
    const allowHeaders = requestedHeaders?.trim().length
      ? requestedHeaders.split(",").map((v) => v.trim())
      : ["Accept", "Authorization", "Content-Type", "HX-Current-URL", "HX-Request", "HX-Target", "HX-Trigger", "HX-Trigger-Name", "X-BP-App-Id", "X-BP-Tenant-Id"];

    const origin = event.req.headers.get("origin");
    if (!origin) {
      return handleCorsRequest(event, {
        origin: [],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders,
        preflight: { statusCode: 403 }
      }) || undefined;
    }

    let allowedOrigins: string[] = [origin];
    let themeId: string | undefined;

    if (this.scopedConfig) {
      const resolved = this.resolveFromScopedConfig(origin);
      if (resolved) {
        allowedOrigins = resolved.allowedOrigins;
        themeId = resolved.themeId;
      }
    } else {
      try {
        const portalConfig = await this.configProvider.loadConfig();
        const requestContext = resolveEmbeddedRequestContext(portalConfig, eventHeaders(event));
        if (requestContext) {
          allowedOrigins = buildOriginPolicy(requestContext).allowedOrigins;
          themeId = requestContext.app.themeId;
        }
      } catch { /* fall back to allowing requesting origin */ }
    }

    if (themeId) {
      (event as unknown as { __bpThemeId?: string }).__bpThemeId = themeId;
    }

    const corsResult = handleCorsRequest(event, {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders,
      exposeHeaders: ["HX-Trigger", "HX-Trigger-After-Swap", "HX-Trigger-After-Settle", "HX-Location", "HX-Push-Url", "HX-Redirect", "HX-Refresh", "HX-Replace-Url", "HX-Reswap", "HX-Retarget"],
      preflight: { statusCode: 204 }
    });

    if (corsResult) return corsResult;
    return undefined;
  }

  private resolveFromScopedConfig(origin: string): { allowedOrigins: string[]; themeId: string } | null {
    if (!this.scopedConfig) return null;

    for (const app of this.scopedConfig.apps) {
      const origins = app.hostnames.flatMap((h) => {
        if (h.startsWith("http://") || h.startsWith("https://")) return [h];
        return [`http://${h}`, `https://${h}`];
      });

      if (origins.includes(origin)) {
        return { allowedOrigins: origins, themeId: app.themeId };
      }
    }

    return null;
  }

  // ── Config management ────────────────────────────────────────────

  private registerDefaultConfigRoutes(): void {
    registerServiceConfigRoutes({
      app: this.app,
      serviceId: this.manifest.pluginId,
      configSchemas: this.manifest.configSchemas,
      mode: "hybrid",
      validateTicket: (ticketValue, event, action) =>
        this.validateDevToken(ticketValue, event, action),
      readConfig: ({ ticket }) =>
        this.configStore.read(ticket),
      writeConfig: ({ tenantId, appId, values }, { ticket }) =>
        this.configStore.write(tenantId, appId, values, ticket)
    });
  }

  private validateDevToken(
    ticketValue: string | null,
    event: BetterPortalEvent,
    action: ServiceConfigAction
  ): ServiceConfigTicketClaims | null {
    const expectedToken = this.bp.configApiToken;
    if (!expectedToken || !ticketValue || ticketValue !== expectedToken) {
      return null;
    }

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
      serviceId: this.manifest.pluginId,
      actions: [action]
    };
  }
}
