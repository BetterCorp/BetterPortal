#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { scanRoutes } from "./scanner.js";
import { emitRegistry, emitRouteRuntime } from "./emitter.js";
import { validateScanResult } from "./validate.js";

interface BetterPortalConfig {
  routes?: string[];
  themes?: string[];
}

function findPackageJson(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readBetterPortalConfig(packageJsonPath: string): BetterPortalConfig {
  const raw = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return (raw.betterportal ?? {}) as BetterPortalConfig;
}

function run(): void {
  const cwd = process.cwd();
  const packageJsonPath = findPackageJson(cwd);

  if (!packageJsonPath) {
    console.error("[bp-codegen] No package.json found.");
    process.exit(1);
  }

  const config = readBetterPortalConfig(packageJsonPath);
  const packageDir = path.dirname(packageJsonPath);
  const routeDirs = config.routes ?? [];

  if (routeDirs.length === 0) {
    console.error('[bp-codegen] No "betterportal.routes" configured in package.json.');
    process.exit(1);
  }

  let totalRoutes = 0;
  let hasErrors = false;

  for (const routeDir of routeDirs) {
    const baseDir = path.resolve(packageDir, routeDir, "..");
    const scanResult = scanRoutes(baseDir);

    // Validate
    const errors = validateScanResult(scanResult);
    const criticalErrors = errors.filter((e) => e.severity === "error");
    const warnings = errors.filter((e) => e.severity === "warning");

    for (const warning of warnings) {
      console.warn(`[bp-codegen] WARN: ${warning.file}: ${warning.message}`);
    }

    if (criticalErrors.length > 0) {
      for (const error of criticalErrors) {
        console.error(`[bp-codegen] ERROR: ${error.file}: ${error.message}`);
      }
      hasErrors = true;
      continue;
    }

    // Generate
    const registryContent = emitRegistry(scanResult);
    const routeRuntimeContent = emitRouteRuntime(scanResult);
    const outputDir = scanResult.generatedDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputs = [
      { path: path.join(outputDir, "registry.ts"), content: registryContent },
      { path: path.join(outputDir, "route-runtime.ts"), content: routeRuntimeContent }
    ];

    for (const output of outputs) {
      const tmpPath = output.path + ".tmp";
      fs.writeFileSync(tmpPath, output.content, "utf-8");
      fs.renameSync(tmpPath, output.path);
    }

    totalRoutes += scanResult.routes.length;
    console.log(
      `[bp-codegen] Generated ${outputs[0].path} (${scanResult.routes.length} routes)`
    );
  }

  if (hasErrors) {
    console.error("[bp-codegen] Generation failed due to errors.");
    process.exit(1);
  }

  console.log(`[bp-codegen] Done. ${totalRoutes} total routes.`);
}

run();
