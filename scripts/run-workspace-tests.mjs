import { readFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
let failed = false;
// Run each test script directly so a later workspace cannot mask an earlier failure.
for (const workspace of manifest.workspaces ?? []) {
  const project = JSON.parse(readFileSync(resolve(root, workspace, "package.json"), "utf8"));
  if (!project.scripts?.test) continue;
  const directory = resolve(root, workspace);
  const env = {
    ...process.env,
    PATH: [resolve(directory, "node_modules/.bin"), resolve(root, "node_modules/.bin"), process.env.PATH ?? ""].join(delimiter)
  };
  const result = spawnSync(project.scripts.test, { cwd: directory, env, shell: true, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    failed = true;
    process.stderr.write(`Workspace tests failed: ${workspace}\n`);
  }
}
if (failed) process.exitCode = 1;
