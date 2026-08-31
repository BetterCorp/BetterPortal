import type { ScanResult, ScannedMethodModule, ScannedRoute, ScannedStreamRenderer, ScannedViewRenderer } from "./scanner.js";

// -- Naming helpers ---------------------------------------------------

/**
 * Convert a viewId like "users.$userId.index" to a camelCase identifier
 * suitable for use as a JavaScript variable name.
 *
 * Steps:
 *  1. Remove the trailing ".index" suffix.
 *  2. Replace `$paramName` -> `ParamName` (capitalize after $).
 *  3. Split on dots, capitalize each segment after the first.
 *
 * Example: "users.$userId.index" -> "usersUserId"
 */
function viewIdToCamel(viewId: string): string {
  // Strip trailing .index
  let base = viewId.endsWith(".index") ? viewId.slice(0, -6) : viewId;

  // Replace $param with capitalized param name
  base = base.replace(/\$(\w)/g, (_match, firstChar: string) => firstChar.toUpperCase());

  // Split on dots and camelCase
  const parts = base.split(".");
  return parts
    .map((part, i) => (i === 0 ? sanitizeIdentifier(part) : capitalize(sanitizeIdentifier(part))))
    .join("");
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build an import alias for a route module.
 * Pattern: `{viewIdCamel}Route`
 */
function routeImportName(viewId: string): string {
  return `${viewIdToCamel(viewId)}Route`;
}

function methodImportName(viewId: string, method: string): string {
  return `${viewIdToCamel(viewId)}${method}Route`;
}

/**
 * Build an import alias for a view renderer module.
 * Pattern: `{viewIdCamel}{RendererKey}{Type|RendererId}`
 *
 * For pages with rendererId="default": `{viewIdCamel}{RendererKey}Page`
 * For components: `{viewIdCamel}{RendererKey}{RendererId}`  (camelCased)
 * For fragments: `{viewIdCamel}{RendererKey}{Location}{Id}`
 */
function rendererImportName(
  viewId: string,
  renderer: ScannedViewRenderer,
): string {
  const base = viewIdToCamel(viewId);
  const rendererName = capitalize(sanitizeIdentifier(renderer.rendererKey));
  const statusSuffix = renderer.statusCode !== undefined ? `S${renderer.statusCode}` : "";

  if (renderer.type === "page") {
    if (renderer.method) {
      return `${base}${rendererName}Page${renderer.method}${statusSuffix}`;
    }
    return `${base}${rendererName}Page${statusSuffix}`;
  }

  if (renderer.type === "fragment") {
    const loc = capitalize(sanitizeIdentifier(renderer.fragmentLocation ?? ""));
    const id = capitalize(sanitizeIdentifier(renderer.fragmentId ?? ""));
    if (renderer.method) {
      return `${base}${rendererName}${loc}${id}${renderer.method}${statusSuffix}`;
    }
    return `${base}${rendererName}${loc}${id}${statusSuffix}`;
  }

  // component
  const variantName = capitalize(sanitizeIdentifier(renderer.rendererId));
  if (renderer.method) {
    return `${base}${rendererName}${variantName}${renderer.method}${statusSuffix}`;
  }
  return `${base}${rendererName}${variantName}${statusSuffix}`;
}

/**
 * Sanitize a string for use as part of a JS identifier.
 * Converts dashes and dots to camelCase boundaries.
 */
function sanitizeIdentifier(s: string): string {
  return s.replace(/[-.](\w)/g, (_match, char: string) => char.toUpperCase());
}

// -- Import path helpers ----------------------------------------------

/**
 * Convert a relative path to a .js import specifier.
 * Strips .ts/.tsx extension and appends .js.
 */
function toJsImport(relativePath: string): string {
  return relativePath
    .replace(/\.tsx?$/, ".js");
}

/**
 * For a route directory, build the import path pointing to its index.ts.
 */
function routeImportPath(route: ScannedRoute): string {
  return toJsImport(`${route.relativePath}/index.ts`);
}

function methodImportPath(methodModule: ScannedMethodModule): string {
  return toJsImport(methodModule.relativePath);
}

// -- Schema emission --------------------------------------------------

const SCHEMA_EXPORTS: ReadonlyArray<{ exportName: string; key: string }> = [
  { exportName: "ResponseSchema", key: "response" },
  { exportName: "ParamsSchema", key: "params" },
  { exportName: "QuerySchema", key: "query" },
  { exportName: "HeadersSchema", key: "headers" },
  { exportName: "RequestSchema", key: "request" },
  { exportName: "MultipartSchema", key: "multipart" },
];

function emitSchemas(route: ScannedRoute, importAlias: string): string {
  return route.metadataExports.includes("ParamsSchema")
    ? emitSchemasFromExports(["ParamsSchema"], importAlias)
    : "{}";
}

function emitSchemasFromExports(
  exports: ReadonlyArray<string>,
  importAlias: string,
  extra: ReadonlyArray<{ key: string; value: string }> = []
): string {
  const entries: string[] = extra.map((entry) => `${entry.key}: ${entry.value}`);
  entries.push(...SCHEMA_EXPORTS
    .filter((s) => exports.includes(s.exportName))
    .filter((s) => !extra.some((entry) => entry.key === s.key))
    .map((s) => `${s.key}: ${importAlias}.${s.exportName}`));

  if (exports.includes("ItemSchema")) {
    if (!exports.includes("ResponseSchema")) {
      entries.unshift(`response: ${importAlias}.default.responseSchema`);
    }
    entries.push(`item: ${importAlias}.ItemSchema`);
    if (exports.includes("SummarySchema")) {
      entries.push(`summary: ${importAlias}.SummarySchema`);
    }
  }

  if (entries.length === 0) {
    return "{}";
  }

  const lines: string[] = ["{"];
  for (let i = 0; i < entries.length; i++) {
    const comma = i < entries.length - 1 ? "," : "";
    lines.push(`        ${entries[i]}${comma}`);
  }
  lines.push("      }");
  return lines.join("\n");
}

// -- Handler emission -------------------------------------------------

function emitHandlers(route: ScannedRoute): string {
  if (route.methodModules.length === 0) return "{}";
  const entries = route.methodModules.map((module) =>
    `${module.method}: ${methodImportName(route.viewId, module.method)}.default`
  );

  return `{ ${entries.join(", ")} }`;
}

function emitMethodRoutes(route: ScannedRoute): string {
  if (route.methodModules.length === 0) return "{}";
  const entries = route.methodModules.map((module) => {
    const alias = methodImportName(route.viewId, module.method);
    const params = route.metadataExports.includes("ParamsSchema")
      ? [{ key: "params", value: `${routeImportName(route.viewId)}.ParamsSchema` }]
      : [];
    const props = [
      `method: ${JSON.stringify(module.method)}`,
      `operationId: ${alias}.operationId`,
      `title: ${alias}.title`,
      `description: ${alias}.description`,
      `schemas: ${emitSchemasFromExports(module.exports, alias, params)}`,
      `handler: ${alias}.default`,
      `auth: ${alias}.auth`,
      `cacheHints: ${module.exports.includes("cacheHints") ? `${alias}.cacheHints` : `{ ttlSeconds: 0, varyBy: [] }`}`,
      `demoScenarios: ${module.exports.includes("demoScenarios") ? `${alias}.demoScenarios` : "[]"}`,
    ];
    if (module.isRaw) props.push("raw: true");
    for (const metadata of ["sitemap", "robots", "role", "chrome", "apiContracts"] as const) {
      if (module.exports.includes(metadata)) props.push(`${metadata}: ${alias}.${metadata}`);
    }
    if (module.exports.includes("dependencies")) props.push(`dependencies: ${alias}.dependencies`);
    return `${module.method}: { ${props.join(", ")} }`;
  });
  return `{ ${entries.join(", ")} }`;
}

// -- View renderer emission -------------------------------------------

interface RenderersByRenderer {
  pages: Array<{ renderer: ScannedViewRenderer; importName: string }>;
  components: Array<{ renderer: ScannedViewRenderer; importName: string }>;
  fragments: Array<{ renderer: ScannedViewRenderer; importName: string; sseImportName?: string }>;
  /** Streaming frame renderers from index.stream.tsx. */
  stream?: { renderer: ScannedStreamRenderer; importName: string };
  /** statusCode -> { page?, components: id -> ..., fragments: loc.id -> ... } */
  statusRenderers: Map<number, {
    pages: Array<{ renderer: ScannedViewRenderer; importName: string }>;
    components: Map<string, { renderer: ScannedViewRenderer; importName: string }>;
    fragments: Map<string, { renderer: ScannedViewRenderer; importName: string }>;
  }>;
}

function emitRenderers(
  route: ScannedRoute,
  renderersByRenderer: Map<string, RenderersByRenderer>,
): string {
  if (renderersByRenderer.size === 0) return "{}";

  const rendererLines: string[] = ["{"];

  const rendererEntries = [...renderersByRenderer.entries()];
  for (let t = 0; t < rendererEntries.length; t++) {
    const [rendererKey, sets] = rendererEntries[t];
    const rendererComma = t < rendererEntries.length - 1 ? "," : "";

    rendererLines.push(`        ${JSON.stringify(rendererKey)}: {`);
    rendererLines.push(`          pages: [${emitRendererArray(route, sets.pages)}],`);
    rendererLines.push(`          components: [${emitRendererArray(route, sets.components)}],`);
    rendererLines.push(`          fragments: [${emitRendererArray(route, sets.fragments)}]${sets.stream ? "," : ""}`);
    if (sets.stream) {
      const streamMethod = route.methodModules.find((module) => module.exports.includes("ItemSchema"));
      if (!streamMethod) throw new Error(`Streaming renderer for ${route.viewId} has no stream handler`);
      const handler = `${methodImportName(route.viewId, streamMethod.method)}.default`;
      const props = [
        `renderShell: ${sets.stream.importName}.renderShell`,
        `renderItem: ${sets.stream.importName}.renderItem`
      ];
      if (sets.stream.renderer.exports.includes("renderSummary")) {
        props.push(`renderSummary: ${sets.stream.importName}.renderSummary`);
      }
      if (sets.stream.renderer.exports.includes("renderError")) {
        props.push(`renderError: ${sets.stream.importName}.renderError`);
      }
      rendererLines.push(`          stream: ({ ${props.join(", ")} } satisfies StreamRendererSetFor<typeof ${handler}>)`);
    }
    rendererLines.push(`        }${rendererComma}`);
  }

  rendererLines.push("      }");
  return rendererLines.join("\n");
}

function emitStatusRenderers(
  route: ScannedRoute,
  renderersByRenderer: Map<string, RenderersByRenderer>,
): string | null {
  const renderersWithStatus = [...renderersByRenderer.entries()].filter(
    ([, sets]) => sets.statusRenderers.size > 0
  );
  if (renderersWithStatus.length === 0) return null;

  const lines: string[] = ["{"];
  for (let t = 0; t < renderersWithStatus.length; t++) {
    const [rendererKey, sets] = renderersWithStatus[t];
    const rendererComma = t < renderersWithStatus.length - 1 ? "," : "";

    lines.push(`        ${JSON.stringify(rendererKey)}: {`);
    const codes = [...sets.statusRenderers.entries()];
    for (let c = 0; c < codes.length; c++) {
      const [code, bucket] = codes[c];
      const codeComma = c < codes.length - 1 ? "," : "";
      const props: string[] = [];
      if (bucket.pages.length > 0) {
        props.push(`pages: [${bucket.pages.map((item) => emitRendererLiteral(route, item)).join(", ")}]`);
      }
      if (bucket.components.size > 0) {
        const compEntries = [...bucket.components.entries()].map(
          ([id, item]) => `${JSON.stringify(id)}: ${emitRendererLiteral(route, item)}`
        );
        props.push(`components: { ${compEntries.join(", ")} }`);
      }
      if (bucket.fragments.size > 0) {
        const fragEntries = [...bucket.fragments.entries()].map(
          ([id, item]) => `${JSON.stringify(id)}: ${emitRendererLiteral(route, item)}`
        );
        props.push(`fragments: { ${fragEntries.join(", ")} }`);
      }
      lines.push(`          ${code}: { ${props.join(", ")} }${codeComma}`);
    }
    lines.push(`        }${rendererComma}`);
  }
  lines.push("      }");
  return lines.join("\n");
}

function emitRendererLiteral(route: ScannedRoute, item: { renderer: ScannedViewRenderer; importName: string }): string {
  const props: string[] = [
    `rendererId: ${JSON.stringify(item.renderer.rendererId)}`,
    `type: ${JSON.stringify(item.renderer.type)}`
  ];
  if (item.renderer.method) props.push(`method: ${JSON.stringify(item.renderer.method)}`);
  // statusCode is NOT emitted - RegisteredViewRenderer has no such field; the
  // status code is already the key of the enclosing statusRenderers map.
  if (item.renderer.fragmentLocation) props.push(`fragmentLocation: ${JSON.stringify(item.renderer.fragmentLocation)}`);
  if (item.renderer.fragmentId) props.push(`fragmentId: ${JSON.stringify(item.renderer.fragmentId)}`);
  const handler = `${methodImportName(route.viewId, item.renderer.method!)}.default`;
  props.push(`render: (${item.importName}.render satisfies ViewRendererFor<typeof ${handler}>)`);
  return `{ ${props.join(", ")} }`;
}

function emitRendererArray(
  route: ScannedRoute,
  items: Array<{ renderer: ScannedViewRenderer; importName: string; sseImportName?: string }>,
): string {
  if (items.length === 0) return "";

  const parts = items.map((item) => {
    const props: string[] = [
      `rendererId: ${JSON.stringify(item.renderer.rendererId)}`,
      `type: ${JSON.stringify(item.renderer.type)}`,
    ];

    if (item.renderer.method) {
      props.push(`method: ${JSON.stringify(item.renderer.method)}`);
    }
    if (item.renderer.fragmentLocation) {
      props.push(`fragmentLocation: ${JSON.stringify(item.renderer.fragmentLocation)}`);
    }
    if (item.renderer.fragmentId) {
      props.push(`fragmentId: ${JSON.stringify(item.renderer.fragmentId)}`);
    }

    const handler = `${methodImportName(route.viewId, item.renderer.method!)}.default`;
    props.push(`render: (${item.importName}.render satisfies ViewRendererFor<typeof ${handler}>)`);

    if (item.sseImportName) {
      const sseContract = `${viewIdToCamel(route.viewId)}Sse.default`;
      props.push(`sseRender: (${item.sseImportName}.renderTick satisfies SseRendererFor<typeof ${sseContract}>)`);
    }

    return `{ ${props.join(", ")} }`;
  });

  return parts.join(", ");
}

// -- Public API -------------------------------------------------------

/**
 * Generate the `.bp-generated/registry.ts` file content from scan results.
 */
export function emitRegistry(scanResult: ScanResult): string {
  const lines: string[] = [];

  lines.push("// AUTO-GENERATED by BetterPortal codegen - DO NOT EDIT");

  // -- Collect imports ------------------------------------------------

  const imports: Array<{ alias: string; path: string }> = [];
  const shellFragmentImports = scanResult.shellFragments.map((fragment, index) => ({
    fragment,
    alias: `shellFragment${index}`
  }));
  for (const item of shellFragmentImports) {
    imports.push({ alias: item.alias, path: toJsImport(item.fragment.relativePath) });
  }

  // Map from theme import name -> ScannedViewRenderer (for each route)
  const routeRendererImports = new Map<
    ScannedRoute,
    Map<string, RenderersByRenderer>
  >();

  for (const route of scanResult.routes) {
    const alias = routeImportName(route.viewId);
    imports.push({ alias, path: routeImportPath(route) });
    for (const methodModule of route.methodModules) {
      imports.push({
        alias: methodImportName(route.viewId, methodModule.method),
        path: methodImportPath(methodModule),
      });
    }

    // SSE handler import
    if (route.hasSseHandler && route.sseRelativePath) {
      imports.push({
        alias: `${viewIdToCamel(route.viewId)}Sse`,
        path: toJsImport(route.sseRelativePath),
      });
    }

    // Group HTML renderers by compatibility key.
    const byRenderer = new Map<string, RenderersByRenderer>();

    for (const renderer of route.renderers) {
      if (!byRenderer.has(renderer.rendererKey)) {
        byRenderer.set(renderer.rendererKey, {
          pages: [],
          components: [],
          fragments: [],
          statusRenderers: new Map()
        });
      }
      const set = byRenderer.get(renderer.rendererKey)!;

      const importName = rendererImportName(route.viewId, renderer);
      imports.push({
        alias: importName,
        path: toJsImport(renderer.relativePath),
      });

      // Status-specific renderer goes into statusRenderers, not the default arrays.
      if (renderer.statusCode !== undefined) {
        let bucket = set.statusRenderers.get(renderer.statusCode);
        if (!bucket) {
          bucket = { pages: [], components: new Map(), fragments: new Map() };
          set.statusRenderers.set(renderer.statusCode, bucket);
        }
        switch (renderer.type) {
          case "page":
            bucket.pages.push({ renderer, importName });
            break;
          case "component":
            bucket.components.set(renderer.rendererId, { renderer, importName });
            break;
          case "fragment":
            bucket.fragments.set(renderer.rendererId, { renderer, importName });
            break;
        }
        continue;
      }

      switch (renderer.type) {
        case "page":
          set.pages.push({ renderer, importName });
          break;
        case "component":
          set.components.push({ renderer, importName });
          break;
        case "fragment": {
          let sseImportName: string | undefined;
          if (renderer.sseRendererPath) {
            sseImportName = `${importName}Sse`;
            imports.push({
              alias: sseImportName,
              path: toJsImport(renderer.sseRendererPath),
            });
          }
          set.fragments.push({ renderer, importName, sseImportName });
          break;
        }
      }
    }

    // Streaming frame renderers (index.stream.tsx) - one per theme
    for (const streamRenderer of route.streamRenderers) {
      if (!byRenderer.has(streamRenderer.rendererKey)) {
        byRenderer.set(streamRenderer.rendererKey, {
          pages: [],
          components: [],
          fragments: [],
          statusRenderers: new Map()
        });
      }
      const importName = `${viewIdToCamel(route.viewId)}${capitalize(sanitizeIdentifier(streamRenderer.rendererKey))}Stream`;
      imports.push({
        alias: importName,
        path: toJsImport(streamRenderer.relativePath),
      });
      byRenderer.get(streamRenderer.rendererKey)!.stream = { renderer: streamRenderer, importName };
    }

    routeRendererImports.set(route, byRenderer);
  }

  // Emit import statements
  const emittedImports = new Set<string>();
  for (const imp of imports) {
    const key = `${imp.alias}\0${imp.path}`;
    if (emittedImports.has(key)) continue;
    emittedImports.add(key);
    lines.push(`import * as ${imp.alias} from ${JSON.stringify(imp.path)};`);
  }

  const frameworkTypes = ["BetterPortalRegistry"];
  if (scanResult.routes.some((route) => route.renderers.some((renderer) => renderer.sseRendererPath))) {
    frameworkTypes.push("SseRendererFor");
  }
  if (scanResult.routes.some((route) => route.streamRenderers.length > 0)) {
    frameworkTypes.push("StreamRendererSetFor");
  }
  if (scanResult.routes.some((route) => route.renderers.length > 0)) {
    frameworkTypes.push("ViewRendererFor");
  }
  lines.push(`import type { ${frameworkTypes.join(", ")} } from "@betterportal/framework";`);
  lines.push("");
  lines.push("export const registry = {");
  if (Object.keys(scanResult.dependencyAliases).length > 0) {
    lines.push(`  dependencies: ${JSON.stringify(scanResult.dependencyAliases)},`);
  }
  lines.push("  routes: [");

  // -- Emit routes ----------------------------------------------------

  for (let r = 0; r < scanResult.routes.length; r++) {
    const route = scanResult.routes[r];
    const alias = routeImportName(route.viewId);
    const byRenderer = routeRendererImports.get(route)!;
    const routeComma = r < scanResult.routes.length - 1 ? "," : "";

    const hasTitle = route.metadataExports.includes("title");
    const hasDescription = route.metadataExports.includes("description");

    // Derive a fallback title from the viewId
    const fallbackTitle = route.viewId
      .replace(/\.index$/, "")
      .split(".")
      .map((s) => s.startsWith("$") ? s : capitalize(s))
      .join(" ");

    lines.push("    {");
    lines.push(`      viewId: ${JSON.stringify(route.viewId)},`);
    lines.push(`      path: ${JSON.stringify(route.path)},`);
    lines.push(`      methods: ${JSON.stringify(route.methods)},`);
    lines.push(`      paramNames: ${JSON.stringify(route.paramNames)},`);
    lines.push(`      schemas: ${emitSchemas(route, alias)},`);
    lines.push(`      methodRoutes: ${emitMethodRoutes(route)},`);
    lines.push(`      handlers: ${emitHandlers(route)},`);
    if (route.isRaw) {
      lines.push(`      raw: true,`);
    }
    lines.push(`      title: ${hasTitle ? `${alias}.title` : JSON.stringify(fallbackTitle)},`);
    lines.push(`      description: ${hasDescription ? `${alias}.description` : `""`},`);
    const statusBlock = emitStatusRenderers(route, byRenderer);
    lines.push(`      renderers: ${emitRenderers(route, byRenderer)}${(statusBlock || route.hasSseHandler) ? "," : ""}`);
    if (statusBlock) {
      lines.push(`      statusRenderers: ${statusBlock}${route.hasSseHandler ? "," : ""}`);
    }
    if (route.hasSseHandler) {
      const sseAlias = `${viewIdToCamel(route.viewId)}Sse`;
      lines.push(`      sse: ${sseAlias}.default`);
    }
    lines.push(`    }${routeComma}`);
  }

  lines.push("  ],");
  lines.push("  shellFragments: [");
  for (const { fragment, alias } of shellFragmentImports) {
    lines.push("    {");
    lines.push(`      id: ${JSON.stringify(fragment.id)},`);
    lines.push(`      kind: ${JSON.stringify(fragment.kind)},`);
    lines.push(`      title: ${alias}.title,`);
    lines.push(`      description: ${alias}.description,`);
    if (fragment.kind === "block") lines.push(`      defaultItems: ${alias}.defaultItems,`);
    lines.push(`      render: ${alias}.render`);
    lines.push("    },");
  }
  lines.push("  ]");
  lines.push("} satisfies BetterPortalRegistry;");
  lines.push("");

  return lines.join("\n");
}

export function emitRouteRuntime(scanResult: ScanResult): string {
  const hasPluginFeature = scanResult.pluginExports.includes("PluginFeature");
  const hasServiceConfig = scanResult.pluginExports.includes("ServiceConfig");
  const lines: string[] = [
    "// AUTO-GENERATED by BetterPortal codegen - DO NOT EDIT",
    `import {`,
    `  createHandler as baseCreateHandler,`,
    `  createRawHandler as baseCreateRawHandler,`,
    `  createSse as baseCreateSse,`,
    `  createStreamHandler as baseCreateStreamHandler`,
    `} from "@betterportal/framework";`
  ];

  const importedTypes: string[] = [];
  if (hasPluginFeature) importedTypes.push("PluginFeature");
  if (hasServiceConfig) importedTypes.push("ServiceConfig");

  if (importedTypes.length > 0) {
    lines.push(`import type { ${importedTypes.join(", ")} } from ${JSON.stringify(scanResult.pluginImportPath)};`);
  }
  if (!hasPluginFeature) {
    lines.push("// Export PluginFeature from the service plugin index to expose an explicit handler context surface.");
    lines.push("type PluginFeature = Record<never, never>;");
  }
  if (!hasServiceConfig) {
    lines.push("type ServiceConfig = Record<string, unknown>;");
  }

  lines.push("");
  lines.push("export const createHandler = baseCreateHandler.forContext<PluginFeature, ServiceConfig>();");
  lines.push("export const createRawHandler = baseCreateRawHandler.forContext<PluginFeature, ServiceConfig>();");
  lines.push("export const createSse = baseCreateSse.forContext<PluginFeature, ServiceConfig>();");
  lines.push("export const createStreamHandler = baseCreateStreamHandler.forContext<PluginFeature, ServiceConfig>();");
  const sseRoutes = [...new Map(scanResult.routes
    .filter((route) => route.sseHasContract && route.sseRelativePath)
    .map((route) => [route.viewId, route])).values()];
  if (sseRoutes.length > 0) {
    lines.push("");
    lines.push(`declare module "@betterportal/framework" {`);
    lines.push("  interface BetterPortalSseContracts {");
    for (const route of sseRoutes) {
      lines.push(`    ${JSON.stringify(route.viewId)}: import("anyvali").Infer<typeof import(${JSON.stringify(toJsImport(route.sseRelativePath!))}).InputSchema>;`);
    }
    lines.push("  }");
    lines.push("}");
  }
  lines.push("");

  return lines.join("\n");
}
