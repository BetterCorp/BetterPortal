import type { RouteHandlerContext } from "../contracts/route.js";
import type { BpStreamHandler, StreamErrorFrame } from "../contracts/streaming.js";

/**
 * Stream driving helpers (spec/streaming.md).
 *
 * The producer-side validation gate lives here: every yielded item is parsed
 * against the handler's itemSchema (and the generator return value against
 * summarySchema) BEFORE leaving the process, in every representation.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStreamHandler = BpStreamHandler<any, any, any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = RouteHandlerContext<any, any, any, any>;

export interface BufferedStreamResult {
  items: unknown[];
  summary?: unknown;
}

/** Events surfaced to a frame consumer while driving the generator. */
export interface StreamDriverSink {
  onItem(item: unknown): Promise<void> | void;
  onSummary(summary: unknown): Promise<void> | void;
  /** Terminal - exactly one of onError / onEnd fires, then nothing. */
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

/**
 * Drive the generator, validating each frame payload, and report frames to
 * the sink in legal order: items -> summary? -> exactly one terminal.
 */
export async function driveStream(
  handler: AnyStreamHandler,
  ctx: AnyCtx,
  sink: StreamDriverSink
): Promise<void> {
  const gen = handler.run(ctx);
  let count = 0;
  try {
    let result = await gen.next();
    while (!result.done) {
      const item = handler.itemSchema.parse(result.value);
      count++;
      await sink.onItem(item);
      result = await gen.next();
    }
    if (result.value !== undefined && handler.summarySchema) {
      const summary = handler.summarySchema.parse(result.value);
      await sink.onSummary(summary);
    }
    await sink.onEnd(count);
  } catch (error) {
    try {
      await gen.return?.(undefined);
    } catch {
      // generator cleanup failure is not reportable past this point
    }
    await sink.onError(toErrorFrame(error));
  }
}

/**
 * Run the stream to completion and assemble the derived buffered shape
 * `{ items, summary? }` (spec/streaming.md section 2.1). Throws on any failure so
 * buffered representations surface real HTTP status codes.
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

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (frame: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      };
      await driveStream(handler, ctx, {
        onItem: (item) => push({ kind: "item", data: item }),
        onSummary: (summary) => push({ kind: "summary", data: summary }),
        onError: (frame) => push(frame as unknown as Record<string, unknown>),
        onEnd: (count) => push({ kind: "end", count })
      });
      controller.close();
    }
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
