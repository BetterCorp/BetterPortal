import { PluginManifestSchema, type PluginManifest } from "../contracts/manifest.js";

export function createPluginManifest(manifest: Parameters<typeof PluginManifestSchema.parse>[0]): PluginManifest {
  return PluginManifestSchema.parse(manifest);
}
