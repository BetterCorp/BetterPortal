import * as av from "anyvali";
import type { BaseSchema, Infer } from "anyvali";
import type { RouteHandlerContext } from "./route.js";
import type { HtmlRenderable } from "../runtime/view.js";

// -- Frame envelope (spec/streaming.md section 1) ---------------------------
// Protocol-defined wire shape. Payload (`data`) schemas are view-defined.

export const StreamErrorFrameSchema = av.object({
  kind: av.enum_(["error"] as const),
  error: av.string().minLength(1),
  message: av.string().minLength(1),
  issues: av.optional(av.array(av.object({
    code: av.string().minLength(1),
    path: av.optional(av.string()),
    message: av.string().minLength(1)
  }, { unknownKeys: "strip" })))
}, { unknownKeys: "strip" });
export type StreamErrorFrame = Infer<typeof StreamErrorFrameSchema>;

export const StreamEndFrameSchema = av.object({
  kind: av.enum_(["end"] as const),
  count: av.int().min(0)
}, { unknownKeys: "strip" });
export type StreamEndFrame = Infer<typeof StreamEndFrameSchema>;

export interface StreamItemFrame<TItem = unknown> {
  readonly kind: "item";
  readonly data: TItem;
}

export interface StreamSummaryFrame<TSummary = unknown> {
  readonly kind: "summary";
  readonly data: TSummary;
}

export type StreamFrame<TItem = unknown, TSummary = unknown> =
  | StreamItemFrame<TItem>
  | StreamSummaryFrame<TSummary>
  | StreamErrorFrame
  | StreamEndFrame;

// -- Stream handler (branded, produced by createStreamHandler) --------

/**
 * Brand key identifying a stream handler in the registry's `handlers` map.
 * Stream handlers are objects (not callables); the adapter detects the brand
 * at request time and diverts to the streaming pipeline.
 */
export const BP_STREAM_HANDLER = Symbol.for("betterportal.streamHandler");

/**
 * A streaming route handler. The generator yields validated-shape items and
 * MAY return a summary value. The adapter (not the generator) drives frame
 * encoding, per-frame validation, and representation negotiation.
 */
export interface BpStreamHandler<
  TItem = unknown,
  TSummary = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  THeaders = Record<string, string>
> {
  readonly [BP_STREAM_HANDLER]: true;
  readonly itemSchema: BaseSchema<unknown, unknown>;
  readonly summarySchema?: BaseSchema<unknown, unknown>;
  /**
   * Derived buffered-JSON response schema: `{ items: array(itemSchema), summary? }`.
   * Used as the route's `schemas.response` and the manifest's `jsonResponseSchema`
   * so streaming views never hand-author a second response shape.
   */
  readonly responseSchema: BaseSchema<unknown, unknown>;
  run(
    ctx: RouteHandlerContext<TParams, TQuery, THeaders, Record<string, unknown>>
  ): AsyncGenerator<TItem, TSummary | void, void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStreamHandler(value: unknown): value is BpStreamHandler<any, any, any, any, any> {
  return typeof value === "object"
    && value !== null
    && (value as Record<symbol, unknown>)[BP_STREAM_HANDLER] === true;
}

// -- Stream theme renderers (spec/streaming.md section 4) -------------------

/**
 * Context passed to a streaming view's shell renderer.
 * `sseConnectPath` is the relative SSE URL (path + original query string) the
 * shell should wire via `hx-sse:connect` - the client rewriter absolutizes it.
 */
export interface StreamShellContext {
  readonly sseConnectPath: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, unknown>;
}

/**
 * Per-theme renderers for a streaming view, sourced from
 * `_theme.<themeId>/index.stream.tsx` exports.
 * Each function renders ONE frame; the buffered HTML page render uses the
 * regular `index.tsx` page renderer over the derived `{ items, summary }` data.
 */
export interface StreamRendererSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly renderShell: (ctx: StreamShellContext) => HtmlRenderable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly renderItem: (item: any) => HtmlRenderable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly renderSummary?: (summary: any) => HtmlRenderable;
  readonly renderError?: (error: StreamErrorFrame) => HtmlRenderable;
}
