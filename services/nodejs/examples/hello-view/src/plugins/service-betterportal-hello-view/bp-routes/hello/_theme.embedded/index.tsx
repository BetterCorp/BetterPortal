/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="h5 mb-2">{data.greeting}</div>
        <div class="text-body-secondary">Rendered for lightweight embedded usage.</div>
      </div>
    </div>
  );
}
