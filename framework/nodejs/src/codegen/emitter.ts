import type { ScanResult, ScannedMethodModule, ScannedRoute, ScannedStreamRenderer, ScannedThemeRenderer } from "./scanner.js";

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
 * Build an import alias for a theme renderer module.
 * Pattern: `{viewIdCamel}{ThemeId}{Type|RendererId}`
 *
 * For pages with rendererId="default": `{viewIdCamel}{ThemeId}Page`
 * For components: `{viewIdCamel}{ThemeId}{RendererId}`  (camelCased)
 * For fragments: `{viewIdCamel}{ThemeId}{Location}{Id}`
 */
function themeImportName(
  viewId: string,
  renderer: ScannedThemeRenderer,
): string {
  const base = viewIdToCamel(viewId);
  const theme = capitalize(sanitizeIdentifier(renderer.themeId));
  const statusSuffix = renderer.statusCode !== undefined ? `S${renderer.statusCode}` : "";

  if (renderer.type === "page") {
    if (renderer.method) {
      return `${base}${theme}Page${renderer.method}${statusSuffix}`;
    }
    return `${base}${theme}Page${statusSuffix}`;
  }

  if (renderer.type === "fragment") {
    const loc = capitalize(sanitizeIdentifier(renderer.fragmentLocation ?? ""));
    const id = capitalize(sanitizeIdentifier(renderer.fragmentId ?? ""));
    if (renderer.method) {
      return `${base}${theme}${loc}${id}${renderer.method}${statusSuffix}`;
    }
    return `${base}${theme}${loc}${id}${statusSuffix}`;
  }

  // component
  const rendererName = capitalize(sanitizeIdentifier(renderer.rendererId));
  if (renderer.method) {
    return `${base}${theme}${rendererName}${renderer.method}${statusSuffix}`;
  }
  return `${base}${theme}${rendererName}${statusSuffix}`;
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
  { exportName: "QuerySchema", key: "query" },
  { exportName: "HeadersSchema", key: "headers" },
  { exportName: "RequestSchema", key: "request" },
  { exportName: "MultipartSchema", key: "multipart" },
];

function emitSchemas(route: ScannedRoute, importAlias: string): string {
  const firstMethod = route.methodModules[0];
  if (firstMethod) {
    return emitSchemasFromExports(firstMethod.exports, methodImportName(route.viewId, firstMethod.method));
  }

  return emitSchemasFromExports(route.handlerExports, importAlias);
}

function emitSchemasFromExports(exports: ReadonlyArray<string>, importAlias: string): string {
  const entries: string[] = SCHEMA_EXPORTS
    .filter((s) => exports.includes(s.exportName))
    .map((s) => `${s.key}: ${importAlias}.${s.exportName}`);

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
    const props = [
      `method: ${JSON.stringify(module.method)}`,
      `schemas: ${emitSchemasFromExports(module.exports, alias)}`,
      `handler: ${alias}.default`,
    ];
    if (module.isRaw) props.push("raw: true");
    return `${module.method}: { ${props.join(", ")} }`;
  });
  return `{ ${entries.join(", ")} }`;
}

// -- Theme renderer emission ------------------------------------------

interface RenderersByTheme {
  pages: Array<{ renderer: ScannedThemeRenderer; importName: string }>;
  components: Array<{ renderer: ScannedThemeRenderer; importName: string }>;
  fragments: Array<{ renderer: ScannedThemeRenderer; importName: string; sseImportName?: string }>;
  /** Streaming frame renderers from index.stream.tsx. */
  stream?: { renderer: ScannedStreamRenderer; importName: string };
  /** statusCode -> { page?, components: id -> ..., fragments: loc.id -> ... } */
  statusRenderers: Map<number, {
    pages: Array<{ renderer: ScannedThemeRenderer; importName: string }>;
    components: Map<string, { renderer: ScannedThemeRenderer; importName: string }>;
    fragments: Map<string, { renderer: ScannedThemeRenderer; importName: string }>;
  }>;
}

function emitThemeRenderers(
  renderersByTheme: Map<string, RenderersByTheme>,
): string {
  if (renderersByTheme.size === 0) return "{}";

  const themeLines: string[] = ["{"];

  const themes = [...renderersByTheme.entries()];
  for (let t = 0; t < themes.length; t++) {
    const [themeId, sets] = themes[t];
    const themeComma = t < themes.length - 1 ? "," : "";

    themeLines.push(`        ${JSON.stringify(themeId)}: {`);
    themeLines.push(`          pages: [${emitRendererArray(sets.pages)}],`);
    themeLines.push(`          components: [${emitRendererArray(sets.components)}],`);
    themeLines.push(`          fragments: [${emitRendererArray(sets.fragments)}]${sets.stream ? "," : ""}`);
    if (sets.stream) {
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
      themeLines.push(`          stream: { ${props.join(", ")} }`);
    }
    themeLines.push(`        }${themeComma}`);
  }

  themeLines.push("      }");
  return themeLines.join("\n");
}

