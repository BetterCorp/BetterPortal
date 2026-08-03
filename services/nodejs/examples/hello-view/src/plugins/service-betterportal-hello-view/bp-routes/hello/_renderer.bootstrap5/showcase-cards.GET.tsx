/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

/*
   Showcase: Cards & Containers
    */

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">Cards &amp; Containers</h2>
          <p class="text-body-secondary">Standard Bootstrap card variants styled with glass neumorphic defaults.</p>
        </div>

        {/* Basic cards */}
        <div class="row row-cols-1 row-cols-md-3 g-3">
          <div class="col">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title">Basic Card</h5>
                <p class="card-text text-body-secondary">Default card with no extra classes. Gets glass treatment automatically.</p>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card h-100">
              <div class="card-header">With Header</div>
              <div class="card-body">
                <p class="card-text text-body-secondary">Card header and footer get transparent background with subtle separators.</p>
              </div>
              <div class="card-footer text-body-secondary">Footer content</div>
            </div>
          </div>
          <div class="col">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title">Action Card</h5>
                <p class="card-text text-body-secondary">Card with primary action button at the bottom.</p>
                <a href="javascript:;" class="btn btn-primary btn-sm">Take Action</a>
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <h3 class="h5 mb-0">Stat Cards</h3>
        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
          {[
            { label: "Total Users", value: "12,482", change: "+14.2%", positive: true },
            { label: "Revenue", value: "$48,290", change: "+8.1%", positive: true },
            { label: "Bounce Rate", value: "23.4%", change: "+3.1%", positive: false },
            { label: "Avg. Response", value: "124ms", change: "-12%", positive: true }
          ].map((stat) => (
            <div class="col">
              <div class="card h-100">
                <div class="card-body">
                  <div class="small text-body-secondary mb-1">{stat.label}</div>
                  <div class="h4 mb-1">{stat.value}</div>
                  <div class={`small ${stat.positive ? "text-success" : "text-danger"}`}>
                    {stat.positive ? "^" : "v"} {stat.change}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Nested cards / card inside card */}
        <h3 class="h5 mb-0">Nested Content</h3>
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Parent Container</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">Nested Card A</h6>
                    <p class="card-text text-body-secondary mb-0">Cards inside cards maintain glass depth.</p>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">Nested Card B</h6>
                    <p class="card-text text-body-secondary mb-0">Consistent styling regardless of nesting level.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal card */}
        <h3 class="h5 mb-0">Horizontal Layout</h3>
        <div class="card">
          <div class="row g-0">
            <div class="col-md-3 d-flex align-items-center justify-content-center p-4">
              <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:4rem;height:4rem;font-size:1.5rem;">BP</div>
            </div>
            <div class="col-md-9">
              <div class="card-body">
                <h5 class="card-title">Horizontal Card</h5>
                <p class="card-text text-body-secondary">Useful for profile cards, feature highlights, or list items that need more visual weight.</p>
                <p class="card-text"><small class="text-body-secondary">Last updated 3 mins ago</small></p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
