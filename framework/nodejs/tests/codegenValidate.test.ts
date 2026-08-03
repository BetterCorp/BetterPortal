import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    themeFragments: [],
    dependencyAliases: {},
    generatedDir: ".bp-generated",
    pluginImportPath: "../index.js",
    pluginExports: ["Plugin"],
    pluginLifecycleOverrides: []
  };
}

test("theme fragment folders distinguish singular fragments from blocks", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-theme-fragments-"));
  try {
    const themeDir = join(baseDir, "theme");
    mkdirSync(join(themeDir, "_nav"), { recursive: true });
    writeFileSync(join(themeDir, "_theme-selector.tsx"), "export const render = () => '';\n");
    writeFileSync(join(themeDir, "_nav", "index.tsx"), "export const render = () => '';\n");
    writeFileSync(join(themeDir, "index.tsx"), "export const shell = true;\n");

    assert.deepEqual(scanRoutes(baseDir).themeFragments.map(({ id, kind }) => ({ id, kind })), [
      { id: "nav", kind: "block" },
      { id: "theme-selector", kind: "fragment" }
    ]);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("theme fragment ids cannot collide between a file and block", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-theme-fragment-conflict-"));
  try {
    const themeDir = join(baseDir, "theme");
    mkdirSync(join(themeDir, "_nav"), { recursive: true });
    writeFileSync(join(themeDir, "_nav.tsx"), "export const render = () => '';\n");
    writeFileSync(join(themeDir, "_nav", "index.tsx"), "export const render = () => '';\n");
    assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes('Duplicate theme fragment id "nav"')), true);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

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