function emitStatusRenderers(
  renderersByTheme: Map<string, RenderersByTheme>,
): string | null {
  const themesWithStatus = [...renderersByTheme.entries()].filter(
    ([, sets]) => sets.statusRenderers.size > 0
  );
  if (themesWithStatus.length === 0) return null;

  const lines: string[] = ["{"];
  for (let t = 0; t < themesWithStatus.length; t++) {
    const [themeId, sets] = themesWithStatus[t];
    const themeComma = t < themesWithStatus.length - 1 ? "," : "";

    lines.push(`        ${JSON.stringify(themeId)}: {`);
    const codes = [...sets.statusRenderers.entries()];
    for (let c = 0; c < codes.length; c++) {
      const [code, bucket] = codes[c];
      const codeComma = c < codes.length - 1 ? "," : "";
      const props: string[] = [];
      if (bucket.pages.length > 0) {
        props.push(`pages: [${bucket.pages.map((item) => emitRendererLiteral(item)).join(", ")}]`);
      }
      if (bucket.components.size > 0) {
        const compEntries = [...bucket.components.entries()].map(
          ([id, item]) => `${JSON.stringify(id)}: ${emitRendererLiteral(item)}`
        );
        props.push(`components: { ${compEntries.join(", ")} }`);
      }
      if (bucket.fragments.size > 0) {
        const fragEntries = [...bucket.fragments.entries()].map(
          ([id, item]) => `${JSON.stringify(id)}: ${emitRendererLiteral(item)}`
        );
        props.push(`fragments: { ${fragEntries.join(", ")} }`);
      }
      lines.push(`          ${code}: { ${props.join(", ")} }${codeComma}`);
    }
    lines.push(`        }${themeComma}`);
  }
  lines.push("      }");
  return lines.join("\n");
}

function emitRendererLiteral(item: { renderer: ScannedThemeRenderer; importName: string }): string {
  const props: string[] = [
    `rendererId: ${JSON.stringify(item.renderer.rendererId)}`,
    `type: ${JSON.stringify(item.renderer.type)}`
  ];
  if (item.renderer.method) props.push(`method: ${JSON.stringify(item.renderer.method)}`);
  // statusCode is NOT emitted - RegisteredThemeRenderer has no such field; the
  // status code is already the key of the enclosing statusRenderers map.
  if (item.renderer.fragmentLocation) props.push(`fragmentLocation: ${JSON.stringify(item.renderer.fragmentLocation)}`);
  if (item.renderer.fragmentId) props.push(`fragmentId: ${JSON.stringify(item.renderer.fragmentId)}`);
  props.push(`render: ${item.importName}.render`);
  return `{ ${props.join(", ")} }`;
}

