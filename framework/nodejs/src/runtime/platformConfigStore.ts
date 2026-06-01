import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, watchFile, unwatchFile } from "node:fs";
import { resolve } from "node:path";
import * as yaml from "yaml";
import {
  BetterPortalConfigSchema,
  type BetterPortalConfig,
  type TenantServiceRegistration,
  type PlatformService
} from "../contracts/platformConfig.js";
import type {
  PlatformConfigStore,
  ScopedServiceConfig,
  ScopedTenant,
  ScopedApp
} from "../contracts/controlPlane.js";

// ── API key helpers ──────────────────────────────────────────────────

export function generateApiKey(): string {
  return `bp_sk_${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

// ── File-backed implementation ───────────────────────────────────────

export class FileBackedPlatformConfigStore implements PlatformConfigStore {
  private readonly configPath: string;
  private cachedConfig: BetterPortalConfig | null = null;
  private listeners: Set<() => void> = new Set();
  private watching = false;

  constructor(configPath: string) {
    this.configPath = resolve(configPath);
  }

  async loadConfig(): Promise<BetterPortalConfig> {
    if (this.cachedConfig) return this.cachedConfig;
    const raw = existsSync(this.configPath)
      ? readFileSync(this.configPath, "utf8")
      : "platformServices: []\ntenants: []\napps: []";
    this.cachedConfig = BetterPortalConfigSchema.parse(yaml.parse(raw));
    this.startWatching();
    return this.cachedConfig;
  }

  async saveConfig(config: BetterPortalConfig): Promise<void> {
    const validated = BetterPortalConfigSchema.parse(config);
    const yamlStr = yaml.stringify(validated, { indent: 2, lineWidth: 120 });
    writeFileSync(this.configPath, yamlStr, "utf8");
    this.cachedConfig = validated;
    this.notifyListeners();
  }

  // ── API key validation ─────────────────────────────────────────────

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

  // ── Scoped config ──────────────────────────────────────────────────

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
      id: tenant.id, slug: tenant.slug, title: tenant.title,
      active: tenant.active, branding: tenant.branding
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
        id: tenant.id, slug: tenant.slug, title: tenant.title,
        active: tenant.active, branding: tenant.branding
      });

      const tenantApps = config.apps
        .filter((a) => a.tenantId === tenant.id)
        .map((a) => this.scopeApp(a, serviceId))
        .filter((a) => a.routes.length > 0 || Object.keys(a.fragments).length > 0);

      apps.push(...tenantApps);
    }

    return { tenants, apps };
  }

  private scopeApp(app: typeof BetterPortalConfigSchema extends { _output: infer T } ? T extends { apps: (infer A)[] } ? A : never : never, serviceId: string): ScopedApp {
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

  // ── Change notification ────────────────────────────────────────────

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore */ }
    }
  }

  private startWatching(): void {
    if (this.watching) return;
    this.watching = true;
    watchFile(this.configPath, { interval: 2000 }, () => {
      this.cachedConfig = null;
      this.notifyListeners();
    });
  }

  dispose(): void {
    if (this.watching) {
      unwatchFile(this.configPath);
      this.watching = false;
    }
    this.listeners.clear();
  }
}
