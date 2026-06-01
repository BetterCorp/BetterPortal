/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { ResponseData } from "../index.js";

/* ════════════════════════════════════════════
   Showcase: Elements (buttons, badges, alerts, typography)
   ════════════════════════════════════════════ */

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">UI Elements</h2>
          <p class="text-body-secondary">Buttons, badges, alerts, typography, and other building blocks.</p>
        </div>

        {/* Buttons */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Buttons</h5>
            <div class="d-flex flex-column gap-3">
              <div>
                <h6 class="small text-body-secondary mb-2">Solid</h6>
                <div class="d-flex flex-wrap gap-2">
                  <button class="btn btn-primary">Primary</button>
                  <button class="btn btn-secondary">Secondary</button>
                  <button class="btn btn-success">Success</button>
                  <button class="btn btn-danger">Danger</button>
                  <button class="btn btn-warning">Warning</button>
                  <button class="btn btn-info">Info</button>
                  <button class="btn btn-light">Light</button>
                  <button class="btn btn-dark">Dark</button>
                </div>
              </div>
              <div>
                <h6 class="small text-body-secondary mb-2">Outline</h6>
                <div class="d-flex flex-wrap gap-2">
                  <button class="btn btn-outline-primary">Primary</button>
                  <button class="btn btn-outline-secondary">Secondary</button>
                  <button class="btn btn-outline-success">Success</button>
                  <button class="btn btn-outline-danger">Danger</button>
                </div>
              </div>
              <div>
                <h6 class="small text-body-secondary mb-2">Sizes</h6>
                <div class="d-flex flex-wrap gap-2 align-items-center">
                  <button class="btn btn-primary btn-sm">Small</button>
                  <button class="btn btn-primary">Default</button>
                  <button class="btn btn-primary btn-lg">Large</button>
                  <button class="btn btn-primary" disabled>Disabled</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Badges</h5>
            <div class="d-flex flex-column gap-3">
              <div>
                <h6 class="small text-body-secondary mb-2">Standard</h6>
                <div class="d-flex flex-wrap gap-2">
                  <span class="badge text-bg-primary">Primary</span>
                  <span class="badge text-bg-secondary">Secondary</span>
                  <span class="badge text-bg-success">Success</span>
                  <span class="badge text-bg-danger">Danger</span>
                  <span class="badge text-bg-warning text-dark">Warning</span>
                  <span class="badge text-bg-info">Info</span>
                  <span class="badge text-bg-light text-dark border">Light</span>
                  <span class="badge text-bg-dark">Dark</span>
                </div>
              </div>
              <div>
                <h6 class="small text-body-secondary mb-2">Pills</h6>
                <div class="d-flex flex-wrap gap-2">
                  <span class="badge rounded-pill text-bg-primary">Messages 4</span>
                  <span class="badge rounded-pill text-bg-success">Active</span>
                  <span class="badge rounded-pill text-bg-danger">Critical 2</span>
                  <span class="badge rounded-pill text-bg-warning text-dark">Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Alerts</h5>
            <div class="d-flex flex-column gap-2">
              <div class="alert alert-primary mb-0">
                <strong>Info:</strong> A new version is available. Consider upgrading your deployment.
              </div>
              <div class="alert alert-success mb-0">
                <strong>Success:</strong> Configuration saved. Changes will take effect immediately.
              </div>
              <div class="alert alert-warning mb-0">
                <strong>Warning:</strong> API quota is at 85%. Consider upgrading your plan.
              </div>
              <div class="alert alert-danger mb-0">
                <strong>Error:</strong> Failed to connect to upstream service. Retrying in 30s.
              </div>
              <div class="alert alert-info mb-0">
                <strong>Tip:</strong> You can configure keyboard shortcuts in Settings → Preferences.
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Typography</h5>
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
            <h4>Heading 4</h4>
            <h5>Heading 5</h5>
            <h6>Heading 6</h6>
            <hr />
            <p>Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p class="lead">Lead paragraph for introductions and emphasis. Stands out from regular body text.</p>
            <p class="text-body-secondary">Secondary text for descriptions, hints, and less prominent content.</p>
            <p><small>Small text for footnotes, timestamps, and metadata.</small></p>
            <p><strong>Bold text</strong> and <em>italic text</em> and <code>inline code</code> and <mark>highlighted text</mark>.</p>
          </div>
        </div>

        {/* Dropdowns */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Dropdowns</h5>
            <div class="d-flex flex-wrap gap-2">
              <div class="dropdown">
                <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">Actions</button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="javascript:;">Edit</a></li>
                  <li><a class="dropdown-item" href="javascript:;">Duplicate</a></li>
                  <li><a class="dropdown-item" href="javascript:;">Export</a></li>
                  <li><hr class="dropdown-divider" /></li>
                  <li><a class="dropdown-item text-danger" href="javascript:;">Delete</a></li>
                </ul>
              </div>
              <div class="dropdown">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">Filter by</button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item active" href="javascript:;">All</a></li>
                  <li><a class="dropdown-item" href="javascript:;">Active</a></li>
                  <li><a class="dropdown-item" href="javascript:;">Archived</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
