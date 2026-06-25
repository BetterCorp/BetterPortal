import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

// -- Scanned types ----------------------------------------------------

export interface ScannedThemeRenderer {
  themeId: string;
  rendererId: string;
  type: "page" | "component" | "fragment";
  method?: string;
  /** HTTP status code this renderer handles (e.g., 401, 404, 500). Undefined = default (200/success). */
  statusCode?: number;
  fragmentLocation?: string;
  fragmentId?: string;
  relativePath: string;
  /** Path to `_<location>.<id>.sse.tsx` (sibling SSE renderer for this fragment). */
  sseRendererPath?: string;
  renderParamWarning?: "missing" | "any" | "unknown";
}

/** Streaming frame renderers for one theme - from `_theme.<id>/index.stream.tsx`. */
export interface ScannedStreamRenderer {
  themeId: string;
  relativePath: string;
  /** Render exports found in the file (renderShell/renderItem/renderSummary/renderError). */
  exports: string[];
}

export interface ScannedMethodModule {
  method: string;
  relativePath: string;
  exports: string[];
  isRaw: boolean;
  looseSchemas: string[];
}

export interface ScannedRoute {
  viewId: string;
  path: string;
  paramNames: string[];
  relativePath: string;
  metadataExports: string[];
  methodModules: ScannedMethodModule[];
  /** @deprecated use metadataExports or methodModules. */
  handlerExports: string[];
  methods: string[];
  themeRenderers: ScannedThemeRenderer[];
  /** Per-theme streaming renderers (streaming views only). */
  streamRenderers: ScannedStreamRenderer[];
  sseRelativePath?: string;
  sseMethod?: string;
  hasSseHandler: boolean;
  /** Whether sse.ts exports a `tickSchema` for SSE message validation. */
  sseHasTickSchema?: boolean;
  /** Whether index.ts exports an `ItemSchema` (streaming view, see spec/streaming.md). */
  hasItemSchema: boolean;
  /** Whether index.ts exports a `SummarySchema`. */
  hasSummarySchema: boolean;
  /** Whether any route handler is created with createRawHandler(). */
  isRaw: boolean;
  /** Exported schema names that use loose anyvali validators. */
  looseSchemas: string[];
  autoDependencies: string[];
}

export interface ScanResult {
  routes: ScannedRoute[];
  generatedDir: string;
  pluginImportPath: string;
  pluginExports: string[];
}

// -- Path helpers -----------------------------------------------------

/** Normalize a filesystem path to posix (forward slashes). */
function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Build a relative import path from the .bp-generated/ directory
 * to a target file, using posix separators.
 */
function relativeFromGenerated(generatedDir: string, targetPath: string): string {
  const rel = path.relative(generatedDir, targetPath);
  const posix = toPosix(rel);
  return posix.startsWith(".") ? posix : `./${posix}`;
}

function toJsImport(relativePath: string): string {
  return relativePath.replace(/\.tsx?$/, ".js");
}

// -- Handler / export detection ---------------------------------------

const HANDLER_NAMES = [
  "handleGet",
  "handlePost",
  "handleGetPost",
  "handlePut",
  "handlePatch",
  "handleDelete",
  "handleOptions",
] as const;

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

const WELL_KNOWN_EXPORTS = [
  "ResponseSchema",
  "QuerySchema",
  "HeadersSchema",
  "RequestSchema",
  "MultipartSchema",
  "ItemSchema",
  "SummarySchema",
  "viewId",
  "title",
  "description",
  "auth",
  "role",
  "dependencies",
  "chrome",
  "apiContracts",
  "cacheHints",
  "demoScenarios",
  "handleSSE",
  "tickSchema",
  // stream renderer exports (index.stream.tsx)
  "renderShell",
  "renderItem",
  "renderSummary",
  "renderError",
] as const;

const ALL_DETECTABLE = [...HANDLER_NAMES, ...WELL_KNOWN_EXPORTS] as const;

