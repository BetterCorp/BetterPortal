import { BindingRecord } from "../contracts/binding.js";
import { PluginManifest, PluginManifestSchema } from "../contracts/manifest.js";
import { BetterPortalControlPlaneStore } from "./store.js";
import { ImportedManifestRecord } from "./types.js";

export type ManifestProvider = (binding: BindingRecord) => Promise<PluginManifest>;

export async function importBindingManifest(
  store: BetterPortalControlPlaneStore,
  bindingId: string,
  provider: ManifestProvider
): Promise<ImportedManifestRecord> {
  const binding = store.getBinding(bindingId);
  if (!binding) {
    throw new Error(`Binding ${bindingId} does not exist`);
  }

  const manifest = PluginManifestSchema.parse(await provider(binding));
  const updatedBinding: BindingRecord = {
    ...binding,
    importedManifestVersion: manifest.version,
    lastSyncAtIso: new Date().toISOString()
  };

  store.upsertBinding(updatedBinding);
  return store.recordImportedManifest(bindingId, manifest);
}

export async function syncAllBindingManifests(
  store: BetterPortalControlPlaneStore,
  provider: ManifestProvider
): Promise<ImportedManifestRecord[]> {
  const snapshot = store.getSnapshot();
  const results: ImportedManifestRecord[] = [];

  for (const binding of snapshot.bindings) {
    results.push(await importBindingManifest(store, binding.bindingId, provider));
  }

  return results;
}
