import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { emitRegistry } from "../src/codegen/emitter.js";
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
      operationId: "download.read",
      relativePath: "../bp-routes/download/GET.ts",
      exports: ["default", "operationId", "title", "description", "auth", "ResponseSchema"],
      isRaw: false,
      looseSchemas: []
    }],
    handlerExports: ["default", "ResponseSchema"],
    methods: ["GET"],
    renderers: [],
    streamRenderers: [],
    hasSseHandler: false,
    hasItemSchema: false,
    hasSummarySchema: false,
    isRaw: false,
    looseSchemas: [],
    hasRouteImpl: false,
    ...overrides
  };
}

function scanResult(route: ScannedRoute | ScannedRoute[]): ScanResult {
  return {
    routes: Array.isArray(route) ? route : [route],
    shellFragments: [],
    dependencyAliases: {},
    generatedDir: ".bp-generated",
    pluginImportPath: "../index.js",
    pluginExports: ["Plugin"],
    pluginLifecycleOverrides: []
  };
}

test("method contracts cannot be flattened into route metadata", () => {
  const issues = validateScanResult(scanResult(scannedRoute({
    metadataExports: ["viewId", "title", "description", "operationId", "auth", "RequestSchema"]
  })));

  for (const name of ["operationId", "auth", "RequestSchema"]) {
    assert.equal(issues.some((issue) =>
      issue.severity === "error" && issue.message.includes(`metadata "${name}" belongs in each method file`)
    ), true);
  }
});

test("route.impl files fail as shared route god modules", () => {
  const issues = validateScanResult(scanResult(scannedRoute({ hasRouteImpl: true })));
  assert.equal(issues.some((issue) => issue.severity === "error" && issue.message.includes("route.impl files are not supported")), true);
});

test("operation ids are unique across a service", () => {
  const first = scannedRoute();
  const second = scannedRoute({
    viewId: "download.other",
    path: "/other",
    relativePath: "../bp-routes/other",
    methodModules: [{
      ...first.methodModules[0],
      relativePath: "../bp-routes/other/GET.ts"
    }]
  });
  const issues = validateScanResult(scanResult([first, second]));

  assert.equal(issues.some((issue) =>
    issue.severity === "error" && issue.message.includes('Duplicate operationId "download.read"')
  ), true);
});

