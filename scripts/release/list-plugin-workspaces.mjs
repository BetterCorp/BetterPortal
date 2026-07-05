import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootPackage = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const coreWorkspaces = new Set([
  "framework/nodejs",
  "plugins/nodejs/betterportal-bsb"
]);

const pluginWorkspaces = (rootPackage.workspaces ?? [])
  .filter((workspace) => typeof workspace === "string")
  .filter((workspace) => !coreWorkspaces.has(workspace))
  .filter((workspace) => existsSync(resolve(workspace, "package.json")));

process.stdout.write(JSON.stringify(pluginWorkspaces));
