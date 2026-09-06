import { importSchema } from "anyvali";
import { readFile } from "node:fs/promises";
import { buildManifestFromRegistry, buildBpSchema } from "../nodejs/lib/runtime/registry.js";
import { PluginManifestSchema, BpSchemaOutputSchema } from "../nodejs/lib/contracts/manifest.js";

const operationSchema = importSchema(JSON.parse(await readFile(new URL("contracts/OperationDeclarationSchema.json", import.meta.url), "utf8")));
const manifestSchema = importSchema(JSON.parse(await readFile(new URL("contracts/ManifestDeclarationSchema.json", import.meta.url), "utf8")));

export function registryRequest(body) {
  try {
    const routes = body.routes.flatMap(item => {
      const operations = item.operations.map(operation => {
        const declaration = operationSchema.parse(operation.declaration);
        const schemas = { response: importSchema(operation.response), ...Object.fromEntries(Object.entries(operation.schemas ?? {}).map(([key, schema]) => [key, importSchema(schema)])) };
        const metadata = declaration.sitemap;
        const sitemap = metadata?.kind === "exclude" ? false : metadata?.kind === "provider" ? () => []
          : metadata?.kind === "metadata" ? metadata : undefined;
        return { ...declaration, sitemap, schemas, handler: () => null };
      });
      const primary = operations.find(operation => operation.method === "GET") ?? operations[0];
      return [...new Set([item.path, ...item.pathVariants ?? []])].map(path => ({ viewId: item.viewId, path,
        paramNames: path.split("/").filter(part => part.startsWith(":")).map(part => part.slice(1)), schemas: operations[0].schemas,
        methods: operations.map(operation => operation.method), methodRoutes: Object.fromEntries(operations.map(operation => [operation.method, operation])),
        handlers: Object.fromEntries(operations.map(operation => [operation.method, operation.handler])), title: primary.title, description: primary.description, renderers: {} }));
    });
    const registry = { routes, dependencies: body.dependencies ?? {} };
    const declaration = manifestSchema.parse(body.declaration);
    const manifest = PluginManifestSchema.parse(buildManifestFromRegistry(registry, { version: declaration.version }, declaration));
    return { status: 200, schema: BpSchemaOutputSchema.parse(buildBpSchema(registry, manifest)) };
  } catch { return { status: 400 }; }
}
