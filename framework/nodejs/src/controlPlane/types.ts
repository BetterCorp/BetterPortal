import { App, BindingRecord, ServiceCatalogEntry, Tenant } from "../contracts/binding";
import { PluginManifest } from "../contracts/manifest";

export interface ImportedManifestRecord {
  bindingId: string;
  manifest: PluginManifest;
  importedAtIso: string;
}

export interface ControlPlaneSnapshot {
  catalog: ReadonlyArray<ServiceCatalogEntry>;
  tenants: ReadonlyArray<Tenant>;
  apps: ReadonlyArray<App>;
  bindings: ReadonlyArray<BindingRecord>;
  importedManifests: ReadonlyArray<ImportedManifestRecord>;
}
