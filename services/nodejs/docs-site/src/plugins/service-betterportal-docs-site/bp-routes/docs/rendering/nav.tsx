/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData as IndexData } from "../index.js";

type DocSummary = IndexData["docs"][number];

function sectionLabel(section: string): string {
  return section
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function docsNav(docs: DocSummary[], activeId?: string): HtmlRenderable {
  const sections = [...new Set(docs.map((doc) => doc.section))];

  return (
    <aside class="border rounded-2 bg-body-tertiary p-3">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div class="fw-semibold">Docs</div>
        <a
          class="btn btn-sm btn-outline-secondary"
          href="/docs"
          hx-get="/docs"
          hx-target="#bp-main"
          hx-swap="innerHTML"
          hx-push-url="/docs"
          data-bp-service="docs-site"
        >Index</a>
      </div>
      <div class="d-flex flex-column gap-3">
        {sections.map((section) => (
          <div>
            <div class="small text-body-secondary text-uppercase fw-semibold mb-2">{sectionLabel(section)}</div>
            <div class="list-group list-group-flush">
              {docs.filter((doc) => doc.section === section).map((doc) => (
                <a
                  class={`list-group-item list-group-item-action px-0 py-2 bg-transparent border-0 ${doc.id === activeId ? "fw-semibold text-primary" : ""}`}
                  href={doc.href}
                  hx-get={doc.href}
                  hx-target="#bp-main"
                  hx-swap="innerHTML"
                  hx-push-url={doc.href}
                  data-bp-service="docs-site"
                >
                  {doc.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
