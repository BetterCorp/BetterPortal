#!/usr/bin/env node

import * as path from "node:path";
import { readFileSync } from "node:fs";
import { checkConfiguredRouteUrls } from "../codegen/routeUrlPolicy.js";
import { buildContracts } from "./contract.js";
import { installClient, syncClients } from "./client.js";
import { findPackageJson, normalizeRegistryUrl, readJsonFile } from "./project.js";
import { publishContracts } from "./publish.js";

const usage = `BetterPortal CLI

  bp setup
  bp run check-routes
  bp run gen
  bp run types [--registry-only] [--frozen] [--registry URL] [--dev-paths PATHS]
  bp run contract
  bp client install <id|namespace/name> [--path PATH] [--as ALIAS] [--registry URL] [--dev-paths PATHS]
  bp client sync [--registry-only] [--frozen] [--registry URL] [--dev-paths PATHS]
  bp publish [contract-file-or-directory] --token-file FILE [--registry URL]`;

function parseOptions(args: string[], valueNames: string[] = [], flagNames: string[] = []) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (values.has(name) || flags.has(name)) throw new Error(`Duplicate option ${name}`);
    if (flagNames.includes(name)) flags.add(name);
    else if (valueNames.includes(name)) {
      const value = args[++index];
      if (!value || value.startsWith("-")) throw new Error(`Missing value for ${name}`);
      values.set(name, value);
    } else throw new Error(name.startsWith("--") ? `Unsupported option ${name.split("=")[0]}` : "Unexpected CLI argument");
  }
  return { values, flags };
}

function lookupOptions(options: ReturnType<typeof parseOptions>) {
  return {
    registryUrl: options.values.get("--registry"),
    devPaths: options.values.get("--dev-paths")?.split(path.delimiter).filter(Boolean)
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, subcommand] = args;
  if (!command || args.includes("--help") || args.includes("-h")) { console.log(usage); return; }
  if (command === "setup") { await import("../codegen/init.js"); return; }
  if (command === "run" && subcommand === "check-routes") {
    parseOptions(args.slice(2));
    const packagePath = findPackageJson();
    const packageDir = path.dirname(packagePath);
    const pkg = readJsonFile<{ betterportal?: { routes?: string[]; shells?: string[] } }>(packagePath);
    const errors = checkConfiguredRouteUrls(packageDir, pkg.betterportal);
    for (const error of errors) console.error(`[bp] ERROR: ${error.file}: ${error.message}`);
    if (errors.length) process.exitCode = 1;
    return;
  }
  if (command === "run" && subcommand === "gen") {
    const pkg = readJsonFile<{ betterportal?: { routes?: string[]; shells?: string[] } }>(findPackageJson());
    if ((pkg.betterportal?.routes?.length ?? 0) === 0 && (pkg.betterportal?.shells?.length ?? 0) === 0) {
      console.log("[bp] No betterportal.routes or betterportal.shells configured; generation skipped.");
      return;
    }
    await import("../codegen/cli.js");
    return;
  }
  if (command === "run" && subcommand === "contract") {
    parseOptions(args.slice(2));
    for (const output of await buildContracts()) console.log(`[bp] Generated ${output.file}`);
    return;
  }
  if ((command === "run" && subcommand === "types") ||
    (command === "client" && (subcommand === "sync" || subcommand === "types"))) {
    const options = parseOptions(args.slice(2), ["--registry", "--dev-paths"], ["--registry-only", "--frozen"]);
    const outputs = await syncClients({ ...lookupOptions(options),
      registryOnly: options.flags.has("--registry-only"), frozen: options.flags.has("--frozen") });
    console.log(`[bp] Synced ${outputs.length} client type file(s).`);
    return;
  }
  if (command === "client" && subcommand === "install") {
    const selector = args[2];
    if (!selector || selector.startsWith("-")) throw new Error("A dependency selector is required");
    const options = parseOptions(args.slice(3), ["--path", "--as", "--registry", "--dev-paths"]);
    if (options.values.has("--path") && options.values.has("--registry")) throw new Error("Select --path or --registry");
    const installed = await installClient(selector, { ...lookupOptions(options),
      path: options.values.get("--path"), alias: options.values.get("--as") });
    console.log(`[bp] Installed ${installed.registryRef}@${installed.version} (${installed.pluginId})`);
    return;
  }
  if (command === "publish") {
    const input = args[1] && !args[1].startsWith("-") ? args[1] : undefined;
    const options = parseOptions(args.slice(input ? 2 : 1), ["--registry", "--token-file"]);
    const tokenFile = options.values.get("--token-file");
    if (!tokenFile) throw new Error("--token-file is required");
    const registryUrl = normalizeRegistryUrl(options.values.get("--registry"));
    const published = await publishContracts(input, { registryUrl, token: readFileSync(tokenFile, "utf8").trim() });
    for (const item of published) console.log(`[bp] Published ${item}`);
    return;
  }
  throw new Error("Unknown command; run bp --help");
}

main().catch((error: unknown) => {
  console.error(`[bp] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
