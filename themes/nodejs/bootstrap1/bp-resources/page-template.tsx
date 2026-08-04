/** @jsxImportSource jsx-htmx */
import type { RegisteredViewRenderer } from "@betterportal/framework";

export const render: RegisteredViewRenderer["render"] = (data, ctx) => (
  <section class="container-fluid py-3">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h1 class="h3 mb-1">Page title</h1>
        <p class="text-body-secondary mb-0">Explain the task in one sentence.</p>
      </div>
      <a class="btn btn-primary" href={ctx.url.uiRoute("example.create") ?? "#"}>Create</a>
    </div>
    <div class="card shadow-sm">
      <div class="card-body">{JSON.stringify(data)}</div>
    </div>
  </section>
);
