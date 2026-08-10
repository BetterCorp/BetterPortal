import type { BaseSchema } from "anyvali";
import type { HttpMethod, RenderMode } from "./common.js";
import type { CacheHints } from "./view.js";
import type { ApiAuthRequirement, DemoScenario, RawRouteHandler, RouteHandler, RouteUrlOptions, SSEHandler } from "./route.js";
import type { BetterPortalApp, BetterPortalRouteChrome, BetterPortalTenant } from "./platformConfig.js";
import type { ApiContractDescriptor } from "./m2m.js";
import type { BpStreamHandler, StreamRendererSet } from "./streaming.js";
import type { HtmlRenderable } from "../runtime/view.js";

export interface RouteUiOptions extends RouteUrlOptions {
  method?: HttpMethod;
  target?: string;
  swap?: string;
  push?: string | boolean;
}

export type RouteUiAttributes = Readonly<Record<string, string>>;

export interface BPElementArgs {
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly query?: Readonly<Record<string, string | number | boolean | null | undefined>>;
}

export interface BPElementReference {
  /** Dependency alias from betterportal.json, a canonical plugin id, or "shell". */
  readonly service: string;
  /** Service route path from the dependency contract. Required for service fragments. */
  readonly path?: string;
  readonly fragment: string;
  readonly args?: BPElementArgs;
}

export interface ResolvedBPElementReference {
  readonly url?: string;
  readonly serviceId?: string;
  readonly unavailable?: string;
}

export interface ViewTenantContext {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly branding: Readonly<BetterPortalTenant["branding"]>;
}

export interface ViewAppContext {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly title: string;
  readonly defaultRoute: string;
  readonly shell?: {
    readonly serviceId: string;
    readonly service: string;
    readonly renderer: string;
  };
  readonly auth?: {
    readonly serviceId: string;
    readonly loginViewId?: string;
    readonly logoutViewId?: string;
  };
}

export interface ViewRenderContext {
  /** Stable, non-secret tenant presentation context. */
  readonly tenant: ViewTenantContext;
  /** Stable, non-secret app presentation and navigation context. */
  readonly app: ViewAppContext;
  readonly request: {
    readonly method: HttpMethod;
    readonly path: string;
    readonly params: Readonly<Record<string, string>>;
    readonly query: Readonly<Record<string, unknown>>;
  };
  readonly route: {
    readonly viewId: string;
    readonly path: string;
    readonly renderer: string;
    readonly mode: RenderMode;
    readonly kind: ViewRendererType;
    readonly key?: string;
    readonly status: number;
  };
  readonly url: {
    current(options?: RouteUrlOptions & { component?: string; fragment?: string }): string;
    path(path: string, options?: RouteUrlOptions): string;
    route(viewId: string, options?: RouteUrlOptions): string | null;
    uiRoute(viewId: string, options?: RouteUrlOptions): string | null;
  };
  readonly routeUi: {
    link(url: string, options?: RouteUiOptions): RouteUiAttributes;
    current(options?: RouteUiOptions): RouteUiAttributes;
    fragment(url: string, options?: RouteUiOptions): RouteUiAttributes;
    form(url: string, options?: RouteUiOptions): RouteUiAttributes;
  };
  /** Resolve an app-allowlisted fragment request. Context is consumed server-side. */
  readonly element: (reference: BPElementReference) => ResolvedBPElementReference;
}
// -- HTML renderer types -----------------------------------------------

/** Type of view renderer within a _renderer.* directory. */
export type ViewRendererType = "page" | "component" | "fragment";

