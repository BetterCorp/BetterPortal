import * as av from "anyvali";
import type { Infer } from "anyvali";
import type { HttpMethod } from "./common.js";
import type { JsonValue } from "./json.js";
import type { BetterPortalObservability } from "./observability.js";
import type { BetterPortalApp, BetterPortalTenant } from "./platformConfig.js";
import { AppAuthPermissionGrantSchema, type JwtClaims } from "./auth.js";

/**
 * Route-level (API-layer) auth requirement. Replaces ViewAuthRequirement at the API tier.
 * Routes declare this to opt into framework-enforced authentication and authorization.
 * Per spec section 0.5, validation runs in 8 steps before the handler is invoked.
 */
export const ApiAuthRequirementSchema = av.object({
  required: av.bool().default(false),
  permissions: av.array(AppAuthPermissionGrantSchema).default([])
}, { unknownKeys: "strip" });
export type ApiAuthRequirement = Infer<typeof ApiAuthRequirementSchema>;

/**
 * Interface the adapter uses to verify JWTs. Framework does not depend on a particular
 * verifier impl - services or plugin-bsb inject one based on app.auth config.
 */
export interface JwtVerifier {
  verify(token: string, context: { tenantId: string; appId: string }): Promise<JwtClaims>;
}

/**
 * Validated user claims attached to the handler context when auth succeeds.
 * Either fully populated or `undefined` - never partial.
 */
export type ValidatedUserClaims = JwtClaims;

/**
 * BP-managed header API on the handler context. Headers set here are emitted as
 * BP-SetHeader / BP-RemoveHeader response headers and stored by the client BP shim.
 */
export interface BpHeadersApi {
  set(name: string, value: string, options?: BpHeaderSetOptions): void;
  remove(name: string): void;
}

export interface BpHeaderSetOptions {
  /** Only the setting service may overwrite or remove. */
  locked?: boolean;
  /** Header only attached to subsequent requests to the service that set it. Default global. */
  scopeToOwner?: boolean;
  /** @deprecated Use scopeToOwner. Explicit cross-service header scope is not supported. */
  scopeServiceId?: string;
  /** Auto-remove on client after this many seconds. */
  expiresInSeconds?: number;
  /** Service-relative or absolute URL the shell may POST before expiry to refresh this header. */
  refreshPath?: string;
  /** Refresh this many seconds before expiry. Defaults to shell policy. */
  refreshBeforeSeconds?: number;
}

export type RawResponseBody = BodyInit | null;

export interface FileResponseOptions {
  filename?: string;
  contentType?: string;
  size?: number;
  disposition?: "attachment" | "inline";
  headers?: HeadersInit;
  status?: number;
}

export interface UploadedFile {
  fieldName: string;
  filename: string;
  contentType: string;
  size: number;
  data: Uint8Array;
}

export interface MultipartRequest {
  fields: Record<string, string | string[]>;
  files: Record<string, UploadedFile | UploadedFile[]>;
}

export interface RouteUrlOptions {
  /** Defaults to this handler's service id. Accepts either plugin id or service-instance UUID. */
  serviceId?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Defaults to false, returning a root-relative path. */
  absolute?: boolean;
  /** Overrides the resolved origin when absolute is true. */
  origin?: string;
}

export interface WebhookEmitOptions {
  tenantId?: string;
  appId?: string;
}

/**
 * Context provided to a route handler.
 * TParams is auto-generated from [param] directory names - never hand-written.
 */
export interface RouteHandlerContext<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TPlugin = unknown,
  TServiceConfig = Record<string, unknown>
