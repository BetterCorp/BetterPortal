import type {
  BetterPortalApp,
  BetterPortalConfig,
  BetterPortalTenant,
  TenantServiceRegistration,
  PlatformService
} from "./platformConfig.js";

// ── Scoped config (what a service receives via sync) ─────────────────

export interface ScopedServiceConfig {
  readonly tenants: ReadonlyArray<ScopedTenant>;
  readonly apps: ReadonlyArray<ScopedApp>;
}

export interface ScopedTenant {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly active: boolean;
  readonly branding: BetterPortalTenant["branding"];
}

export interface ScopedApp {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly title: string;
  readonly hostnames: ReadonlyArray<string>;
  readonly themeId: string;
  readonly themeConfig: BetterPortalApp["themeConfig"];
  readonly routes: ReadonlyArray<BetterPortalApp["routes"][number]>;
  readonly fragments: BetterPortalApp["fragments"];
}

// ── Platform config store interface ──────────────────────────────────

export interface PlatformConfigStore {
  loadConfig(): Promise<BetterPortalConfig>;
  saveConfig(config: BetterPortalConfig): Promise<void>;

  validateApiKey(apiKey: string): Promise<{
    scope: "tenant" | "platform";
    serviceId: string | undefined;
    tenantId?: string;
    service: TenantServiceRegistration | PlatformService;
  } | null>;

  getScopedConfig(serviceId: string, scope: "tenant" | "platform", tenantId?: string): Promise<ScopedServiceConfig>;

  onChange(listener: () => void): () => void;
}
