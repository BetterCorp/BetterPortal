import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
const checkOnly = process.argv.includes("--check");

if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/release/set-workspace-version.mjs <semver> [--check]");
  process.exit(1);
}

// PyPI uses PEP 440 spelling for the prereleases supported by this repository.
const pythonMatch = /^(\d+\.\d+\.\d+)(?:-(alpha|beta|rc|dev)\.(\d+))?$/.exec(version);
if (!pythonMatch) {
  console.error("Python releases support X.Y.Z or X.Y.Z-{alpha,beta,rc,dev}.N; build metadata is not publishable on PyPI");
  process.exit(1);
}
const pythonSuffix = { alpha: "a", beta: "b", rc: "rc", dev: ".dev" };
const pythonVersion = pythonMatch[1] + (pythonMatch[2] ? pythonSuffix[pythonMatch[2]] + pythonMatch[3] : "");
const pythonFile = "framework/python/pyproject.toml";
const pythonProject = readFileSync(pythonFile, "utf8");
const pythonVersionPattern = /(^\[project\]\s*\n(?:(?!\[)[^\n]*\n)*?version\s*=\s*")[^"]+("\s*$)/m;
if (!pythonVersionPattern.test(pythonProject)) throw new Error("Missing Python project.version");
const updatedPythonProject = pythonProject.replace(pythonVersionPattern, (_, before, after) => before + pythonVersion + after);

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

if (checkOnly) {
  const mismatches = [];
  if (updatedPythonProject !== pythonProject) mismatches.push(`${pythonFile}: version must be ${pythonVersion}`);
  for (const { file, pkg } of [{ file: "package.json", pkg: root }, ...workspacePackages]) {
    if (pkg.version !== version) mismatches.push(`${file}: version is ${pkg.version ?? "missing"}`);
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, value] of Object.entries(pkg[field] ?? {})) {
        if (workspaceNames.has(name) && value !== version) mismatches.push(`${file}: ${field}.${name} is ${value}`);
      }
    }
  }
  if (mismatches.length > 0) {
    console.error(`Workspace packages must match release ${version}:\n${mismatches.join("\n")}`);
    process.exit(1);
  }
  console.log(`BetterPortal workspace matches release ${version}`);
  process.exit(0);
}

const updateDeps = (deps) => {
  if (!deps) return;
  for (const name of Object.keys(deps)) {
    if (workspaceNames.has(name)) {
      deps[name] = version;
    }
  }
};

writeFileSync(pythonFile, updatedPythonProject, "utf8");

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
