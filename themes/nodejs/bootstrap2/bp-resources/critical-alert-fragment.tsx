/** @jsxImportSource jsx-htmx */
import type { RegisteredViewRenderer } from "@betterportal/framework";

// File location in a service:
// bp-routes/alerts/_renderer.bootstrap5/_critical-alerts.active.GET.tsx
export const render: RegisteredViewRenderer["render"] = (_data, ctx) => (
  <div
    id="critical-alert-stream"
    hx-ext="sse"
    sse-connect={ctx.url.route("alerts.stream")}
    sse-swap="message"
  ></div>
);

// Its sibling _critical-alerts.active.sse.tsx may render:
// <div class="alert alert-danger" role="alert"><strong>Critical:</strong> Perimeter breach</div>
// or <div id="critical-alert-stream"></div> when no alert is active.
