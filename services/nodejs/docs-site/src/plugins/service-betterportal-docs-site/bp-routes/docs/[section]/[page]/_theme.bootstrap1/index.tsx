/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";
import { renderMarkdown } from "../../../rendering/markdown.js";

function sectionLabel(section: string): string {
  return section
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function pageStyles(): HtmlRenderable {
  return (
    <style>{`
      .bp-doc-page {
        --bp-doc-page-blue: rgba(59,130,246,.14);
        --bp-doc-page-green: rgba(34,197,94,.12);
        --bp-doc-page-amber: rgba(245,158,11,.14);
      }
      .bp-doc-page-hero {
        border: 1px solid var(--bs-border-color);
        background: linear-gradient(135deg, var(--bp-doc-page-blue), var(--bp-doc-page-green) 55%, var(--bp-doc-page-amber));
        overflow: hidden;
      }
      .bp-doc-page-art {
        width: 100%;
        height: 160px;
        object-fit: cover;
        border: 1px solid rgba(255,255,255,.55);
      }
      .bp-doc-page-source {
        width: fit-content;
        border: 1px solid var(--bs-border-color);
        background: rgba(255,255,255,.48);
      }
      [data-bs-theme="dark"] .bp-doc-page-source { background: rgba(15,23,42,.32); }
      .bp-doc-article {
        max-width: 920px;
      }
      .bp-doc-article h1 {
        margin-bottom: 1rem;
        font-weight: 650;
      }
      .bp-doc-article h2 {
        padding-top: 1rem;
        border-top: 1px solid var(--bs-border-color);
        font-weight: 650;
      }
      .bp-doc-article p {
        max-width: 78ch;
      }
      .bp-doc-article ul {
        padding-left: 1.25rem;
      }
      .bp-doc-article li {
        margin-bottom: .4rem;
      }
      .bp-doc-article code {
        border: 1px solid var(--bs-border-color);
        border-radius: .25rem;
        padding: .08rem .28rem;
        background: var(--bs-tertiary-bg);
      }
      .bp-doc-article pre code {
        border: 0;
        padding: 0;
        background: transparent;
      }
      .bp-doc-article table {
        background: var(--bs-body-bg);
      }
      .bp-doc-related {
        border: 1px solid var(--bs-border-color);
        background: linear-gradient(180deg, var(--bs-body-bg), var(--bs-tertiary-bg));
      }
      .bp-doc-related a {
        transition: transform .12s ease, border-color .12s ease;
      }
      .bp-doc-related a:hover {
        transform: translateY(-2px);
        border-color: rgba(59,130,246,.45) !important;
      }
    `}</style>
  );
}

function relatedDocs(data: ResponseData): HtmlRenderable {
  const related = data.docs
    .filter((doc) => doc.section === data.section && doc.page !== data.page)
    .slice(0, 3);

  if (related.length === 0) return "";

  return (
    <div class="bp-doc-related rounded-2 p-4 mt-5">
      <div class="small text-body-secondary text-uppercase fw-semibold mb-3">Related in {sectionLabel(data.section)}</div>
      <div class="row row-cols-1 row-cols-md-3 g-3">
        {related.map((doc) => (
          <div class="col">
            <a
              class="d-block h-100 text-decoration-none text-body border rounded-2 bg-body p-3"
              href={doc.href}
              hx-get={doc.href}
              hx-target="#bp-main"
              hx-swap="innerHTML"
              hx-push-url={doc.href}
              data-bp-service="docs-site"
            >
              <div class="fw-semibold mb-2">{doc.title}</div>
              <div class="small text-body-secondary">{doc.excerpt}</div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function markdownWithoutTitle(markdown: string): string {
  return markdown.replace(/^# .*(\r?\n)+/, "");
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="bp-doc-page container-fluid px-0" data-bp-service="docs-site">
      {pageStyles()}
      {data.notFound ? (
        <div class="alert alert-warning">
          <h1 class="h5 alert-heading mb-2">Doc not found</h1>
          <p class="mb-0">No Markdown file exists at <code>{data.sourcePath}</code>.</p>
        </div>
      ) : (
        <>
          <div class="bp-doc-page-hero rounded-2 p-4 p-lg-5 mb-4">
            <div class="row align-items-center g-4">
              <div class="col-lg-8">
                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <span class="badge text-bg-primary">{sectionLabel(data.section)}</span>
                  <span class="bp-doc-page-source small text-body-secondary rounded-pill px-3 py-1 font-monospace">{data.sourcePath}</span>
                </div>
                <div class="small text-body-secondary text-uppercase fw-semibold">BetterPortal guide</div>
              </div>
              <div class="col-lg-4">
                <img
                  class="bp-doc-page-art rounded-2"
                  src="/docs-assets/doc-wave.svg"
                  alt="BetterPortal documentation visual accent"
                />
              </div>
            </div>
          </div>
          <article class="bp-doc-article lh-lg">
            {renderMarkdown(markdownWithoutTitle(data.markdown))}
          </article>
          {relatedDocs(data)}
        </>
      )}
    </section>
  );
}
