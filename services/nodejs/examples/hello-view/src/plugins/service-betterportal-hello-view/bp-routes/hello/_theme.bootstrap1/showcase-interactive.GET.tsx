/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">Interactive Components</h2>
          <p class="text-body-secondary">Accordions, collapse, spinners, placeholders, breadcrumbs, and range inputs.</p>
        </div>

        {/* -- Accordion -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Accordion</h5>
            <div class="accordion" id="showcase-accordion">
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#acc-1" aria-expanded="true">
                    How does theming work?
                  </button>
                </h2>
                <div id="acc-1" class="accordion-collapse collapse show" data-bs-parent="#showcase-accordion">
                  <div class="accordion-body text-body-secondary">
                    BetterPortal uses a theme plugin system. Each theme provides renderers for standard Bootstrap components. Services write vanilla Bootstrap HTML and the theme's CSS overrides handle the visual treatment - glass neumorphic in this case.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acc-2" aria-expanded="false">
                    Can I customize the color palette?
                  </button>
                </h2>
                <div id="acc-2" class="accordion-collapse collapse" data-bs-parent="#showcase-accordion">
                  <div class="accordion-body text-body-secondary">
                    Yes. Colors are configured in <code>bp-config.yaml</code> per-app. You can override the accent, surface, text, and border colors. Bootstrap color tokens are also mapped so <code>.btn-primary</code>, <code>.text-bg-success</code>, etc. all follow your palette.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acc-3" aria-expanded="false">
                    What about dark mode?
                  </button>
                </h2>
                <div id="acc-3" class="accordion-collapse collapse" data-bs-parent="#showcase-accordion">
                  <div class="accordion-body text-body-secondary">
                    The theme supports <code>light</code>, <code>dark</code>, and <code>system</code> modes. Each mode has its own surface, shadow, and overlay values. Glass effects adapt automatically - lighter translucency in dark mode, frosted white in light mode.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acc-4" aria-expanded="false">
                    How do HTMX navigations work?
                  </button>
                </h2>
                <div id="acc-4" class="accordion-collapse collapse" data-bs-parent="#showcase-accordion">
                  <div class="accordion-body text-body-secondary">
                    Navigation links use <code>hx-get</code> to fetch content from service endpoints. The shell runtime manages loading indicators (topbar progress, content overlay, nav shimmer) and error states. Content is swapped into <code>#bp-main</code> with <code>innerHTML</code> strategy.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Collapse -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Collapse / Show-Hide</h5>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <button class="btn btn-primary btn-sm" data-bs-toggle="collapse" data-bs-target="#collapse-demo">Toggle Content</button>
              <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="collapse" data-bs-target="#collapse-multi-1">Panel A</button>
              <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="collapse" data-bs-target="#collapse-multi-2">Panel B</button>
            </div>
            <div class="collapse show mb-3" id="collapse-demo">
              <div class="card">
                <div class="card-body">
                  <p class="mb-0">This content can be toggled. Useful for advanced options, details panels, or progressive disclosure.</p>
                </div>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-md-6">
                <div class="collapse" id="collapse-multi-1">
                  <div class="card">
                    <div class="card-body">
                      <h6>Panel A</h6>
                      <p class="text-body-secondary mb-0">Independent collapse panels can be toggled individually.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="collapse" id="collapse-multi-2">
                  <div class="card">
                    <div class="card-body">
                      <h6>Panel B</h6>
                      <p class="text-body-secondary mb-0">Multiple collapse targets work independently.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Spinners & Loading -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Spinners &amp; Loading</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <h6 class="small text-body-secondary mb-2">Border Spinners</h6>
                <div class="d-flex align-items-center gap-3">
                  <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                  <div class="spinner-border text-secondary" role="status"></div>
                  <div class="spinner-border text-success" role="status"></div>
                  <div class="spinner-border text-danger" role="status"></div>
                  <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="small text-body-secondary mb-2">Growing Spinners</h6>
                <div class="d-flex align-items-center gap-3">
                  <div class="spinner-grow text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                  <div class="spinner-grow text-secondary" role="status"></div>
                  <div class="spinner-grow text-success" role="status"></div>
                  <div class="spinner-grow text-info" role="status"></div>
                  <div class="spinner-grow spinner-grow-sm text-primary" role="status"></div>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="small text-body-secondary mb-2">Button with Spinner</h6>
                <div class="d-flex gap-2">
                  <button class="btn btn-primary" disabled>
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Saving...
                  </button>
                  <button class="btn btn-outline-secondary" disabled>
                    <span class="spinner-grow spinner-grow-sm me-1" role="status"></span>
                    Loading
                  </button>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="small text-body-secondary mb-2">Full Card Loading</h6>
                <div class="card">
                  <div class="card-body text-center py-4">
                    <div class="spinner-border text-primary mb-2" role="status"></div>
                    <div class="text-body-secondary small">Loading dashboard data...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Placeholders / Skeletons -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Placeholders / Skeletons</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title placeholder-glow">
                      <span class="placeholder col-6"></span>
                    </h6>
                    <p class="card-text placeholder-glow">
                      <span class="placeholder col-7"></span>
                      <span class="placeholder col-4"></span>
                      <span class="placeholder col-4"></span>
                      <span class="placeholder col-6"></span>
                      <span class="placeholder col-8"></span>
                    </p>
                    <a class="btn btn-primary disabled placeholder col-4" aria-disabled="true" href="javascript:;"></a>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <div class="d-flex align-items-center gap-3 placeholder-glow mb-3">
                      <span class="placeholder rounded-circle" style="width:3rem;height:3rem;"></span>
                      <div class="flex-grow-1">
                        <span class="placeholder col-5 d-block mb-1"></span>
                        <span class="placeholder col-3"></span>
                      </div>
                    </div>
                    <div class="placeholder-glow">
                      <span class="placeholder col-12 mb-1"></span>
                      <span class="placeholder col-10 mb-1"></span>
                      <span class="placeholder col-8"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Breadcrumbs -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Breadcrumbs</h5>
            <nav aria-label="breadcrumb" class="mb-2">
              <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item"><a href="javascript:;">Home</a></li>
                <li class="breadcrumb-item"><a href="javascript:;">Projects</a></li>
                <li class="breadcrumb-item active" aria-current="page">Alpha</li>
              </ol>
            </nav>
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item"><a href="javascript:;">Dashboard</a></li>
                <li class="breadcrumb-item"><a href="javascript:;">Settings</a></li>
                <li class="breadcrumb-item"><a href="javascript:;">Security</a></li>
                <li class="breadcrumb-item active" aria-current="page">API Keys</li>
              </ol>
            </nav>
          </div>
        </div>

        {/* -- Range Inputs -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Range Inputs</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Volume</label>
                <input type="range" class="form-range" min="0" max="100" value="65" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Brightness</label>
                <input type="range" class="form-range" min="0" max="100" value="40" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Opacity (disabled)</label>
                <input type="range" class="form-range" min="0" max="100" value="50" disabled />
              </div>
              <div class="col-md-6">
                <label class="form-label">Steps (0-5)</label>
                <input type="range" class="form-range" min="0" max="5" step="1" value="3" />
              </div>
            </div>
          </div>
        </div>

        {/* -- Keyboard Shortcuts / Kbd -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Keyboard Shortcuts</h5>
            <div class="d-flex flex-column gap-2">
              {[
                { keys: ["Ctrl", "K"], action: "Open command palette" },
                { keys: ["Ctrl", "S"], action: "Save current document" },
                { keys: ["Ctrl", "Shift", "P"], action: "Open settings" },
                { keys: ["Esc"], action: "Close modal / cancel" },
                { keys: ["^", "v"], action: "Navigate list items" }
              ].map((shortcut) => (
                <div class="d-flex justify-content-between align-items-center py-1">
                  <span class="text-body-secondary">{shortcut.action}</span>
                  <span class="d-flex gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd class="bg-body-secondary text-body border rounded px-2 py-1" style="font-size:0.78rem;">{key}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
