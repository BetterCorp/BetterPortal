/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { HelloResponse } from "../../routes/hello";

export function renderBootstrap1HelloView(response: HelloResponse): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-3">
        <span class="badge rounded-pill text-bg-primary w-auto">{response.themeHint}</span>
        <div>
          <h1 class="h3 mb-2">{response.greeting}</h1>
          <p class="text-body-secondary mb-0">
            This HTML representation is rendered from the same validated API output.
          </p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          {response.supports.map((item) => (
            <span class="badge text-bg-light border text-dark">{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function renderEmbeddedHelloView(response: HelloResponse): HtmlRenderable {
  return (
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="small text-body-secondary mb-2">{response.themeHint}</div>
        <div class="h5 mb-2">{response.greeting}</div>
        <div class="text-body-secondary">Rendered for lightweight embedded usage.</div>
      </div>
    </div>
  );
}
