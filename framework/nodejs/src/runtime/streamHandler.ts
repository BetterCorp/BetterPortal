import * as av from "anyvali";
import type { BaseSchema, Infer } from "anyvali";
import type { RouteHandlerContext } from "../contracts/route.js";
import { BP_STREAM_HANDLER, type BpStreamHandler } from "../contracts/streaming.js";

// ── Schema configuration ─────────────────────────────────────────────

/**
 * Schema configuration for a streaming route handler.
 * `item` is required (the canonical per-frame payload); `summary` is the
 * optional end-of-stream aggregate. Cross-item invariants belong in `summary`,
 * not `item` — see spec/streaming.md § 3.
 */
export interface StreamHandlerSchemas<
  TItem extends BaseSchema<unknown, unknown>,
  TSummary extends BaseSchema<unknown, unknown> | undefined = undefined,
  TQuery extends BaseSchema<unknown, unknown> | undefined = undefined,
  THeaders extends BaseSchema<unknown, unknown> | undefined = undefined
> {
  readonly item: TItem;
  readonly summary?: TSummary;
  readonly query?: TQuery;
  readonly headers?: THeaders;
}

type SchemaOutput<
  T extends BaseSchema<unknown, unknown> | undefined,
  TDefault
> = T extends BaseSchema<unknown, unknown> ? Infer<T> : TDefault;

/** Generator return type: summary value when a summary schema is declared, else void. */
type SummaryReturn<TSummary extends BaseSchema<unknown, unknown> | undefined> =
  TSummary extends BaseSchema<unknown, unknown> ? Infer<TSummary> : void;

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Create a streaming route handler. Mirrors `createHandler` but the handler is
 * an async generator yielding items; the generator's `return` value is the
 * summary frame (when a `summary` schema is declared).
 *
 * The adapter — not this factory — drives the stream: it validates every
 * yielded item against `schemas.item` before emission and negotiates the
 * representation (buffered JSON / NDJSON frames / themed HTML over SSE).
 *
 * The buffered JSON response schema (`{ items, summary? }`) is derived here so
 * codegen and the manifest never need a hand-written ResponseSchema for
 * streaming views.
 *
 * @example
 * ```ts
 * export const handleGet = createStreamHandler(
 *   { item: ItemSchema, summary: SummarySchema, query: QuerySchema },
 *   async function* (ctx) {
 *     for (const row of await loadRows(ctx.query.q)) yield row;
 *     return { total: 12 };
 *   }
 * );
 * ```
 */
export function createStreamHandler<
  TItem extends BaseSchema<unknown, unknown>,
  TSummary extends BaseSchema<unknown, unknown> | undefined = undefined,
  TQuery extends BaseSchema<unknown, unknown> | undefined = undefined,
  THeaders extends BaseSchema<unknown, unknown> | undefined = undefined,
  TParams = Record<string, string>,
  TPlugin = unknown,
  TServiceConfig = Record<string, unknown>
>(
  schemas: StreamHandlerSchemas<TItem, TSummary, TQuery, THeaders>,
  handler: (
    ctx: RouteHandlerContext<
      TParams,
      SchemaOutput<TQuery, Record<string, unknown>>,
      SchemaOutput<THeaders, Record<string, string>>,
      Record<string, unknown>,
      TPlugin,
      TServiceConfig
    >
  ) => AsyncGenerator<Infer<TItem>, SummaryReturn<TSummary>, void>
): BpStreamHandler<
  Infer<TItem>,
  SummaryReturn<TSummary>,
  TParams,
  SchemaOutput<TQuery, Record<string, unknown>>,
  SchemaOutput<THeaders, Record<string, string>>
> {
  const responseShape: Record<string, BaseSchema<unknown, unknown>> = {
    items: av.array(schemas.item).default([])
  };
  if (schemas.summary) {
    responseShape.summary = av.optional(schemas.summary);
  }

  return {
    [BP_STREAM_HANDLER]: true,
    itemSchema: schemas.item,
    ...(schemas.summary ? { summarySchema: schemas.summary } : {}),
    responseSchema: av.object(responseShape, { unknownKeys: "strip" }),
    run: handler as BpStreamHandler<
      Infer<TItem>,
      SummaryReturn<TSummary>,
      TParams,
      SchemaOutput<TQuery, Record<string, unknown>>,
      SchemaOutput<THeaders, Record<string, string>>
    >["run"]
  };
}

export namespace createStreamHandler {
  export function forContext<TPlugin = unknown, TServiceConfig = Record<string, unknown>>() {
    return createStreamHandler as <
      TItem extends BaseSchema<unknown, unknown>,
      TSummary extends BaseSchema<unknown, unknown> | undefined = undefined,
      TQuery extends BaseSchema<unknown, unknown> | undefined = undefined,
      THeaders extends BaseSchema<unknown, unknown> | undefined = undefined,
      TParams = Record<string, string>
    >(
      schemas: StreamHandlerSchemas<TItem, TSummary, TQuery, THeaders>,
      handler: (
        ctx: RouteHandlerContext<
          TParams,
          SchemaOutput<TQuery, Record<string, unknown>>,
          SchemaOutput<THeaders, Record<string, string>>,
          Record<string, unknown>,
          TPlugin,
          TServiceConfig
        >
      ) => AsyncGenerator<Infer<TItem>, SummaryReturn<TSummary>, void>
    ) => BpStreamHandler<
      Infer<TItem>,
      SummaryReturn<TSummary>,
      TParams,
      SchemaOutput<TQuery, Record<string, unknown>>,
      SchemaOutput<THeaders, Record<string, string>>
    >;
  }
}
