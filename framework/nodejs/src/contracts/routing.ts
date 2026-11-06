import type { HttpMethod } from "./common.js";

/** Values encoded into route parameters and query strings. */
export type RouteUrlValue = string | number | boolean | null | undefined;

/** Options shared by API handlers and view renderers. */
export interface RouteOptions {
  /** Dependency alias, plugin id, or service instance id. Defaults to the current service. */
  serviceId?: string;
  /** Target HTTP method. Defaults to the current method for self, and GET for an explicit target. */
  method?: HttpMethod;
  /** Values substituted into service and mounted UI path parameters. Missing values fail resolution. */
  params?: Record<string, RouteUrlValue>;
  /** Query values, encoded once. Null and undefined remove keys. Self inherits the current query before overrides. Reserved _c/_f keys are removed; use component/fragment. */
  query?: Record<string, RouteUrlValue>;
  /** Select one UI mount when a service endpoint has multiple frontend aliases. */
  mountId?: string;
  /** Named component renderer. Applies to view paths, not API or UI navigation paths. */
  component?: string;
  /** Named fragment renderer. Applies to view paths, not API or UI navigation paths. */
  fragment?: string;
  /** Select a registered GET SSE endpoint on the current service. Unknown streaming capability returns null; SSE has no UI navigation path. */
  sse?: boolean;
}

/**
 * Resolve a service path or view id; omitting both resolves self. API code normally supplies a path;
 * view ids are also supported in API code, for example to build a public UI URL.
 * A path is always a service path, never an inferred theme/UI path. Exact templates
 * take precedence; concrete paths prefer earlier literal segments as the router does.
 */
export type RouteInput = RouteOptions & (
  | { path: string; viewId?: never }
  | { viewId: string; path?: never }
  | { path?: never; viewId?: never }
);

/**
 * Resolved destinations. Every path includes its encoded query string.
 * API and view paths share a service endpoint; HTML negotiation is controlled by
 * request headers. Component/fragment selectors appear only in view paths.
 * Resolve destinations where they are used: never add internal navigation URLs
 * to an API response merely to pass them to a renderer.
 */
export interface ResolvedRoute {
  /** API handlers stringify to apiPath; renderers stringify to viewPath. Never defaults to a UI path. */
  toString(): string;
  /** Return an immutable component destination, or null when resolution fails. */
  component(id: string): ResolvedRoute | null;
  /** Return an immutable fragment destination, or null when resolution fails. */
  fragment(id: string): ResolvedRoute | null;
  /** Resolved service-relative API request path. Use for service-context API requests. */
  readonly apiPath: string;
  /** Default service-view destination for renderer links and HTML actions, including component/fragment selectors. The theme maps service destinations to UI mounts. */
  readonly viewPath: string;
  /** Explicit mounted theme destination for shell navigation and history. Service renderers prefer BPRoute or viewPath. Null unless one GET page mount resolves. */
  readonly uiPath: string | null;
  /** Absolute API request URL on the target service origin. Null if that origin is unavailable. */
  readonly absoluteApiPath: string | null;
  /** Absolute rendered-view request URL on the target service origin. Use for cross-service HTMX view requests. */
  readonly absoluteViewPath: string | null;
  /** Absolute public UI URL on the app/theme origin. Use for public links, emails and OAuth callbacks. */
  readonly absoluteUiPath: string | null;
}

/**
 * The same resolver in API handlers and view renderers. Returns null for unknown
 * routes, unsupported methods, missing parameters or ambiguous service targets.
 * Unmounted/ambiguous UI destinations leave UI fields null while service paths remain usable.
 */
export type RouteResolver = (input?: RouteInput) => ResolvedRoute | null;
