import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("./set-workspace-version.mjs", import.meta.url);
test("release versioning updates and checks Python alongside workspace packages", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "bp-release-version-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "framework/python"), { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify({ version: "1.0.0", workspaces: [] }));
  const pythonFile = join(directory, "framework/python/pyproject.toml");
  writeFileSync(pythonFile, '[project]\nname = "betterportal"\nversion = "0.9.0"\n\n[project.urls]\nRepository = "https://example.test"\n');
  const run = (...args) => spawnSync(process.execPath, [script.pathname, ...args], { cwd: directory, encoding: "utf8" });
  assert.equal(run("1.0.0", "--check").status, 1, "Python drift must fail the release check");
  for (const [semver, pep440] of [["1.0.0", "1.0.0"], ["1.1.0-rc.2", "1.1.0rc2"], ["1.1.0-dev.3", "1.1.0.dev3"]]) {
    assert.equal(run(semver).status, 0);
    assert.ok(readFileSync(pythonFile, "utf8").includes(`version = "${pep440}"`));
    assert.equal(run(semver, "--check").status, 0);
  }
  const before = readFileSync(pythonFile, "utf8");
  assert.equal(run("1.1.0+private").status, 1);
  assert.equal(readFileSync(pythonFile, "utf8"), before, "unsupported releases must not partially update files");
});
