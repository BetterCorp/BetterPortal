import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { inspectAnyValiSchemaNode } from "./schemaPolicy.js";

// -- Scanned types ----------------------------------------------------

export interface ScannedViewRenderer {
  rendererKey: string;
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
  /** Conflicting SSE renderer aliases for the same fragment. */
  sseRendererConflicts?: string[];
  renderParamWarning?: "missing" | "any" | "unknown";
}

/** Streaming frame renderers for one compatibility key. */
export interface ScannedStreamRenderer {
  rendererKey: string;
  relativePath: string;
  /** Render exports found in the file (renderShell/renderItem/renderSummary/renderError). */
  exports: string[];
}

export interface ScannedMethodModule {
  method: string;
  operationId?: string;
  relativePath: string;
  exports: string[];
  isRaw: boolean;
  looseSchemas: string[];
  allowUnknownKeysSchemas?: string[];
  redundantStripSchemas?: string[];
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
  renderers: ScannedViewRenderer[];
  /** Per-theme streaming renderers (streaming views only). */
  streamRenderers: ScannedStreamRenderer[];
  sseRelativePath?: string;
  /** All detected SSE handler paths; more than one is ambiguous. */
  sseRelativePaths?: string[];
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
  /** Route metadata schema names that use loose anyvali validators. */
  looseSchemas: string[];
  allowUnknownKeysSchemas?: string[];
  redundantStripSchemas?: string[];
  hasRouteImpl: boolean;
}

export interface ScannedShellFragment {
  id: string;
  kind: "fragment" | "block";
  relativePath: string;
}

export interface ScanResult {
  routes: ScannedRoute[];
  shellFragments: ScannedShellFragment[];
  dependencyAliases: Record<string, string>;
  generatedDir: string;
  pluginImportPath: string;
  pluginExports: string[];
  pluginLifecycleOverrides: ScannedPluginLifecycleOverride[];
}

export interface ScannedPluginLifecycleOverride {
  method: "init" | "run" | "dispose";
  line: number;
  callsSuper: boolean;
  awaitsOrReturnsSuper: boolean;
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
  "ParamsSchema",
  "QuerySchema",
  "HeadersSchema",
  "RequestSchema",
  "MultipartSchema",
  "ItemSchema",
  "SummarySchema",
  "operationId",
  "viewId",
  "title",
  "description",
  "auth",
  "sitemap",
  "robots",
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
  if (fileName === "sse.ts") return "GET";
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

function scanPluginLifecycleOverrides(filePath: string): ScannedPluginLifecycleOverride[] {
  if (!fs.existsSync(filePath)) return [];

  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const methods = new Set(["init", "run", "dispose"]);
  const overrides: ScannedPluginLifecycleOverride[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Plugin") continue;

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.body || !ts.isIdentifier(member.name)) continue;
      const method = member.name.text;
      if (!methods.has(method)) continue;

      let callsSuper = false;
      let awaitsOrReturnsSuper = false;
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.kind === ts.SyntaxKind.SuperKeyword
          && node.expression.name.text === method
        ) {
          callsSuper = true;
          awaitsOrReturnsSuper = awaitsOrReturnsSuper
            || ts.isAwaitExpression(node.parent)
            || ts.isReturnStatement(node.parent);
        }
        ts.forEachChild(node, visit);
      };
      visit(member.body);

      overrides.push({
        method: method as ScannedPluginLifecycleOverride["method"],
        line: sourceFile.getLineAndCharacterOfPosition(member.name.getStart(sourceFile)).line + 1,
        callsSuper,
        awaitsOrReturnsSuper
      });
    }
  }

  return overrides;
}

function detectRawHandler(filePath: string): boolean {
  return /createRawHandler(?:\.forContext(?:<[^>]+>)?\(\))?\s*\(/.test(fs.readFileSync(filePath, "utf-8"));
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
  "ParamsSchema",
  "QuerySchema",
  "HeadersSchema",
  "RequestSchema",
  "MultipartSchema",
  "ItemSchema",
  "SummarySchema",
]);

