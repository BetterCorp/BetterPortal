import type { ScanResult, ScannedRoute } from "./scanner.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ValidationError {
  file: string;
  message: string;
  severity: "error" | "warning";
}

// ── Fragment file-name pattern ───────────────────────────────────────

/** Matches `_{location}.{id}.tsx` — at least two dot-separated parts after `_`. */
const FRAGMENT_PATTERN = /^_([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)\.tsx$/;

// ── Validation helpers ───────────────────────────────────────────────

function checkHandlerExports(route: ScannedRoute, errors: ValidationError[]): void {
  const hasHandler = route.handlerExports.some((e) => e.startsWith("handle"));

  if (!hasHandler) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" does not export any handler function (handleGet, handlePost, etc.).`,
      severity: "error",
    });
  }
}

function checkResponseSchema(route: ScannedRoute, errors: ValidationError[]): void {
  if (!route.handlerExports.includes("ResponseSchema")) {
    errors.push({
      file: route.relativePath + "/index.ts",
      message: `Route "${route.viewId}" does not export a ResponseSchema.`,
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
      // directory — this should never happen with the scanner, but
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

// ── Public API ───────────────────────────────────────────────────────

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
    checkFragmentFileNames(route, errors);
    checkThemeRendererOrphans(route, errors);
    checkMissingThemeRenderers(route, errors);
  }

  return errors;
}
