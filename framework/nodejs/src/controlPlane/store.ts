import {
  App,
  AppSchema,
  BindingRecord,
  BindingRecordSchema,
  ServiceCatalogEntry,
  ServiceCatalogEntrySchema,
  Tenant,
  TenantSchema
} from "../contracts/binding";
import { PluginManifest, PluginManifestSchema } from "../contracts/manifest";
import { ImportedManifestRecord, ControlPlaneSnapshot } from "./types";

export class BetterPortalControlPlaneStore {
  private readonly catalog = new Map<string, ServiceCatalogEntry>();
  private readonly tenants = new Map<string, Tenant>();
  private readonly apps = new Map<string, App>();
  private readonly bindings = new Map<string, BindingRecord>();
  private readonly manifests = new Map<string, ImportedManifestRecord>();

  public registerCatalogEntry(entry: ServiceCatalogEntry): ServiceCatalogEntry {
    const parsed = ServiceCatalogEntrySchema.parse(entry);
    this.catalog.set(parsed.serviceId, parsed);
    return parsed;
  }

  public upsertTenant(tenant: Tenant): Tenant {
    const parsed = TenantSchema.parse(tenant);
    this.tenants.set(parsed.id, parsed);
    return parsed;
  }

  public upsertApp(app: App): App {
    const parsed = AppSchema.parse(app);
    this.apps.set(parsed.id, parsed);
    return parsed;
  }

  public upsertBinding(binding: BindingRecord): BindingRecord {
    const parsed = BindingRecordSchema.parse(binding);
    this.bindings.set(parsed.bindingId, parsed);
    return parsed;
  }

  public recordImportedManifest(bindingId: string, manifest: PluginManifest): ImportedManifestRecord {
    const parsedManifest = PluginManifestSchema.parse(manifest);
    const record: ImportedManifestRecord = {
      bindingId,
      manifest: parsedManifest,
      importedAtIso: new Date().toISOString()
    };
    this.manifests.set(bindingId, record);
    return record;
  }

  public getCatalogEntry(serviceId: string): ServiceCatalogEntry | null {
    return this.catalog.get(serviceId) ?? null;
  }

  public getTenant(tenantId: string): Tenant | null {
    return this.tenants.get(tenantId) ?? null;
  }

  public getApp(appId: string): App | null {
    return this.apps.get(appId) ?? null;
  }

  public getBinding(bindingId: string): BindingRecord | null {
    return this.bindings.get(bindingId) ?? null;
  }

  public getImportedManifest(bindingId: string): ImportedManifestRecord | null {
    return this.manifests.get(bindingId) ?? null;
  }

  public getAppsForTenant(tenantId: string): App[] {
    return [...this.apps.values()].filter((app) => app.tenantId === tenantId);
  }

  public getBindingsForTenant(tenantId: string): BindingRecord[] {
    return [...this.bindings.values()].filter((binding) => binding.tenantId === tenantId);
  }

  public getSnapshot(): ControlPlaneSnapshot {
    return {
      catalog: [...this.catalog.values()],
      tenants: [...this.tenants.values()],
      apps: [...this.apps.values()],
      bindings: [...this.bindings.values()],
      importedManifests: [...this.manifests.values()]
    };
  }
}