test("legacy string dependencies fail with the object migration", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-legacy-dependencies-"));
  try {
    const routeDir = join(baseDir, "bp-routes", "home");
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(baseDir, "index.ts"), "export class Plugin {}\n");
    writeFileSync(join(routeDir, "index.ts"), 'export const viewId = "home.index";\n');
    writeFileSync(join(routeDir, "GET.ts"), `
      export const operationId = "home.read";
      export const title = "Home";
      export const description = "Home";
      export const auth = { required: false, permissions: [] };
      export const ResponseSchema = {};
      export const dependencies = ["auth.login"] as const;
      export default () => ({});
    `);

    const issues = validateScanResult(scanRoutes(baseDir));
    assert.equal(issues.some((issue) =>
      issue.severity === "error"
      && issue.message.includes("Use { operationId, method, serviceId? }")
    ), true);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("generated registries compile with noUnusedLocals when no renderers are used", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-codegen-unused-imports-"));
  try {
    const generatedPath = join(baseDir, "registry.ts");
    const frameworkTypesPath = join(baseDir, "framework.d.ts");
    writeFileSync(generatedPath, emitRegistry(scanResult([])));
    writeFileSync(frameworkTypesPath, `
      declare module "@betterportal/framework" {
        export interface BetterPortalRegistry { routes: unknown[]; shellFragments: unknown[]; }
      }
    `);

    const program = ts.createProgram([generatedPath, frameworkTypesPath], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      noUnusedLocals: true,
      strict: true,
      skipLibCheck: true
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => baseDir,
      getNewLine: () => "\n"
    }), "");
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("shell fragment folders distinguish singular fragments from blocks", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-shell-fragments-"));
  try {
    const shellDir = join(baseDir, "shell");
    mkdirSync(join(shellDir, "_nav"), { recursive: true });
    writeFileSync(join(shellDir, "_theme-selector.tsx"), "export const render = () => '';\n");
    writeFileSync(join(shellDir, "_nav", "index.tsx"), "export const render = () => '';\n");
    writeFileSync(join(shellDir, "index.tsx"), "export const shell = true;\n");

    assert.deepEqual(scanRoutes(baseDir).shellFragments.map(({ id, kind }) => ({ id, kind })), [
      { id: "nav", kind: "block" },
      { id: "theme-selector", kind: "fragment" }
    ]);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("shell fragment ids cannot collide between a file and block", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-shell-fragment-conflict-"));
  try {
    const shellDir = join(baseDir, "shell");
    mkdirSync(join(shellDir, "_nav"), { recursive: true });
    writeFileSync(join(shellDir, "_nav.tsx"), "export const render = () => '';\n");
    writeFileSync(join(shellDir, "_nav", "index.tsx"), "export const render = () => '';\n");
    assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes('Duplicate shell fragment id "nav"')), true);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("legacy theme renderer folders fail codegen", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-legacy-renderer-"));
  try {
    const routeDir = join(baseDir, "bp-routes", "home");
    mkdirSync(join(routeDir, "_theme.bootstrap1"), { recursive: true });
    writeFileSync(join(baseDir, "index.ts"), "export class Plugin {}\n");
    assert.throws(() => scanRoutes(baseDir), /rename it to _renderer/);
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

test("loose anyvali route schemas fail codegen", () => {
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
    issue.severity === "error"
    && issue.message.includes("ResponseSchema")
    && issue.message.includes("Published schemas must be concrete")
  ), true);
  assert.equal(issues.some((issue) =>
    issue.severity === "error"
    && issue.message.includes("RequestSchema")
    && issue.message.includes("JsonValueSchema")
  ), true);
});

test("nested loose schemas are detected in method files", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-loose-schema-"));
  try {
    const routeDir = join(baseDir, "bp-routes", "data");
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(baseDir, "index.ts"), "export class Plugin {}\n");
    writeFileSync(join(routeDir, "index.ts"), `
      import * as av from "anyvali";
      export const viewId = "data.index";
      export const title = "Data";
      export const description = "Data";
      export const ParamsSchema = av.object({ id: av.unknown() });
    `);
    writeFileSync(join(routeDir, "POST.ts"), `
      import * as av from "anyvali";
      export const operationId = "data.create";
      export const title = "Create data";
      export const description = "Create data";
      export const auth = { required: false, permissions: [] };
      export const RequestSchema = av.object({ values: av.record(av.any()) });
      export const ResponseSchema = av.object({ value: av.unknown() });
      export default () => ({});
    `);

    const issues = validateScanResult(scanRoutes(baseDir));
    assert.equal(issues.some((issue) =>
      issue.severity === "error" && issue.message.includes("RequestSchema containing av.any()")
    ), true);
    assert.equal(issues.some((issue) =>
      issue.severity === "error" && issue.message.includes("ResponseSchema containing av.any() or av.unknown()")
    ), true);
    assert.equal(issues.some((issue) =>
      issue.severity === "error" && issue.message.includes("ParamsSchema containing av.any() or av.unknown()")
    ), true);
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("unknown-key passthrough fails and redundant stripping warns", () => {
  const issues = validateScanResult(scanResult(scannedRoute({
    methodModules: [{
      method: "POST",
      relativePath: "../bp-routes/data/POST.ts",
      exports: ["default", "operationId", "title", "description", "auth", "RequestSchema", "ResponseSchema"],
      isRaw: false,
      looseSchemas: [],
      allowUnknownKeysSchemas: ["RequestSchema"],
      redundantStripSchemas: ["ResponseSchema"]
    }],
    methods: ["POST"]
  })));

  assert.equal(issues.some((issue) => issue.severity === "error"
    && issue.message.includes('RequestSchema with unknownKeys: "allow"')), true);
  assert.equal(issues.some((issue) => issue.severity === "warning"
    && issue.message.includes('ResponseSchema with unknownKeys: "strip"')), true);
});
