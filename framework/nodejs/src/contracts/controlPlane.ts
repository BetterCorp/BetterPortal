import type {
  BetterPortalApp,
  BetterPortalConfig,
  BetterPortalTenant,
  TenantServiceRegistration,
  PlatformService,
  SharedServiceDefinition
} from "./platformConfig.js";

// -- Scoped config (what a service receives via sync) -----------------

export interface ScopedServiceConfig {
  readonly managementOrigins: ReadonlyArray<string>;
  readonly tenants: ReadonlyArray<ScopedTenant>;
  /** Apps whose service config may be managed for this service. This can be broader than runtime apps. */
  readonly configApps?: ReadonlyArray<ScopedConfigApp>;
  readonly apps: ReadonlyArray<ScopedApp>;
}

export interface ScopedTenant {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly active: boolean;
  readonly branding: BetterPortalTenant["branding"];
  /** Service registrations needed by themes/services to resolve route URLs. Secrets redacted. */
  readonly services: ReadonlyArray<ScopedTenantService>;
  readonly activatedPlatformServices: ReadonlyArray<string>;
}

export type ScopedTenantService = Omit<TenantServiceRegistration, "apiKeyHash"> & {
  readonly source?: "tenant" | "platform" | "shared";
  readonly sharedServiceId?: string;
  readonly baseUrl?: string;
  readonly logoUrl?: string;
  readonly category?: string;
  readonly tags?: ReadonlyArray<string>;
};

export interface ScopedApp {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly title: string;
  readonly hostnames: ReadonlyArray<string>;
  readonly originOverrides: ReadonlyArray<string>;
  readonly refererOverrides: ReadonlyArray<string>;
  readonly themeId: string;
  readonly shell?: BetterPortalApp["shell"];
  readonly themeConfig: BetterPortalApp["themeConfig"];
  readonly defaultRoute: string;
  readonly routes: ReadonlyArray<BetterPortalApp["routes"][number]>;
  readonly menu: BetterPortalApp["menu"];
  readonly slots: BetterPortalApp["slots"];
  readonly fragments: BetterPortalApp["fragments"];
  readonly auth?: BetterPortalApp["auth"];
}

export interface ScopedConfigApp {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
}

// -- Platform config store interface ----------------------------------

export interface PlatformConfigStore {
  loadConfig(): Promise<BetterPortalConfig>;
  saveConfig(config: BetterPortalConfig): Promise<void>;

  validateApiKey(apiKey: string): Promise<{
    scope: "tenant" | "platform";
    serviceId: string | undefined;
    tenantId?: string;
    service: TenantServiceRegistration | PlatformService | SharedServiceDefinition;
  } | null>;

  getScopedConfig(serviceId: string, scope: "tenant" | "platform", tenantId?: string): Promise<ScopedServiceConfig>;

  invalidate(): void;

  onChange(listener: () => void): () => void;
}
