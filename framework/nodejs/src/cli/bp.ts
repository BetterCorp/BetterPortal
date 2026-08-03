#!/usr/bin/env node

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

  if (command === "setup") {
    await import("../codegen/init.js");
    return;
  }
  if (command === "run" && subcommand === "gen") {
    const pkg = readJsonFile<{ betterportal?: { routes?: string[]; themes?: string[] } }>(findPackageJson());
    if ((pkg.betterportal?.routes?.length ?? 0) === 0 && (pkg.betterportal?.themes?.length ?? 0) === 0) {
      console.log("[bp] No betterportal.routes or betterportal.themes configured; generation skipped.");
      return;
    }
    await import("../codegen/cli.js");
    return;
  }
  if (command === "run" && subcommand === "types") {
    const outputs = await syncClients({
      registryOnly: args.includes("--registry-only"),
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
    if (!selector) throw new Error("Usage: bp client install <id|namespace/name> [--path path] [--as alias]");
    const installed = await installClient(selector, { path: option(args, "--path"), alias: option(args, "--as") });
    console.log(`[bp] Installed ${installed.registryRef}@${installed.version} (${installed.pluginId})`);
    return;
  }
  if (command === "client" && (subcommand === "sync" || subcommand === "types")) {
    const outputs = await syncClients({ registryOnly: args.includes("--registry-only"), frozen: args.includes("--frozen") });
    console.log(`[bp] Synced ${outputs.length} client type file(s).`);
    return;
  }
  if (command === "publish") {
    const published = await publishContracts(args[1]);
    for (const item of published) console.log(`[bp] Published ${item}`);
    return;
  }

  console.log(`BetterPortal CLI

  bp setup
  bp run gen
  bp run types [--registry-only] [--frozen]
  bp run contract
  bp client install <id|namespace/name> [--path path] [--as alias]
  bp client sync [--registry-only] [--frozen]
  bp publish [contract-file-or-directory]`);
}

main().catch((error: unknown) => {
  console.error(`[bp] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
