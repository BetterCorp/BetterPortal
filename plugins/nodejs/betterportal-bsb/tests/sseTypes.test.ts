import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("BetterPortal SSE emission is typed by generated route contracts", (t) => {
  const root = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), "bp-sse-types-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "usage.ts");
  writeFileSync(source, `
    import type { BetterPortalRuntime } from "../../src/service.js";
    declare module "@betterportal/framework" {
      interface BetterPortalSseContracts {
        "incidents.index": { id: string };
      }
    }
    declare const runtime: BetterPortalRuntime;
    runtime.sse.emit("incidents.index", { tenantId: "tenant", appId: "app" }, { id: "incident" });
    // @ts-expect-error unknown view
    runtime.sse.emit("missing.index", { tenantId: "tenant", appId: "app" }, { id: "incident" });
    // @ts-expect-error wrong input
    runtime.sse.emit("incidents.index", { tenantId: "tenant", appId: "app" }, { id: 1 });
  `, "utf8");

  const program = ts.createProgram([source], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: ["node"],
    strict: true,
    noEmit: true,
    skipLibCheck: true
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n"
  }), "");
});
