import * as av from "anyvali";
import type { Infer, ParseContext, SchemaNode } from "anyvali";
import { PluginIdSchema, type HttpMethod } from "./common.js";
import { JsonObjectSchema, JsonValueSchema, type JsonObject, type JsonValue } from "./json.js";
import type { BetterPortalObservability, HttpOutcomeDiagnostic } from "./observability.js";
import type { BetterPortalResolvedApp, BetterPortalTenant } from "./platformConfig.js";
import { AppAuthPermissionActionSchema, type JwtClaims } from "./auth.js";
import { ApiCallerModeSchema, type ApiCallerMode, type M2MCallerMode, type ServiceTokenClaims } from "./m2m.js";

/**
 * Route-level (API-layer) auth requirement. Replaces ViewAuthRequirement at the API tier.
 * Routes declare this to opt into framework-enforced authentication and authorization.
 * Per spec section 0.5, validation runs in 8 steps before the handler is invoked.
 */
export const ApiAuthRequirementSchema = av.object({
  required: av.bool().default(false),
  callers: av.array(ApiCallerModeSchema).minItems(1).default(["user"]),
  permissions: av.array(av.object({
    serviceId: PluginIdSchema,
    viewId: av.string().minLength(1),
    permissions: av.array(AppAuthPermissionActionSchema).minItems(1)
  })).default([])
});
type ParsedApiAuthRequirement = Infer<typeof ApiAuthRequirementSchema>;
export type ApiAuthRequirement = Omit<ParsedApiAuthRequirement, "callers"> & {
  readonly callers?: ReadonlyArray<ApiCallerMode>;
};

/**
 * Interface the adapter uses to verify JWTs. Framework does not depend on a particular
 * verifier impl - services or plugin-bsb inject one based on app.auth config.
 */
export interface JwtVerifier {
  verify(token: string, context: { tenantId: string; appId: string }): Promise<JwtClaims>;
}

export interface ServiceTokenVerifier {
  verify(token: string, context: {
    tenantId: string;
    appId: string;
    viewId: string;
    method: HttpMethod;
    mode: M2MCallerMode;
    sourceServiceId: string;
    requiredPermissions: ReadonlyArray<string>;
  }): Promise<ServiceTokenClaims>;
}

/**
 * Validated user claims attached to the handler context when auth succeeds.
 * Either fully populated or `undefined` - never partial.
 */
export type ValidatedUserClaims = JwtClaims;
export type ValidatedServiceClaims = ServiceTokenClaims;

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

class Uint8ArraySchema extends av.BaseSchema<unknown, Uint8Array> {
  _validate(input: unknown, ctx: ParseContext): Uint8Array | undefined {
    if (input instanceof Uint8Array) return input;
    ctx.issues.push({
      code: av.ISSUE_CODES.INVALID_TYPE,
      message: "Expected uploaded file bytes",
      path: [...ctx.path],
      expected: "Uint8Array",
      received: input?.constructor?.name ?? typeof input
    });
    return undefined;
  }

  _toNode(): SchemaNode {
    return this._addDefault({
      kind: "array",
      items: { kind: "uint8" },
      metadata: { contentEncoding: "binary" }
    });
  }
}

const UploadedFileDataSchema: av.BaseSchema<unknown, Uint8Array> = new Uint8ArraySchema();
const UploadedFileSchema = av.object({
  fieldName: av.string(),
  filename: av.string(),
  contentType: av.string(),
  size: av.int().min(0),
  data: UploadedFileDataSchema
});
const StringOrStringArraySchema = av.union([av.string(), av.array(av.string())]);

/** Concrete runtime and portable contract for parsed multipart form data. */
export const MultipartRequestSchema: av.BaseSchema<unknown, MultipartRequest> = av.object({
  fields: av.record(StringOrStringArraySchema),
  files: av.record(av.union([UploadedFileSchema, av.array(UploadedFileSchema)]))
});

export interface RouteUrlOptions {
  /** Defaults to this handler's service id. Accepts a declared dependency alias, plugin id, or service-instance UUID. */
  serviceId?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Defaults to false, returning a root-relative path. */
  absolute?: boolean;
  /** Overrides the resolved origin when absolute is true. */
  origin?: string;
  /** Request a named component renderer (`?_c=`) from the resolved service route. */
  component?: string;
  /** Request a named fragment renderer (`?_f=`) from the resolved service route. */
  fragment?: string;
  /** Resolve the route's SSE endpoint (`/__sse`). */
  sse?: boolean;
}

export interface WebhookEmitOptions {
  tenantId?: string;
  appId?: string;
}

/**
 * Context provided to a route handler.
 * TParams is auto-generated from [param] directory names - never hand-written.
 */
