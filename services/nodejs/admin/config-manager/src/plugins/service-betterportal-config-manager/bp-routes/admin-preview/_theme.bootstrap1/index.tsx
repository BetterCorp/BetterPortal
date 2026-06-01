/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { ResponseData } from "../index.js";

function previewScript(): HtmlRenderable {
  return js(`{
    document.querySelectorAll("[data-bp-preview-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.bpPreviewUrl;
        const mode = btn.dataset.bpPreviewMode || "page";
        const previewFrame = document.getElementById("bp-preview-frame");
        if (!previewFrame || !url) return;

        previewFrame.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';

        fetch(url, {
          headers: { Accept: "text/html; mode=" + mode }
        })
        .then((r) => r.text())
        .then((html) => { previewFrame.innerHTML = html; })
        .catch(() => { previewFrame.innerHTML = '<div class="alert alert-danger">Failed to load preview</div>'; });
      });
    });
  }`);
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="container-fluid px-0">
      <h2 class="mb-4">{data.title}</h2>

      {data.services.length === 0 ? (
        <div class="alert alert-secondary">No services with views discovered</div>
      ) : (
        <div class="row">
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h5 class="mb-3">Views</h5>
                {data.services.map((service) => (
                  <div class="mb-3">
                    <div class="fw-semibold text-secondary small text-uppercase mb-1">{service.serviceId}</div>
                    {service.views.map((view) => (
                      <div class="mb-2">
                        <div class="fw-semibold">{view.title || view.viewId}</div>
                        <div class="small text-secondary mb-1">{view.path}</div>
                        <div class="d-flex flex-wrap gap-1 mb-1">
                          <button
                            class="btn btn-sm btn-outline-primary"
                            data-bp-preview-btn=""
                            data-bp-preview-url={`${service.endpointBaseUrl}${view.path}`}
                            data-bp-preview-mode="page"
                          >Page</button>
                          {view.components.map((comp) => (
                            <button
                              class="btn btn-sm btn-outline-secondary"
                              data-bp-preview-btn=""
                              data-bp-preview-url={`${service.endpointBaseUrl}${view.path}?_c=${comp}`}
                              data-bp-preview-mode="fragment"
                            >{comp}</button>
                          ))}
                          {view.hasFragments ? (
                            <span class="badge text-bg-info">has fragments</span>
                          ) : ""}
                        </div>
                        {view.demoScenarios.length > 0 ? (
                          <div class="small text-secondary">
                            Demos: {view.demoScenarios.map((d) => d.title).join(", ")}
                          </div>
                        ) : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div class="col-lg-8">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h5 class="mb-3">Preview</h5>
                <div id="bp-preview-frame" class="border rounded p-3 bg-body-tertiary" style="min-height:300px">
                  <div class="text-secondary text-center py-5">Select a view or component to preview</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <script>{previewScript()}</script>
    </div>
  );
}
