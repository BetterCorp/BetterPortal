/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";
import { docsNav } from "../../../rendering/nav.js";
import { renderMarkdown } from "../../../rendering/markdown.js";

export function render(data: ResponseData): HtmlRenderable {
  const activeId = `${data.section}/${data.page}`;

  return (
    <section class="container-fluid px-0" data-bp-service="docs-site">
      <div class="row g-4">
        <div class="col-lg-3">
          {docsNav(data.docs, activeId)}
        </div>
        <div class="col-lg-9">
          {data.notFound ? (
            <div class="alert alert-warning">
              <h1 class="h5 alert-heading mb-2">Doc not found</h1>
              <p class="mb-0">No Markdown file exists at <code>{data.sourcePath}</code>.</p>
            </div>
          ) : (
            <>
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                  <div class="small text-body-secondary mb-1">{data.sourcePath}</div>
                  <h1 class="h2 mb-0">{data.title}</h1>
                </div>
                <a
                  class="btn btn-sm btn-outline-secondary"
                  href="/docs"
                  hx-get="/docs"
                  hx-target="#bp-main"
                  hx-swap="innerHTML"
                  hx-push-url="/docs"
                  data-bp-service="docs-site"
                >All docs</a>
              </div>
              <article class="bp-docs-article lh-lg">
                {renderMarkdown(data.markdown)}
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
