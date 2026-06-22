import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createStreamHandler,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

// -- Schemas (spec/streaming.md - item is the canonical contract) ----

export const QuerySchema = av.object({
  count: av.string().default("5"),
  delayMs: av.string().default("400")
}, { unknownKeys: "strip" });

export const ItemSchema = av.object({
  id: av.string().minLength(1),
  label: av.string().minLength(1),
  elapsedMs: av.int().min(0)
}, { unknownKeys: "strip" });
export type DelayedItem = Infer<typeof ItemSchema>;

export const SummarySchema = av.object({
  total: av.int().min(0),
  totalMs: av.int().min(0)
}, { unknownKeys: "strip" });
export type DelayedSummary = Infer<typeof SummarySchema>;

// -- Metadata --------------------------------------------------------

export const title = "Delayed Stream";
export const description = "Example streaming view: items arrive one by one as a slow data source produces them. JSON buffers, NDJSON streams frames, HTML streams rendered rows over SSE.";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: ["accept", "origin"]
};

// -- Handler - async generator; the framework drives representation --

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handleGet = createStreamHandler(
  { item: ItemSchema, summary: SummarySchema, query: QuerySchema },
  async function* (ctx) {
    const count = clampInt(ctx.query.count, 1, 25, 5);
    const delayMs = clampInt(ctx.query.delayMs, 0, 2000, 400);
    const startedAt = Date.now();

    for (let i = 1; i <= count; i++) {
      await sleep(delayMs);
      yield {
        id: `item-${i}`,
        label: `Slow record #${i} of ${count}`,
        elapsedMs: Date.now() - startedAt
      };
    }

    return { total: count, totalMs: Date.now() - startedAt };
  }
);
