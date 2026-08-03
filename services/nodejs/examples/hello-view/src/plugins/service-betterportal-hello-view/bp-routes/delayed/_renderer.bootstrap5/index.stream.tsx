/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable, StreamErrorFrame, StreamShellContext } from "@betterportal/framework";
import type { DelayedItem, DelayedSummary } from "../route.impl.js";

/**
 * Streaming renderers (spec/streaming.md section 4). The shell returns instantly with
 * SSE wiring; each frame is rendered server-side and swapped in as it arrives.
 */

export function renderShell(ctx: StreamShellContext): HtmlRenderable {
  return (
    <section class="container-fluid">
      <h1 class="h4">Delayed stream</h1>
      <p class="text-body-secondary">
        Rows below stream in as the (deliberately slow) data source yields them.
      </p>
      <div hx-ext="sse" hx-sse:connect={ctx.sseConnectPath} hx-sse:close="end">
        <ul class="list-group" sse-swap="item" hx-swap="beforeend">
          <li class="list-group-item text-body-secondary" sse-swap="end" hx-swap="delete">
            <span class="spinner-border spinner-border-sm me-2"></span>
            Waiting for data...
          </li>
        </ul>
        <div sse-swap="summary" hx-swap="innerHTML"></div>
        <div sse-swap="error" hx-swap="innerHTML"></div>
      </div>
    </section>
  );
}

export function renderItem(item: DelayedItem): HtmlRenderable {
  return (
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <span>{item.label}</span>
      <span class="badge text-bg-secondary">{item.elapsedMs}ms</span>
    </li>
  );
}

export function renderSummary(summary: DelayedSummary): HtmlRenderable {
  return (
    <p class="text-body-secondary small mt-2 mb-0">
      {summary.total} items in {summary.totalMs}ms total.
    </p>
  );
}

export function renderError(error: StreamErrorFrame): HtmlRenderable {
  return (
    <div class="alert alert-danger mt-2 mb-0" role="alert">
      Stream failed: {error.message}
    </div>
  );
}
