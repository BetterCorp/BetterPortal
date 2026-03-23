import { PluginManifest, PluginManifestSchema } from "../contracts/manifest";

export function createPluginManifest(manifest: PluginManifest): PluginManifest {
  return PluginManifestSchema.parse(manifest);
}
