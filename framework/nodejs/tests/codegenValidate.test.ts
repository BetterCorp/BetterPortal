import { test } from "node:test";
import assert from "node:assert/strict";
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
    pluginExports: ["Plugin"]
  };
}

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
