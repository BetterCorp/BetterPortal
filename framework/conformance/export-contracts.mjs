import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BaseSchema, exportSchema, importSchema } from "anyvali";
import { JSON_VALUE_DEFINITION, JsonValueSchemaNode } from "../nodejs/lib/contracts/json.js";

// Development-only: consumers embed these documents and never execute Node.
const source = new URL("../nodejs/lib/contracts/", import.meta.url);
const output = new URL("./contracts/", import.meta.url);
await mkdir(output, { recursive: true });
const check = process.argv.includes("--check");
const names = new Map();
for (const file of (await readdir(source)).filter(name => name.endsWith(".js")).sort()) {
  const module = await import(new URL(file, source).href);
  for (const [name, schema] of Object.entries(module)) {
    if (!(schema instanceof BaseSchema)) continue;
    const document = exportSchema(schema, "portable");
    // Platform menu schemas are bounded but deeper than JSON data's 100-level limit.
    // A schema document is not an application JSON value; export it natively.
    if (JSON.stringify(document).includes(`#/definitions/${JSON_VALUE_DEFINITION}`)) {
      document.definitions[JSON_VALUE_DEFINITION] = JsonValueSchemaNode;
    }
    const content = JSON.stringify(document, null, 2) + "\n";
    if (names.has(name) && names.get(name) !== content) throw new Error(`Duplicate contract ${name}`);
    names.set(name, content);
  }
}

// Author declarations omit fields derived by the registry. Their remaining policy
// fields come from the wire contract, never an independently maintained schema.
function omitFields(node, fields) {
  for (const name of fields) delete node.properties[name];
  node.required = node.required.filter(name => !fields.includes(name));
}
function declaration(name, source, derived, defaults) {
  const document = JSON.parse(names.get(source));
  omitFields(document.root, derived);
  document.root.unknownKeys = "reject";
  for (const [field, value] of Object.entries(defaults)) document.root.properties[field].default = value;
  if (name === "OperationDeclarationSchema") {
    // Same authoring requirement as codegen/validate.ts: explicit auth and stable IDs.
    document.root.properties.operationId.pattern = "^[A-Za-z][A-Za-z0-9._-]*$";
    omitFields(document.root.properties.apiContracts.items, ["viewId", "methods"]);
  }
  importSchema(document); // The native SDK validates the projected document.
  names.set(name, JSON.stringify(document, null, 2) + "\n");
}
declaration("OperationDeclarationSchema", "ViewOperationMetadataSchema",
  ["querySchema", "headersSchema", "bodySchema", "jsonResponseSchema", "metadataResponseSchema", "renderable", "raw", "streaming", "html"],
  { cacheHints: {} });
declaration("ManifestDeclarationSchema", "PluginManifestSchema",
  ["protocolVersion", "supportedRenderers", "supportedRenderModes", "views"], { category: "service", deploymentModes: ["self-hosted"] });

for (const [name, content] of [...names].sort(([a], [b]) => a.localeCompare(b))) {
  const target = new URL(`${name}.json`, output);
  if (check) {
    if (await readFile(target, "utf8") !== content) throw new Error(`Stale contract: ${fileURLToPath(target)}`);
  } else await writeFile(target, content);
}
const unexpected = (await readdir(output)).filter(name => name.endsWith(".json") && !names.has(name.slice(0, -5)));
if (unexpected.length) throw new Error(`Obsolete contracts must be removed explicitly: ${unexpected.join(", ")}`);
console.log(`${check ? "Checked" : "Exported"} ${names.size} BP AnyVali contracts`);
