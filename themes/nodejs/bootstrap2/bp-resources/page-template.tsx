/** @jsxImportSource jsx-htmx */
import type { RegisteredViewRenderer, ViewRenderContext } from "@betterportal/framework";

export const render: RegisteredViewRenderer["render"] = (data, ctx: ViewRenderContext) => (
  <section class="container-fluid px-0">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h1 class="h5 mb-1" data-bp-page-title>Work queue</h1>
        <p class="small text-body-secondary mb-0">Current operational items requiring attention.</p>
      </div>
      <a class="btn btn-sm btn-primary" href={ctx.url.uiRoute("example.create") ?? "#"}>Create</a>
    </div>

    <div class="bp-split-pane" data-bp-detail-open="true">
      <div class="bp-split-pane__content table-responsive border">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead><tr><th scope="col">ID</th><th scope="col">Summary</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            <tr>
              <td class="font-monospace">INC-4821</td>
              <td>Access controller offline</td>
              <td><span class="badge text-bg-danger">High</span></td>
              <td class="text-end"><button class="btn btn-sm btn-outline-secondary" type="button" data-bp-detail-toggle>View</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <aside class="bp-split-pane__detail" aria-label="Selected record">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
          <h2 class="h6 mb-0">INC-4821 · Access controller offline</h2>
          <button class="btn-close" type="button" data-bp-detail-close aria-label="Close details"></button>
        </div>
        <pre class="small mb-0">{JSON.stringify(data, null, 2)}</pre>
      </aside>
    </div>
  </section>
);
