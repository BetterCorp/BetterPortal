/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";
import type { ResponseData } from "../GET.js";

export function render(_data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  return (
    <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-body-tertiary border">
      <span class="badge bg-success rounded-circle p-1" style="width:0.55rem;height:0.55rem;"></span>
      <span
        class="font-monospace small"
        hx-ext="sse"
        hx-sse:connect={ctx.url.route("hello.index", { sse: true, fragment: "nav.clock" }) ?? ""}
      >--:--:--</span>
    </div>
  );
}
