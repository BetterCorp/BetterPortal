import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanRoutes } from "../src/codegen/scanner.js";
import { validateScanResult } from "../src/codegen/validate.js";
import type { ScanResult, ScannedRoute } from "../src/codegen/scanner.js";

function scannedRoute(overrides: Partial<ScannedRoute> = {}): ScannedRoute {
  return {
    viewId: "download.index",
    path: "/download",
    paramNames: [],
    relativePath: "../bp-routes/download",
    metadataExports: [],
    methodModules: [{
      method: "GET",
      relativePath: "../bp-routes/download/GET.ts",
      exports: ["default", "ResponseSchema"],
      isRaw: false,
      looseSchemas: []
    }],
    handlerExports: ["default", "ResponseSchema"],
    methods: ["GET"],
    themeRenderers: [],
    streamRenderers: [],
    hasSseHandler: false,
    hasItemSchema: false,
    hasSummarySchema: false,
    isRaw: false,
    looseSchemas: [],
    autoDependencies: [],
    ...overrides
  };
}

function scanResult(route: ScannedRoute): ScanResult {
  return {
    routes: [route],
    generatedDir: ".bp-generated",
    pluginImportPath: "../index.js",
    pluginExports: ["Plugin"],
    pluginLifecycleOverrides: []
  };
}

function lifecycleIssues(source: string) {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-lifecycle-"));
  try {
    writeFileSync(join(baseDir, "index.ts"), source);
    return validateScanResult(scanRoutes(baseDir));
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
}

test("plugin lifecycle overrides must call the BP base lifecycle", () => {
  const issues = lifecycleIssues(`
    class Unrelated { init() {} }
    export class Plugin extends BPService {
      async init(obs: Observable) { /* super.init(obs) */ }
      async run(obs: Observable) { super.run(obs); }
      async dispose() {}
    }
  `);

  assert.equal(issues.some((issue) => issue.message.includes("does not call super.init")), true);
  assert.equal(issues.some((issue) => issue.message.includes("without awaiting or returning")), true);
  assert.equal(issues.some((issue) => issue.message.includes("does not call super.dispose")), true);
});

test("awaited, returned, and inherited BP lifecycle methods pass validation", () => {
  const valid = lifecycleIssues(`
    export class Plugin extends BPService {
      async init(obs: Observable) { await super.init(obs); }
      run(obs: Observable) { return super.run(obs); }
      async dispose() { await super.dispose(); }
    }
  `);
  const inherited = lifecycleIssues("export class Plugin extends BPService {}");

  assert.equal(valid.some((issue) => issue.severity === "error"), false);
  assert.equal(inherited.some((issue) => issue.severity === "error"), false);
});

test("raw handlers warn developers to prefer schema based handlers", () => {
  const issues = validateScanResult(scanResult(scannedRoute({
    isRaw: true,
    methodModules: [{
      method: "GET",
      relativePath: "../bp-routes/download/GET.ts",
      exports: ["default"],
      isRaw: true,
      looseSchemas: []
    }]
  })));

  assert.equal(issues.some((issue) =>
    issue.severity === "warning"
    && issue.message.includes("uses createRawHandler")
    && issue.message.includes("Prefer createHandler")
  ), true);
});

test("loose anyvali route schemas warn developers to use concrete schemas", () => {
  const issues = validateScanResult(scanResult(scannedRoute({
    methodModules: [{
      method: "POST",
      relativePath: "../bp-routes/download/POST.ts",
      exports: ["default", "ResponseSchema", "RequestSchema"],
      isRaw: false,
      looseSchemas: ["ResponseSchema", "RequestSchema"]
    }],
    handlerExports: ["default", "ResponseSchema", "RequestSchema"],
    methods: ["POST"],
    looseSchemas: ["ResponseSchema", "RequestSchema"]
  })));

  assert.equal(issues.some((issue) =>
    issue.severity === "warning"
    && issue.message.includes("ResponseSchema")
    && issue.message.includes("concrete anyvali schema")
  ), true);
  assert.equal(issues.some((issue) =>
    issue.severity === "warning"
    && issue.message.includes("RequestSchema")
    && issue.message.includes("BP can validate inputs and outputs")
  ), true);
});
