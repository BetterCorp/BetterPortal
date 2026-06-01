import type { BaseSchema } from "anyvali";
import type { HttpMethod, RenderMode } from "./common.js";
import type { CacheHints, ViewAuthRequirement } from "./view.js";
import type { DemoScenario, RouteHandler, SSEHandler } from "./route.js";
import type { HtmlRenderable } from "../runtime/view.js";

// ── Theme renderer types ──────────────────────────────────────────────

/** Type of view renderer within a _theme.* directory. */
export type ThemeRendererType = "page" | "component" | "fragment";

/** A single theme renderer — page, component, or fragment. */
export interface RegisteredThemeRenderer {
  readonly rendererId: string;
  readonly type: ThemeRendererType;
  /** HTTP method restriction (e.g., from index.GET.tsx). Undefined = all methods. */
  readonly method?: HttpMethod;
  /** Fragment location (e.g., "nav" from _nav.profile.tsx). Only for fragments. */
  readonly fragmentLocation?: string;
  /** Fragment id (e.g., "profile" from _nav.profile.tsx). Only for fragments. */
  readonly fragmentId?: string;
  /** The render function exported by the theme file. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly render: (data: any) => HtmlRenderable;
  /**
   * SSE tick renderer — fragments only.
   * Sourced from `_<location>.<fragmentId>.sse.tsx`'s `renderTick` export.
   * Called once per SSE data item yielded by the route's `handleSSE` generator.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly sseRender?: (data: any) => HtmlRenderable;
}

/** All renderers for a single theme within a route. */
export interface ThemeRendererSet {
  readonly pages: ReadonlyArray<RegisteredThemeRenderer>;
  readonly components: ReadonlyArray<RegisteredThemeRenderer>;
  readonly fragments: ReadonlyArray<RegisteredThemeRenderer>;
}

// ── Route schemas ─────────────────────────────────────────────────────

/** Schema references for a route — all optional except response. */
export interface RouteSchemas {
  readonly response: BaseSchema<unknown, unknown>;
  readonly query?: BaseSchema<unknown, unknown>;
  readonly headers?: BaseSchema<unknown, unknown>;
  readonly request?: BaseSchema<unknown, unknown>;
}

// ── Registered route ──────────────────────────────────────────────────

/** A fully resolved route from the registry. */
export interface RegisteredRoute {
  readonly viewId: string;
  /** HTTP path derived from filesystem (e.g., "/users/:userId"). */
  readonly path: string;
  /** HTTP methods derived from handler exports (e.g., ["GET", "POST"]). */
  readonly methods: ReadonlyArray<HttpMethod>;
  /** Parameter names derived from [param] directory names. */
  readonly paramNames: ReadonlyArray<string>;
  readonly schemas: RouteSchemas;
  /** Handler functions keyed by HTTP method. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handlers: Readonly<Partial<Record<HttpMethod, RouteHandler<any, any, any, any, any>>>>;
  readonly title: string;
  readonly description: string;
  readonly auth: ViewAuthRequirement;
  readonly cacheHints: CacheHints;
  readonly demoScenarios: ReadonlyArray<DemoScenario>;
  /** Theme renderers keyed by themeId. */
  readonly themeRenderers: Readonly<Record<string, ThemeRendererSet>>;
  /** SSE handler, registered at `{path}/__sse`. */
  readonly sse?: {
    readonly handler: SSEHandler;
    /** Optional schema validating each tick yielded by the generator handler. */
    readonly tickSchema?: BaseSchema<unknown, unknown>;
  };
}

// ── Registry ──────────────────────────────────────────────────────────

/** The complete compiled registry — output of codegen. */
export interface BetterPortalRegistry {
  readonly routes: ReadonlyArray<RegisteredRoute>;
}
