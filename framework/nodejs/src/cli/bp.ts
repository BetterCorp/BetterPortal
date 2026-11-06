#!/usr/bin/env node

import * as path from "node:path";
import { readFileSync } from "node:fs";
import { checkConfiguredRouteUrls } from "../codegen/routeUrlPolicy.js";
import { buildContracts } from "./contract.js";
import { installClient, syncClients } from "./client.js";
import { findPackageJson, readJsonFile } from "./project.js";
import { publishContracts } from "./publish.js";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, subcommand] = args;
  const registryUrl = option(args, "--registry");
  const devPaths = option(args, "--dev-paths")?.split(path.delimiter).filter(Boolean);

  if (command === "setup") {
    await import("../codegen/init.js");
    return;
  }
  if (command === "run" && subcommand === "check-routes") {
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
  if (command === "run" && subcommand === "types") {
    const outputs = await syncClients({
      registryUrl, devPaths, registryOnly: args.includes("--registry-only"),
      frozen: args.includes("--frozen")
    });
    console.log(`[bp] Synced ${outputs.length} client type file(s).`);
    return;
  }
  if (command === "run" && subcommand === "contract") {
    const outputs = await buildContracts();
    for (const output of outputs) console.log(`[bp] Generated ${output.file}`);
    return;
  }
  if (command === "client" && subcommand === "install") {
    const selector = args[2];
    if (!selector) throw new Error("Usage: bp client install <id|namespace/name> [--path path] [--as alias] [--registry URL] [--dev-paths PATHS]");
    const installed = await installClient(selector, { path: option(args, "--path"), alias: option(args, "--as"), registryUrl, devPaths });
    console.log(`[bp] Installed ${installed.registryRef}@${installed.version} (${installed.pluginId})`);
    return;
  }
  if (command === "client" && (subcommand === "sync" || subcommand === "types")) {
    const outputs = await syncClients({ registryUrl, devPaths, registryOnly: args.includes("--registry-only"), frozen: args.includes("--frozen") });
    console.log(`[bp] Synced ${outputs.length} client type file(s).`);
    return;
  }
  if (command === "publish") {
    const tokenFile = option(args, "--token-file");
    const published = await publishContracts(args[1]?.startsWith("--") ? undefined : args[1], {
      token: tokenFile ? readFileSync(tokenFile, "utf8").trim() : undefined, registryUrl
    });
    for (const item of published) console.log(`[bp] Published ${item}`);
    return;
  }

  console.log(`BetterPortal CLI

  bp setup
  bp run check-routes
  bp run gen
  bp run types [--registry-only] [--frozen]
  bp run contract
  bp client install <id|namespace/name> [--path path] [--as alias] [--registry URL] [--dev-paths PATHS]
  bp client sync [--registry-only] [--frozen] [--registry URL] [--dev-paths PATHS]
  bp publish [contract-file-or-directory] --token-file FILE [--registry URL]`);
}

main().catch((error: unknown) => {
  console.error(`[bp] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