/** Map handler function name -> HTTP method(s). */
function handlerToMethods(handlerName: string): string[] {
  switch (handlerName) {
    case "handleGet": return ["GET"];
    case "handlePost": return ["POST"];
    case "handleGetPost": return ["GET", "POST"];
    case "handlePut": return ["PUT"];
    case "handlePatch": return ["PATCH"];
    case "handleDelete": return ["DELETE"];
    case "handleOptions": return ["OPTIONS"];
    default: return [];
  }
}

function methodFromFileName(fileName: string): string | undefined {
  const match = fileName.match(/^([A-Z]+)\.ts$/);
  if (!match) return undefined;
  return HTTP_METHODS.has(match[1]) ? match[1] : undefined;
}

function sseMethodFromFileName(fileName: string): string | undefined {
  const match = fileName.match(/^([A-Z]+)\.sse\.ts$/);
  if (!match) return undefined;
  return HTTP_METHODS.has(match[1]) ? match[1] : undefined;
}

/**
 * Parse a TypeScript source file with the compiler API and detect
 * exported identifiers that match the well-known set.
 * This uses `ts.createSourceFile` - no full program compilation needed.
 */
function detectExports(filePath: string): string[] {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const detectable = new Set<string>(ALL_DETECTABLE);
  const found: string[] = [];

  function visit(node: ts.Node): void {
    // export function handleGet(...)
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      hasExportModifier(node) &&
      detectable.has(node.name.text)
    ) {
      found.push(node.name.text);
    }

    // export const ResponseSchema = ...
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && detectable.has(decl.name.text)) {
          found.push(decl.name.text);
        }
      }
    }

    // export { handleGet, ResponseSchema }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const spec of node.exportClause.elements) {
        const name = (spec.name ?? spec.propertyName).text;
        if (detectable.has(name)) {
          found.push(name);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...new Set(found)];
}

function detectRawHandler(filePath: string): boolean {
  return fs.readFileSync(filePath, "utf-8").includes("createRawHandler(");
}

