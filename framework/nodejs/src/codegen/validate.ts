import type { ScanResult, ScannedRoute } from "./scanner.js";

// -- Types ------------------------------------------------------------

export interface ValidationError {
  file: string;
  message: string;
  severity: "error" | "warning";
}

// -- Fragment file-name pattern ---------------------------------------

/** Matches method-specific fragment renderer names. */
const FRAGMENT_PATTERN = /^_([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)\.(GET|POST|PUT|PATCH|DELETE|OPTIONS)(\.sse)?\.tsx$/;

// -- Validation helpers -----------------------------------------------

function checkHandlerExports(route: ScannedRoute, errors: ValidationError[]): void {
  const legacyHandlers = route.metadataExports.filter((e) => e.startsWith("handle"));
  for (const handler of legacyHandlers) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Legacy handler export "${handler}" is no longer supported. Move the handler to a method file such as GET.ts or POST.ts and default-export it.`,
      severity: "error",
    });
  }

  const hasHandler = route.methodModules.length > 0;

  if (!hasHandler) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" does not define any method file. Add GET.ts, POST.ts, or another supported HTTP method file with a default-exported handler.`,
      severity: "error",
    });
  }
}

function checkResponseSchema(route: ScannedRoute, errors: ValidationError[]): void {
  for (const methodRoute of route.methodModules) {
    if (!methodRoute.exports.includes("default")) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Method route "${route.viewId}" ${methodRoute.method} must default-export a handler.`,
        severity: "error",
      });
    }

    if (methodRoute.isRaw) {
      if (methodRoute.exports.includes("ResponseSchema")) {
        errors.push({
          file: methodRoute.relativePath,
          message: `Raw method route "${route.viewId}" ${methodRoute.method} must not export a ResponseSchema.`,
          severity: "error",
        });
      }
      continue;
    }

    if (methodRoute.exports.includes("ItemSchema")) {
      if (methodRoute.exports.includes("ResponseSchema")) {
        errors.push({
          file: methodRoute.relativePath,
          message: `Method route "${route.viewId}" ${methodRoute.method} exports both ItemSchema and ResponseSchema. Streaming routes derive their response schema - remove ResponseSchema.`,
          severity: "error",
        });
      }
      continue;
    }

    if (!methodRoute.exports.includes("ResponseSchema")) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Method route "${route.viewId}" ${methodRoute.method} does not export a ResponseSchema.`,
        severity: "error",
      });
    }
  }
}

function checkRawRenderers(route: ScannedRoute, errors: ValidationError[]): void {
  if (!route.isRaw) return;
  if (route.themeRenderers.length === 0 && route.streamRenderers.length === 0) return;
  errors.push({
    file: route.relativePath + "/index.ts",
    message: `Raw route "${route.viewId}" cannot have theme renderers.`,
    severity: "error",
  });
}

function warnRawHandler(route: ScannedRoute, errors: ValidationError[]): void {
  if (!route.isRaw) return;
  errors.push({
    file: route.relativePath + "/index.ts",
    message: `Route "${route.viewId}" uses createRawHandler. Prefer createHandler with RequestSchema/ResponseSchema for normal JSON or HTML responses; use raw handlers only for files, streams, redirects, or custom HTTP responses.`,
    severity: "warning",
  });
}

