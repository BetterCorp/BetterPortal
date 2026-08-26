/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../GET.js";

export function render(_data: ResponseData): HtmlRenderable {
  const iso = new Date().toISOString();
  return (
    <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-body-tertiary border">
      <span class="badge bg-success rounded-circle p-1" style="width:0.55rem;height:0.55rem;"></span>
      <span class="font-monospace small" title={iso}>{iso.slice(11, 19)}</span>
    </div>
  );
}