> {
  readonly params: TParams;
  readonly query: TQuery;
  readonly headers: THeaders;
  readonly request: TRequest;
  readonly multipart?: MultipartRequest;
  readonly method: HttpMethod;
  readonly path: string;
  readonly rawEvent?: unknown;
  readonly obs?: BetterPortalObservability;
  /** Validated user claims when auth resolver succeeds. `undefined` for anonymous or invalid token. */
  readonly user?: ValidatedUserClaims;
  /** Resolved tenant for this request. Handlers are not invoked without it. */
  readonly tenant: BetterPortalTenant;
  /** Resolved app for this request. Handlers are not invoked without it. */
  readonly app: BetterPortalApp;
  /** Effective service config for this tenant/app: tenant defaults overridden by app config. */
  readonly config?: TServiceConfig;
  /** Direct plugin/service instance that owns this route. */
  readonly plugin?: TPlugin;
  /** Optional response model injected by services before generated view handlers run. */
  readonly responseModel?: unknown;
  /** BP-managed response header API. Always present when adapter wires it. */
  readonly bpHeaders?: BpHeadersApi;
  /** Response headers for HTMX/native headers without raw event reach-through. */
  readonly responseHeaders?: Headers;
  /** Set HTTP status without raw event reach-through. */
  readonly setStatus?: (status: number) => void;
  /** The service id this handler belongs to. Always present when adapter wires it. */
  readonly serviceId?: string;
  /** Build a service-facing URL for a registered view id. */
  readonly routeUrl?: (viewId: string, options?: RouteUrlOptions) => string | null;
  /** Build an app/UI-facing URL for a mounted route by view id. */
  readonly uiRouteUrl?: (viewId: string, options?: RouteUrlOptions) => string | null;
  /** Emit a dev-declared webhook event through the control plane. */
  readonly webhook?: (eventId: string, payload: JsonValue, options?: WebhookEmitOptions) => Promise<void>;
  readonly response: (body?: RawResponseBody, init?: ResponseInit) => Response;
  readonly file: (body: RawResponseBody, options?: FileResponseOptions) => Response;
}

/**
 * A route handler function. Return type is the response data.
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TResponse = unknown,
  TPlugin = unknown,
  TServiceConfig = Record<string, unknown>
> = (ctx: RouteHandlerContext<TParams, TQuery, THeaders, TRequest, TPlugin, TServiceConfig>) => TResponse | Promise<TResponse>;

export type RawRouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TPlugin = unknown,
  TServiceConfig = Record<string, unknown>
> = ((ctx: RouteHandlerContext<TParams, TQuery, THeaders, TRequest, TPlugin, TServiceConfig>) => Response | Promise<Response>) & {
  readonly __bpRawHandler: true;
};

/**
 * Match criteria for demo scenarios - used to match incoming request data
 * against a scenario for preview/testing.
 */
export interface DemoScenarioMatch {
  readonly query?: Record<string, unknown>;
  readonly params?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
  readonly request?: Record<string, unknown>;
}

const NonEmptyStringSchema = av.string().minLength(1);

export const DemoScenarioMatchSchema = av.object({
  query: av.optional(av.record(av.any())),
  params: av.optional(av.record(av.any())),
  headers: av.optional(av.record(av.string())),
  request: av.optional(av.record(av.any()))
}, { unknownKeys: "strip" });

/**
 * A demo scenario for a route - includes optional match criteria
 * and the expected response data.
 */
export interface DemoScenario<TResponse = unknown> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly match?: DemoScenarioMatch;
  readonly response: TResponse;
}

export const DemoScenarioSchema = av.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: av.optional(av.string()),
  match: av.optional(DemoScenarioMatchSchema),
  response: av.any()
}, { unknownKeys: "strip" });
export type DemoScenarioInferred = Infer<typeof DemoScenarioSchema>;

// -- SSE handler ------------------------------------------------------

export interface SSEHandlerContext {
  readonly event: unknown;
  readonly params: Record<string, string>;
  readonly query: Record<string, unknown>;
  readonly obs?: BetterPortalObservability;
}

/**
 * Two supported handler shapes:
 *  - Legacy: returns BodyInit (e.g., from `createEventStream(event).send()`).
 *            Handler manages stream lifecycle directly. Cannot be themed.
 *  - Generator: returns AsyncIterable of data items. Framework drives the
 *               stream, validates each item (if `tickSchema` exported), and
 *               applies theme-specific `renderTick` when `?_f=loc.frag` is
 *               present on the request.
 */
export type SSEHandler =
  | ((ctx: SSEHandlerContext) => Promise<BodyInit> | BodyInit)
  | ((ctx: SSEHandlerContext) => AsyncIterable<unknown>);