export interface RouteHandlerContextBase<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
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
  /** Validated installed-service caller. Never populated from a user JWT. */
  readonly serviceCaller?: ValidatedServiceClaims;
  /** Verified caller shape. Delegated calls populate both user and serviceCaller. */
  readonly callerMode?: ApiCallerMode;
  /** Resolved tenant for this request. Handlers are not invoked without it. */
  readonly tenant: BetterPortalTenant;
  /** Resolved app for this request. Handlers are not invoked without it. */
  readonly app: BetterPortalResolvedApp;
  /** Effective service config for this tenant/app: tenant defaults overridden by app config. */
  readonly config?: TServiceConfig;
  /** Optional response model injected by services before generated view handlers run. */
  readonly responseModel?: unknown;
  /** BP-managed response header API. Always present when adapter wires it. */
  readonly bpHeaders?: BpHeadersApi;
  /** Response headers for HTMX/native headers without raw event reach-through. */
  readonly responseHeaders?: Headers;
  /** Set HTTP status without raw event reach-through. */
  readonly setStatus?: (status: number) => void;
  /** Attach structured diagnostic context to the final HTTP outcome. */
  readonly diagnostic: (diagnostic: HttpOutcomeDiagnostic) => void;
  /** The service id this handler belongs to. Always present when adapter wires it. */
  readonly serviceId?: string;
  /**
   * Build a URL to the service route that owns the view.
   * Use for service requests: HTMX requests, form actions, fetch, SSE, and downloads.
   */
  readonly routeUrl?: (viewId: string, options?: RouteUrlOptions) => string | null;
  /**
   * Build a GET navigation URL for a page mounted in the app shell.
   * Do not use for HTMX requests, form actions, fetch, SSE, or downloads; those
   * must use routeUrl or they can target the theme/app origin and return 404.
   */
  readonly uiRouteUrl?: (viewId: string, options?: RouteUrlOptions) => string | null;
  /** Emit a dev-declared webhook event through the control plane. */
  readonly webhook?: (eventId: string, payload: JsonValue, options?: WebhookEmitOptions) => Promise<void>;
  readonly response: (body?: RawResponseBody, init?: ResponseInit) => Response;
  readonly file: (body: RawResponseBody, options?: FileResponseOptions) => Response;
}

type PluginHandlerContext<TPlugin> = [TPlugin] extends [never]
  ? {}
  : {
      /** Public feature explicitly exported by the BSB plugin that owns this route. */
      readonly plugin: TPlugin;
    };

export type RouteHandlerContext<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
> = RouteHandlerContextBase<TParams, TQuery, THeaders, TRequest, TServiceConfig>
  & PluginHandlerContext<TPlugin>;

/**
 * A route handler function. Return type is the response data.
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TResponse = unknown,
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
> = (ctx: RouteHandlerContext<TParams, TQuery, THeaders, TRequest, TPlugin, TServiceConfig>) => TResponse | Promise<TResponse>;

export type RawRouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
> = ((ctx: RouteHandlerContext<TParams, TQuery, THeaders, TRequest, TPlugin, TServiceConfig>) => Response | Promise<Response>) & {
  readonly __bpRawHandler: true;
};

/**
 * Match criteria for demo scenarios - used to match incoming request data
 * against a scenario for preview/testing.
 */
export interface DemoScenarioMatch {
  readonly query?: JsonObject;
  readonly params?: JsonObject;
  readonly headers?: Record<string, string>;
  readonly request?: JsonObject;
}

const NonEmptyStringSchema = av.string().minLength(1);

export const DemoScenarioMatchSchema = av.object({
  query: av.optional(JsonObjectSchema),
  params: av.optional(JsonObjectSchema),
  headers: av.optional(av.record(av.string())),
  request: av.optional(JsonObjectSchema)
});

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
  response: JsonValueSchema
});
export type DemoScenarioInferred = Infer<typeof DemoScenarioSchema>;

// -- SSE handler ------------------------------------------------------

export type SSEHandlerContext<
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
> = {
  readonly event: unknown;
  readonly params: Record<string, string>;
  readonly query: Record<string, unknown>;
  readonly tenant: BetterPortalTenant;
  readonly app: BetterPortalResolvedApp;
  readonly user?: ValidatedUserClaims;
  readonly serviceCaller?: ValidatedServiceClaims;
  readonly callerMode?: ApiCallerMode;
  readonly serviceId?: string;
  readonly routeUrl?: RouteHandlerContext["routeUrl"];
  readonly uiRouteUrl?: RouteHandlerContext["uiRouteUrl"];
  readonly obs?: BetterPortalObservability;
  readonly config?: TServiceConfig;
  /** Aborted when the browser closes the SSE connection. */
  readonly signal?: AbortSignal;
} & PluginHandlerContext<TPlugin>;

/**
 * Two supported handler shapes:
 *  - Legacy: returns BodyInit (e.g., from `createEventStream(event).send()`).
 *            Handler manages stream lifecycle directly. Cannot be themed.
 *  - Generator: returns AsyncIterable of data items. Framework drives the
 *               stream, validates each item (if `tickSchema` exported), and
 *               applies renderer-specific `renderTick` when `?_f=loc.frag` is
 *               present on the request.
 */
export type SSEHandler<TItem = unknown, TPlugin = never, TServiceConfig = Record<string, unknown>> =
  | ((ctx: SSEHandlerContext<TPlugin, TServiceConfig>) => Promise<BodyInit> | BodyInit)
  | ((ctx: SSEHandlerContext<TPlugin, TServiceConfig>) => AsyncIterable<TItem>);
