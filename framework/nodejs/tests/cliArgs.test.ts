import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("publish rejects malformed registry options before reading credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "bp-cli-args-"));
  const missingSecret = join(directory, "not-read");
  const cli = fileURLToPath(new URL("../src/cli/bp.ts", import.meta.url));
  try {
    for (const [args, error] of [
      [["--token-file", missingSecret, "--registry"], /Missing value for --registry/],
      [["--token-file", missingSecret, "--registry", "--other"], /Missing value for --registry/],
      [["--token-file", missingSecret, "--regsitry", "https://private.test"], /Unsupported option --regsitry/],
      [["--registry", "https://first.test", "--registry", "https://second.test", "--token-file", missingSecret], /Duplicate option --registry/],
      [["--registry", "http://private.test", "--token-file", missingSecret], /Registry URL requires HTTPS/]
    ] as const) {
      const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), cli, "publish", ...args], {
        cwd: directory, env: {}, encoding: "utf8", timeout: 10_000
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, error);
      assert.doesNotMatch(result.stderr, /ENOENT|not-read/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