function detectDefaultExport(filePath: string): boolean {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(path.basename(filePath), source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let found = false;

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      found = true;
      return;
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      if (node.exportClause.elements.some((spec) => spec.name.text === "default")) {
        found = true;
        return;
      }
    }
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

const ROUTE_SCHEMA_EXPORTS = new Set([
  "ResponseSchema",
  "QuerySchema",
  "HeadersSchema",
  "RequestSchema",
  "MultipartSchema",
]);

function detectLooseSchemas(filePath: string): string[] {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const loose: string[] = [];

  function isLooseAnyvaliCall(node: ts.Node | undefined): boolean {
    if (!node || !ts.isCallExpression(node)) return false;
    const expression = node.expression;
    return ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === "av"
      && (expression.name.text === "any" || expression.name.text === "unknown");
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name)
          && ROUTE_SCHEMA_EXPORTS.has(decl.name.text)
          && isLooseAnyvaliCall(decl.initializer)
        ) {
          loose.push(decl.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return loose;
}

function detectRouteTokens(filePath: string): string[] {
  const source = fs.readFileSync(filePath, "utf-8");
  const tokens = new Set<string>();
  const tokenRe = /["'`]\{([A-Za-z0-9_$.-]+)\}["'`]/g;
  for (const match of source.matchAll(tokenRe)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

function detectRenderParamWarning(filePath: string): ScannedThemeRenderer["renderParamWarning"] {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(path.basename(filePath), source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let warning: ScannedThemeRenderer["renderParamWarning"];

  function checkFunction(node: ts.FunctionDeclaration): void {
    if (warning || !node.name || node.name.text !== "render" || !hasExportModifier(node)) return;
    const param = node.parameters[0];
    if (!param) {
      warning = "missing";
      return;
    }
    if (!param.type) {
      warning = "missing";
      return;
    }
    if (param.type.kind === ts.SyntaxKind.AnyKeyword) warning = "any";
    if (param.type.kind === ts.SyntaxKind.UnknownKeyword) warning = "unknown";
  }

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node)) checkFunction(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return warning;
}

function detectNamedExports(filePath: string, names: ReadonlyArray<string>): string[] {
  if (!fs.existsSync(filePath)) return [];
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const wanted = new Set(names);
  const found: string[] = [];

  function add(name: string): void {
    if (wanted.has(name) && !found.includes(name)) found.push(name);
  }

  function visit(node: ts.Node): void {
    if (hasExportModifier(node)) {
      if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) {
        add(node.name.text);
      }
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) add(decl.name.text);
        }
      }
    }

    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const spec of node.exportClause.elements) {
        add((spec.name ?? spec.propertyName).text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function detectLiteralViewId(filePath: string): string | undefined {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  let viewId: string | undefined;

  function visit(node: ts.Node): void {
    if (viewId || !ts.isVariableStatement(node) || !hasExportModifier(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name)
        && decl.name.text === "viewId"
        && decl.initializer
        && ts.isStringLiteral(decl.initializer)
      ) {
        viewId = decl.initializer.text;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return viewId;
}

function hasExportModifier(node: ts.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

// -- Route path construction ------------------------------------------

/**
 * Convert a directory path relative to bp-routes/ into one or more HTTP paths
 * and extract param names. Required params use [name]; optional params use [[name]].
 *
 * Example: "users/[userId]/posts" -> [{ httpPath: "/users/:userId/posts", paramNames: ["userId"] }]
 * Example: "tenants/[[tenantId]]/services" -> "/tenants/services" and "/tenants/:tenantId/services"
 */
function buildRoutePaths(segments: string[]): Array<{ httpPath: string; paramNames: string[] }> {
  let variants: Array<{ segments: string[]; paramNames: string[] }> = [
    { segments: [], paramNames: [] }
  ];

  for (const seg of segments) {
    const optionalParamMatch = seg.match(/^\[\[(\w+)]]$/);
    if (optionalParamMatch) {
      const paramName = optionalParamMatch[1];
      variants = variants.flatMap((variant) => [
        variant,
        {
          segments: [...variant.segments, `:${paramName}`],
          paramNames: [...variant.paramNames, paramName]
        }
      ]);
      continue;
    }

    const paramMatch = seg.match(/^\[(\w+)]$/);
    const httpSegment = paramMatch ? `:${paramMatch[1]}` : seg;
    const paramName = paramMatch?.[1];

    variants = variants.map((variant) => ({
      segments: [...variant.segments, httpSegment],
      paramNames: paramName ? [...variant.paramNames, paramName] : variant.paramNames
    }));
  }

  return variants.map((variant) => ({
    httpPath: "/" + variant.segments.join("/"),
    paramNames: variant.paramNames
  }));
}

/**
 * Build a viewId from path segments.
 * Param segments become `$`, and `.index` is appended.
 *
 * Example: ["users", "[userId]"] -> "users.$userId.index"
 */
function buildViewId(segments: string[]): string {
  const parts = segments.map((seg) => {
    const paramMatch = seg.match(/^\[\[?(\w+)]]?$/);
    return paramMatch ? `$${paramMatch[1]}` : seg;
  });
  return [...parts, "index"].join(".");
}

// -- Theme renderer scanning -----------------------------------------

/**
 * Parse a theme file name to determine renderer type and attributes.
 *
 * Patterns:
 *  - index.tsx          -> page, rendererId = "default"
 *  - index.GET.tsx      -> page, rendererId = "default", method = "GET"
 *  - name.tsx           -> component, rendererId = name
 *  - name.POST.tsx      -> component, rendererId = name, method = "POST"
 *  - _location.id.tsx   -> fragment, fragmentLocation = location, fragmentId = id
 */
function parseThemeFile(
  fileName: string,
): {
  type: "page" | "component" | "fragment";
  rendererId: string;
  method?: string;
  statusCode?: number;
  fragmentLocation?: string;
  fragmentId?: string;
} | null {
  // Must be .tsx
  if (!fileName.endsWith(".tsx")) return null;

  let base = fileName.slice(0, -4); // strip .tsx

  // Skip *.sse.tsx files - paired with fragment renderers separately
  if (base.endsWith(".sse")) return null;

  if (/^[1-5]\d{2}$/.test(base)) {
    return { type: "page", rendererId: "default", statusCode: Number(base) };
  }

  // Extract trailing .NNN status code (3 digits, 100-599) if present.
  const statusMatch = base.match(/\.([1-5]\d{2})$/);
  let statusCode: number | undefined;
  if (statusMatch) {
    statusCode = Number(statusMatch[1]);
    base = base.slice(0, base.length - statusMatch[0].length);
  }

  // Fragment: starts with underscore (but NOT _theme)
  if (base.startsWith("_") && !base.startsWith("_theme")) {
    const withoutUnderscore = base.slice(1);
    const parts = withoutUnderscore.split(".");
    if (parts.length < 2 || parts.length > 3) return null;
    const method = parts.length === 3 && HTTP_METHODS.has(parts[2]) ? parts[2] : undefined;
    if (parts.length === 3 && !method) return null;
    const [location, id] = parts;
    if (!location || !id) return null;
    return {
      type: "fragment",
      rendererId: `${location}.${id}`,
      fragmentLocation: location,
      fragmentId: id,
      method,
      statusCode,
    };
  }

  // Split remaining by dots to detect method-specific files
  const parts = base.split(".");

  if (parts.length === 1 && HTTP_METHODS.has(parts[0])) {
    return { type: "page", rendererId: "default", method: parts[0], statusCode };
  }

  if (parts.length === 1 && statusCode !== undefined) {
    return { type: "page", rendererId: "default", statusCode };
  }

  // name.tsx or name.METHOD.tsx -> component
  const method = parts.length === 2 && HTTP_METHODS.has(parts[1]) ? parts[1] : undefined;
  if (parts.length > 2) return null;
  if (parts.length !== 2 || !method) return null;
  const rendererId = parts[0];
  return { type: "component", rendererId, method, statusCode };
}

/**
 * Scan a `_theme.{themeId}/` directory for renderers.
 */
function scanThemeDirectory(
  themeDirPath: string,
  themeId: string,
  generatedDir: string,
  streamRenderers?: ScannedStreamRenderer[],
): ScannedThemeRenderer[] {
  const renderers: ScannedThemeRenderer[] = [];

  if (!fs.existsSync(themeDirPath) || !fs.statSync(themeDirPath).isDirectory()) {
    return renderers;
  }

  const entries = fs.readdirSync(themeDirPath, { withFileTypes: true });

  // Streaming frame renderers: index.stream.tsx (spec/streaming.md section 4)
  const streamFile = entries.find((e) => e.isFile() && e.name === "index.stream.tsx");
  if (streamFile && streamRenderers) {
    const filePath = path.join(themeDirPath, streamFile.name);
    const exports = detectExports(filePath).filter((name) => name.startsWith("render"));
    if (exports.includes("renderShell") && exports.includes("renderItem")) {
      streamRenderers.push({
        themeId,
        relativePath: relativeFromGenerated(generatedDir, filePath),
        exports,
      });
    }
  }

  // Collect SSE renderer files by their `rendererId` and method.
  // so we can pair them with their fragment renderer.
  const sseRendererPaths = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".sse.tsx")) continue;
    const base = entry.name.slice(0, -".sse.tsx".length);
    if (!base.startsWith("_") || base.startsWith("_theme")) continue;
    const parts = base.slice(1).split(".");
    if (parts.length < 2 || parts.length > 3) continue;
    const method = parts.length === 3 && HTTP_METHODS.has(parts[2]) ? parts[2] : undefined;
    if (parts.length === 3 && !method) continue;
    const [location, id] = parts;
    if (!location || !id) continue;
    const filePath = path.join(themeDirPath, entry.name);
    sseRendererPaths.set(`${location}.${id}:${method ?? ""}`, relativeFromGenerated(generatedDir, filePath));
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const parsed = parseThemeFile(entry.name);
    if (!parsed) continue;

    const filePath = path.join(themeDirPath, entry.name);
    const sseRendererPath = parsed.type === "fragment"
      ? sseRendererPaths.get(`${parsed.rendererId}:${parsed.method ?? ""}`)
      : undefined;

    renderers.push({
      themeId,
      rendererId: parsed.rendererId,
      type: parsed.type,
      method: parsed.method,
      statusCode: parsed.statusCode,
      fragmentLocation: parsed.fragmentLocation,
      fragmentId: parsed.fragmentId,
      relativePath: relativeFromGenerated(generatedDir, filePath),
      sseRendererPath,
      renderParamWarning: detectRenderParamWarning(filePath),
    });
  }

  return renderers;
}

// -- Recursive route scanner ------------------------------------------

function scanDirectory(
  currentDir: string,
  routesDir: string,
  generatedDir: string,
  segments: string[],
  routes: ScannedRoute[],
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  // Check for index.ts in this directory
  const hasIndex = entries.some(
    (e) => e.isFile() && e.name === "index.ts",
  );

  if (hasIndex && segments.length > 0) {
    const indexPath = path.join(currentDir, "index.ts");
    const routePaths = buildRoutePaths(segments);
    const viewId = detectLiteralViewId(indexPath) ?? buildViewId(segments);
    const metadataExports = detectExports(indexPath);
    const legacyHandlerExports = metadataExports.filter((exp) => HANDLER_NAMES.includes(exp as typeof HANDLER_NAMES[number]));

    const methodModules: ScannedMethodModule[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const method = methodFromFileName(entry.name);
      if (!method) continue;
      const filePath = path.join(currentDir, entry.name);
      const exports = detectExports(filePath);
      if (detectDefaultExport(filePath)) {
        exports.push("default");
      }
      methodModules.push({
        method,
        relativePath: relativeFromGenerated(generatedDir, filePath),
        exports: [...new Set(exports)],
        isRaw: detectRawHandler(filePath),
        looseSchemas: detectLooseSchemas(filePath),
      });
    }
    const methods = methodModules.map((module) => module.method);
    const handlerExports = [...new Set([...legacyHandlerExports, ...methodModules.flatMap((module) => module.exports)])];

    // Detect method-scoped SSE handler (GET.sse.ts)
    const sseEntry = entries.find((e) => e.isFile() && sseMethodFromFileName(e.name));
    const sseMethod = sseEntry ? sseMethodFromFileName(sseEntry.name) : undefined;
    const ssePath = sseEntry ? path.join(currentDir, sseEntry.name) : undefined;
    const sseExports = ssePath ? detectExports(ssePath) : [];
    const hasSseHandler = Boolean(ssePath) && sseExports.includes("handleSSE");
    const sseRelativePath = hasSseHandler && ssePath
      ? relativeFromGenerated(generatedDir, ssePath)
      : undefined;
    const sseHasTickSchema = hasSseHandler && sseExports.includes("tickSchema");

    // Scan theme renderers
    const themeRenderers: ScannedThemeRenderer[] = [];
    const streamRenderers: ScannedStreamRenderer[] = [];
    const autoDependencies = new Set<string>();

    for (const entry of entries) {
      // Theme directory: _theme.{themeId}/
      if (entry.isDirectory()) {
        const themeMatch = entry.name.match(/^_theme\.(.+)$/);
        if (themeMatch) {
          const themeId = themeMatch[1];
          const themeDirPath = path.join(currentDir, entry.name);
          themeRenderers.push(
            ...scanThemeDirectory(themeDirPath, themeId, generatedDir, streamRenderers),
          );
          for (const rendererFile of fs.readdirSync(themeDirPath, { withFileTypes: true })) {
            if (rendererFile.isFile() && rendererFile.name.endsWith(".tsx")) {
              for (const token of detectRouteTokens(path.join(themeDirPath, rendererFile.name))) {
                if (token !== viewId) autoDependencies.add(token);
              }
            }
          }
        }
      }

      // Single-file theme shorthand: _theme.{themeId}.tsx
      if (entry.isFile()) {
        const themeFileMatch = entry.name.match(/^_theme\.(.+)\.tsx$/);
        if (themeFileMatch) {
          const themeId = themeFileMatch[1];
          const filePath = path.join(currentDir, entry.name);
          for (const token of detectRouteTokens(filePath)) {
            if (token !== viewId) autoDependencies.add(token);
          }
          themeRenderers.push({
            themeId,
            rendererId: "default",
            type: "page",
            relativePath: relativeFromGenerated(generatedDir, filePath),
            renderParamWarning: detectRenderParamWarning(filePath),
          });
        }
      }
    }

    for (const { httpPath, paramNames } of routePaths) {
      routes.push({
        viewId,
        path: httpPath,
        paramNames,
        relativePath: relativeFromGenerated(generatedDir, currentDir),
        metadataExports,
        methodModules,
        handlerExports,
        methods,
        themeRenderers,
        streamRenderers,
        sseRelativePath,
        sseMethod,
        hasSseHandler,
        sseHasTickSchema,
        hasItemSchema: handlerExports.includes("ItemSchema"),
        hasSummarySchema: handlerExports.includes("SummarySchema"),
        isRaw: methodModules.some((module) => module.isRaw),
        looseSchemas: [...new Set(methodModules.flatMap((module) => module.looseSchemas))],
        autoDependencies: [...autoDependencies],
      });
    }
  }

  // Recurse into child directories (excluding theme dirs)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_theme.")) continue;
    if (entry.name.startsWith(".")) continue;

    const childDir = path.join(currentDir, entry.name);
    scanDirectory(childDir, routesDir, generatedDir, [...segments, entry.name], routes);
  }
}

// -- Public API -------------------------------------------------------

/**
 * Scan the `bp-routes/` directory tree and build a data structure
 * describing all routes, theme renderers, components, and fragments.
 *
 * @param baseDir - The directory containing `bp-routes/`. The
 *   `.bp-generated/` output directory is placed as a sibling.
 */
export function scanRoutes(baseDir: string): ScanResult {
  const routesDir = path.resolve(baseDir, "bp-routes");
  const generatedDir = path.resolve(baseDir, ".bp-generated");
  const pluginIndexPath = path.resolve(baseDir, "index.ts");
  const pluginImportPath = toJsImport(relativeFromGenerated(generatedDir, pluginIndexPath));
  const pluginExports = detectNamedExports(pluginIndexPath, ["Plugin", "ServiceConfig"]);

  if (!fs.existsSync(routesDir)) {
    return { routes: [], generatedDir, pluginImportPath, pluginExports };
  }

  const routes: ScannedRoute[] = [];
  scanDirectory(routesDir, routesDir, generatedDir, [], routes);

  // Sort routes so static segments come before dynamic ones at the same level
  routes.sort((a, b) => {
    const aSeg = a.path.split("/").filter(Boolean);
    const bSeg = b.path.split("/").filter(Boolean);

    for (let i = 0; i < Math.min(aSeg.length, bSeg.length); i++) {
      const aIsDynamic = aSeg[i].startsWith(":");
      const bIsDynamic = bSeg[i].startsWith(":");

      if (!aIsDynamic && bIsDynamic) return -1;
      if (aIsDynamic && !bIsDynamic) return 1;

      const cmp = aSeg[i].localeCompare(bSeg[i]);
      if (cmp !== 0) return cmp;
    }

    return aSeg.length - bSeg.length;
  });

  return { routes, generatedDir, pluginImportPath, pluginExports };
}
