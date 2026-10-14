import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("a failing workspace keeps the root test command red while later workspaces still run", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-workspace-tests-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, workspaces: ["first", "second"] }));
    for (const [name, command] of [
      ["first", "node -e \"process.exit(1)\""],
      ["second", "node -e \"require('node:fs').writeFileSync('second-ran','yes')\""]
    ]) {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, version: "1.0.0", scripts: { test: command } }));
    }
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/run-workspace-tests.mjs", import.meta.url)), root], {
      encoding: "utf8", timeout: 15_000
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(existsSync(join(root, "second", "second-ran")), "later workspaces must still run");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
