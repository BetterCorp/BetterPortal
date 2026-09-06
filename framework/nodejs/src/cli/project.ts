import * as fs from "node:fs";
import * as path from "node:path";
import { BpSchemaOutputSchema, type BpSchemaOutput } from "../contracts/manifest.js";
export { canonicalJson, contractDigest } from "../runtime/contract.js";
import type { BetterPortalProjectConfig, BetterPortalLock } from "../contracts/project.js";
import { RegistryReferenceSchema } from "../contracts/project.js";
export type { BetterPortalProjectConfig, BetterPortalLock, LockedDependency } from "../contracts/project.js";

export const DEFAULT_REGISTRY_URL = "https://io.betterportal.org";

export function findPackageJson(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("No package.json found");
    dir = parent;
  }
}

export function readJsonFile<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJsonFile(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === next) return;
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, next, "utf8");
  fs.renameSync(temp, file);
}

export function readProjectConfig(packageDir: string): BetterPortalProjectConfig {
  const file = path.join(packageDir, "betterportal.json");
  return fs.existsSync(file) ? readJsonFile<BetterPortalProjectConfig>(file) : {};
}

export function readLock(packageDir: string): BetterPortalLock {
  const file = path.join(packageDir, "betterportal.lock.json");
  return fs.existsSync(file) ? readJsonFile<BetterPortalLock>(file) : { dependencies: {} };
}

export function parseContract(value: unknown): BpSchemaOutput {
  return BpSchemaOutputSchema.parse(value);
}

export function readContract(file: string): BpSchemaOutput {
  return parseContract(readJsonFile(file));
}

export function normalizeRegistryUrl(value = process.env.BP_REGISTRY_URL ?? DEFAULT_REGISTRY_URL): string {
  return value.replace(/\/+$/, "");
}

export interface DependencySelector {
  raw: string;
  registryRef?: string;
  pluginId?: string;
  shortName?: string;
  version?: string;
}

export function parseDependencySelector(rawInput: string, defaultNamespace?: string): DependencySelector {
  const raw = rawInput.trim();
  if (!raw) throw new Error("Dependency selector is required");

  const at = raw.lastIndexOf("@");
  const id = at > 0 ? raw.slice(0, at) : raw;
  const version = at > 0 ? raw.slice(at + 1) : undefined;
  if (id.includes("/")) return { raw, registryRef: id, version };
  if (id.includes(".")) return { raw, pluginId: id, version };
  if (defaultNamespace) return { raw, registryRef: `${defaultNamespace}/${id}`, shortName: id, version };
  return { raw, shortName: id, version };
}

export function registryRefParts(registryRef: string): [string, string] {
  const parts = registryRef.split("/");
  if (!RegistryReferenceSchema.safeParse(registryRef).success) {
    throw new Error(`Invalid BetterPortal registry reference: ${registryRef}`);
  }
  return [parts[0], parts[1]];
}