function warnLooseSchemas(route: ScannedRoute, errors: ValidationError[]): void {
  for (const methodRoute of route.methodModules) {
    for (const schemaName of methodRoute.looseSchemas) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Route "${route.viewId}" ${methodRoute.method} exports ${schemaName} with av.any() or av.unknown(). Prefer a concrete anyvali schema so BP can validate inputs and outputs.`,
        severity: "warning",
      });
    }
  }
}

function checkRenderersMatchMethods(route: ScannedRoute, errors: ValidationError[]): void {
  const methods = new Set(route.methods);
  for (const renderer of route.themeRenderers) {
    if (!renderer.method && renderer.statusCode === undefined) {
      errors.push({
        file: renderer.relativePath,
        message: `Generic UI renderer for route "${route.viewId}" is no longer supported. Use method-specific files such as GET.tsx or POST.tsx.`,
        severity: "error",
      });
      continue;
    }
    if (renderer.method && !methods.has(renderer.method)) {
      errors.push({
        file: renderer.relativePath,
        message: `Renderer for route "${route.viewId}" targets ${renderer.method}, but that method has no ${renderer.method}.ts handler.`,
        severity: "error",
      });
    }
    if (renderer.renderParamWarning) {
      errors.push({
        file: renderer.relativePath,
        message: `Renderer for route "${route.viewId}" has ${renderer.renderParamWarning === "missing" ? "an untyped or missing" : `a ${renderer.renderParamWarning}`} render data parameter. Type it from the route response data.`,
        severity: "warning",
      });
    }
  }
}

function checkSseMethod(route: ScannedRoute, errors: ValidationError[]): void {
  if (!route.hasSseHandler) return;
  if (route.sseMethod !== "GET") {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/GET.sse.ts`,
      message: `SSE route "${route.viewId}" must use GET.sse.ts.`,
      severity: "error",
    });
  }
  if (!route.methods.includes("GET")) {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/GET.sse.ts`,
      message: `SSE route "${route.viewId}" requires a GET.ts handler.`,
      severity: "error",
    });
  }
}

function checkFragmentFileNames(route: ScannedRoute, errors: ValidationError[]): void {
  for (const renderer of route.themeRenderers) {
    if (renderer.type !== "fragment") continue;

    // Extract the file name from the relative import path
    const segments = renderer.relativePath.split("/");
    const fileName = segments[segments.length - 1];

    if (fileName && !FRAGMENT_PATTERN.test(fileName)) {
      errors.push({
        file: renderer.relativePath,
        message: `Fragment file "${fileName}" does not match the _{location}.{id}.tsx pattern.`,
        severity: "error",
      });
    }
  }
}

function checkDuplicateViewIds(routes: ScannedRoute[], errors: ValidationError[]): void {
  const seen = new Map<string, ScannedRoute>();

  for (const route of routes) {
    const existing = seen.get(route.viewId);
    if (existing) {
      errors.push({
        file: route.relativePath + "/index.ts",
        message: `Duplicate viewId "${route.viewId}". Also defined at "${existing.relativePath}/index.ts".`,
        severity: "error",
      });
    } else {
      seen.set(route.viewId, route);
    }
  }
}

function checkConflictingPaths(routes: ScannedRoute[], errors: ValidationError[]): void {
  const seen = new Map<string, ScannedRoute>();

  for (const route of routes) {
    // Normalize the path for conflict detection: replace each :param with a
    // placeholder so "/users/:userId" and "/users/:id" are treated as the
    // same structural path.
    const normalized = route.path.replace(/:[^/]+/g, ":*");
    const existing = seen.get(normalized);

    if (existing && existing.viewId !== route.viewId) {
      errors.push({
        file: route.relativePath + "/index.ts",
        message: `Path "${route.path}" conflicts with "${existing.path}" (route "${existing.viewId}"). Both resolve to the same structural pattern.`,
        severity: "error",
      });
    } else {
      seen.set(normalized, route);
    }
  }
}

function checkThemeRendererOrphans(route: ScannedRoute, errors: ValidationError[]): void {
  // Theme renderers should belong to a route that has an index.ts.
  // Since we only create ScannedRoute entries for directories that have
  // index.ts, any renderer attached to a route is by definition valid.
  // However, we can warn if a renderer's path suggests it sits outside
  // the route's own directory tree. In practice the scanner already
  // constrains this, but we defensively verify.

  for (const renderer of route.themeRenderers) {
    if (!renderer.relativePath.includes(route.relativePath.replace(/\/index\.ts$/, ""))) {
      // The renderer's relative path does not share the route's base
      // directory - this should never happen with the scanner, but
      // guard against hand-edited ScanResults.
      errors.push({
        file: renderer.relativePath,
        message: `Theme renderer "${renderer.rendererId}" (theme "${renderer.themeId}") does not appear to belong to route "${route.viewId}".`,
        severity: "error",
      });
    }
  }
}

function checkMissingThemeRenderers(route: ScannedRoute, errors: ValidationError[]): void {
  if (route.isRaw) return;
  if (route.themeRenderers.length === 0) {
    const hasHandler = route.handlerExports.some((e) => e.startsWith("handle"));
    if (hasHandler) {
      errors.push({
        file: route.relativePath + "/index.ts",
        message: `Route "${route.viewId}" has handlers but no theme renderers. The route will serve JSON but not HTML.`,
        severity: "warning",
      });
    }
  }
}

// -- Public API -------------------------------------------------------

/**
 * Validate a `ScanResult` for convention violations.
 *
 * Returns an array of errors and warnings. An empty array means the
 * scan result is valid.
 */
export function validateScanResult(result: ScanResult): ValidationError[] {
  const errors: ValidationError[] = [];

  // Cross-route checks
  checkDuplicateViewIds(result.routes, errors);
  checkConflictingPaths(result.routes, errors);

  // Per-route checks
  for (const route of result.routes) {
    checkHandlerExports(route, errors);
    checkResponseSchema(route, errors);
    checkRawRenderers(route, errors);
    warnRawHandler(route, errors);
    warnLooseSchemas(route, errors);
    checkRenderersMatchMethods(route, errors);
    checkSseMethod(route, errors);
    checkFragmentFileNames(route, errors);
    checkThemeRendererOrphans(route, errors);
    checkMissingThemeRenderers(route, errors);
  }

  return errors;
}
