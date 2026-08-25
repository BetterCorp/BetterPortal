import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildContracts } from "../src/cli/contract.js";
import { assertManifestOnlyDefinition, loadGeneratedRegistry } from "../src/runtime/generatedRegistry.js";

function fixture(): string {
  return mkdtempSync(join(tmpdir(), "bp-generated-registry-"));
}

test("source registries load by plugin directory convention", async () => {
  const root = fixture();
  try {
    const generated = join(root, ".bp-generated");
    mkdirSync(generated);
    writeFileSync(join(generated, "registry.ts"), "export const registry = { routes: [] };\n");
    assert.deepEqual(await loadGeneratedRegistry(root), { routes: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy inline registries are rejected", () => {
  assert.throws(
    () => assertManifestOnlyDefinition({ manifest: {}, registry: { routes: [] } }),
    /BPServiceDefinition\.registry was removed/
  );
});

test("missing generated registries explain how to recover", async () => {
  const root = fixture();
  try {
    await assert.rejects(loadGeneratedRegistry(root), /Run bp:gen or build the service/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("contract generation discovers the compiled registry", async () => {
  const root = fixture();
  try {
    const sourceGenerated = join(root, "src", "plugins", "demo", ".bp-generated");
    const plugin = join(root, "lib", "plugins", "demo");
    mkdirSync(sourceGenerated, { recursive: true });
    mkdirSync(plugin, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({
      version: "1.2.3",
      type: "module",
      betterportal: { definitions: ["src/plugins/demo/index.ts"] }
    }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        rootDir: "src",
        outDir: "lib"
      }
    }));
    writeFileSync(join(plugin, "index.js"), `
      export class Plugin {
        static getBPDefinition() {
          return { manifest: { pluginId: "com.example.demo", title: "Demo", description: "Demo service" } };
        }
      }
    `);
    writeFileSync(join(root, "src", "plugins", "demo", "index.ts"), "export class Plugin {}\n");
    writeFileSync(join(sourceGenerated, "registry.ts"), "export const registry: { routes: unknown[] } = { routes: [] };\n");

    const [output] = await buildContracts(root);
    assert.equal(output.contract.manifest.pluginId, "com.example.demo");
    assert.equal(output.contract.manifest.version, "1.2.3");
    assert.deepEqual(await loadGeneratedRegistry(plugin), { routes: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
