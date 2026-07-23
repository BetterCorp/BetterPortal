import * as fs from "node:fs";
import * as path from "node:path";
import type { BpSchemaOutput } from "../contracts/manifest.js";
import {
  contractDigest,
  findPackageJson,
  normalizeRegistryUrl,
  parseContract,
  parseDependencySelector,
  readContract,
  readJsonFile,
  readLock,
  readProjectConfig,
  registryRefParts,
  writeJsonFile,
  type BetterPortalProjectConfig,
  type DependencySelector,
  type LockedDependency
} from "./project.js";

interface PackageJson {
  workspaces?: string[];
  betterportal?: { routes?: string[] };
}

interface ContractCandidate {
  root: string;
  registryRef?: string;
  file: string;
  contract: BpSchemaOutput;
}

function repoRoot(start: string): string {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

function contractFiles(root: string): string[] {
  const direct = path.join(root, "bp-contract.json");
  const dir = path.join(root, "lib", "bp-contracts");
  return [
    ...(fs.existsSync(direct) ? [direct] : []),
    ...(fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => path.join(dir, name))
      : [])
  ];
}

function candidateFromRoot(root: string): ContractCandidate[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const config = readProjectConfig(root);
  const candidates: ContractCandidate[] = [];
  for (const file of contractFiles(root)) {
    try {
      candidates.push({ root, registryRef: config.registryRef, file, contract: readContract(file) });
    } catch {
      // A sibling with an invalid/stale contract is not a valid local override.
    }
  }
  return candidates;
}

function localRoots(packageDir: string, explicitPath?: string): string[] {
  if (explicitPath) return [path.resolve(packageDir, explicitPath)];
  const root = repoRoot(packageDir);
  const roots = new Set<string>();
  const rootPackageFile = path.join(root, "package.json");
  if (fs.existsSync(rootPackageFile)) {
    const rootPackage = readJsonFile<PackageJson>(rootPackageFile);
    for (const workspace of rootPackage.workspaces ?? []) {
      if (!workspace.includes("*")) roots.add(path.resolve(root, workspace));
    }
  }
  const nodeModules = path.join(packageDir, "node_modules");
  if (fs.existsSync(nodeModules)) roots.add(nodeModules);
  const parent = path.dirname(root);
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) roots.add(path.join(parent, entry.name));
  }
  for (const extra of (process.env.BP_DEV_PATHS ?? "").split(path.delimiter).filter(Boolean)) {
    roots.add(path.resolve(packageDir, extra));
  }
  return [...roots];
}

function nestedPackageRoots(root: string): string[] {
  if (path.basename(root) !== "node_modules") return [root];
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const first = path.join(root, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of fs.readdirSync(first, { withFileTypes: true })) {
        if (scoped.isDirectory()) result.push(path.join(first, scoped.name));
      }
    } else result.push(first);
  }
  return result;
}

function matches(candidate: ContractCandidate, selector: DependencySelector): boolean {
  if (selector.pluginId && candidate.contract.manifest.pluginId !== selector.pluginId) return false;
  if (selector.registryRef && candidate.registryRef !== selector.registryRef) return false;
  if (selector.shortName) {
    const refName = candidate.registryRef?.split("/")[1];
    const idName = candidate.contract.manifest.pluginId.split(".").at(-1);
    if (selector.shortName !== refName && selector.shortName !== idName) return false;
  }
  return true;
}

function findLocal(packageDir: string, selector: DependencySelector, explicitPath?: string): ContractCandidate | null {
  const found = localRoots(packageDir, explicitPath)
    .flatMap(nestedPackageRoots)
    .flatMap(candidateFromRoot)
    .filter((candidate) => matches(candidate, selector));
  const identities = new Set(found.map((candidate) => `${candidate.registryRef ?? ""}|${candidate.contract.manifest.pluginId}`));
  if (identities.size > 1) {
    throw new Error(`Local dependency selector "${selector.raw}" is ambiguous: ${found.map((item) => item.root).join(", ")}`);
  }
  return found[0] ?? null;
}

