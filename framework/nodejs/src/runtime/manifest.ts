import { PluginManifest, PluginManifestSchema } from "../contracts/manifest.js";

export function createPluginManifest(manifest: PluginManifest): PluginManifest {
  return PluginManifestSchema.parse(manifest);
}
