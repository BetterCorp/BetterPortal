import { readFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = process.argv[3] ?? "test";
if (script !== "test" && script !== "build") throw new Error(`Unsupported workspace script: ${script}`);
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
let failed = false;
// Run lifecycle scripts directly so npm cannot mask an earlier workspace failure.
for (const workspace of manifest.workspaces ?? []) {
  const project = JSON.parse(readFileSync(resolve(root, workspace, "package.json"), "utf8"));
  if (!project.scripts?.[script]) continue;
  const directory = resolve(root, workspace);
  const baseEnv = {
    ...process.env,
    PATH: [resolve(directory, "node_modules/.bin"), resolve(root, "node_modules/.bin"), process.env.PATH ?? ""].join(delimiter),
    npm_package_name: project.name,
    npm_package_version: project.version
  };
  for (const step of [`pre${script}`, script, `post${script}`]) {
    const command = project.scripts[step];
    if (!command) continue;
    const result = spawnSync(command, { cwd: directory, env: { ...baseEnv, npm_lifecycle_event: step }, shell: true, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      failed = true;
      process.stderr.write(`Workspace ${step} failed: ${workspace}\n`);
      break;
    }
  }
}
if (failed) process.exitCode = 1;
