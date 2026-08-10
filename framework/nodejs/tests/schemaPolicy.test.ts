import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectAnyValiSchemaSource } from "../src/codegen/schemaPolicy.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const roots = ["framework", "plugins", "services", "themes", "automations"];
const skipped = new Set(["node_modules", "lib", "dist", "tests", ".bp-generated"]);

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && skipped.has(entry.name)) return [];
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(file);
    return extname(file) === ".ts" || file.endsWith(".tsx") ? [file] : [];
  });
}

test("schema policy detects aliases, passthrough, and redundant stripping", () => {
  const issues = inspectAnyValiSchemaSource(`
    import * as av from "anyvali";
    import { unknown as loose } from "anyvali";
    const indirect = av.any;
    av.object({ first: indirect(), second: loose() }, { unknownKeys: "allow" });
    av.object({ ok: av.string() }, { unknownKeys: "strip" });
  `, "fixture.ts");
  assert.deepEqual(issues.map(({ kind, severity }) => ({ kind, severity })), [
    { kind: "allow", severity: "error" },
    { kind: "loose", severity: "error" },
    { kind: "loose", severity: "error" },
    { kind: "redundant-strip", severity: "warning" }
  ]);
});

test("production sources contain no unsafe or redundant AnyVali policy", () => {
  const findings = roots.flatMap((root) => productionSources(join(repoRoot, root))).flatMap((file) =>
    inspectAnyValiSchemaSource(readFileSync(file, "utf8"), file).map((issue) =>
      `${relative(repoRoot, file)}:${issue.line}:${issue.column} ${issue.severity} ${issue.kind}`
    )
  );
  assert.deepEqual(findings, []);
});
