/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function sectionList(items: ResponseData["sections"]): HtmlRenderable {
  return (
    <div class="d-flex flex-column gap-3">
      {items.map((item) => (
        <section class="border-bottom pb-3">
          <h2 class="h4 mb-2">{item.title}</h2>
          <p class="text-body-secondary mb-0">{item.text}</p>
        </section>
      ))}
    </div>
  );
}

function principleGrid(items: ResponseData["principles"]): HtmlRenderable {
  return (
    <div class="row row-cols-1 row-cols-md-2 g-3">
      {items.map((item) => (
        <div class="col">
          <article class="h-100 p-4 rounded-3 border bg-body">
            <h3 class="h5 mb-2">{item.title}</h3>
            <p class="text-body-secondary mb-0">{item.text}</p>
          </article>
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
          .bp-about-hero {
            border-bottom: 1px solid var(--bs-border-color);
            background:
              linear-gradient(120deg, rgba(var(--bs-info-rgb), .10), transparent 34%),
              linear-gradient(180deg, rgba(var(--bs-body-bg-rgb), .98), var(--bs-body-bg));
          }
          .bp-about-map {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: .75rem;
          }
          .bp-about-map__item {
            min-height: 7rem;
            border: 1px solid var(--bs-border-color);
            border-radius: .75rem;
            padding: 1rem;
            background: var(--bs-tertiary-bg);
          }
          @media (max-width: 575.98px) {
            .bp-about-map { grid-template-columns: 1fr; }
          }
        `}
      </style>

      <section class="bp-about-hero">
        <div class="container py-5">
          <div class="row g-5 align-items-center">
            <div class="col-lg-7">
              <a class="btn btn-sm btn-outline-secondary mb-4" href={data.landingHref}>Back to landing</a>
              <h1 class="display-5 fw-semibold mb-3">{data.title}</h1>
              <p class="lead text-body-secondary mb-0">{data.intro}</p>
            </div>
            <div class="col-lg-5">
              <div class="bp-about-map">
                <div class="bp-about-map__item"><div class="small text-body-secondary">01</div><strong>Control plane</strong></div>
                <div class="bp-about-map__item"><div class="small text-body-secondary">02</div><strong>Runtime services</strong></div>
                <div class="bp-about-map__item"><div class="small text-body-secondary">03</div><strong>Themes</strong></div>
                <div class="bp-about-map__item"><div class="small text-body-secondary">04</div><strong>Auth</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="container py-5">
          <div class="row g-5">
            <div class="col-lg-5">
              <div class="sticky-lg-top" style="top: 2rem;">
                <div class="small text-uppercase text-body-secondary fw-semibold mb-2">Architecture</div>
                <h2 class="h1 mb-3">One platform contract, many deployable services.</h2>
                <p class="text-body-secondary">
                  BetterPortal keeps routing, configuration, auth, and rendering explicit. That makes the portal easier to operate, inspect, and extend.
                </p>
              </div>
            </div>
            <div class="col-lg-7">
              {sectionList(data.sections)}
            </div>
          </div>
        </div>
      </section>

      <section class="border-top">
        <div class="container py-5">
          <div class="row g-4 align-items-start">
            <div class="col-lg-4">
              <div class="small text-uppercase text-body-secondary fw-semibold mb-2">Principles</div>
              <h2 class="h1 mb-0">Designed for typed, observable composition.</h2>
            </div>
            <div class="col-lg-8">
              {principleGrid(data.principles)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
