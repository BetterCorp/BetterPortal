import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { BpSchemaOutputSchema, type BpSchemaOutput } from "../contracts/manifest.js";
import type { BetterPortalRegistry } from "../contracts/registry.js";
import type { ManifestBaseFields } from "../runtime/registry.js";
import { buildBpSchema, buildManifestFromRegistry } from "../runtime/registry.js";
import { findPackageJson, readJsonFile, writeJsonFile } from "./project.js";

interface PackageJson {
  version: string;
  betterportal?: { routes?: string[]; definitions?: string[] };
}

interface BuildDefinition {
  manifest: ManifestBaseFields;
  registry: BetterPortalRegistry;
}

interface DefinitionProvider {
  getBPDefinition(): BuildDefinition;
}

function compiledPluginModule(packageDir: string, sourcePath: string, isRouteDir: boolean): string {
  const sourcePlugin = path.resolve(packageDir, sourcePath, ...(isRouteDir ? ["..", "index.ts"] : []));
  const relative = path.relative(packageDir, sourcePlugin);
  const parts = relative.split(path.sep);
  if (parts[0] !== "src") {
    throw new Error(`BetterPortal definition must be under src/: ${sourcePath}`);
  }
  parts[parts.length - 1] = parts.at(-1)?.replace(/\.tsx?$/, ".js") ?? "index.js";
  return path.join(packageDir, "lib", ...parts.slice(1));
}

export async function buildContracts(startDir = process.cwd()): Promise<Array<{ file: string; contract: BpSchemaOutput }>> {
  const packageJsonFile = findPackageJson(startDir);
  const packageDir = path.dirname(packageJsonFile);
  const pkg = readJsonFile<PackageJson>(packageJsonFile);
  const routeDirs = pkg.betterportal?.routes ?? [];
  const definitions = pkg.betterportal?.definitions ?? [];
  if (routeDirs.length === 0 && definitions.length === 0) {
    throw new Error("No betterportal.routes or betterportal.definitions are configured");
  }

  const modules = [...new Set([
    ...routeDirs.map((routeDir) => compiledPluginModule(packageDir, routeDir, true)),
    ...definitions.map((definition) => compiledPluginModule(packageDir, definition, false))
  ])];
  const outputs: Array<{ file: string; contract: BpSchemaOutput }> = [];
  for (const moduleFile of modules) {
    if (!fs.existsSync(moduleFile)) throw new Error(`Compiled BP plugin not found: ${moduleFile}`);
    const loaded = await import(`${pathToFileURL(moduleFile).href}?bp-contract=${Date.now()}`) as { Plugin?: DefinitionProvider };
    if (!loaded.Plugin || typeof loaded.Plugin.getBPDefinition !== "function") {
      throw new Error(`${moduleFile} does not export a BPService Plugin`);
    }
    const definition = loaded.Plugin.getBPDefinition();
    const manifest = buildManifestFromRegistry(definition.registry, { version: pkg.version }, definition.manifest);
    const contract = BpSchemaOutputSchema.parse(buildBpSchema(definition.registry, manifest));
    const file = path.join(packageDir, "lib", "bp-contracts", `${manifest.pluginId}.json`);
    writeJsonFile(file, contract);
    outputs.push({ file, contract });
  }
  return outputs;
}
