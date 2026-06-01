import type { BaseSchema, Infer } from "anyvali";
import type { RouteHandlerContext, RouteHandler } from "../contracts/route.js";

// ── Schema configuration ─────────────────────────────────────────────

/**
 * Schema configuration for a route handler.
 * `response` is required; `query`, `headers`, and `request` are optional.
 */
export interface HandlerSchemas<
  TResponse extends BaseSchema<unknown, unknown>,
  TQuery extends BaseSchema<unknown, unknown> | undefined = undefined,
  THeaders extends BaseSchema<unknown, unknown> | undefined = undefined,
  TRequest extends BaseSchema<unknown, unknown> | undefined = undefined
> {
  readonly response: TResponse;
  readonly query?: TQuery;
  readonly headers?: THeaders;
  readonly request?: TRequest;
}

// ── Type helpers ─────────────────────────────────────────────────────

/** Resolve a schema to its inferred output type, or fall back to a default. */
type SchemaOutput<
  T extends BaseSchema<unknown, unknown> | undefined,
  TDefault
> = T extends BaseSchema<unknown, unknown> ? Infer<T> : TDefault;

/** Fully-typed handler context derived from schema configuration. */
type TypedHandlerContext<
  TSchemas extends HandlerSchemas<BaseSchema<unknown, unknown>, any, any, any>,
  TParams = Record<string, string>
> = RouteHandlerContext<
  TParams,
  SchemaOutput<TSchemas["query"], Record<string, unknown>>,
  SchemaOutput<TSchemas["headers"], Record<string, string>>,
  SchemaOutput<TSchemas["request"], Record<string, unknown>>
>;

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Create a type-safe route handler with framework-enforced validation.
 *
 * - TypeScript enforces the return type matches `Infer<ResponseSchema>` at compile time.
 * - At runtime, the response is validated through `schemas.response.parse()` as a safety net.
 * - The handler's `ctx` is fully typed from the provided schemas — no manual `.parse()` needed.
 *
 * @example
 * ```ts
 * export const handleGet = createHandler(
 *   { response: ResponseSchema, query: QuerySchema },
 *   (ctx) => ({
 *     greeting: `Hello, ${ctx.query.name}`,
 *     themeHint: "bootstrap1",
 *     supports: ["application/json", "text/html"]
 *   })
 * );
 * ```
 */
export function createHandler<
  TResponse extends BaseSchema<unknown, unknown>,
  TQuery extends BaseSchema<unknown, unknown> | undefined = undefined,
  THeaders extends BaseSchema<unknown, unknown> | undefined = undefined,
  TRequest extends BaseSchema<unknown, unknown> | undefined = undefined,
  TParams = Record<string, string>
>(
  schemas: HandlerSchemas<TResponse, TQuery, THeaders, TRequest>,
  handler: (
    ctx: TypedHandlerContext<HandlerSchemas<TResponse, TQuery, THeaders, TRequest>, TParams>
  ) => Infer<TResponse> | Promise<Infer<TResponse>>
): RouteHandler<
  TParams,
  SchemaOutput<TQuery, Record<string, unknown>>,
  SchemaOutput<THeaders, Record<string, string>>,
  SchemaOutput<TRequest, Record<string, unknown>>,
  Infer<TResponse>
> {
  return async (ctx) => {
    const result = await handler(
      ctx as TypedHandlerContext<HandlerSchemas<TResponse, TQuery, THeaders, TRequest>, TParams>
    );
    // Runtime validation — catches any drift between TypeScript types and actual data.
    return schemas.response.parse(result) as Infer<TResponse>;
  };
}
