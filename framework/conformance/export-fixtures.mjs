import { readFile, writeFile } from "node:fs/promises";
import * as av from "anyvali";

const file = new URL("schema-cases.json", import.meta.url);
const cases = JSON.parse(await readFile(file, "utf8"));
const sensitive = av.object({ secret: av.string().describe("Private setting", { sensitive: true }) }, { unknownKeys: "reject" });
const fixtures = {
  "sensitive-encrypt": sensitive,
  "sensitive-reject-plaintext-storage": sensitive,
  "sensitive-decrypt": sensitive,
  "default-null": av.object({ value: av.nullable(av.string()).default(null) }, { unknownKeys: "reject" }),
  "default-present-null": av.object({ value: av.string().default("fallback") }, { unknownKeys: "reject" }),
  "coerce-int": av.int().coerce({ toInt: true }),
  "unknown-reject": av.object({}, { unknownKeys: "reject" })
};
for (const scenario of cases) {
  const schema = fixtures[scenario.id];
  if (!schema) continue;
  scenario.document = av.exportSchema(schema);
  // Independently prove the intended semantics using native schema authoring.
  const action = scenario.action;
  const result = action === "encrypt" ? { success: true, data: av.encrypt(schema, scenario.input, (_path, value) => `encrypted:${JSON.stringify(value)}`) }
    : action === "decrypt" ? { success: true, data: av.decrypt(schema, scenario.input, (_path, value) => JSON.parse(value.slice("encrypted:".length))) }
    : action === "encrypted" ? av.safeParseEncrypted(schema, scenario.input)
    : schema.safeParse(scenario.input);
  if (result.success !== (scenario.valid ?? true) || (result.success && JSON.stringify(result.data) !== JSON.stringify(scenario.output))) {
    throw new Error(`Invalid source fixture: ${scenario.id}`);
  }
}
const content = JSON.stringify(cases, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (await readFile(file, "utf8") !== content) throw new Error("Stale fixtures");
} else await writeFile(file, content);
console.log("Checked native fixture semantics");