function emitRendererArray(
  items: Array<{ renderer: ScannedThemeRenderer; importName: string; sseImportName?: string }>,
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

    props.push(`render: ${item.importName}.render`);

    if (item.sseImportName) {
      props.push(`sseRender: ${item.sseImportName}.renderTick`);
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

  // Map from theme import name -> ScannedThemeRenderer (for each route)
  const routeThemeImports = new Map<
    ScannedRoute,
    Map<string, RenderersByTheme>
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

    // Group theme renderers by themeId
    const byTheme = new Map<string, RenderersByTheme>();

    for (const renderer of route.themeRenderers) {
      if (!byTheme.has(renderer.themeId)) {
        byTheme.set(renderer.themeId, {
          pages: [],
          components: [],
          fragments: [],
          statusRenderers: new Map()
        });
      }
      const set = byTheme.get(renderer.themeId)!;

      const importName = themeImportName(route.viewId, renderer);
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
      if (!byTheme.has(streamRenderer.themeId)) {
        byTheme.set(streamRenderer.themeId, {
          pages: [],
          components: [],
          fragments: [],
          statusRenderers: new Map()
        });
      }
      const importName = `${viewIdToCamel(route.viewId)}${capitalize(sanitizeIdentifier(streamRenderer.themeId))}Stream`;
      imports.push({
        alias: importName,
        path: toJsImport(streamRenderer.relativePath),
      });
      byTheme.get(streamRenderer.themeId)!.stream = { renderer: streamRenderer, importName };
    }

    routeThemeImports.set(route, byTheme);
  }

  // Emit import statements
  const emittedImports = new Set<string>();
  for (const imp of imports) {
    const key = `${imp.alias}\0${imp.path}`;
    if (emittedImports.has(key)) continue;
    emittedImports.add(key);
    lines.push(`import * as ${imp.alias} from ${JSON.stringify(imp.path)};`);
  }

  lines.push(`import type { BetterPortalRegistry } from "@betterportal/framework";`);
  lines.push("");
  lines.push("export const registry: BetterPortalRegistry = {");
  lines.push("  routes: [");

  // -- Emit routes ----------------------------------------------------

  for (let r = 0; r < scanResult.routes.length; r++) {
    const route = scanResult.routes[r];
    const alias = routeImportName(route.viewId);
    const byTheme = routeThemeImports.get(route)!;
    const routeComma = r < scanResult.routes.length - 1 ? "," : "";

    const hasTitle = route.metadataExports.includes("title");
    const hasDescription = route.metadataExports.includes("description");
    const hasAuth = route.metadataExports.includes("auth");
    const hasRole = route.metadataExports.includes("role");
    const hasDependencies = route.metadataExports.includes("dependencies");
    const hasChrome = route.metadataExports.includes("chrome");
    const hasApiContracts = route.metadataExports.includes("apiContracts");
    const hasCacheHints = route.metadataExports.includes("cacheHints");
    const hasDemoScenarios = route.metadataExports.includes("demoScenarios");

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
    lines.push(`      auth: ${hasAuth ? `${alias}.auth` : `{ required: false, permissions: [] }`},`);
    if (hasRole) {
      lines.push(`      role: ${alias}.role,`);
    }
    if (hasDependencies) {
      if (route.autoDependencies.length > 0) {
        lines.push(`      dependencies: [...new Set([...${alias}.dependencies, ...${JSON.stringify(route.autoDependencies)}])],`);
      } else {
        lines.push(`      dependencies: ${alias}.dependencies,`);
      }
    } else if (route.autoDependencies.length > 0) {
      lines.push(`      dependencies: ${JSON.stringify(route.autoDependencies)},`);
    }
    if (hasChrome) {
      lines.push(`      chrome: ${alias}.chrome,`);
    }
    if (hasApiContracts) {
      lines.push(`      apiContracts: ${alias}.apiContracts,`);
    }
    lines.push(`      cacheHints: ${hasCacheHints ? `${alias}.cacheHints` : `{ ttlSeconds: 0, varyBy: [] }`},`);
    lines.push(`      demoScenarios: ${hasDemoScenarios ? `${alias}.demoScenarios` : `[]`},`);
    const statusBlock = emitStatusRenderers(byTheme);
    lines.push(`      themeRenderers: ${emitThemeRenderers(byTheme)}${(statusBlock || route.hasSseHandler) ? "," : ""}`);
    if (statusBlock) {
      lines.push(`      statusRenderers: ${statusBlock}${route.hasSseHandler ? "," : ""}`);
    }
    if (route.hasSseHandler) {
      const sseAlias = `${viewIdToCamel(route.viewId)}Sse`;
      const props = [`handler: ${sseAlias}.handleSSE`];
      if (route.sseHasTickSchema) props.push(`tickSchema: ${sseAlias}.tickSchema`);
      lines.push(`      sse: { ${props.join(", ")} }`);
    }
    lines.push(`    }${routeComma}`);
  }

  lines.push("  ]");
  lines.push("};");
  lines.push("");

  return lines.join("\n");
}

export function emitRouteRuntime(scanResult: ScanResult): string {
  const hasPlugin = scanResult.pluginExports.includes("Plugin");
  const hasServiceConfig = scanResult.pluginExports.includes("ServiceConfig");
  const lines: string[] = [
    "// AUTO-GENERATED by BetterPortal codegen - DO NOT EDIT",
    `import {`,
    `  createHandler as baseCreateHandler,`,
    `  createRawHandler as baseCreateRawHandler,`,
    `  createStreamHandler as baseCreateStreamHandler`,
    `} from "@betterportal/framework";`
  ];

  const importedTypes: string[] = [];
  if (hasPlugin) importedTypes.push("Plugin");
  if (hasServiceConfig) importedTypes.push("ServiceConfig");

  if (importedTypes.length > 0) {
    lines.push(`import type { ${importedTypes.join(", ")} } from ${JSON.stringify(scanResult.pluginImportPath)};`);
  }
  if (!hasPlugin) {
    lines.push("type Plugin = unknown;");
  }
  if (!hasServiceConfig) {
    lines.push("type ServiceConfig = Record<string, unknown>;");
  }

  lines.push("");
  lines.push("export const createHandler = baseCreateHandler.forContext<Plugin, ServiceConfig>();");
  lines.push("export const createRawHandler = baseCreateRawHandler.forContext<Plugin, ServiceConfig>();");
  lines.push("export const createStreamHandler = baseCreateStreamHandler.forContext<Plugin, ServiceConfig>();");
  lines.push("");

  return lines.join("\n");
}
