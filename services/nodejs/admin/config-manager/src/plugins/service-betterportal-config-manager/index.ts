import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { BPService } from "@betterportal/plugin-bsb-nodejs";
import { registry } from "./.bp-generated/registry.js";
import { registerAdminApiRoutes } from "./adminApi.js";
import { registerMenuEditorRoutes } from "./menuEditor.js";
import { registerFragmentsEditorRoutes } from "./fragmentsEditor.js";
import { registerSyncEndpoint } from "./syncApi.js";
import {
  FileBackedPlatformConfigStore,
  eventHeaders,
  resolveEmbeddedRequestContext,
  type BetterPortalEvent,
  type BetterPortalRegistry,
  type PlatformConfigStore
} from "@betterportal/framework-nodejs";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3300),
  bpConfigPath: av.string().minLength(1),
  requestTimeoutMs: av.int().min(1).default(2000)
}, { unknownKeys: "strip" });

const Config = createConfigSchema(
  {
    name: "service-betterportal-config-manager",
    description: "BetterPortal config management admin service",
    tags: ["betterportal", "service", "admin", "config"],
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

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  private platformStore!: PlatformConfigStore;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
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

  protected async onRegistered(_registry: BetterPortalRegistry, _obs: Observable): Promise<void> {
    this.platformStore = new FileBackedPlatformConfigStore(this.config.bpConfigPath);

    this.app.use("/config-admin", (event) => this.populateConfigAdminContext(event));
    this.app.use("/admin-services", (event) => this.populateServicesContext(event));
    this.app.use("/admin-tenants", (event) => this.populateTenantsContext(event));
    this.app.use("/admin-routes", (event) => this.populateRoutesContext(event));
    this.app.use("/admin-menu", (event) => this.populateMenuContext(event));
    this.app.use("/admin-fragments", (event) => this.populateFragmentsContext(event));
    this.app.use("/admin-preview", (event) => this.populatePreviewContext(event));

    registerAdminApiRoutes(this.app, this.platformStore);
    registerMenuEditorRoutes(this.app, this.platformStore);
    registerFragmentsEditorRoutes(this.app, this.platformStore);
    registerSyncEndpoint(this.app, this.platformStore);
  }

  private async populateConfigAdminContext(event: BetterPortalEvent): Promise<void> {
    const portalConfig = await this.platformStore.loadConfig();
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
          }))
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
    const config = await this.platformStore.loadConfig();

    const tenantApps: Record<string, Array<{ id: string; title: string }>> = {};
    for (const t of config.tenants) {
      tenantApps[t.id] = config.apps
        .filter((a) => a.tenantId === t.id)
        .map((a) => ({ id: a.id, title: a.title }));
    }

    const fetchSchemaMeta = async (hostname: string): Promise<{ supportsCustomUi: boolean; customUiPath?: string }> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        const resp = await fetch(`${hostname.replace(/\/+$/, "")}/.well-known/bp/config/schema`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) return { supportsCustomUi: false };
        const s = await resp.json() as { supportsCustomUi?: boolean; customUiPath?: string };
        return { supportsCustomUi: !!s.supportsCustomUi, customUiPath: s.customUiPath };
      } catch { return { supportsCustomUi: false }; }
    };

    const themeServicesRaw = config.tenants.flatMap((t) => {
      const apps = config.apps.filter((a) => a.tenantId === t.id);
      const themeIds = [...new Set(apps.map((a) => a.themeId))];
      return themeIds
        .map((tid) => config.themes.find((th) => th.id === tid && th.enabled))
        .filter((th): th is NonNullable<typeof th> => !!th)
        .map((th) => ({
          id: `theme-${t.id}-${th.id}`,
          hostname: th.hostname,
          serviceId: `service.betterportal.theme-${th.id}`,
          title: th.title,
          description: th.description,
          createdAt: "—",
          lastSeenAt: undefined as string | undefined,
          enabled: th.enabled,
          scope: "theme" as const,
          tenantId: t.id,
          pushBase: `/settings/theme/${th.id}`
        }));
    });

    const tenantSvcsRaw = config.tenants.flatMap((t) =>
      t.services.map((s) => ({
        id: s.id, hostname: s.hostname, serviceId: s.serviceId,
        title: s.title, description: s.description,
        createdAt: s.createdAt, lastSeenAt: s.lastSeenAt,
        enabled: s.enabled, scope: "tenant" as const, tenantId: t.id as string | undefined,
        pushBase: `/settings/service/${s.id}`
      }))
    );

    const platformSvcsRaw = config.platformServices.map((ps) => ({
      id: ps.id, hostname: ps.hostname, serviceId: ps.serviceId,
      title: ps.title, description: ps.description,
      createdAt: ps.createdAt, lastSeenAt: undefined as string | undefined,
      enabled: ps.enabled, scope: "platform" as const, tenantId: undefined as string | undefined,
      pushBase: `/settings/platform/${ps.id}`
    }));

    const allRaw = [...themeServicesRaw, ...tenantSvcsRaw, ...platformSvcsRaw];
    const metas = await Promise.all(allRaw.map((s) => fetchSchemaMeta(s.hostname)));
    const allServices = allRaw.map((s, i) => ({
      ...s,
      supportsCustomUi: metas[i].supportsCustomUi,
      customUiPath: metas[i].customUiPath
    }));

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Service Registry",
      services: allServices,
      tenants: config.tenants.map((t) => ({ id: t.id, title: t.title })),
      apps: config.apps.map((a) => ({ id: a.id, tenantId: a.tenantId, title: a.title })),
      tenantApps,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: `http://${this.config.host === "0.0.0.0" ? "localhost" : this.config.host}:${this.config.port}`,
      configApiToken: "bp-dev-config-token"
    };
  }

  private async populateTenantsContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.platformStore.loadConfig();
    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Tenants & Apps",
      tenants: config.tenants.map((t) => ({
        id: t.id, slug: t.slug, title: t.title, active: t.active,
        serviceCount: t.services.length
      })),
      apps: config.apps.map((a) => ({
        id: a.id, tenantId: a.tenantId, slug: a.slug, title: a.title,
        hostnames: a.hostnames, themeId: a.themeId,
        routeCount: a.routes.length
      })),
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: `http://${this.config.host === "0.0.0.0" ? "localhost" : this.config.host}:${this.config.port}`
    };
  }

  private async populateRoutesContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.platformStore.loadConfig();
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;
    const selectedApp = selectedAppId ? config.apps.find((a) => a.id === selectedAppId) : undefined;
    const selectedTenant = selectedApp ? config.tenants.find((t) => t.id === selectedApp.tenantId) : undefined;

    const fetchViews = async (hostname: string): Promise<Array<{ viewId: string; title: string; path: string }>> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        const resp = await fetch(`${hostname.replace(/\/+$/, "")}/.well-known/bp/schema.json`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) return [];
        const schema = await resp.json() as {
          routes?: Array<{ viewId: string; path: string }>;
          manifest?: { views?: Array<{ viewId: string; title: string }> };
        };
        const viewMeta = new Map((schema.manifest?.views ?? []).map((v) => [v.viewId, v.title]));
        return (schema.routes ?? []).map((r) => ({
          viewId: r.viewId,
          title: viewMeta.get(r.viewId) ?? r.viewId,
          path: r.path
        }));
      } catch { return []; }
    };

    const availableServices = selectedTenant
      ? await Promise.all([
          ...selectedTenant.services.filter((s) => s.enabled).map(async (s) => ({
            id: s.id,
            title: s.title ?? s.serviceId ?? s.hostname,
            views: await fetchViews(s.hostname)
          })),
          ...selectedTenant.activatedPlatformServices
            .map((psId) => config.platformServices.find((ps) => ps.id === psId && ps.enabled))
            .filter((ps): ps is NonNullable<typeof ps> => !!ps)
            .map(async (ps) => ({
              id: ps.id,
              title: `${ps.title} (platform)`,
              views: await fetchViews(ps.hostname)
            }))
        ])
      : [];

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Route Designer",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      routes: (selectedApp?.routes ?? []).map((r) => ({
        id: r.id, path: r.path, serviceId: r.serviceId, viewId: r.viewId,
        targetPath: r.targetPath, title: r.title, enabled: r.enabled
      })),
      availableServices,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: `http://${this.config.host === "0.0.0.0" ? "localhost" : this.config.host}:${this.config.port}`
    };
  }

  private async populateMenuContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.platformStore.loadConfig();
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;
    const selectedApp = selectedAppId ? config.apps.find((a) => a.id === selectedAppId) : undefined;

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Menu Designer",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      menu: ((selectedApp as any)?.menu ?? []).map((m: any) => ({
        id: m.id, type: m.type, title: m.title,
        routeId: m.routeId, href: m.href, enabled: m.enabled !== false
      })),
      routes: (selectedApp?.routes ?? []).filter((r) => r.enabled).map((r) => ({
        id: r.id, path: r.path, title: r.title ?? r.path
      })),
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: `http://${this.config.host === "0.0.0.0" ? "localhost" : this.config.host}:${this.config.port}`
    };
  }

  private async populateFragmentsContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.platformStore.loadConfig();
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const selectedAppId = url.searchParams.get("appId") ?? undefined;

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Fragments",
      apps: config.apps.map((a) => ({ id: a.id, title: a.title, tenantId: a.tenantId })),
      selectedAppId,
      adminApiBase: "/.well-known/bp/admin",
      serviceBaseUrl: `http://${this.config.host === "0.0.0.0" ? "localhost" : this.config.host}:${this.config.port}`
    };
  }

  private async populatePreviewContext(event: BetterPortalEvent): Promise<void> {
    const config = await this.platformStore.loadConfig();
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
      try {
        const schemaUrl = `${svc.hostname.replace(/\/+$/, "")}/.well-known/bp/schema.json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        const response = await fetch(schemaUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) continue;
        const schema = await response.json() as {
          routes?: Array<{
            viewId: string; path: string; themes: string[];
            hasFragments: boolean; components: string[];
          }>;
          manifest?: { views?: Array<{ viewId: string; title: string; demoScenarios?: Array<{ id: string; title: string }> }> };
        };

        const viewMeta = new Map(
          (schema.manifest?.views ?? []).map((v) => [v.viewId, v])
        );

        services.push({
          serviceId: svc.serviceId,
          endpointBaseUrl: svc.hostname,
          views: (schema.routes ?? []).map((r) => {
            const meta = viewMeta.get(r.viewId);
            return {
              viewId: r.viewId,
              title: meta?.title ?? r.viewId,
              path: r.path,
              themes: r.themes,
              components: r.components,
              hasFragments: r.hasFragments,
              demoScenarios: (meta?.demoScenarios ?? []).map((d) => ({ id: d.id, title: d.title }))
            };
          })
        });
      } catch { /* skip unreachable services */ }
    }

    (event as unknown as { __bpResponseModel: unknown }).__bpResponseModel = {
      title: "Component Preview",
      services
    };
  }
}

export { Config, EventSchemas };
