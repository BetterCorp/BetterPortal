/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { ResponseData } from "../index.js";

export function render(data: ResponseData): HtmlRenderable {
  const editorBase = "/.well-known/bp/admin/fragments-editor";
  const initialUrl = data.selectedAppId ? `${editorBase}?appId=${encodeURIComponent(data.selectedAppId)}` : "";

  return (
    <div class="container-fluid px-0">
      <div class="mb-4">
        <h2 class="mb-1">{data.title}</h2>
        <p class="text-secondary mb-0">Add service-rendered widgets to the topbar and other shell regions.</p>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold">App</label>
        <select class="form-select" name="appId"
          hx-get={editorBase}
          hx-target="#bp-fragments-editor"
          hx-swap="outerHTML"
          hx-trigger="change"
          hx-include="this">
          <option value="">Choose an app...</option>
          {data.apps.map((app) => (
            <option value={app.id} selected={app.id === data.selectedAppId}>
              {app.title} ({app.tenantId})
            </option>
          ))}
        </select>
      </div>

      <div id="bp-fragments-editor"
        {...(data.selectedAppId
          ? { "hx-get": initialUrl, "hx-trigger": "load", "hx-swap": "outerHTML" }
          : {})}>
        {data.selectedAppId
          ? <div class="text-secondary">Loading editor...</div>
          : <div class="alert alert-secondary">Select an app to manage its fragments</div>}
      </div>
    </div>
  );
}
