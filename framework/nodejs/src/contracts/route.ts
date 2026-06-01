import * as av from "anyvali";
import type { Infer } from "anyvali";
import type { HttpMethod } from "./common.js";
import type { JsonValue } from "./json.js";
import type { ViewAuthRequirement } from "./view.js";

/**
 * Context provided to a route handler.
 * TParams is auto-generated from [param] directory names — never hand-written.
 */
export interface RouteHandlerContext<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>
> {
  readonly params: TParams;
  readonly query: TQuery;
  readonly headers: THeaders;
  readonly request: TRequest;
  readonly method: HttpMethod;
  readonly path: string;
  readonly rawEvent?: unknown;
}

/**
 * A route handler function. Return type is the response data.
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>,
  TRequest = Record<string, unknown>,
  TResponse = unknown
> = (ctx: RouteHandlerContext<TParams, TQuery, THeaders, TRequest>) => TResponse | Promise<TResponse>;

/**
 * Match criteria for demo scenarios — used to match incoming request data
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
 * A demo scenario for a route — includes optional match criteria
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

// ── SSE handler ──────────────────────────────────────────────────────

export interface SSEHandlerContext {
  readonly event: unknown;
  readonly params: Record<string, string>;
  readonly query: Record<string, unknown>;
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
