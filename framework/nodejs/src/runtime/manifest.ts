import { PluginManifestSchema, type PluginManifest } from "../contracts/manifest.js";

export function createPluginManifest(manifest: Parameters<typeof PluginManifestSchema.parse>[0]): PluginManifest {
  return PluginManifestSchema.parse(
    manifest && typeof manifest === "object" && !Array.isArray(manifest)
      ? { protocolVersion: 2, ...manifest }
      : manifest
  );
}
