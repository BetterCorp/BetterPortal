import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootPackage = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const workspaces = (rootPackage.workspaces ?? [])
  .filter((workspace) => typeof workspace === "string")
  .filter((workspace) => existsSync(resolve(workspace, "betterportal.json")))
  .filter((workspace) => {
    const pkg = JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8"));
    return Boolean(pkg.scripts?.["publish:bp"]);
  });

process.stdout.write(JSON.stringify(workspaces));
