import { randomBytes, createHash } from "node:crypto";
import type {
  PlatformConfigStore,
  ScopedServiceConfig,
  ScopedTenant,
  ScopedApp
} from "@betterportal/framework";
import type {
  BetterPortalConfig,
  TenantServiceRegistration,
  PlatformService,
  BetterPortalApp
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

  async validateApiKey(apiKey: string): Promise<{
    scope: "tenant" | "platform";
    serviceId: string | undefined;
    tenantId?: string;
    service: TenantServiceRegistration | PlatformService;
  } | null> {
    const hash = hashApiKey(apiKey);
    const config = await this.loadConfig();

    for (const ps of config.platformServices) {
      if (ps.enabled && ps.apiKeyHash === hash) {
        return { scope: "platform", serviceId: ps.serviceId, service: ps };
      }
    }

    for (const tenant of config.tenants) {
      if (!tenant.active) continue;
      for (const svc of tenant.services) {
        if (svc.enabled && svc.apiKeyHash === hash) {
          return { scope: "tenant", serviceId: svc.serviceId, tenantId: tenant.id, service: svc };
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

    if (scope === "tenant" && tenantId) {
      return this.scopeForTenantService(config, serviceId, tenantId);
    }

    return this.scopeForPlatformService(config, serviceId);
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
    tenantId: string
  ): ScopedServiceConfig {
    const tenant = config.tenants.find((t) => t.active && t.id === tenantId);
    if (!tenant) return { tenants: [], apps: [] };

    const hasService = tenant.services.some(
      (s) => s.enabled && (s.id === serviceId || s.serviceId === serviceId)
    );
    if (!hasService) return { tenants: [], apps: [] };

    const scopedTenant: ScopedTenant = {
      id: tenant.id,
      slug: tenant.slug,
      title: tenant.title,
      active: tenant.active,
      branding: tenant.branding
    };

    const apps: ScopedApp[] = config.apps
      .filter((a) => a.tenantId === tenantId)
      .map((a) => this.scopeApp(a, serviceId))
      .filter((a) => a.routes.length > 0 || Object.keys(a.fragments).length > 0);

    return { tenants: [scopedTenant], apps };
  }

  private scopeForPlatformService(
    config: BetterPortalConfig,
    serviceId: string
  ): ScopedServiceConfig {
    const tenants: ScopedTenant[] = [];
    const apps: ScopedApp[] = [];

    for (const tenant of config.tenants) {
      if (!tenant.active) continue;
      if (!tenant.activatedPlatformServices.includes(serviceId)) continue;

      tenants.push({
        id: tenant.id,
        slug: tenant.slug,
        title: tenant.title,
        active: tenant.active,
        branding: tenant.branding
      });

      const tenantApps = config.apps
        .filter((a) => a.tenantId === tenant.id)
        .map((a) => this.scopeApp(a, serviceId))
        .filter((a) => a.routes.length > 0 || Object.keys(a.fragments).length > 0);

      apps.push(...tenantApps);
    }

    return { tenants, apps };
  }

  private scopeApp(app: BetterPortalApp, serviceId: string): ScopedApp {
    return {
      id: app.id,
      tenantId: app.tenantId,
      slug: app.slug,
      title: app.title,
      hostnames: app.hostnames,
      themeId: app.themeId,
      themeConfig: app.themeConfig,
      routes: app.routes.filter((r) => r.serviceId === serviceId),
      fragments: Object.fromEntries(
        Object.entries(app.fragments)
          .map(([loc, frags]) => [loc, frags.filter((f) => f.serviceId === serviceId)])
          .filter(([, frags]) => (frags as unknown[]).length > 0)
      )
    };
  }
}
