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

const OPERATION_EXPORTS = [
  "operationId",
  "auth",
  "QuerySchema",
  "HeadersSchema",
  "RequestSchema",
  "MultipartSchema",
  "ResponseSchema",
  "ItemSchema",
  "SummarySchema",
  "sitemap",
  "robots",
  "role",
  "dependencies",
  "chrome",
  "apiContracts",
  "cacheHints",
  "demoScenarios"
] as const;

function checkOperationMetadata(route: ScannedRoute, errors: ValidationError[]): void {
  if (route.hasRouteImpl) {
    errors.push({
      file: route.relativePath + "/route.impl.ts",
      message: "route.impl files are not supported. Keep each operation contract and handler in its HTTP method file; move genuinely shared domain logic to a named module outside the route directory.",
      severity: "error"
    });
  }
  for (const name of OPERATION_EXPORTS) {
    if (route.metadataExports.includes(name)) {
      errors.push({
        file: route.relativePath + "/index.ts",
        message: `Route metadata "${name}" belongs in each method file that uses it.`,
        severity: "error"
      });
    }
  }

  for (const methodRoute of route.methodModules) {
    for (const required of ["operationId", "title", "description", "auth"]) {
      if (!methodRoute.exports.includes(required)) {
        errors.push({
          file: methodRoute.relativePath,
          message: `Method route "${route.viewId}" ${methodRoute.method} must export ${required}.`,
          severity: "error"
        });
      }
    }
    if (methodRoute.operationId !== undefined && !/^[A-Za-z][A-Za-z0-9._-]*$/.test(methodRoute.operationId)) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Operation id "${methodRoute.operationId}" is invalid. Use a stable dot-separated identifier.`,
        severity: "error"
      });
    }
  }
}

function checkDuplicateOperationIds(routes: ScannedRoute[], errors: ValidationError[]): void {
  const seen = new Map<string, string>();
  for (const route of routes) {
    for (const methodRoute of route.methodModules) {
      if (!methodRoute.operationId) continue;
      const existing = seen.get(methodRoute.operationId);
      if (existing) {
        errors.push({
          file: methodRoute.relativePath,
          message: `Duplicate operationId "${methodRoute.operationId}". Also defined at "${existing}".`,
          severity: "error"
        });
      } else {
        seen.set(methodRoute.operationId, methodRoute.relativePath);
      }
    }
  }
}

function checkRawRenderers(route: ScannedRoute, errors: ValidationError[]): void {
  if (!route.isRaw) return;
  if (route.renderers.length === 0 && route.streamRenderers.length === 0) return;
  errors.push({
    file: route.relativePath + "/index.ts",
    message: `Raw route "${route.viewId}" cannot have HTML renderers.`,
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

function checkSchemaPolicy(route: ScannedRoute, errors: ValidationError[]): void {
  for (const schemaName of route.looseSchemas) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" exports ${schemaName} containing av.any() or av.unknown(). Published schemas must be concrete; use a specific AnyVali schema, JsonValueSchema, or JsonObjectSchema.`,
      severity: "error",
    });
  }
  for (const schemaName of route.allowUnknownKeysSchemas ?? []) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" exports ${schemaName} with unknownKeys: "allow". Validate extension keys with a concrete av.record(...) schema.`,
      severity: "error"
    });
  }
  for (const schemaName of route.redundantStripSchemas ?? []) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" exports ${schemaName} with unknownKeys: "strip". Stripping is the default; remove the redundant option.`,
      severity: "warning"
    });
  }
  for (const methodRoute of route.methodModules) {
    for (const schemaName of methodRoute.looseSchemas) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Route "${route.viewId}" ${methodRoute.method} exports ${schemaName} containing av.any() or av.unknown(). Published schemas must be concrete; use a specific AnyVali schema, JsonValueSchema, or JsonObjectSchema.`,
        severity: "error",
      });
    }
    for (const schemaName of methodRoute.allowUnknownKeysSchemas ?? []) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Route "${route.viewId}" ${methodRoute.method} exports ${schemaName} with unknownKeys: "allow". Validate extension keys with a concrete av.record(...) schema.`,
        severity: "error"
      });
    }
    for (const schemaName of methodRoute.redundantStripSchemas ?? []) {
      errors.push({
        file: methodRoute.relativePath,
        message: `Route "${route.viewId}" ${methodRoute.method} exports ${schemaName} with unknownKeys: "strip". Stripping is the default; remove the redundant option.`,
        severity: "warning"
      });
    }
  }
  for (const schemaName of route.sseLooseSchemas ?? []) {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/sse.ts`,
      message: `SSE route "${route.viewId}" exports ${schemaName} containing av.any() or av.unknown(). SSE schemas must be concrete.`,
      severity: "error"
    });
  }
  for (const schemaName of route.sseAllowUnknownKeysSchemas ?? []) {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/sse.ts`,
      message: `SSE route "${route.viewId}" exports ${schemaName} with unknownKeys: "allow". Validate extension keys with a concrete av.record(...) schema.`,
      severity: "error"
    });
  }
  for (const schemaName of route.sseRedundantStripSchemas ?? []) {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/sse.ts`,
      message: `SSE route "${route.viewId}" exports ${schemaName} with unknownKeys: "strip". Stripping is the default; remove the redundant option.`,
      severity: "warning"
    });
  }
}

function checkRenderersMatchMethods(route: ScannedRoute, errors: ValidationError[]): void {
  const methods = new Set(route.methods);
  for (const renderer of route.renderers) {
    if (!renderer.method) {
      errors.push({
        file: renderer.relativePath,
        message: `Generic UI renderer for route "${route.viewId}" is not type-safe. Use method-specific files such as GET.tsx or POST.400.tsx.`,
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
        severity: "error",
      });
    }
    if (renderer.renderContextWarning) {
      errors.push({
        file: renderer.relativePath,
        message: `Renderer for route "${route.viewId}" has a ${renderer.renderContextWarning} render context parameter. Type it as ViewRenderContext; the framework supplies it without adding presentation data to the API schema.`,
        severity: "error",
      });
    }
  }
}

function checkSseMethod(route: ScannedRoute, errors: ValidationError[]): void {
  if (route.invalidSseRelativePaths?.length) {
    errors.push({
      file: route.invalidSseRelativePaths.join(", "),
      message: `SSE route "${route.viewId}" must use sse.ts; method-qualified SSE handler names are unsupported.`,
      severity: "error",
    });
  }
  const contractExports = ["InputSchema", "EventSchema", "default"];
  if (route.sseRelativePath && !route.sseHasContract) {
    const missing = contractExports.filter((name) => !route.sseExports?.includes(name));
    errors.push({
      file: route.sseRelativePath,
      message: `SSE route "${route.viewId}" must export InputSchema, EventSchema, and a default createSse(...) contract${missing.length ? `; missing ${missing.join(", ")}` : ""}.`,
      severity: "error",
    });
    return;
  }
  if (!route.hasSseHandler) return;
  if (!route.methods.includes("GET")) {
    errors.push({
      file: route.sseRelativePath ?? `${route.relativePath}/sse.ts`,
      message: `SSE route "${route.viewId}" requires a GET.ts handler.`,
      severity: "error",
    });
  }
}

function checkSseFragmentRenderers(route: ScannedRoute, errors: ValidationError[]): void {
  for (const file of route.invalidSseRendererPaths ?? []) {
    errors.push({
      file,
      message: `SSE fragment renderer for route "${route.viewId}" must use _<location>.<id>.sse.tsx; method-qualified SSE renderer names are unsupported.`,
      severity: "error",
    });
  }
  for (const renderer of route.renderers) {
    if (renderer.sseRendererPath && renderer.method !== "GET") {
      errors.push({
        file: renderer.sseRendererPath,
        message: `SSE fragment "${renderer.rendererId}" must target GET.`,
        severity: "error",
      });
    }
    if (renderer.sseRendererPath && renderer.sseRenderContextWarning) {
      errors.push({
        file: renderer.sseRendererPath,
        message: `SSE renderer for route "${route.viewId}" has a ${renderer.sseRenderContextWarning} render context parameter. Type it as ViewRenderContext; the framework supplies it server-side.`,
        severity: "error",
      });
    }
  }
}

function checkFragmentFileNames(route: ScannedRoute, errors: ValidationError[]): void {
  for (const renderer of route.renderers) {
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

function checkDuplicateShellFragmentIds(result: ScanResult, errors: ValidationError[]): void {
  const seen = new Map<string, string>();
  for (const fragment of result.shellFragments) {
    const existing = seen.get(fragment.id);
    if (existing) {
      errors.push({
        file: fragment.relativePath,
        message: `Duplicate shell fragment id "${fragment.id}". Also defined at "${existing}".`,
        severity: "error"
      });
    } else {
      seen.set(fragment.id, fragment.relativePath);
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

function checkRendererOrphans(route: ScannedRoute, errors: ValidationError[]): void {
  // Renderers should belong to a route that has an index.ts.
  // Since we only create ScannedRoute entries for directories that have
  // index.ts, any renderer attached to a route is by definition valid.
  // However, we can warn if a renderer's path suggests it sits outside
  // the route's own directory tree. In practice the scanner already
  // constrains this, but we defensively verify.

  for (const renderer of route.renderers) {
    if (!renderer.relativePath.includes(route.relativePath.replace(/\/index\.ts$/, ""))) {
      // The renderer's relative path does not share the route's base
      // directory - this should never happen with the scanner, but
      // guard against hand-edited ScanResults.
      errors.push({
        file: renderer.relativePath,
        message: `Renderer "${renderer.rendererId}" (renderer "${renderer.rendererKey}") does not appear to belong to route "${route.viewId}".`,
        severity: "error",
      });
    }
  }
}

function checkMissingRenderers(route: ScannedRoute, errors: ValidationError[]): void {
  if (route.isRaw) return;
  if (route.renderers.length === 0) {
    const hasHandler = route.handlerExports.some((e) => e.startsWith("handle"));
    if (hasHandler) {
      errors.push({
        file: route.relativePath + "/index.ts",
        message: `Route "${route.viewId}" has handlers but no HTML renderers. The route will serve JSON but not HTML.`,
        severity: "warning",
      });
    }
  }
}

function checkPluginLifecycle(result: ScanResult, errors: ValidationError[]): void {
  for (const lifecycle of result.pluginLifecycleOverrides) {
    const file = `index.ts:${lifecycle.line}`;
    if (!lifecycle.callsSuper) {
      errors.push({
        file,
        message: lifecycle.method === "dispose"
          ? "Plugin.dispose overrides BPService.dispose but does not call super.dispose(). BetterPortal cleanup would be skipped."
          : `Plugin.${lifecycle.method} overrides BPService.${lifecycle.method} but does not call super.${lifecycle.method}(obs). Await or return the base lifecycle call, or remove the override.`,
        severity: "error"
      });
      continue;
    }

    if (lifecycle.method !== "dispose" && !lifecycle.awaitsOrReturnsSuper) {
      errors.push({
        file,
        message: `Plugin.${lifecycle.method} calls super.${lifecycle.method}(obs) without awaiting or returning it. BetterPortal lifecycle setup must complete before the override returns.`,
        severity: "error"
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

  checkPluginLifecycle(result, errors);

  // Cross-route checks
  checkDuplicateViewIds(result.routes, errors);
  checkDuplicateOperationIds(result.routes, errors);
  checkConflictingPaths(result.routes, errors);
  checkDuplicateShellFragmentIds(result, errors);

  // Per-route checks
  for (const route of result.routes) {
    checkHandlerExports(route, errors);
    checkResponseSchema(route, errors);
    checkOperationMetadata(route, errors);
    checkRawRenderers(route, errors);
    warnRawHandler(route, errors);
    checkSchemaPolicy(route, errors);
    checkRenderersMatchMethods(route, errors);
    checkSseMethod(route, errors);
    checkSseFragmentRenderers(route, errors);
    checkFragmentFileNames(route, errors);
    checkRendererOrphans(route, errors);
    checkMissingRenderers(route, errors);
  }

  return errors;
}
