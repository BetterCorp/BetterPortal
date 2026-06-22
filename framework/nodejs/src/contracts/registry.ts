import type { BaseSchema } from "anyvali";
import type { HttpMethod, RenderMode } from "./common.js";
import type { CacheHints } from "./view.js";
import type { ApiAuthRequirement, DemoScenario, RawRouteHandler, RouteHandler, SSEHandler } from "./route.js";
import type { BetterPortalRouteChrome } from "./platformConfig.js";
import type { BpStreamHandler, StreamRendererSet } from "./streaming.js";
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
  /**
   * Streaming-view frame renderers, sourced from `index.stream.tsx`.
   * Present only on routes whose handler is a `createStreamHandler` stream.
   */
  readonly stream?: StreamRendererSet;
}

/**
 * Status-specific renderers grouped by kind.
 * `page` is single; `component` and `fragment` are keyed by id / location.id so the adapter
 * can match the originally requested renderer (e.g. fragment `nav.profile`).
 */
export interface StatusRenderersByKind {
  readonly page?: RegisteredThemeRenderer;
  readonly components?: Readonly<Record<string, RegisteredThemeRenderer>>;
  readonly fragments?: Readonly<Record<string, RegisteredThemeRenderer>>;
}

// ── Route schemas ─────────────────────────────────────────────────────

/** Schema references for a route — all optional except response. */
export interface RouteSchemas {
  readonly response?: BaseSchema<unknown, unknown>;
  readonly query?: BaseSchema<unknown, unknown>;
  readonly headers?: BaseSchema<unknown, unknown>;
  readonly request?: BaseSchema<unknown, unknown>;
  readonly multipart?: BaseSchema<unknown, unknown>;
  /** Streaming views: per-frame item payload schema (canonical contract). */
  readonly item?: BaseSchema<unknown, unknown>;
  /** Streaming views: end-of-stream summary payload schema. */
  readonly summary?: BaseSchema<unknown, unknown>;
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
  /** Handler functions keyed by HTTP method. Streaming routes register a branded BpStreamHandler object instead of a function. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handlers: Readonly<Partial<Record<HttpMethod, RouteHandler<any, any, any, any, any, any, any> | RawRouteHandler<any, any, any, any, any, any> | BpStreamHandler<any, any, any, any, any>>>>;
  readonly raw?: boolean;
  readonly title: string;
  readonly description: string;
  readonly auth: ApiAuthRequirement;
  /** Optional view role hint (e.g., "auth.login"). Used by discovery flows. */
  readonly role?: string;
  /** ViewIds that should be mounted with this view for API/detail flows. */
  readonly dependencies?: ReadonlyArray<string>;
  /** Optional shell chrome hints declared by the service route. */
  readonly chrome?: BetterPortalRouteChrome;
  /**
   * Status code → renderer map (per theme), broken down by renderer kind.
   * Adapter looks up by (themeId, statusCode, kind, optional rendererKey).
   */
  readonly statusRenderers?: Readonly<Record<string, Readonly<Record<number, StatusRenderersByKind>>>>;
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
