#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

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

function run(): void {
  const cwd = process.cwd();
  const packageJsonPath = findPackageJson(cwd);

  if (!packageJsonPath) {
    console.error("[bp-init] No package.json found.");
    process.exit(1);
  }

  const packageDir = path.dirname(packageJsonPath);
  const raw = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  let modified = false;

  // Add bp-codegen script if missing
  if (!raw.scripts) raw.scripts = {};
  if (!raw.scripts["bp-codegen"]) {
    raw.scripts["bp-codegen"] = "bp-codegen";
    console.log("[bp-init] Added 'bp-codegen' script.");
    modified = true;
  }

  // Detect BSB vs non-BSB
  const isBsb = raw.bsb !== undefined;

  if (isBsb) {
    // Add afterSchemas hook
    if (!raw.bsb.hooks) raw.bsb.hooks = {};
    if (!raw.bsb.hooks.afterSchemas) {
      raw.bsb.hooks.afterSchemas = "bp-codegen";
      console.log("[bp-init] Added BSB afterSchemas hook for bp-codegen.");
      modified = true;
    } else {
      console.log("[bp-init] BSB afterSchemas hook already configured.");
    }
  } else {
    // Add prebuild script for non-BSB
    if (!raw.scripts.prebuild) {
      raw.scripts.prebuild = "bp-codegen";
      console.log("[bp-init] Added 'prebuild' script for bp-codegen.");
      modified = true;
    } else {
      console.log("[bp-init] prebuild script already configured.");
    }
  }

  // Ensure betterportal key exists
  if (!raw.betterportal) {
    raw.betterportal = { routes: [] };
    console.log("[bp-init] Added 'betterportal' config key. Add your route paths to betterportal.routes[].");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    console.log("[bp-init] Updated package.json.");
  }

  // Ensure .bp-generated/ in .gitignore
  const gitignorePath = path.join(packageDir, ".gitignore");
  const bpGeneratedPattern = "**/.bp-generated/";

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".bp-generated")) {
      fs.appendFileSync(gitignorePath, `\n${bpGeneratedPattern}\n`, "utf-8");
      console.log("[bp-init] Added .bp-generated/ to .gitignore.");
    } else {
      console.log("[bp-init] .gitignore already contains .bp-generated.");
    }
  } else {
    fs.writeFileSync(gitignorePath, `${bpGeneratedPattern}\n`, "utf-8");
    console.log("[bp-init] Created .gitignore with .bp-generated/ entry.");
  }

  console.log("[bp-init] Done.");
}

run();
