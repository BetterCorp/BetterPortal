import { randomBytes, createHash } from "node:crypto";
import type {
  PlatformConfigStore,
  ScopedM2MConfig,
  ScopedServiceConfig,
  ScopedTenant,
  ScopedApp
} from "@betterportal/framework";
import { resolveAppShell } from "@betterportal/framework";
import type {
  BetterPortalConfig,
  BetterPortalTenant,
  TenantServiceRegistration,
  PlatformService,
  BetterPortalApp,
  SharedServiceDefinition,
  AuthProviderRuntimeMetadata
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

const OfficialPluginIdMigrations: Readonly<Record<string, string>> = {
  "service.betterportal.config-manager": "org.betterportal.config-manager",
  "service.betterportal.auth.default": "org.betterportal.auth.default",
  "auth.betterportal.default": "org.betterportal.auth.default",
  "service.betterportal.auth.authress-io": "org.betterportal.auth.authress-io",
  "service.betterportal.auth.workos": "org.betterportal.auth.workos",
  "service.betterportal.theme.bootstrap1": "org.betterportal.theme.bootstrap1",
  "theme.betterportal.bootstrap1": "org.betterportal.theme.bootstrap1",
  "service.betterportal.theme.embedded": "org.betterportal.theme.embedded",
  "service.betterportal.docs-site": "org.betterportal.docs-site",
  "service.betterportal.hello-view": "org.betterportal.hello-view"
};

export function migrateOfficialPluginIds<T>(value: T): T {
  if (typeof value === "string") return (OfficialPluginIdMigrations[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((item) => migrateOfficialPluginIds(item)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, migrateOfficialPluginIds(item)])
  ) as T;
}

export function generateApiKey(): string {
  return `bp_sk_${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

const DefaultAuthViewIds = {
  login: "login.index",
  logout: "logout.index",
  refresh: "refresh.index"
} as const;

function canonicalAuthViewId(
  app: BetterPortalApp,
  serviceId: string,
  value: string | undefined,
  kind: keyof typeof DefaultAuthViewIds
): string {
  const fallback = DefaultAuthViewIds[kind];
  if (!value) return fallback;
  if (!value.startsWith("/")) return value;
  const route = app.routes.find((candidate) =>
    candidate.serviceId === serviceId
    && [candidate.path, candidate.resolvedServicePath, candidate.targetPath].includes(value)
  );
  return route?.viewId ?? (value === `/${kind}` ? fallback : value);
}

export function migrateAuthViewIds(config: BetterPortalConfig): BetterPortalConfig {
  for (const app of config.apps) {
    if (!app.auth) continue;
    app.auth.loginViewId = canonicalAuthViewId(app, app.auth.serviceId, app.auth.loginViewId, "login");
    app.auth.logoutViewId = canonicalAuthViewId(app, app.auth.serviceId, app.auth.logoutViewId, "logout");
    app.auth.refreshViewId = canonicalAuthViewId(app, app.auth.serviceId, app.auth.refreshViewId, "refresh");
  }
  return config;
}

export function getAvailableServiceInstanceIdsForApp(
  config: BetterPortalConfig,
  app: Pick<BetterPortalApp, "id" | "tenantId">
): Set<string> {
  const tenant = config.tenants.find((candidate) => candidate.id === app.tenantId);
  if (!tenant) return new Set();
  const activePlatformServiceIds = new Set(config.platformServices.filter((service) => service.enabled).map((service) => service.id));
  const activeSharedServiceIds = new Set(config.sharedServiceCatalog.filter((service) => service.enabled).map((service) => service.id));
  return new Set([
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
}

export abstract class BaseStorage implements PlatformConfigStore {
  protected listeners: Set<() => void> = new Set();

  abstract loadConfig(): Promise<BetterPortalConfig>;
  abstract saveConfig(config: BetterPortalConfig): Promise<void>;

  protected canonicalizeConfig(config: BetterPortalConfig): BetterPortalConfig {
    config = migrateOfficialPluginIds(config);
    migrateAuthViewIds(config);
    this.ensurePlatformRootRole(config);
    for (const app of config.apps) {
      if (app.auth) {
        const authProvider = resolveAuthProviderRuntimeMetadata(config, app.auth.serviceId);
        if (authProvider) {
          app.auth.expectedIssuer = authProvider.issuer;
          app.auth.expectedAudience = authProvider.audience;
          app.auth.jwksUri = authProvider.jwksUri;
        }
      }
      if (app.auth?.provider?.kind !== "authress.io") continue;
      if (app.auth.expectedAudience === "authress") {
        app.auth.expectedAudience = "betterportal-runtime";
      }
    }
    return config;
  }

  private ensurePlatformRootRole(config: BetterPortalConfig): void {
    const adminTenantId = config.configManagement.adminTenantId;
    const managementAppId = config.configManagement.managementAppId;
    if (!adminTenantId || !managementAppId) return;
    const app = config.apps.find((candidate) => candidate.id === managementAppId && candidate.tenantId === adminTenantId);
    if (!app?.auth) return;
    app.auth.roles ??= [];
    const existing = app.auth.roles.find((role) => role.id === "*");
    if (existing) {
      existing.title ||= "Platform Root";
      existing.description ||= "Reserved platform-root wildcard role. Only valid for the configured management tenant/app.";
      return;
    }
    app.auth.roles.push({
      id: "*",
      title: "Platform Root",
      description: "Reserved platform-root wildcard role. Only valid for the configured management tenant/app.",
      permissions: []
    });
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
    if (config.configManagement.managementAppId) {
      const managementApp = appsById.get(config.configManagement.managementAppId);
      if (!managementApp) {
        errors.push(`configManagement.managementAppId references missing app: ${config.configManagement.managementAppId}`);
      } else if (config.configManagement.adminTenantId && managementApp.tenantId !== config.configManagement.adminTenantId) {
        errors.push(`configManagement.managementAppId must belong to adminTenantId: ${config.configManagement.managementAppId}`);
      }
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

    const serviceIdsForTenant = (tenantId: string, appId?: string): Set<string> => {
      const tenant = tenantsById.get(tenantId);
      return new Set([
        ...(tenant?.services.filter((service) => service.enabled).map((service) => service.id) ?? []),
        ...(tenant?.activatedPlatformServices.filter((serviceId) => activePlatformServiceIds.has(serviceId)) ?? []),
        ...config.sharedServiceActivations
          .filter((activation) =>
            activation.enabled
            && activation.tenantId === tenantId
            && (!activation.appId || !appId || activation.appId === appId)
            && activeSharedServiceIds.has(activation.sharedServiceId)
          )
          .map((activation) => activation.id)
      ]);
    };

    seen("m2m binding", config.m2m.bindings.map((binding) => binding.id));
    const activeConnectionKeys = new Set<string>();
    for (const binding of config.m2m.bindings.filter((candidate) => candidate.enabled)) {
      const key = [binding.tenantId, binding.appId ?? "", binding.sourceServiceId, binding.requestId, binding.mode].join("\n");
      if (activeConnectionKeys.has(key)) errors.push(`active m2m binding is duplicated for request ${binding.requestId}`);
      activeConnectionKeys.add(key);
    }
    for (const binding of config.m2m.bindings) {
      const tenant = tenantsById.get(binding.tenantId);
      if (!tenant || !tenant.active) {
        errors.push(`m2m binding ${binding.id} references missing or disabled tenant: ${binding.tenantId}`);
        continue;
      }
      if (binding.appId) {
        const app = appsById.get(binding.appId);
        if (!app) {
          errors.push(`m2m binding ${binding.id} references missing app: ${binding.appId}`);
        } else if (app.tenantId !== binding.tenantId) {
          errors.push(`m2m binding ${binding.id} app ${binding.appId} does not belong to tenant ${binding.tenantId}`);
        }
      }
      const serviceIds = serviceIdsForTenant(binding.tenantId, binding.appId);
      if (!serviceIds.has(binding.sourceServiceId)) {
        errors.push(`m2m binding ${binding.id} references unavailable source service: ${binding.sourceServiceId}`);
      }
      if (!serviceIds.has(binding.targetServiceId)) {
        errors.push(`m2m binding ${binding.id} references unavailable target service: ${binding.targetServiceId}`);
      }
    }

    const bindingsById = new Map(config.m2m.bindings.map((binding) => [binding.id, binding]));
    seen("m2m grant", config.m2m.grants.map((grant) => grant.id));
    const activeGrantBindings = new Set<string>();
    for (const grant of config.m2m.grants.filter((candidate) => candidate.enabled)) {
      if (activeGrantBindings.has(grant.bindingId)) errors.push(`m2m binding ${grant.bindingId} has multiple active grants`);
      activeGrantBindings.add(grant.bindingId);
    }
    for (const grant of config.m2m.grants) {
      const binding = bindingsById.get(grant.bindingId);
      if (!binding) {
        errors.push(`m2m grant ${grant.id} references missing binding: ${grant.bindingId}`);
        continue;
      }
      if (binding.tenantId !== grant.tenantId) {
        errors.push(`m2m grant ${grant.id} tenant ${grant.tenantId} does not match binding tenant ${binding.tenantId}`);
      }
      if (grant.appId && binding.appId && grant.appId !== binding.appId) {
        errors.push(`m2m grant ${grant.id} app ${grant.appId} does not match binding app ${binding.appId}`);
      }
    }

    for (const app of config.apps) {
      const tenant = tenantsById.get(app.tenantId);
      if (!tenant) {
        errors.push(`app ${app.id} references missing tenant: ${app.tenantId}`);
        continue;
      }
      const serviceIdsForApp = getAvailableServiceInstanceIdsForApp(config, app);

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
        // Return the UUIDv7 instance id; app references always use concrete instances.
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

  async registerServicePublicKey(
    serviceId: string,
    scope: "tenant" | "platform",
    tenantId: string | undefined,
    publicKeyPem: string,
    keyId: string
  ): Promise<"registered" | "matched" | "mismatch" | "not-found"> {
    const config = await this.loadConfig();
    const service = scope === "tenant"
      ? config.tenants.find((tenant) => tenant.id === tenantId)?.services.find((candidate) => candidate.id === serviceId)
      : config.platformServices.find((candidate) => candidate.id === serviceId)
        ?? config.sharedServiceCatalog.find((candidate) => candidate.id === serviceId);
    if (!service) return "not-found";
    if (service.publicKeyPem || service.keyId) {
      return service.publicKeyPem === publicKeyPem && service.keyId === keyId ? "matched" : "mismatch";
    }
    service.publicKeyPem = publicKeyPem;
    service.keyId = keyId;
    await this.saveConfig(config);
    return "registered";
  }

  async getScopedConfig(
    serviceId: string,
    scope: "tenant" | "platform",
    tenantId?: string
  ): Promise<ScopedServiceConfig> {
    const config = await this.loadConfig();
    // Shell services need an unfiltered app view to resolve route URLs and
    // render full nav. Detect by app.shell.serviceId pointing at the caller.
    const sharedActivationIdsForCaller = new Set(
      config.sharedServiceActivations
        .filter((activation) => activation.enabled && activation.sharedServiceId === serviceId)
        .map((activation) => activation.id)
    );
    const isShellCaller = config.apps.some((app) =>
      app.shell?.serviceId === serviceId
      || (app.shell?.serviceId ? sharedActivationIdsForCaller.has(app.shell.serviceId) : false)
    );
    const isAuthCaller = config.apps.some((app) =>
      app.auth?.serviceId === serviceId
      || (app.auth?.serviceId ? sharedActivationIdsForCaller.has(app.auth.serviceId) : false)
    );
    if (scope === "tenant" && tenantId) {
      return this.withM2MPolicy(
        config,
        serviceId,
        this.scopeForTenantService(config, serviceId, tenantId, isShellCaller, isAuthCaller)
      );
    }

    return this.withM2MPolicy(
      config,
      serviceId,
      this.scopeForPlatformService(config, serviceId, isShellCaller, isAuthCaller)
    );
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
    isShellCaller: boolean,
    isAuthCaller: boolean
  ): ScopedServiceConfig {
    const tenant = config.tenants.find((t) => t.active && t.id === tenantId);
    const managementOrigins = this.managementOrigins(config);
    if (!tenant) return { configManagement: this.scopedConfigManagement(config), managementOrigins, tenants: [], apps: [] };

    const service = tenant.services.find(
      (s) => s.enabled && (s.id === serviceId || s.serviceId === serviceId)
    );
    const sharedActivation = config.sharedServiceActivations.find((activation) =>
      activation.enabled
      && activation.tenantId === tenantId
      && (activation.id === serviceId || activation.sharedServiceId === serviceId)
    );
    if (!service && !sharedActivation && !isShellCaller) return { configManagement: this.scopedConfigManagement(config), managementOrigins, tenants: [], apps: [] };

    const serviceKeys = service
      ? [service.id, service.serviceId].filter((value): value is string => !!value)
      : sharedActivation
        ? [sharedActivation.id, sharedActivation.sharedServiceId]
      : [];

    const scopedTenant = this.scopeTenant(tenant, config);

    const apps: ScopedApp[] = config.apps
      .filter((a) => a.tenantId === tenantId)
      // Shell callers only see apps that selected this service instance as shell.
      .filter((a) => isShellCaller ? a.shell?.serviceId === serviceId : true)
      .map((a) => this.scopeApp(config, a, serviceKeys, isShellCaller, isAuthCaller))
      .filter((a) => isShellCaller || a.routes.length > 0 || Object.keys(a.fragments).length > 0);

    return {
      configManagement: this.scopedConfigManagement(config),
      managementOrigins,
      tenants: [scopedTenant],
      configApps: this.configAppsForTenant(config, tenantId),
      apps
    };
  }

  private scopeForPlatformService(
    config: BetterPortalConfig,
    serviceId: string,
    isShellCaller: boolean,
    isAuthCaller: boolean
  ): ScopedServiceConfig {
    const tenants: ScopedTenant[] = [];
    const apps: ScopedApp[] = [];

    for (const tenant of config.tenants) {
      if (!tenant.active) continue;

      if (isShellCaller) {
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
          .map((a) => this.scopeApp(config, a, [], true, isAuthCaller));
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
          .filter((a) => isShellCaller ? (a.shell?.serviceId ? activationIds.has(a.shell.serviceId) : false) : true)
          .map((a) => this.scopeApp(config, a, [sharedService.id, ...activationIds], isShellCaller, isAuthCaller))
          .filter((a) => isShellCaller || a.routes.length > 0 || Object.keys(a.fragments).length > 0);
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
        .map((a) => this.scopeApp(config, a, serviceKeys, false, isAuthCaller))
        .filter((a) => a.routes.length > 0 || Object.keys(a.fragments).length > 0);

      apps.push(...tenantApps);
    }

    return {
      configManagement: this.scopedConfigManagement(config),
      managementOrigins: this.managementOrigins(config),
      tenants,
      configApps: tenants.flatMap((tenant) => this.configAppsForTenant(config, tenant.id)),
      apps
    };
  }

  private withM2MPolicy(
    config: BetterPortalConfig,
    serviceId: string,
    scoped: ScopedServiceConfig
  ): ScopedServiceConfig {
    const registered = this.registeredService(config, serviceId);
    const localServiceIds = new Set<string>([serviceId]);
    const shared = config.sharedServiceCatalog.find((candidate) => candidate.id === serviceId);
    if (shared) {
      for (const activation of config.sharedServiceActivations) {
        const tenantActive = config.tenants.some((tenant) => tenant.active && tenant.id === activation.tenantId);
        if (activation.enabled && tenantActive && activation.sharedServiceId === shared.id) localServiceIds.add(activation.id);
      }
    }

    const bindings = config.m2m.bindings.filter((binding) =>
      binding.enabled
      && config.tenants.some((tenant) => tenant.active && tenant.id === binding.tenantId)
      && (!binding.appId || config.apps.some((app) => app.id === binding.appId && app.tenantId === binding.tenantId))
      && Boolean(this.resolveM2MService(config, binding.sourceServiceId))
      && Boolean(this.resolveM2MService(config, binding.targetServiceId))
      && (localServiceIds.has(binding.sourceServiceId) || localServiceIds.has(binding.targetServiceId))
    );
    const bindingIds = new Set(bindings.map((binding) => binding.id));
    const grants = config.m2m.grants.filter((grant) => grant.enabled && bindingIds.has(grant.bindingId));
    const relatedServiceIds = new Set(bindings.flatMap((binding) => [binding.sourceServiceId, binding.targetServiceId]));
    const services = [...relatedServiceIds]
      .map((id) => this.resolveM2MService(config, id))
      .filter((service): service is NonNullable<typeof service> => Boolean(service));
    const m2m: ScopedM2MConfig = {
      localServiceIds: [...localServiceIds],
      services,
      bindings,
      grants
    };
    return {
      ...scoped,
      ...(registered ? {
        serviceIdentity: {
          id: serviceId,
          ...(registered.publicKeyPem ? { publicKeyPem: registered.publicKeyPem } : {}),
          ...(registered.keyId ? { keyId: registered.keyId } : {})
        }
      } : {}),
      m2m
    };
  }

  private registeredService(
    config: BetterPortalConfig,
    serviceId: string
  ): TenantServiceRegistration | PlatformService | SharedServiceDefinition | undefined {
    return config.platformServices.find((service) => service.id === serviceId)
      ?? config.sharedServiceCatalog.find((service) => service.id === serviceId)
      ?? config.tenants.flatMap((tenant) => tenant.services).find((service) => service.id === serviceId);
  }

  private resolveM2MService(config: BetterPortalConfig, serviceId: string): ScopedM2MConfig["services"][number] | undefined {
    const direct = this.registeredService(config, serviceId);
    const directEnabled = direct?.enabled && (
      !("hostname" in direct)
      || config.platformServices.includes(direct as PlatformService)
      || config.tenants.some((tenant) => tenant.active && tenant.services.includes(direct as TenantServiceRegistration))
    );
    if (direct && directEnabled) {
      return {
        id: serviceId,
        ...(direct.serviceId ? { serviceId: direct.serviceId } : {}),
        hostname: "hostname" in direct ? direct.hostname : direct.baseUrl,
        ...(direct.publicKeyPem ? { publicKeyPem: direct.publicKeyPem } : {}),
        ...(direct.keyId ? { keyId: direct.keyId } : {})
      };
    }
    const activation = config.sharedServiceActivations.find((candidate) => candidate.enabled && candidate.id === serviceId);
    const shared = activation
      ? config.sharedServiceCatalog.find((candidate) => candidate.enabled && candidate.id === activation.sharedServiceId)
      : undefined;
    if (!shared) return undefined;
    return {
      id: serviceId,
      serviceId: shared.serviceId ?? shared.id,
      hostname: shared.baseUrl,
      ...(shared.publicKeyPem ? { publicKeyPem: shared.publicKeyPem } : {}),
      ...(shared.keyId ? { keyId: shared.keyId } : {})
    };
  }

  private configAppsForTenant(config: BetterPortalConfig, tenantId: string): Array<{ id: string; tenantId: string; title: string }> {
    return config.apps
      .filter((app) => app.tenantId === tenantId)
      .map((app) => ({ id: app.id, tenantId: app.tenantId, title: app.title }));
  }

  private scopedConfigManagement(config: BetterPortalConfig): NonNullable<ScopedServiceConfig["configManagement"]> {
    const tenant = config.tenants.find((candidate) => candidate.id === config.configManagement.adminTenantId);
    const app = config.apps.find((candidate) =>
      candidate.id === config.configManagement.managementAppId
      && candidate.tenantId === tenant?.id
    );
    return {
      adminTenantId: config.configManagement.adminTenantId,
      managementAppId: config.configManagement.managementAppId,
      ...(tenant && app ? {
        context: {
          tenant: this.scopeTenant(tenant, config),
          app: {
            ...this.scopeApp(config, app, [], false, false),
            routes: [],
            menu: [],
            slots: [],
            fragments: {},
            shellFragments: {}
          }
        }
      } : {})
    };
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
      // apiKeyHash redacted - services know their own key, others have no need.
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

  private scopeApp(config: BetterPortalConfig, app: BetterPortalApp, serviceKeys: string[], isShellCaller: boolean, isAuthCaller: boolean): ScopedApp {
    const serviceKeySet = new Set(serviceKeys);
    return {
      id: app.id,
      tenantId: app.tenantId,
      slug: app.slug,
      title: app.title,
      hostnames: app.hostnames,
      originOverrides: app.originOverrides,
      refererOverrides: app.refererOverrides,
      shell: resolveAppShell(config, app),
      themeConfig: app.themeConfig,
      defaultRoute: app.defaultRoute,
      // Themes and authoritative auth services need the full route allowlist.
      routes: isShellCaller || isAuthCaller ? app.routes : app.routes.filter((r) => serviceKeySet.has(r.serviceId)),
      menu: app.menu,
      slots: isShellCaller ? app.slots : app.slots.filter((s) => serviceKeySet.has(s.serviceId)),
      fragments: isShellCaller
        ? app.fragments
        : Object.fromEntries(
            Object.entries(app.fragments)
              .map(([loc, frags]) => [loc, frags.filter((f) => serviceKeySet.has(f.serviceId))])
              .filter(([, frags]) => (frags as unknown[]).length > 0)
          ),
      shellFragments: isShellCaller ? app.shellFragments : {},
      auth: app.auth
    };
  }
}

function resolveAuthProviderRuntimeMetadata(
  config: BetterPortalConfig,
  serviceId: string
): AuthProviderRuntimeMetadata | undefined {
  const tenantService = config.tenants
    .flatMap((tenant) => tenant.services)
    .find((service) => service.id === serviceId);
  if (tenantService?.authProvider) return tenantService.authProvider;

  const platformService = config.platformServices.find((service) => service.id === serviceId);
  if (platformService?.authProvider) return platformService.authProvider;

  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId && candidate.enabled);
  if (activation) {
    const sharedService = config.sharedServiceCatalog.find((service) => service.id === activation.sharedServiceId);
    if (sharedService?.authProvider) return sharedService.authProvider;
  }

  return undefined;
}
