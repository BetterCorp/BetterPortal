import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BaseSchema, exportSchema, importSchema } from "anyvali";
import * as av from "anyvali";
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

// The renderer's serializable data follows ViewRenderContext in contracts/registry.ts.
// Project presentation fields from platform contracts so auth/config never reaches it.
function unwrap(node) {
  while (node.kind === "optional" || node.kind === "nullable") node = node.inner;
  return node;
}
function pick(node, fields) {
  node = unwrap(node);
  omitFields(node, Object.keys(node.properties).filter(field => !fields.includes(field)));
  node.unknownKeys = "strip";
}
function presentation(name, source, fields) {
  const document = JSON.parse(names.get(source));
  pick(document.root, fields);
  names.set(name, JSON.stringify(document, null, 2) + "\n");
  return document;
}
presentation("ViewTenantContextSchema", "ScopedTenantSchema", ["id", "slug", "title", "branding"]);
const appPresentation = presentation("ViewAppContextSchema", "ScopedAppSchema", ["id", "tenantId", "slug", "title", "defaultRoute", "shell", "auth"]);
pick(appPresentation.root.properties.shell, ["serviceId", "service", "renderer"]);
pick(appPresentation.root.properties.auth, ["serviceId", "loginViewId", "logoutViewId"]);
names.set("ViewAppContextSchema", JSON.stringify(appPresentation, null, 2) + "\n");

const node = schema => exportSchema(schema).root;
const sourceNode = name => JSON.parse(names.get(name)).root;
function portable(name, root) {
  const document = { anyvaliVersion: "1.0", schemaVersion: "1.1", root,
    definitions: JSON.stringify(root).includes(`#/definitions/${JSON_VALUE_DEFINITION}`) ? { [JSON_VALUE_DEFINITION]: JsonValueSchemaNode } : {}, extensions: {} };
  importSchema(document);
  names.set(name, JSON.stringify(document, null, 2) + "\n");
}
function objectNode(properties, unknownKeys = "strip") {
  return { kind: "object", properties, required: Object.entries(properties).filter(([, value]) => value.kind !== "optional").map(([key]) => key), unknownKeys };
}
// Node's persisted settings interface in runtime/configStore.ts, derived from
// the canonical tenant/app bucket. Legacy data requires an explicit owner.
portable("PersistedServiceConfigStateSchema", objectNode({
  tenants: { kind: "record", valueSchema: sourceNode("ServiceConfigStateSchema"), default: {} },
  legacy: { kind: "optional", inner: sourceNode("ServiceConfigStateSchema") }
}, "reject"));
portable("ServiceConfigWriteResponseSchema", objectNode({
  ...sourceNode("ServiceConfigReadResponseSchema").properties, ok: { kind: "literal", value: true }
}));
// The sync POST is a projection of the CP's cached manifest plus the provisioned
// public identity. metadataResponse is submitted by the existing BSB integration,
// although the current CP cache schema does not retain it.
const submission = JSON.parse(names.get("ServiceManifestCacheEntrySchema"));
omitFields(submission.root, ["serviceId", "fetchedAt"]);
submission.root.unknownKeys = "reject";
const identityFields = unwrap(sourceNode("ScopedServiceConfigSchema").properties.serviceIdentity).properties;
for (const field of ["publicKeyPem", "keyId"]) submission.root.properties[field] = identityFields[field];
const operationSchemas = unwrap(submission.root.properties.viewIndex.valueSchema.properties.operations.items.properties.schemas);
operationSchemas.properties.metadataResponse = { kind: "optional", inner: sourceNode("JsonObjectSchema") };
importSchema(submission);
names.set("ControlPlaneSubmissionSchema", JSON.stringify(submission, null, 2) + "\n");
const kind = node(av.enum_(["page", "fragment", "component"]));
portable("RendererDeclarationSchema", objectNode({
  renderer: node(av.string().minLength(1)), kind: { ...kind, default: "page" },
  key: node(av.optional(av.string().minLength(1))), status: node(av.int().min(200).max(599).default(200))
}, "reject"));
portable("ViewRenderDataSchema", objectNode({
  tenant: sourceNode("ViewTenantContextSchema"), app: sourceNode("ViewAppContextSchema"),
  request: objectNode({ method: sourceNode("HttpMethodSchema"), path: node(av.string()), params: sourceNode("JsonObjectSchema"), query: sourceNode("JsonObjectSchema") }),
  route: objectNode({ viewId: node(av.string().minLength(1)), path: node(av.string().minLength(1)), renderer: node(av.string().minLength(1)),
    mode: sourceNode("RenderModeSchema"), kind, key: node(av.optional(av.string().minLength(1))), status: node(av.int().min(200).max(599)) })
}));
portable("ViewRenderErrorSchema", objectNode({ error: node(av.string()), status: node(av.int().min(400).max(599)) }));

// Portable declarations for the URL/element interfaces in route.ts and registry.ts.
const scalar = av.union([av.string(), av.number(), av.bool()]);
const urlFields = {
  serviceId: node(av.optional(av.string().minLength(1))),
  params: node(av.record(av.nullable(scalar)).default({})), query: node(av.record(av.nullable(scalar)).default({})),
  absolute: node(av.bool().default(false)), origin: node(av.optional(av.string().minLength(1))),
  component: node(av.optional(av.string().minLength(1))), fragment: node(av.optional(av.string().minLength(1))),
  sse: node(av.bool().default(false))
};
portable("RouteUrlOptionsSchema", objectNode(urlFields, "reject"));
portable("RouteUiOptionsSchema", objectNode({ ...urlFields, method: { ...sourceNode("HttpMethodSchema"), default: "GET" },
  target: node(av.optional(av.string())), swap: node(av.optional(av.string())), push: node(av.optional(av.union([av.string(), av.bool()]))) }, "reject"));
portable("BPElementReferenceSchema", objectNode({ service: node(av.string().minLength(1)), path: node(av.optional(av.string())), fragment: node(av.string()),
  args: node(av.object({ params: av.record(scalar).default({}), query: av.record(av.nullable(scalar)).default({}) }).default({})) }, "reject"));
portable("ResolvedBPElementReferenceSchema", objectNode({ url: node(av.optional(av.string())), serviceId: node(av.optional(av.string())), unavailable: node(av.optional(av.string())) }, "reject"));

for (const [name, content] of [...names].sort(([a], [b]) => a.localeCompare(b))) {
  const target = new URL(`${name}.json`, output);
  if (check) {
    if (await readFile(target, "utf8") !== content) throw new Error(`Stale contract: ${fileURLToPath(target)}`);
  } else await writeFile(target, content);
}
const unexpected = (await readdir(output)).filter(name => name.endsWith(".json") && !names.has(name.slice(0, -5)));
if (unexpected.length) throw new Error(`Obsolete contracts must be removed explicitly: ${unexpected.join(", ")}`);
console.log(`${check ? "Checked" : "Exported"} ${names.size} BP AnyVali contracts`);
