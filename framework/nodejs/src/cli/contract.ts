import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";
import { BpSchemaOutputSchema, type BpSchemaOutput } from "../contracts/manifest.js";
import type { ManifestBaseFields } from "../runtime/registry.js";
import { buildBpSchema, buildManifestFromRegistry } from "../runtime/registry.js";
import { assertManifestOnlyDefinition, loadGeneratedRegistry } from "../runtime/generatedRegistry.js";
import { findPackageJson, readJsonFile, writeJsonFile } from "./project.js";

interface PackageJson {
  version: string;
  betterportal?: { routes?: string[]; definitions?: string[] };
}

interface BuildDefinition {
  manifest: ManifestBaseFields;
}

interface DefinitionProvider {
  getBPDefinition(): BuildDefinition;
}

interface CompiledPluginModule {
  moduleFile: string;
  sourcePluginDir: string;
}

function compiledPluginModule(packageDir: string, sourcePath: string, isRouteDir: boolean): CompiledPluginModule {
  const sourcePlugin = path.resolve(packageDir, sourcePath, ...(isRouteDir ? ["..", "index.ts"] : []));
  const relative = path.relative(packageDir, sourcePlugin);
  const parts = relative.split(path.sep);
  if (parts[0] !== "src") {
    throw new Error(`BetterPortal definition must be under src/: ${sourcePath}`);
  }
  parts[parts.length - 1] = parts.at(-1)?.replace(/\.tsx?$/, ".js") ?? "index.js";
  return {
    moduleFile: path.join(packageDir, "lib", ...parts.slice(1)),
    sourcePluginDir: path.dirname(sourcePlugin)
  };
}

function compileGeneratedRegistry(sourcePluginDir: string, compiledPluginDir: string): void {
  const sourceFile = path.join(sourcePluginDir, ".bp-generated", "registry.ts");
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Generated BetterPortal registry not found in ${path.dirname(sourceFile)}. Run bp:gen or build the service.`);
  }
  const tsconfig = ts.findConfigFile(sourcePluginDir, ts.sys.fileExists, "tsconfig.json");
  if (!tsconfig) throw new Error(`No tsconfig.json found for generated BetterPortal registry ${sourceFile}`);
  const read = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (read.error) {
    throw new Error(ts.formatDiagnostic(read.error, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine
    }));
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfig));
  const program = ts.createProgram({ rootNames: [sourceFile], options: parsed.options });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length > 0) {
    throw new Error(`Generated BetterPortal registry failed type checking:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine
    })}`);
  }
  if (!program.getSourceFile(sourceFile) || program.emit().emitSkipped) {
    throw new Error(`Failed to compile generated BetterPortal registry ${sourceFile}`);
  }
  const outputFile = path.join(compiledPluginDir, ".bp-generated", "registry.js");
  if (!fs.existsSync(outputFile)) throw new Error(`Compiled BetterPortal registry was not emitted to ${outputFile}`);
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

  const modules = new Map([
    ...routeDirs.map((routeDir) => compiledPluginModule(packageDir, routeDir, true)),
    ...definitions.map((definition) => compiledPluginModule(packageDir, definition, false))
  ].map((module) => [module.moduleFile, module]));
  const outputs: Array<{ file: string; contract: BpSchemaOutput }> = [];
  for (const { moduleFile, sourcePluginDir } of modules.values()) {
    if (!fs.existsSync(moduleFile)) throw new Error(`Compiled BP plugin not found: ${moduleFile}`);
    const loaded = await import(`${pathToFileURL(moduleFile).href}?bp-contract=${Date.now()}`) as { Plugin?: DefinitionProvider };
    if (!loaded.Plugin || typeof loaded.Plugin.getBPDefinition !== "function") {
      throw new Error(`${moduleFile} does not export a BPService Plugin`);
    }
    const definition = loaded.Plugin.getBPDefinition();
    assertManifestOnlyDefinition(definition);
    compileGeneratedRegistry(sourcePluginDir, path.dirname(moduleFile));
    const registry = await loadGeneratedRegistry(path.dirname(moduleFile));
    const manifest = buildManifestFromRegistry(registry, { version: pkg.version }, definition.manifest);
    const contract = BpSchemaOutputSchema.parse(buildBpSchema(registry, manifest));
    const file = path.join(packageDir, "lib", "bp-contracts", `${manifest.pluginId}.json`);
    writeJsonFile(file, contract);
    outputs.push({ file, contract });
  }
  return outputs;
}
