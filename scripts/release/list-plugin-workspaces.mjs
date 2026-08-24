import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootPackage = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const publishableOnly = process.argv.includes("--publishable");
const coreWorkspaces = new Set([
  "framework/nodejs",
  "plugins/nodejs/betterportal-bsb"
]);

const pluginWorkspaces = (rootPackage.workspaces ?? [])
  .filter((workspace) => typeof workspace === "string")
  .filter((workspace) => !coreWorkspaces.has(workspace))
  .filter((workspace) => existsSync(resolve(workspace, "package.json")))
  .filter((workspace) => !publishableOnly || JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8")).private !== true);

process.stdout.write(JSON.stringify(pluginWorkspaces));
