import type { ScanResult, ScannedRoute, ScannedThemeRenderer } from "./scanner.js";

// ── Naming helpers ───────────────────────────────────────────────────

/**
 * Convert a viewId like "users.$userId.index" to a camelCase identifier
 * suitable for use as a JavaScript variable name.
 *
 * Steps:
 *  1. Remove the trailing ".index" suffix.
 *  2. Replace `$paramName` → `ParamName` (capitalize after $).
 *  3. Split on dots, capitalize each segment after the first.
 *
 * Example: "users.$userId.index" → "usersUserId"
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

  if (renderer.type === "page") {
    if (renderer.method) {
      return `${base}${theme}Page${renderer.method}`;
    }
    return `${base}${theme}Page`;
  }

  if (renderer.type === "fragment") {
    const loc = capitalize(sanitizeIdentifier(renderer.fragmentLocation ?? ""));
    const id = capitalize(sanitizeIdentifier(renderer.fragmentId ?? ""));
    if (renderer.method) {
      return `${base}${theme}${loc}${id}${renderer.method}`;
    }
    return `${base}${theme}${loc}${id}`;
  }

  // component
  const rendererName = capitalize(sanitizeIdentifier(renderer.rendererId));
  if (renderer.method) {
    return `${base}${theme}${rendererName}${renderer.method}`;
  }
  return `${base}${theme}${rendererName}`;
}

/**
 * Sanitize a string for use as part of a JS identifier.
 * Converts dashes and dots to camelCase boundaries.
 */
function sanitizeIdentifier(s: string): string {
  return s.replace(/[-.](\w)/g, (_match, char: string) => char.toUpperCase());
}

// ── Import path helpers ──────────────────────────────────────────────

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

// ── Schema emission ──────────────────────────────────────────────────

const SCHEMA_EXPORTS: ReadonlyArray<{ exportName: string; key: string }> = [
  { exportName: "ResponseSchema", key: "response" },
  { exportName: "QuerySchema", key: "query" },
  { exportName: "HeadersSchema", key: "headers" },
  { exportName: "RequestSchema", key: "request" },
];

function emitSchemas(route: ScannedRoute, importAlias: string): string {
  const lines: string[] = [];
  const detectedSchemas = SCHEMA_EXPORTS.filter(
    (s) => route.handlerExports.includes(s.exportName),
  );

  if (detectedSchemas.length === 0) {
    return "{}";
  }

  lines.push("{");
  for (let i = 0; i < detectedSchemas.length; i++) {
    const schema = detectedSchemas[i];
    const comma = i < detectedSchemas.length - 1 ? "," : "";
    lines.push(`        ${schema.key}: ${importAlias}.${schema.exportName}${comma}`);
  }
  lines.push("      }");
  return lines.join("\n");
}

// ── Handler emission ─────────────────────────────────────────────────

function emitHandlers(route: ScannedRoute, importAlias: string): string {
  const handlerExports = route.handlerExports.filter((e) =>
    e.startsWith("handle"),
  );

  if (handlerExports.length === 0) return "{}";

  const entries: string[] = [];
  for (const handler of handlerExports) {
    if (handler === "handleGetPost") {
      entries.push(`GET: ${importAlias}.${handler}`);
      entries.push(`POST: ${importAlias}.${handler}`);
    } else {
      const method = handler.replace("handle", "").toUpperCase();
      entries.push(`${method}: ${importAlias}.${handler}`);
    }
  }

  return `{ ${entries.join(", ")} }`;
}

// ── Theme renderer emission ──────────────────────────────────────────

interface RenderersByTheme {
  pages: Array<{ renderer: ScannedThemeRenderer; importName: string }>;
  components: Array<{ renderer: ScannedThemeRenderer; importName: string }>;
  fragments: Array<{ renderer: ScannedThemeRenderer; importName: string; sseImportName?: string }>;
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
    themeLines.push(`          fragments: [${emitRendererArray(sets.fragments)}]`);
    themeLines.push(`        }${themeComma}`);
  }

  themeLines.push("      }");
  return themeLines.join("\n");
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

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate the `.bp-generated/registry.ts` file content from scan results.
 */
export function emitRegistry(scanResult: ScanResult): string {
  const lines: string[] = [];

  lines.push("// AUTO-GENERATED by BetterPortal codegen — DO NOT EDIT");

  // ── Collect imports ────────────────────────────────────────────────

  const imports: Array<{ alias: string; path: string }> = [];

  // Map from theme import name → ScannedThemeRenderer (for each route)
  const routeThemeImports = new Map<
    ScannedRoute,
    Map<string, RenderersByTheme>
  >();

  for (const route of scanResult.routes) {
    const alias = routeImportName(route.viewId);
    imports.push({ alias, path: routeImportPath(route) });

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
        byTheme.set(renderer.themeId, { pages: [], components: [], fragments: [] });
      }
      const set = byTheme.get(renderer.themeId)!;

      const importName = themeImportName(route.viewId, renderer);
      imports.push({
        alias: importName,
        path: toJsImport(renderer.relativePath),
      });

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

    routeThemeImports.set(route, byTheme);
  }

  // Emit import statements
  for (const imp of imports) {
    lines.push(`import * as ${imp.alias} from ${JSON.stringify(imp.path)};`);
  }

  lines.push(`import type { BetterPortalRegistry } from "@betterportal/framework";`);
  lines.push("");
  lines.push("export const registry: BetterPortalRegistry = {");
  lines.push("  routes: [");

  // ── Emit routes ────────────────────────────────────────────────────

  for (let r = 0; r < scanResult.routes.length; r++) {
    const route = scanResult.routes[r];
    const alias = routeImportName(route.viewId);
    const byTheme = routeThemeImports.get(route)!;
    const routeComma = r < scanResult.routes.length - 1 ? "," : "";

    const hasTitle = route.handlerExports.includes("title");
    const hasDescription = route.handlerExports.includes("description");
    const hasAuth = route.handlerExports.includes("auth");
    const hasCacheHints = route.handlerExports.includes("cacheHints");
    const hasDemoScenarios = route.handlerExports.includes("demoScenarios");

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
    lines.push(`      handlers: ${emitHandlers(route, alias)},`);
    lines.push(`      title: ${hasTitle ? `${alias}.title` : JSON.stringify(fallbackTitle)},`);
    lines.push(`      description: ${hasDescription ? `${alias}.description` : `""`},`);
    lines.push(`      auth: ${hasAuth ? `${alias}.auth` : `{ required: false, realm: "runtime", minimumTier: "public", audiences: [], permissions: [] }`},`);
    lines.push(`      cacheHints: ${hasCacheHints ? `${alias}.cacheHints` : `{ ttlSeconds: 0, varyBy: [] }`},`);
    lines.push(`      demoScenarios: ${hasDemoScenarios ? `${alias}.demoScenarios` : `[]`},`);
    lines.push(`      themeRenderers: ${emitThemeRenderers(byTheme)}${route.hasSseHandler ? "," : ""}`);
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
