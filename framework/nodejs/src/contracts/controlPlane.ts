import type {
  BetterPortalApp,
  BetterPortalConfig,
  BetterPortalResolvedShell,
  BetterPortalTenant,
  M2MBinding,
  M2MGrant,
  TenantServiceRegistration,
  PlatformService,
  SharedServiceDefinition
} from "./platformConfig.js";

// -- Scoped config (what a service receives via sync) -----------------

export interface ScopedServiceConfig {
  /** The installed service identity authenticated by the control-plane API key. */
  readonly serviceIdentity?: ScopedServiceIdentity;
  /** Last-known-good S2S policy relevant to this service, filtered by the control plane. */
  readonly m2m?: ScopedM2MConfig;
  readonly configManagement?: {
    readonly adminTenantId?: string;
    readonly managementAppId?: string;
    /** Minimal admin tenant/app context used by authenticated /.well-known/bp routes. */
    readonly context?: {
      readonly tenant: ScopedTenant;
      readonly app: ScopedApp;
    };
  };
  readonly managementOrigins: ReadonlyArray<string>;
  readonly tenants: ReadonlyArray<ScopedTenant>;
  /** Apps whose service config may be managed for this service. This can be broader than runtime apps. */
  readonly configApps?: ReadonlyArray<ScopedConfigApp>;
  readonly apps: ReadonlyArray<ScopedApp>;
}

export interface ScopedServiceIdentity {
  readonly id: string;
  readonly publicKeyPem?: string;
  readonly keyId?: string;
}

export interface ScopedM2MService {
  /** Concrete tenant/app service id used by a binding and JWT iss/aud. */
  readonly id: string;
  readonly serviceId?: string;
  readonly hostname: string;
  readonly publicKeyPem?: string;
  readonly keyId?: string;
}

export interface ScopedM2MConfig {
  /** All concrete ids that resolve to this running service (including shared activations). */
  readonly localServiceIds: ReadonlyArray<string>;
  readonly services: ReadonlyArray<ScopedM2MService>;
  readonly bindings: ReadonlyArray<M2MBinding>;
  readonly grants: ReadonlyArray<M2MGrant>;
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
  readonly shell?: BetterPortalResolvedShell;
  readonly themeConfig: BetterPortalApp["themeConfig"];
  readonly defaultRoute: string;
  readonly seo?: BetterPortalApp["seo"];
  readonly routes: ReadonlyArray<BetterPortalApp["routes"][number]>;
  /** Full application route index for cross-service URL resolution. Never used as this service's inbound allowlist. */
  readonly appRoutes?: ReadonlyArray<BetterPortalApp["routes"][number]>;
  readonly menu: BetterPortalApp["menu"];
  readonly slots: BetterPortalApp["slots"];
  readonly fragments: BetterPortalApp["fragments"];
  /** Full application fragment index for cross-service fragment resolution. */
  readonly appFragments?: BetterPortalApp["fragments"];
  readonly shellFragments: BetterPortalApp["shellFragments"];
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
  saveConfig(config: BetterPortalConfig, options?: { notify?: boolean }): Promise<void>;

  validateApiKey(apiKey: string): Promise<{
    scope: "tenant" | "platform";
    serviceId: string | undefined;
    tenantId?: string;
    service: TenantServiceRegistration | PlatformService | SharedServiceDefinition;
  } | null>;

  getScopedConfig(serviceId: string, scope: "tenant" | "platform", tenantId?: string): Promise<ScopedServiceConfig>;

  registerServicePublicKey(
    serviceId: string,
    scope: "tenant" | "platform",
    tenantId: string | undefined,
    publicKeyPem: string,
    keyId: string
  ): Promise<"registered" | "matched" | "mismatch" | "not-found">;

  invalidate(): void;

  onChange(listener: () => void): () => void;
}
