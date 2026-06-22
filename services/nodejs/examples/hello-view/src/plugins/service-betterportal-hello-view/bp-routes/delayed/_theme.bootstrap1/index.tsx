/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { DelayedItem, DelayedSummary } from "../index.js";
import { renderItem, renderSummary } from "./index.stream.js";

/**
 * Buffered full-page render (spec/streaming.md § 4.2): the framework runs the
 * stream to completion and hands the derived { items, summary } shape here.
 * Reuses the per-frame renderers so streamed and buffered output match.
 */
export function render(data: { items: DelayedItem[]; summary?: DelayedSummary }): HtmlRenderable {
  return (
    <section class="container-fluid">
      <h1 class="h4">Delayed stream</h1>
      <p class="text-body-secondary">
        Buffered render — the server waited for the full stream before responding.
      </p>
      <ul class="list-group">{data.items.map((item) => renderItem(item))}</ul>
      {data.summary ? renderSummary(data.summary) : null}
    </section>
  );
}
