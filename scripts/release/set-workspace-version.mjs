import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/release/set-workspace-version.mjs <semver>");
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const root = readJson("package.json");
const workspacePaths = root.workspaces ?? [];
const workspacePackages = workspacePaths.map((workspacePath) => ({
  path: workspacePath,
  file: `${workspacePath}/package.json`,
  pkg: readJson(`${workspacePath}/package.json`)
}));
const workspaceNames = new Set(workspacePackages.map((entry) => entry.pkg.name));

const updateDeps = (deps) => {
  if (!deps) return;
  for (const name of Object.keys(deps)) {
    if (workspaceNames.has(name)) {
      deps[name] = version;
    }
  }
};

root.version = version;
updateDeps(root.dependencies);
updateDeps(root.devDependencies);
updateDeps(root.peerDependencies);
updateDeps(root.optionalDependencies);
writeJson("package.json", root);

for (const entry of workspacePackages) {
  entry.pkg.version = version;
  updateDeps(entry.pkg.dependencies);
  updateDeps(entry.pkg.devDependencies);
  updateDeps(entry.pkg.peerDependencies);
  updateDeps(entry.pkg.optionalDependencies);
  writeJson(entry.file, entry.pkg);
}

console.log(`Set BetterPortal workspace version to ${version}`);