/** A single HTML renderer - page, component, or fragment. */
export interface RegisteredViewRenderer {
  readonly rendererId: string;
  readonly type: ViewRendererType;
  /** HTTP method restriction (e.g., from index.GET.tsx). Undefined = all methods. */
  readonly method?: HttpMethod;
  /** Fragment location (e.g., "nav" from _nav.profile.tsx). Only for fragments. */
  readonly fragmentLocation?: string;
  /** Fragment id (e.g., "profile" from _nav.profile.tsx). Only for fragments. */
  readonly fragmentId?: string;
  /** The render function exported by the theme file. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly render: (data: any, context: ViewRenderContext) => HtmlRenderable;
  /**
   * SSE tick renderer - fragments only.
   * Sourced from `_<location>.<fragmentId>.sse.tsx`'s `renderTick` export.
   * Called once per SSE data item yielded by the route's `handleSSE` generator.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly sseRender?: (data: any) => HtmlRenderable;
}

/** All renderers for a single theme within a route. */
export interface ViewRendererSet {
  readonly pages: ReadonlyArray<RegisteredViewRenderer>;
  readonly components: ReadonlyArray<RegisteredViewRenderer>;
  readonly fragments: ReadonlyArray<RegisteredViewRenderer>;
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
  readonly page?: RegisteredViewRenderer;
  readonly pages?: ReadonlyArray<RegisteredViewRenderer>;
  readonly components?: Readonly<Record<string, RegisteredViewRenderer>>;
  readonly fragments?: Readonly<Record<string, RegisteredViewRenderer>>;
}

// -- Route schemas -----------------------------------------------------

/** Schema references for a route - all optional except response. */
export interface RouteSchemas {
  readonly params?: BaseSchema<unknown, unknown>;
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

export interface RegisteredMethodRoute {
  readonly method: HttpMethod;
  readonly operationId: string;
  readonly title: string;
  readonly description: string;
  readonly schemas: RouteSchemas;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handler: RouteHandler<any, any, any, any, any, any, any> | RawRouteHandler<any, any, any, any, any, any> | BpStreamHandler<any, any, any, any, any>;
  readonly raw?: boolean;
  readonly auth: ApiAuthRequirement;
  readonly sitemap?: import("./seo.js").RouteSitemapDeclaration;
  readonly robots?: import("./seo.js").RouteRobotsPolicy;
  readonly role?: string;
  readonly dependencies?: ReadonlyArray<string>;
  readonly chrome?: BetterPortalRouteChrome;
  readonly apiContracts?: ReadonlyArray<Omit<ApiContractDescriptor, "viewId" | "methods">>;
  readonly cacheHints: CacheHints;
  readonly demoScenarios: ReadonlyArray<DemoScenario>;
}

// -- Registered route --------------------------------------------------

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
  readonly methodRoutes?: Readonly<Partial<Record<HttpMethod, RegisteredMethodRoute>>>;
  /** Handler functions keyed by HTTP method. Streaming routes register a branded BpStreamHandler object instead of a function. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handlers: Readonly<Partial<Record<HttpMethod, RouteHandler<any, any, any, any, any, any, any> | RawRouteHandler<any, any, any, any, any, any> | BpStreamHandler<any, any, any, any, any>>>>;
  readonly raw?: boolean;
  readonly title: string;
  readonly description: string;
  /**
   * Status code -> renderer map (per theme), broken down by renderer kind.
   * Adapter looks up by (rendererKey, statusCode, kind, optional renderer id).
   */
  readonly statusRenderers?: Readonly<Record<string, Readonly<Record<number, StatusRenderersByKind>>>>;
  /** HTML renderers keyed by compatibility key. */
  readonly renderers: Readonly<Record<string, ViewRendererSet>>;
  /** SSE handler, registered at `{path}/__sse`. */
  readonly sse?: {
    readonly handler: SSEHandler;
    /** Optional schema validating each tick yielded by the generator handler. */
    readonly tickSchema?: BaseSchema<unknown, unknown>;
  };
}

export interface ShellFragmentRenderContext {
  readonly tenant: BetterPortalTenant;
  readonly app: BetterPortalApp;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly request: { readonly url: string };
  readonly fragmentId: string;
  readonly items: ReadonlyArray<HtmlRenderable>;
}

export interface RegisteredShellFragment {
  readonly id: string;
  readonly kind: "fragment" | "block";
  readonly title: string;
  readonly description: string;
  readonly defaultItems?: ReadonlyArray<string>;
  readonly render: (context: ShellFragmentRenderContext) => HtmlRenderable;
}

// -- Registry ----------------------------------------------------------

/** The complete compiled registry - output of codegen. */
export interface BetterPortalRegistry {
  /** Dependency alias -> canonical plugin id, generated from betterportal.lock.json. */
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly routes: ReadonlyArray<RegisteredRoute>;
  readonly shellFragments?: ReadonlyArray<RegisteredShellFragment>;
}
