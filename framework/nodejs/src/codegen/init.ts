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

  // Add BP scripts if missing
  if (!raw.scripts) raw.scripts = {};
  if (!raw.scripts["bp-codegen"]) {
    raw.scripts["bp-codegen"] = "bp-codegen";
    console.log("[bp-init] Added 'bp-codegen' script.");
    modified = true;
  }
  for (const [name, command] of Object.entries({
    "bp:gen": "bp run gen",
    "bp:types": "bp run types",
    "bp:contract": "bp run contract",
    "publish:bp": "bp publish"
  })) {
    if (!raw.scripts[name]) {
      raw.scripts[name] = command;
      console.log(`[bp-init] Added '${name}' script.`);
      modified = true;
    }
  }

  // Detect BSB vs non-BSB
  const isBsb = raw.bsb !== undefined;

  if (isBsb) {
    if (raw.scripts.prebuild === "bp-codegen" || raw.scripts.prebuild === "npm run bp-codegen") {
      delete raw.scripts.prebuild;
      console.log("[bp-init] Removed duplicate legacy BSB prebuild hook.");
      modified = true;
    }
    // Route generation and dependency types must exist before TypeScript compilation.
    if (!raw.bsb.hooks) raw.bsb.hooks = {};
    const afterSchemas = Array.isArray(raw.bsb.hooks.afterSchemas)
      ? raw.bsb.hooks.afterSchemas
      : raw.bsb.hooks.afterSchemas ? [raw.bsb.hooks.afterSchemas] : [];
    const normalizedAfterSchemas = afterSchemas.map((hook: string) => hook === "bp-codegen" ? "bp:gen" : hook);
    for (const hook of ["bp:gen", "bp:types"]) {
      if (!normalizedAfterSchemas.includes(hook)) normalizedAfterSchemas.push(hook);
    }
    if (JSON.stringify(normalizedAfterSchemas) !== JSON.stringify(afterSchemas)) {
      raw.bsb.hooks.afterSchemas = normalizedAfterSchemas;
      console.log("[bp-init] Added BSB generation/type hooks.");
      modified = true;
    }
    const afterBuild = Array.isArray(raw.bsb.hooks.afterBuild)
      ? raw.bsb.hooks.afterBuild
      : raw.bsb.hooks.afterBuild ? [raw.bsb.hooks.afterBuild] : [];
    if (!afterBuild.includes("bp:contract")) {
      raw.bsb.hooks.afterBuild = [...afterBuild, "bp:contract"];
      console.log("[bp-init] Added BSB contract hook.");
      modified = true;
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
