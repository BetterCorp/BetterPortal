/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";
import { docsNav } from "../rendering/nav.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0" data-bp-service="docs-site">
      <div class="row g-4">
        <div class="col-lg-3">
          {docsNav(data.docs)}
        </div>
        <div class="col-lg-9">
          <div class="mb-4">
            <h1 class="h2 mb-2">{data.title}</h1>
            <p class="text-body-secondary mb-0">{data.description}</p>
          </div>

          {data.docs.length === 0 ? (
            <div class="alert alert-secondary">No Markdown docs were found.</div>
          ) : (
            <div class="row row-cols-1 row-cols-md-2 g-3">
              {data.docs.map((doc) => (
                <div class="col">
                  <a
                    class="card h-100 border-0 shadow-sm text-decoration-none text-body"
                    href={doc.href}
                    hx-get={doc.href}
                    hx-target="#bp-main"
                    hx-swap="innerHTML"
                    hx-push-url={doc.href}
                    data-bp-service="docs-site"
                  >
                    <div class="card-body">
                      <div class="small text-body-secondary mb-2">{doc.sourcePath}</div>
                      <h2 class="h5 mb-2">{doc.title}</h2>
                      <p class="text-body-secondary mb-0">{doc.excerpt}</p>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
