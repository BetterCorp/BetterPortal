import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BaseSchema, exportSchema } from "anyvali";
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
for (const [name, content] of [...names].sort(([a], [b]) => a.localeCompare(b))) {
  const target = new URL(`${name}.json`, output);
  if (check) {
    if (await readFile(target, "utf8") !== content) throw new Error(`Stale contract: ${fileURLToPath(target)}`);
  } else await writeFile(target, content);
}
const unexpected = (await readdir(output)).filter(name => name.endsWith(".json") && !names.has(name.slice(0, -5)));
if (unexpected.length) throw new Error(`Obsolete contracts must be removed explicitly: ${unexpected.join(", ")}`);
console.log(`${check ? "Checked" : "Exported"} ${names.size} BP AnyVali contracts`);