async function fetchRegistry(selector: DependencySelector): Promise<{ registryRef: string; contract: BpSchemaOutput }> {
  const base = normalizeRegistryUrl();
  const version = encodeURIComponent(selector.version ?? "latest");
  let url: string;
  if (selector.registryRef) {
    const [namespace, name] = registryRefParts(selector.registryRef);
    url = `${base}/v1/packages/${namespace}/${name}/${version}/schema.json`;
  } else if (selector.pluginId) {
    url = `${base}/v1/plugin-ids/${encodeURIComponent(selector.pluginId)}/${version}/schema.json`;
  } else {
    url = `${base}/v1/packages?name=${encodeURIComponent(selector.shortName ?? "")}`;
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Registry lookup failed (${response.status}): ${selector.raw}`);
  const body = await response.json() as unknown;
  if (!selector.registryRef && !selector.pluginId) {
    const matches = body as Array<{ registryRef: string; contract: unknown }>;
    if (matches.length !== 1) throw new Error(`Registry selector "${selector.raw}" matched ${matches.length} packages; use the full reference`);
    return { registryRef: matches[0].registryRef, contract: parseContract(matches[0].contract) };
  }
  const contract = parseContract(body);
  const registryRef = selector.registryRef ?? String(response.headers.get("BP-Registry-Ref") ?? "");
  if (!registryRef) throw new Error(`Registry did not return a package reference for ${selector.raw}`);
  return { registryRef, contract };
}

function schemaType(document: unknown): string {
  if (!document || typeof document !== "object" || Object.keys(document as object).length === 0) return "unknown";
  const value = document as Record<string, unknown>;
  return nodeType((value.root ?? value) as unknown);
}

function nodeType(input: unknown): string {
  if (!input || typeof input !== "object") return "unknown";
  const node = input as Record<string, unknown>;
  switch (node.kind) {
    case "string": return "string";
    case "int":
    case "number": return "number";
    case "bool": return "boolean";
    case "literal": return JSON.stringify(node.value);
    case "enum": return Array.isArray(node.values) ? node.values.map((value) => JSON.stringify(value)).join(" | ") || "never" : "unknown";
    case "array": return `Array<${nodeType(node.items)}>`;
    case "record": return `Record<string, ${nodeType(node.valueSchema)}>`;
    case "optional": return `${nodeType(node.inner)} | undefined`;
    case "nullable": return `${nodeType(node.inner)} | null`;
    case "union": return Array.isArray(node.options) ? node.options.map(nodeType).join(" | ") : "unknown";
    case "object": {
      const properties = (node.properties ?? {}) as Record<string, unknown>;
      const required = new Set(Array.isArray(node.required) ? node.required.map(String) : []);
      const fields = Object.entries(properties).map(([name, child]) => {
        const optional = required.has(name) ? "" : "?";
        return `${JSON.stringify(name)}${optional}: ${nodeType(child)}`;
      });
      return `{ ${fields.join("; ")} }`;
    }
    default: return "unknown";
  }
}

function safeName(value: string): string {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
  return /^[0-9]/.test(joined) ? `V${joined}` : joined || "View";
}

export function emitTypeScriptClient(alias: string, contract: BpSchemaOutput): string {
  const lines = [
    "// AUTO-GENERATED by BetterPortal - DO NOT EDIT",
    "export interface BPClientRuntime {",
    "  baseUrl: string;",
    "  token?: string | (() => string | Promise<string>);",
    "  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);",
    "  fetch?: typeof globalThis.fetch;",
    "}",
    "",
    "async function bpRequest<T>(runtime: BPClientRuntime, method: string, route: string, input: { params?: Record<string, unknown>; query?: Record<string, unknown>; headers?: Record<string, string>; body?: unknown } = {}): Promise<T> {",
    "  let pathname = route.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_match, name: string) => {",
    "    const value = input.params?.[name];",
    "    if (value === undefined || value === null) throw new Error(`Missing route parameter: ${name}`);",
    "    return encodeURIComponent(String(value));",
    "  });",
    "  const url = new URL(pathname, runtime.baseUrl.endsWith('/') ? runtime.baseUrl : runtime.baseUrl + '/');",
    "  for (const [name, value] of Object.entries(input.query ?? {})) {",
    "    if (value === undefined || value === null) continue;",
    "    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(name, String(item));",
    "  }",
    "  const token = typeof runtime.token === 'function' ? await runtime.token() : runtime.token;",
    "  const runtimeHeaders = typeof runtime.headers === 'function' ? await runtime.headers() : runtime.headers;",
    "  const response = await (runtime.fetch ?? globalThis.fetch)(url, {",
    "    method,",
    "    headers: { Accept: 'application/json', ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(runtimeHeaders ?? {}), ...(input.headers ?? {}) },",
    "    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })",
    "  });",
    "  if (!response.ok) throw new Error(`BetterPortal request failed: ${response.status}`);",
    "  return await response.json() as T;",
    "}",
    ""
  ];
  for (const view of contract.manifest.views) {
    for (const method of view.methods) {
      const name = `${safeName(alias)}${safeName(view.viewId)}${safeName(method.toLowerCase())}`;
      lines.push(`export interface ${name}Input {`);
      lines.push(`  params?: ${schemaType(view.paramsSchema)};`);
      lines.push(`  query?: ${schemaType(view.querySchema)};`);
      lines.push(`  headers?: ${schemaType(view.headersSchema)};`);
      lines.push(`  body?: ${schemaType(view.bodySchema)};`);
      lines.push("}");
      lines.push(`export type ${name}Response = ${schemaType(view.jsonResponseSchema)};`);
      lines.push(`export const ${name[0].toLowerCase() + name.slice(1)} = (runtime: BPClientRuntime, input: ${name}Input = {}) =>`);
      lines.push(`  bpRequest<${name}Response>(runtime, ${JSON.stringify(method)}, ${JSON.stringify(view.path)}, input as Parameters<typeof bpRequest>[3]);`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function generatedClientDir(packageDir: string): string {
  const pkg = readJsonFile<PackageJson>(path.join(packageDir, "package.json"));
  const firstRoute = pkg.betterportal?.routes?.[0];
  return firstRoute
    ? path.join(path.resolve(packageDir, firstRoute, ".."), ".bp-generated", "clients")
    : path.join(packageDir, "src", ".bp-generated", "clients");
}

function assertAlias(alias: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(alias)) throw new Error(`Invalid BetterPortal dependency alias: ${alias}`);
}

function writeClient(packageDir: string, alias: string, contract: BpSchemaOutput): string {
  assertAlias(alias);
  const file = path.join(generatedClientDir(packageDir), `${alias}.ts`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = emitTypeScriptClient(alias, contract);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) fs.writeFileSync(file, content, "utf8");
  return file;
}

function cacheContract(packageDir: string, contract: BpSchemaOutput): string {
  const file = path.join(packageDir, ".betterportal", "contracts", contract.manifest.pluginId, `${contract.manifest.version}.json`);
  writeJsonFile(file, contract);
  return file;
}

export async function installClient(rawSelector: string, options: { alias?: string; path?: string } = {}): Promise<LockedDependency> {
  const packageJsonFile = findPackageJson();
  const packageDir = path.dirname(packageJsonFile);
  const config = readProjectConfig(packageDir);
  const selector = parseDependencySelector(rawSelector, config.defaultNamespace);
  const local = findLocal(packageDir, selector, options.path);
  const resolved = local
    ? { registryRef: local.registryRef ?? selector.registryRef ?? "", contract: local.contract }
    : await fetchRegistry(selector);
  if (!resolved.registryRef) throw new Error(`Local contract ${resolved.contract.manifest.pluginId} has no registryRef`);

  const alias = options.alias ?? selector.shortName ?? resolved.registryRef.split("/")[1];
  assertAlias(alias);
  const locked: LockedDependency = {
    registryRef: resolved.registryRef,
    pluginId: resolved.contract.manifest.pluginId,
    version: resolved.contract.manifest.version,
    digest: contractDigest(resolved.contract)
  };
  const nextConfig: BetterPortalProjectConfig = {
    ...config,
    dependencies: { ...(config.dependencies ?? {}), [alias]: `${locked.registryRef}@${selector.version ?? locked.version}` }
  };
  writeJsonFile(path.join(packageDir, "betterportal.json"), nextConfig);
  const lock = readLock(packageDir);
  lock.dependencies[alias] = locked;
  writeJsonFile(path.join(packageDir, "betterportal.lock.json"), lock);
  cacheContract(packageDir, resolved.contract);
  writeClient(packageDir, alias, resolved.contract);
  if (local) {
    const localLockFile = path.join(packageDir, ".betterportal", "local-lock.json");
    const localLock = fs.existsSync(localLockFile) ? readJsonFile<Record<string, unknown>>(localLockFile) : {};
    localLock[alias] = { path: path.relative(packageDir, local.root), ...locked };
    writeJsonFile(localLockFile, localLock);
  }
  return locked;
}

export async function syncClients(options: { registryOnly?: boolean; frozen?: boolean } = {}): Promise<string[]> {
  const packageDir = path.dirname(findPackageJson());
  const config = readProjectConfig(packageDir);
  const lock = readLock(packageDir);
  const localLockFile = path.join(packageDir, ".betterportal", "local-lock.json");
  const localLock = fs.existsSync(localLockFile)
    ? readJsonFile<Record<string, { path?: string }>>(localLockFile)
    : {};
  const outputs: string[] = [];
  for (const [alias, rawSelector] of Object.entries(config.dependencies ?? {})) {
    const selector = parseDependencySelector(rawSelector, config.defaultNamespace);
    const preferredPath = localLock[alias]?.path;
    const local = options.registryOnly
      ? null
      : findLocal(packageDir, selector, preferredPath) ?? (preferredPath ? findLocal(packageDir, selector) : null);
    let contract: BpSchemaOutput;
    if (local) contract = local.contract;
    else {
      const locked = lock.dependencies[alias];
      const cached = locked && path.join(packageDir, ".betterportal", "contracts", locked.pluginId, `${locked.version}.json`);
      if (cached && fs.existsSync(cached)) contract = readContract(cached);
      else {
        if (options.frozen) throw new Error(`Frozen dependency is not cached: ${alias}`);
        contract = (await fetchRegistry(selector)).contract;
        cacheContract(packageDir, contract);
      }
    }
    const digest = contractDigest(contract);
    if (options.frozen && lock.dependencies[alias]?.digest !== digest) throw new Error(`Frozen dependency changed: ${alias}`);
    outputs.push(writeClient(packageDir, alias, contract));
  }
  return outputs;
}
