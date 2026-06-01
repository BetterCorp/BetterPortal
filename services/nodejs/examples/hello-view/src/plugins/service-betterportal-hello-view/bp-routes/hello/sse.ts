import * as av from "anyvali";
import type { Infer } from "anyvali";
import type { SSEHandlerContext } from "@betterportal/framework-nodejs";

// ── Tick schema (validated per yielded value) ────────────────────────

export const tickSchema = av.object({
  time: av.string().minLength(1),
  iso: av.string().minLength(1)
}, { unknownKeys: "strip" });

export type Tick = Infer<typeof tickSchema>;

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Handler — async generator. Framework drives the SSE stream ──────

export async function* handleSSE(_ctx: SSEHandlerContext): AsyncGenerator<Tick> {
  while (true) {
    const now = new Date();
    yield { time: formatTime(now), iso: now.toISOString() };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
