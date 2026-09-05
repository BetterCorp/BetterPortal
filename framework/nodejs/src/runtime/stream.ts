import type { RouteHandlerContext } from "../contracts/route.js";
import type { BpStreamHandler, StreamErrorFrame } from "../contracts/streaming.js";

/**
 * Stream driving helpers (spec/streaming.md).
 *
 * The producer-side validation gate lives here: every yielded item is parsed
 * against the handler's itemSchema (and the generator return value against
 * summarySchema) BEFORE leaving the process, in every representation.
 */

type AnyStreamHandler = BpStreamHandler<any, any, any, any, any>;
type AnyCtx = RouteHandlerContext<any, any, any, any>;

/** Validated stream items and optional generator-return summary. */
export interface BufferedStreamResult {
  items: unknown[];
  summary?: unknown;
}

/** Events surfaced to a frame consumer while driving the generator. */
export interface StreamDriverSink {
  onItem(item: unknown): Promise<void> | void;
  onSummary(summary: unknown): Promise<void> | void;
  /** Terminal failure callback; cancellation suppresses both terminal callbacks. */
  onError(frame: StreamErrorFrame): Promise<void> | void;
  onEnd(count: number): Promise<void> | void;
}

function toErrorFrame(error: unknown): StreamErrorFrame {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    kind: "error",
    error: err.name === "ValidationError" ? "item_validation_failed" : "stream_failed",
    message: err.message || "stream failed"
  };
}

/** Stop waiting on abort, while still observing late producer/sink rejections. */
function waitForStreamWork<T>(work: Promise<T> | T, signal?: AbortSignal): Promise<T> {
  if (!signal) return Promise.resolve(work);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener("abort", onAbort); reject(signal.reason); };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Drive the generator, validating each frame payload, and report frames to
 * the sink in legal order: items, optional summary, then one terminal callback.
 *
 * @remarks
 * Each callback is awaited for backpressure. Cancellation suppresses subsequent
 * callbacks and settles the driver immediately, requesting generator cleanup.
 * Async generators queue return behind pending next calls: producers must pass
 * the context signal to I/O to release their resources promptly.
 * Validation and producer failures are reported through the sink's error callback.
 */
export async function driveStream(
  handler: AnyStreamHandler,
  ctx: AnyCtx,
  sink: StreamDriverSink
): Promise<void> {
  const gen = handler.run(ctx);
  let count = 0;
  try {
    ctx.signal?.throwIfAborted();
    let result = await waitForStreamWork(gen.next(), ctx.signal);
    while (!result.done) {
      ctx.signal?.throwIfAborted();
      const item = handler.itemSchema.parse(result.value);
      count++;
      await waitForStreamWork(sink.onItem(item), ctx.signal);
      ctx.signal?.throwIfAborted();
      result = await waitForStreamWork(gen.next(), ctx.signal);
    }
    ctx.signal?.throwIfAborted();
    if (result.value !== undefined && handler.summarySchema) {
      const summary = handler.summarySchema.parse(result.value);
      await waitForStreamWork(sink.onSummary(summary), ctx.signal);
    }
    ctx.signal?.throwIfAborted();
    await waitForStreamWork(sink.onEnd(count), ctx.signal);
  } catch (error) {
    try {
      const cleanup = gen.return?.(undefined);
      if (ctx.signal?.aborted) void cleanup?.catch(() => {});
      else await waitForStreamWork(cleanup, ctx.signal);
    } catch {
      // generator cleanup failure is not reportable past this point
    }
    if (!ctx.signal?.aborted) await sink.onError(toErrorFrame(error));
  }
}

/**
 * Run the stream to completion and assemble the derived buffered shape
 * `{ items, summary? }` (spec/streaming.md section 2.1). Throws on any failure so
 * buffered representations surface real HTTP status codes. Cancellation returns
 * the items already received without a terminal frame.
 */
export async function driveStreamBuffered(
  handler: AnyStreamHandler,
  ctx: AnyCtx
): Promise<BufferedStreamResult> {
  const items: unknown[] = [];
  let summary: unknown;
  let failure: StreamErrorFrame | undefined;

  await driveStream(handler, ctx, {
    onItem: (item) => { items.push(item); },
    onSummary: (s) => { summary = s; },
    onError: (frame) => { failure = frame; },
    onEnd: () => {}
  });

  if (failure) {
    const err = new Error(failure.message);
    err.name = failure.error;
    throw err;
  }

  return summary !== undefined ? { items, summary } : { items };
}

/**
 * NDJSON representation (spec/streaming.md section 2.2): one frame per line,
 * flushed per frame, in-band terminal frame.
 */
export function ndjsonStreamResponse(
  handler: AnyStreamHandler,
  ctx: AnyCtx
): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const signal = ctx.signal ? AbortSignal.any([ctx.signal, abort.signal]) : abort.signal;
  let resume: (() => void) | undefined;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = async (frame: Record<string, unknown>) => {
        while (!signal.aborted && (controller.desiredSize ?? 0) <= 0) {
          await new Promise<void>(resolve => { resume = resolve; });
        }
        signal.throwIfAborted();
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      };
      const onAbort = () => { resume?.(); controller.error(signal.reason); };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      void driveStream(handler, { ...ctx, signal }, {
        onItem: (item) => push({ kind: "item", data: item }),
        onSummary: (summary) => push({ kind: "summary", data: summary }),
        onError: (frame) => push(frame as unknown as Record<string, unknown>),
        onEnd: (count) => push({ kind: "end", count })
      }).then(() => { if (!signal.aborted) controller.close(); }, error => {
        if (!signal.aborted) controller.error(error);
      });
    },
    pull() { resume?.(); resume = undefined; },
    cancel() { abort.abort(); resume?.(); }
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
      // disable proxy buffering so frames actually flush incrementally
      "x-accel-buffering": "no"
    }
  });
}
