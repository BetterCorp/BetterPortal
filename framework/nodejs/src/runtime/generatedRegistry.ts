import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { BetterPortalRegistry } from "../contracts/registry.js";

export function assertManifestOnlyDefinition(definition: object): void {
  if ("registry" in definition) {
    throw new Error(
      "BPServiceDefinition.registry was removed. Delete the generated registry import and registry property; BetterPortal loads it automatically."
    );
  }
}

export async function loadGeneratedRegistry(pluginDir: string): Promise<BetterPortalRegistry> {
  const generatedDir = join(pluginDir, ".bp-generated");
  const file = ["registry.ts", "registry.js"]
    .map((name) => join(generatedDir, name))
    .find(existsSync);

  if (!file) {
    throw new Error(`Generated BetterPortal registry not found in ${generatedDir}. Run bp:gen or build the service.`);
  }

  const loaded = await import(pathToFileURL(file).href) as { registry?: unknown };
  const registry = loaded.registry;
  if (!registry || typeof registry !== "object" || !Array.isArray((registry as BetterPortalRegistry).routes)) {
    throw new Error(`Generated BetterPortal registry at ${file} does not export a valid registry.`);
  }
  return registry as BetterPortalRegistry;
}
