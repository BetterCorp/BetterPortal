import { randomBytes, createHash } from "node:crypto";
import type {
  PlatformConfigStore,
  ScopedServiceConfig,
  ScopedTenant,
  ScopedApp
} from "@betterportal/framework";
import type {
  BetterPortalConfig,
  BetterPortalTenant,
  TenantServiceRegistration,
  PlatformService,
  BetterPortalApp,
  SharedServiceDefinition
} from "@betterportal/framework";

export type StorageBackend = "file" | "postgres";

export interface FileStorageOptions {
  readonly backend?: "file";
  readonly configPath: string;
}

export interface PostgresStorageOptions {
  readonly backend: "postgres";
  readonly connectionString: string;
  readonly tableName?: string;
  readonly rowId?: string;
}

export type StorageOptions =
  | FileStorageOptions
  | PostgresStorageOptions;

export function generateApiKey(): string {
  return `bp_sk_${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export abstract class BaseStorage implements PlatformConfigStore {
  protected listeners: Set<() => void> = new Set();

  abstract loadConfig(): Promise<BetterPortalConfig>;
  abstract saveConfig(config: BetterPortalConfig): Promise<void>;

  protected canonicalizeConfig(config: BetterPortalConfig): BetterPortalConfig {
    for (const app of config.apps) {
      if (app.auth?.provider?.kind !== "authress.io") continue;
      if (app.auth.expectedIssuer === "https://authress.io") {
        app.auth.expectedIssuer = "https://authress.betterportal.local";
      }
      if (app.auth.expectedAudience === "authress") {
        app.auth.expectedAudience = "betterportal-runtime";
      }
      app.auth.refreshViewId ??= "/refresh";
    }
    return config;
  }

  protected validateConfigReferences(config: BetterPortalConfig): void {
    const errors: string[] = [];
    const seen = (label: string, values: string[]) => {
      const found = new Set<string>();
      for (const value of values) {
        if (found.has(value)) errors.push(`${label} id is duplicated: ${value}`);
        found.add(value);
      }
    };

    seen("tenant", config.tenants.map((tenant) => tenant.id));
    seen("app", config.apps.map((app) => app.id));
    seen("platform service", config.platformServices.map((service) => service.id));
    seen("shared service", config.sharedServiceCatalog.map((service) => service.id));

    const tenantsById = new Map(config.tenants.map((tenant) => [tenant.id, tenant]));
    const appsById = new Map(config.apps.map((app) => [app.id, app]));
    const activePlatformServiceIds = new Set(config.platformServices.filter((service) => service.enabled).map((service) => service.id));
    const activeSharedServiceIds = new Set(config.sharedServiceCatalog.filter((service) => service.enabled).map((service) => service.id));
    if (config.configManagement.adminTenantId && !tenantsById.has(config.configManagement.adminTenantId)) {
      errors.push(`configManagement.adminTenantId references missing tenant: ${config.configManagement.adminTenantId}`);
    }

    for (const tenant of config.tenants) {
      seen(`tenant ${tenant.id} service`, tenant.services.map((service) => service.id));
      for (const platformServiceId of tenant.activatedPlatformServices) {
        if (!activePlatformServiceIds.has(platformServiceId)) {
          errors.push(`tenant ${tenant.id} activates missing or disabled platform service: ${platformServiceId}`);
        }
      }
    }

    seen("shared service activation", config.sharedServiceActivations.map((activation) => activation.id));
    for (const activation of config.sharedServiceActivations) {
      if (!tenantsById.has(activation.tenantId)) {
        errors.push(`shared service activation references missing tenant: ${activation.tenantId}`);
      }
      if (!activeSharedServiceIds.has(activation.sharedServiceId)) {
        errors.push(`shared service activation references missing or disabled shared service: ${activation.sharedServiceId}`);
      }
      if (activation.appId) {
        const app = appsById.get(activation.appId);
        if (!app) {
          errors.push(`shared service activation references missing app: ${activation.appId}`);
        } else if (app.tenantId !== activation.tenantId) {
          errors.push(`shared service activation ${activation.sharedServiceId} app ${activation.appId} does not belong to tenant ${activation.tenantId}`);
        }
      }
    }

    seen("webhook target", config.webhooks.targets.map((target) => target.id));
    for (const target of config.webhooks.targets) {
      const tenant = tenantsById.get(target.tenantId);
      if (!tenant || !tenant.active) {
        errors.push(`webhook target ${target.id} references missing or disabled tenant: ${target.tenantId}`);
      }
      if (target.appId) {
        const app = appsById.get(target.appId);
        if (!app) {
          errors.push(`webhook target ${target.id} references missing app: ${target.appId}`);
        } else if (app.tenantId !== target.tenantId) {
          errors.push(`webhook target ${target.id} app ${target.appId} does not belong to tenant ${target.tenantId}`);
        }
      }
    }

    for (const app of config.apps) {
      const tenant = tenantsById.get(app.tenantId);
      if (!tenant) {
        errors.push(`app ${app.id} references missing tenant: ${app.tenantId}`);
        continue;
      }
      const serviceIdsForApp = new Set([
        ...tenant.services.filter((service) => service.enabled).map((service) => service.id),
        ...tenant.activatedPlatformServices.filter((serviceId) => activePlatformServiceIds.has(serviceId)),
        ...config.sharedServiceActivations
          .filter((activation) =>
            activation.enabled
            && activation.tenantId === app.tenantId
            && (!activation.appId || activation.appId === app.id)
            && activeSharedServiceIds.has(activation.sharedServiceId)
          )
          .map((activation) => activation.id)
      ]);

      if (app.shell?.serviceId && !serviceIdsForApp.has(app.shell.serviceId)) {
        errors.push(`app ${app.id} shell.serviceId references unavailable service instance: ${app.shell.serviceId}`);
      }

      seen(`app ${app.id} route`, app.routes.map((route) => route.id));
      const routeIds = new Set(app.routes.map((route) => route.id));

      for (const route of app.routes) {
        if (!serviceIdsForApp.has(route.serviceId)) {
          errors.push(`app ${app.id} route ${route.id} references unavailable service instance: ${route.serviceId}`);
        }
      }

      const validateMenu = (items: Array<{ id: string; routeId?: string; children?: unknown[] }>, path: string): void => {
        seen(`app ${app.id} menu ${path}`, items.map((item) => item.id));
        for (const item of items) {
          if (item.routeId && !routeIds.has(item.routeId)) {
            errors.push(`app ${app.id} menu item ${item.id} references missing route: ${item.routeId}`);
          }
          if (Array.isArray(item.children)) {
            validateMenu(item.children as Array<{ id: string; routeId?: string; children?: unknown[] }>, `${path}.${item.id}`);
          }
        }
      };
      validateMenu(app.menu as Array<{ id: string; routeId?: string; children?: unknown[] }>, "root");

      for (const slot of app.slots) {
        if (!serviceIdsForApp.has(slot.serviceId)) {
          errors.push(`app ${app.id} slot ${slot.slotId} references unavailable service instance: ${slot.serviceId}`);
        }
      }

      for (const [location, fragments] of Object.entries(app.fragments)) {
        for (const fragment of fragments) {
          if (!serviceIdsForApp.has(fragment.serviceId)) {
            errors.push(`app ${app.id} fragment ${location}.${fragment.fragmentId} references unavailable service instance: ${fragment.serviceId}`);
          }
        }
      }

      if (app.auth?.serviceId && !serviceIdsForApp.has(app.auth.serviceId)) {
        errors.push(`app ${app.id} auth.serviceId references unavailable service instance: ${app.auth.serviceId}`);
      }
      for (const role of app.auth?.roles ?? []) {
        for (const grant of role.permissions) {
          if (!serviceIdsForApp.has(grant.serviceId)) {
            errors.push(`app ${app.id} role ${role.id} references unavailable service instance: ${grant.serviceId}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid BetterPortal config references:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    }
  }

  async validateApiKey(apiKey: string): Promise<{
    scope: "tenant" | "platform";
    serviceId: string | undefined;
    tenantId?: string;
    service: TenantServiceRegistration | PlatformService | SharedServiceDefinition;
  } | null> {
    const hash = hashApiKey(apiKey);
    const config = await this.loadConfig();

    for (const ps of config.platformServices) {
      if (ps.enabled && ps.apiKeyHash === hash) {
        // Return the UUIDv7 instance id — routes/fragments/app.themeId all key off it.
        // (ps.serviceId is the pluginId reference; not used for routing.)
        return { scope: "platform", serviceId: ps.id, service: ps };
      }
    }

    for (const shared of config.sharedServiceCatalog) {
      if (shared.enabled && shared.apiKeyHash === hash) {
        return { scope: "platform", serviceId: shared.id, service: shared };
      }
    }

    for (const tenant of config.tenants) {
      if (!tenant.active) continue;
      for (const svc of tenant.services) {
        if (svc.enabled && svc.apiKeyHash === hash) {
          return { scope: "tenant", serviceId: svc.id, tenantId: tenant.id, service: svc };
        }
      }
    }

    return null;
  }

  async getScopedConfig(
    serviceId: string,
    scope: "tenant" | "platform",
    tenantId?: string
  ): Promise<ScopedServiceConfig> {
    const config = await this.loadConfig();
    // Shell/theme services need an unfiltered app view to resolve route URLs and
    // render full nav. Detect by app.shell.serviceId pointing at the caller.
    const sharedActivationIdsForCaller = new Set(
      config.sharedServiceActivations
        .filter((activation) => activation.enabled && activation.sharedServiceId === serviceId)
        .map((activation) => activation.id)
    );
    const isThemeCaller = config.apps.some((app) =>
      app.shell?.serviceId === serviceId
      || (app.shell?.serviceId ? sharedActivationIdsForCaller.has(app.shell.serviceId) : false)
    );

    if (scope === "tenant" && tenantId) {
      return this.scopeForTenantService(config, serviceId, tenantId, isThemeCaller);
    }

    return this.scopeForPlatformService(config, serviceId, isThemeCaller);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  invalidate(): void {
    this.notifyListeners();
  }

  protected notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore listener failures */ }
    }
  }

  private scopeForTenantService(
    config: BetterPortalConfig,
    serviceId: string,
    tenantId: string,
    isThemeCaller: boolean
  ): ScopedServiceConfig {
    const tenant = config.tenants.find((t) => t.active && t.id === tenantId);
    const managementOrigins = this.managementOrigins(config);
    if (!tenant) return { managementOrigins, tenants: [], apps: [] };

    const service = tenant.services.find(
      (s) => s.enabled && (s.id === serviceId || s.serviceId === serviceId)
    );
    const sharedActivation = config.sharedServiceActivations.find((activation) =>
      activation.enabled
      && activation.tenantId === tenantId
      && (activation.id === serviceId || activation.sharedServiceId === serviceId)
    );
    if (!service && !sharedActivation && !isThemeCaller) return { managementOrigins, tenants: [], apps: [] };

    const serviceKeys = service
      ? [service.id, service.serviceId].filter((value): value is string => !!value)
      : sharedActivation
        ? [sharedActivation.id, sharedActivation.sharedServiceId]
      : [];

    const scopedTenant = this.scopeTenant(tenant, config);

    const apps: ScopedApp[] = config.apps
      .filter((a) => a.tenantId === tenantId)
      // Shell callers only see apps that selected this service instance as shell.
      .filter((a) => isThemeCaller ? a.shell?.serviceId === serviceId : true)
      .map((a) => this.scopeApp(a, serviceKeys, isThemeCaller))
      .filter((a) => isThemeCaller || a.routes.length > 0 || Object.keys(a.fragments).length > 0);

    return {
      managementOrigins,
      tenants: [scopedTenant],
      configApps: this.configAppsForTenant(config, tenantId),
      apps
    };
  }

  private scopeForPlatformService(
    config: BetterPortalConfig,
    serviceId: string,
    isThemeCaller: boolean
  ): ScopedServiceConfig {
    const tenants: ScopedTenant[] = [];
    const apps: ScopedApp[] = [];

    for (const tenant of config.tenants) {
      if (!tenant.active) continue;

      if (isThemeCaller) {
        // Platform shell services serve any tenant whose apps reference this service.
        const sharedShellActivationIds = new Set(
          config.sharedServiceActivations
            .filter((activation) => activation.enabled && activation.tenantId === tenant.id && activation.sharedServiceId === serviceId)
            .map((activation) => activation.id)
        );
        const tenantApps = config.apps
          .filter((a) =>
            a.tenantId === tenant.id
            && (
              a.shell?.serviceId === serviceId
              || (a.shell?.serviceId ? sharedShellActivationIds.has(a.shell.serviceId) : false)
            )
          )
          .map((a) => this.scopeApp(a, [], true));
        if (tenantApps.length === 0) continue;
        tenants.push(this.scopeTenant(tenant, config));
        apps.push(...tenantApps);
        continue;
      }

      const platformService = config.platformServices.find(
        (ps) => ps.enabled && (ps.id === serviceId || ps.serviceId === serviceId)
      );
      const sharedService = config.sharedServiceCatalog.find((shared) => shared.enabled && shared.id === serviceId);
      if (!platformService && !sharedService) continue;

      if (sharedService) {
        const activations = config.sharedServiceActivations.filter((activation) =>
          activation.enabled
          && activation.tenantId === tenant.id
          && activation.sharedServiceId === sharedService.id
        );
        if (activations.length === 0) continue;
        tenants.push(this.scopeTenant(tenant, config));
        const activationIds = new Set(activations.map((activation) => activation.id));
        const tenantApps = config.apps
          .filter((a) => a.tenantId === tenant.id)
          .filter((a) => activations.some((activation) => !activation.appId || activation.appId === a.id))
          .filter((a) => isThemeCaller ? (a.shell?.serviceId ? activationIds.has(a.shell.serviceId) : false) : true)
          .map((a) => this.scopeApp(a, [sharedService.id, ...activationIds], isThemeCaller))
          .filter((a) => isThemeCaller || a.routes.length > 0 || Object.keys(a.fragments).length > 0);
        apps.push(...tenantApps);
        continue;
      }

      if (
        !platformService
        || (
          !tenant.activatedPlatformServices.includes(platformService.id)
          && (!platformService.serviceId || !tenant.activatedPlatformServices.includes(platformService.serviceId))
        )
      ) continue;

      const serviceKeys = [platformService.id, platformService.serviceId].filter((value): value is string => !!value);

      tenants.push(this.scopeTenant(tenant, config));

      const tenantApps = config.apps
        .filter((a) => a.tenantId === tenant.id)
        .map((a) => this.scopeApp(a, serviceKeys, false))
        .filter((a) => a.routes.length > 0 || Object.keys(a.fragments).length > 0);

      apps.push(...tenantApps);
    }

    return {
      managementOrigins: this.managementOrigins(config),
      tenants,
      configApps: tenants.flatMap((tenant) => this.configAppsForTenant(config, tenant.id)),
      apps
    };
  }

  private configAppsForTenant(config: BetterPortalConfig, tenantId: string): Array<{ id: string; tenantId: string; title: string }> {
    return config.apps
      .filter((app) => app.tenantId === tenantId)
      .map((app) => ({ id: app.id, tenantId: app.tenantId, title: app.title }));
  }

  private scopeTenant(tenant: BetterPortalTenant, config?: BetterPortalConfig): ScopedTenant {
    const sharedServices = (config?.sharedServiceActivations ?? [])
      .filter((activation) => activation.enabled && activation.tenantId === tenant.id)
      .map((activation) => {
        const shared = config?.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId && service.enabled);
        if (!shared) return undefined;
        return {
          id: activation.id,
          hostname: shared.baseUrl,
          serviceId: shared.serviceId ?? shared.id,
          source: "shared" as const,
          sharedServiceId: shared.id,
          baseUrl: shared.baseUrl,
          capabilities: shared.tags,
          title: shared.title,
          description: shared.description,
          logoUrl: shared.logoUrl,
          category: shared.category,
          tags: shared.tags,
          deploymentMode: "bp-hosted" as const,
          createdAt: activation.activatedAt,
          enabled: activation.enabled
        };
      })
      .filter((service): service is NonNullable<typeof service> => !!service);
    return {
      id: tenant.id,
      slug: tenant.slug,
      title: tenant.title,
      active: tenant.active,
      branding: tenant.branding,
      // apiKeyHash redacted — services know their own key, others have no need.
      services: [
        ...tenant.services.map(({ apiKeyHash: _hash, ...rest }) => ({ ...rest, source: "tenant" as const })),
        ...sharedServices
      ],
      activatedPlatformServices: tenant.activatedPlatformServices
    };
  }

  private managementOrigins(config: BetterPortalConfig): string[] {
    const adminTenantId = config.configManagement.adminTenantId;
    if (!adminTenantId) return [];

    const origins = config.apps
      .filter((app) => app.tenantId === adminTenantId)
      .flatMap((app) => [
        ...app.hostnames.flatMap((hostname) => {
          if (hostname.startsWith("http://") || hostname.startsWith("https://")) {
            return [hostname.replace(/\/+$/, "")];
          }
          return [`https://${hostname}`, `http://${hostname}`];
        }),
        ...app.originOverrides.map((origin) => origin.replace(/\/+$/, ""))
      ]);

    return [...new Set(origins)];
  }

  private shellThemeId(app: BetterPortalApp): string {
    const legacyThemeId = (app as unknown as { themeId?: string }).themeId;
    if (legacyThemeId) return legacyThemeId;
    // Convention: service.betterportal.theme.bootstrap1 -> bootstrap1.
    // Renderer ids stay internal to codegen; app config only stores shell service.
    return "bootstrap1";
  }

  private scopeApp(app: BetterPortalApp, serviceKeys: string[], isThemeCaller: boolean): ScopedApp {
    const serviceKeySet = new Set(serviceKeys);
    return {
      id: app.id,
      tenantId: app.tenantId,
      slug: app.slug,
      title: app.title,
      hostnames: app.hostnames,
      originOverrides: app.originOverrides,
      refererOverrides: app.refererOverrides,
      themeId: this.shellThemeId(app),
      shell: app.shell,
      themeConfig: app.themeConfig,
      defaultRoute: app.defaultRoute,
      // Themes get everything. Other services get only routes that target them.
      routes: isThemeCaller ? app.routes : app.routes.filter((r) => serviceKeySet.has(r.serviceId)),
      menu: app.menu,
      slots: isThemeCaller ? app.slots : app.slots.filter((s) => serviceKeySet.has(s.serviceId)),
      fragments: isThemeCaller
        ? app.fragments
        : Object.fromEntries(
            Object.entries(app.fragments)
              .map(([loc, frags]) => [loc, frags.filter((f) => serviceKeySet.has(f.serviceId))])
              .filter(([, frags]) => (frags as unknown[]).length > 0)
          ),
      auth: app.auth
    };
  }
}