function detectSchemaPolicy(filePath: string): {
  looseSchemas: string[];
  allowUnknownKeysSchemas: string[];
  redundantStripSchemas: string[];
} {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const looseSchemas: string[] = [];
  const allowUnknownKeysSchemas: string[] = [];
  const redundantStripSchemas: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name)
          && ROUTE_SCHEMA_EXPORTS.has(decl.name.text)
          && decl.initializer
        ) {
          const kinds = new Set(inspectAnyValiSchemaNode(sourceFile, decl.initializer).map((issue) => issue.kind));
          if (kinds.has("loose")) looseSchemas.push(decl.name.text);
          if (kinds.has("allow")) allowUnknownKeysSchemas.push(decl.name.text);
          if (kinds.has("redundant-strip")) redundantStripSchemas.push(decl.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { looseSchemas, allowUnknownKeysSchemas, redundantStripSchemas };
}

function detectRenderParamWarning(filePath: string): ScannedViewRenderer["renderParamWarning"] {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(path.basename(filePath), source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let warning: ScannedViewRenderer["renderParamWarning"];

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

function detectLiteralExport(filePath: string, exportName: string): string | undefined {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  let value: string | undefined;

  function visit(node: ts.Node): void {
    if (value || !ts.isVariableStatement(node) || !hasExportModifier(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name)
        && decl.name.text === exportName
        && decl.initializer
        && ts.isStringLiteral(decl.initializer)
      ) {
        value = decl.initializer.text;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return value;
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
    if (/^\[/.test(seg)
      && !/^\[\[[A-Za-z_][A-Za-z0-9_]*]]$/.test(seg)
      && !/^\[[A-Za-z_][A-Za-z0-9_]*]$/.test(seg)) {
      throw new Error(`Unsupported route segment "${seg}". Use [id] or [[id]]; catch-all params are not supported.`);
    }
    if (/^\{[^}]+\}$/.test(seg)) {
      throw new Error(`Unsupported route segment "${seg}". Filesystem params use [id] or [[id]] and publish as :id.`);
    }
    const optionalParamMatch = seg.match(/^\[\[([A-Za-z_][A-Za-z0-9_]*)]]$/);
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

    const paramMatch = seg.match(/^\[([A-Za-z_][A-Za-z0-9_]*)]$/);
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
    const paramMatch = seg.match(/^\[\[?([A-Za-z_][A-Za-z0-9_]*)]]?$/);
    return paramMatch ? `$${paramMatch[1]}` : seg;
  });
  return [...parts, "index"].join(".");
}

// -- HTML renderer scanning ------------------------------------------

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
function parseRendererFile(
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
 * Scan a `_renderer.{rendererKey}/` directory for renderers.
 */
function scanRendererDirectory(
  rendererDirPath: string,
  rendererKey: string,
  generatedDir: string,
  streamRenderers?: ScannedStreamRenderer[],
): ScannedViewRenderer[] {
  const renderers: ScannedViewRenderer[] = [];

  if (!fs.existsSync(rendererDirPath) || !fs.statSync(rendererDirPath).isDirectory()) {
    return renderers;
  }

  const entries = fs.readdirSync(rendererDirPath, { withFileTypes: true });

  // Streaming frame renderers: index.stream.tsx (spec/streaming.md section 4)
  const streamFile = entries.find((e) => e.isFile() && e.name === "index.stream.tsx");
  if (streamFile && streamRenderers) {
    const filePath = path.join(rendererDirPath, streamFile.name);
    const exports = detectExports(filePath).filter((name) => name.startsWith("render"));
    if (exports.includes("renderShell") && exports.includes("renderItem")) {
      streamRenderers.push({
        rendererKey,
        relativePath: relativeFromGenerated(generatedDir, filePath),
        exports,
      });
    }
  }

  // Collect SSE renderer files by their `rendererId` and method.
  // so we can pair them with their fragment renderer.
  const sseRendererPaths = new Map<string, string[]>();
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
    const filePath = path.join(rendererDirPath, entry.name);
    const key = `${location}.${id}:${method ?? "GET"}`;
    const paths = sseRendererPaths.get(key) ?? [];
    paths.push(relativeFromGenerated(generatedDir, filePath));
    sseRendererPaths.set(key, paths);
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const parsed = parseRendererFile(entry.name);
    if (!parsed) continue;

    const filePath = path.join(rendererDirPath, entry.name);
    const sseRendererMatches = parsed.type === "fragment"
      ? sseRendererPaths.get(`${parsed.rendererId}:${parsed.method ?? ""}`)
      : undefined;

    renderers.push({
      rendererKey,
      rendererId: parsed.rendererId,
      type: parsed.type,
      method: parsed.method,
      statusCode: parsed.statusCode,
      fragmentLocation: parsed.fragmentLocation,
      fragmentId: parsed.fragmentId,
      relativePath: relativeFromGenerated(generatedDir, filePath),
      sseRendererPath: sseRendererMatches?.[0],
      sseRendererConflicts: sseRendererMatches && sseRendererMatches.length > 1
        ? sseRendererMatches
        : undefined,
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
  const legacyRenderer = entries.find((entry) => entry.name.startsWith("_theme."));
  if (legacyRenderer) {
    throw new Error(`Legacy renderer path "${path.join(currentDir, legacyRenderer.name)}" is unsupported; rename it to _renderer.<key>.`);
  }

  // Check for index.ts in this directory
  const hasIndex = entries.some(
    (e) => e.isFile() && e.name === "index.ts",
  );

  if (hasIndex && segments.length > 0) {
    const indexPath = path.join(currentDir, "index.ts");
    const routePaths = buildRoutePaths(segments);
    const viewId = detectLiteralExport(indexPath, "viewId") ?? buildViewId(segments);
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
        operationId: detectLiteralExport(filePath, "operationId"),
        relativePath: relativeFromGenerated(generatedDir, filePath),
        exports: [...new Set(exports)],
        isRaw: detectRawHandler(filePath),
        ...detectSchemaPolicy(filePath),
      });
    }
    const methods = methodModules.map((module) => module.method);
    const handlerExports = [...new Set([...legacyHandlerExports, ...methodModules.flatMap((module) => module.exports)])];

    // Detect SSE handler (`sse.ts` infers GET; `GET.sse.ts` remains supported).
    const sseEntries = entries.filter((e) => e.isFile() && sseMethodFromFileName(e.name));
    const sseEntry = sseEntries.find((e) => e.name === "sse.ts") ?? sseEntries[0];
    const sseMethod = sseEntry ? sseMethodFromFileName(sseEntry.name) : undefined;
    const ssePath = sseEntry ? path.join(currentDir, sseEntry.name) : undefined;
    const sseRelativePaths = sseEntries.map((entry) =>
      relativeFromGenerated(generatedDir, path.join(currentDir, entry.name))
    );
    const sseExports = ssePath ? detectExports(ssePath) : [];
    const hasSseHandler = Boolean(ssePath) && sseExports.includes("handleSSE");
    const sseRelativePath = hasSseHandler && ssePath
      ? relativeFromGenerated(generatedDir, ssePath)
      : undefined;
    const sseHasTickSchema = hasSseHandler && sseExports.includes("tickSchema");

    // Scan UI renderers
    const renderers: ScannedViewRenderer[] = [];
    const streamRenderers: ScannedStreamRenderer[] = [];

    for (const entry of entries) {
      // Renderer directory: _renderer.{rendererKey}/
      if (entry.isDirectory()) {
        const rendererMatch = entry.name.match(/^_renderer\.(.+)$/);
        if (rendererMatch) {
          const rendererKey = rendererMatch[1];
          const rendererDirPath = path.join(currentDir, entry.name);
          renderers.push(
            ...scanRendererDirectory(rendererDirPath, rendererKey, generatedDir, streamRenderers),
          );
        }
      }

      // Single-file renderer shorthand: _renderer.{rendererKey}.tsx
      if (entry.isFile()) {
        const rendererFileMatch = entry.name.match(/^_renderer\.(.+)\.tsx$/);
        if (rendererFileMatch) {
          const rendererKey = rendererFileMatch[1];
          const filePath = path.join(currentDir, entry.name);
          renderers.push({
            rendererKey,
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
        renderers,
        streamRenderers,
        sseRelativePath,
        sseRelativePaths,
        sseMethod,
        hasSseHandler,
        sseHasTickSchema,
        hasItemSchema: handlerExports.includes("ItemSchema"),
        hasSummarySchema: handlerExports.includes("SummarySchema"),
        isRaw: methodModules.some((module) => module.isRaw),
        ...detectSchemaPolicy(indexPath),
        hasRouteImpl: entries.some((entry) => entry.isFile() && /^route\.impl\.tsx?$/.test(entry.name)),
      });
    }
  }

  // Recurse into child directories (excluding renderer dirs)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_renderer.")) continue;
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;

    const childDir = path.join(currentDir, entry.name);
    scanDirectory(childDir, routesDir, generatedDir, [...segments, entry.name], routes);
  }
}

// -- Public API -------------------------------------------------------

/**
 * Scan the `bp-routes/` directory tree and build a data structure
 * describing all routes, UI renderers, components, and fragments.
 *
 * @param baseDir - The directory containing `bp-routes/`. The
 *   `.bp-generated/` output directory is placed as a sibling.
 */
export function scanRoutes(baseDir: string, dependencyAliases: Record<string, string> = {}): ScanResult {
  const routesDir = path.resolve(baseDir, "bp-routes");
  const generatedDir = path.resolve(baseDir, ".bp-generated");
  const pluginIndexPath = path.resolve(baseDir, "index.ts");
  const pluginImportPath = toJsImport(relativeFromGenerated(generatedDir, pluginIndexPath));
  const pluginExports = detectNamedExports(pluginIndexPath, ["Plugin", "ServiceConfig"]);
  const pluginLifecycleOverrides = scanPluginLifecycleOverrides(pluginIndexPath);
  const shellDir = path.resolve(baseDir, "shell");
  const shellFragments: ScannedShellFragment[] = fs.existsSync(shellDir)
    ? fs.readdirSync(shellDir, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.name.startsWith("_")) return [];
      const id = entry.name.slice(1).replace(/\.tsx?$/, "");
      const source = entry.isDirectory()
        ? path.join(shellDir, entry.name, "index.tsx")
        : path.join(shellDir, entry.name);
      if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(id) || !fs.existsSync(source)) return [];
      return [{ id, kind: entry.isDirectory() ? "block" as const : "fragment" as const, relativePath: relativeFromGenerated(generatedDir, source) }];
    }).sort((a, b) => a.id.localeCompare(b.id))
    : [];

  if (!fs.existsSync(routesDir)) {
    return { routes: [], shellFragments, dependencyAliases, generatedDir, pluginImportPath, pluginExports, pluginLifecycleOverrides };
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

  return { routes, shellFragments, dependencyAliases, generatedDir, pluginImportPath, pluginExports, pluginLifecycleOverrides };
}
