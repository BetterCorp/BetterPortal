/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function featureGrid(items: ResponseData["capabilities"]): HtmlRenderable {
  return (
    <div class="row row-cols-1 row-cols-md-2 g-3">
      {items.map((item) => (
        <div class="col">
          <article class="border rounded-3 h-100 p-4 bg-body">
            <h3 class="h5 mb-2">{item.title}</h3>
            <p class="text-body-secondary mb-0">{item.text}</p>
          </article>
        </div>
      ))}
    </div>
  );
}

function platformStrip(items: ResponseData["highlights"]): HtmlRenderable {
  return (
    <div class="row row-cols-1 row-cols-lg-3 g-3">
      {items.map((item) => (
        <div class="col">
          <div class="h-100 border-top border-3 border-primary pt-3">
            <h2 class="h5">{item.title}</h2>
            <p class="text-body-secondary mb-0">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <main class="container-fluid px-0">
      <style>
        {`
          .bp-landing-hero {
            min-height: min(680px, calc(100vh - 10rem));
            display: grid;
            align-items: center;
            border-bottom: 1px solid var(--bs-border-color);
            background:
              linear-gradient(120deg, rgba(var(--bs-primary-rgb), .10), transparent 38%),
              linear-gradient(180deg, rgba(var(--bs-body-bg-rgb), .98), var(--bs-body-bg));
          }
          .bp-landing-wordmark {
            display: inline-flex;
            align-items: center;
            gap: .75rem;
            color: var(--bs-primary);
            font-weight: 700;
          }
          .bp-landing-mark {
            width: 2.75rem;
            height: 2.75rem;
            display: inline-grid;
            place-items: center;
            border: 1px solid rgba(var(--bs-primary-rgb), .35);
            border-radius: .75rem;
            background: rgba(var(--bs-primary-rgb), .08);
          }
          .bp-landing-diagram {
            border: 1px solid var(--bs-border-color);
            border-radius: 1rem;
            background: var(--bs-body-bg);
            box-shadow: 0 1rem 3rem rgba(0,0,0,.08);
            overflow: hidden;
          }
          .bp-landing-diagram__bar {
            height: .7rem;
            background: linear-gradient(90deg, var(--bs-primary), var(--bs-info), var(--bs-success));
          }
          .bp-landing-node {
            border: 1px solid var(--bs-border-color);
            border-radius: .75rem;
            padding: 1rem;
            background: var(--bs-tertiary-bg);
          }
          .bp-landing-band {
            border-bottom: 1px solid var(--bs-border-color);
          }
        `}
      </style>

      <section class="bp-landing-hero">
        <div class="container py-5">
          <div class="row align-items-center g-5">
            <div class="col-lg-6">
              <div class="bp-landing-wordmark mb-4">
                <span class="bp-landing-mark">BP</span>
                <span>BetterPortal</span>
              </div>
              <h1 class="display-4 fw-semibold mb-3">{data.headline}</h1>
              <p class="lead text-body-secondary mb-4">{data.subheading}</p>
              <p class="fs-5 text-body-secondary mb-4">{data.summary}</p>
              <div class="d-flex flex-wrap gap-2">
                <a class="btn btn-primary btn-lg" href={data.aboutHref}>About BetterPortal</a>
                <a class="btn btn-outline-secondary btn-lg" href="/hello">View service demo</a>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="bp-landing-diagram">
                <div class="bp-landing-diagram__bar" />
                <div class="p-4">
                  <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div class="small text-body-secondary">Platform runtime</div>
                      <div class="h5 mb-0">Service graph</div>
                    </div>
                    <span class="badge text-bg-success">Live config</span>
                  </div>
                  <div class="row g-3">
                    <div class="col-6"><div class="bp-landing-node"><div class="small text-body-secondary">Theme</div><strong>Bootstrap1</strong></div></div>
                    <div class="col-6"><div class="bp-landing-node"><div class="small text-body-secondary">Auth</div><strong>Provider</strong></div></div>
                    <div class="col-6"><div class="bp-landing-node"><div class="small text-body-secondary">Service</div><strong>Views</strong></div></div>
                    <div class="col-6"><div class="bp-landing-node"><div class="small text-body-secondary">Control</div><strong>Config</strong></div></div>
                  </div>
                  <div class="mt-4 p-3 rounded-3 bg-primary-subtle text-primary-emphasis">
                    Typed routes, scoped config, and AI-readable discovery stay aligned.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="bp-landing-band">
        <div class="container py-5">
          {platformStrip(data.highlights)}
        </div>
      </section>

      <section>
        <div class="container py-5">
          <div class="row g-4 mb-4">
            <div class="col-lg-4">
              <h2 class="h1 mb-3">Built from independent parts.</h2>
              <p class="text-body-secondary mb-0">
                BetterPortal gives each service a strong local contract while the app decides what is mounted, themed, and visible.
              </p>
            </div>
            <div class="col-lg-8">
              {featureGrid(data.capabilities)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
