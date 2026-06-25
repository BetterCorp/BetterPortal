/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

/*
   Showcase: Forms & Inputs
    */

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">Forms &amp; Inputs</h2>
          <p class="text-body-secondary">Form controls with glass neumorphic styling. All standard Bootstrap form elements.</p>
        </div>

        {/* Text inputs */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Text Inputs</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" placeholder="Enter your name" />
                <div class="form-text">Your display name across the platform.</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-control" placeholder="name@example.com" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" placeholder="--------" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Disabled Input</label>
                <input type="text" class="form-control" placeholder="Can't touch this" disabled />
              </div>
              <div class="col-12">
                <label class="form-label">Message</label>
                <textarea class="form-control" rows="3" placeholder="Write something..."></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Selects */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Selects &amp; Dropdowns</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Region</label>
                <select class="form-select">
                  <option selected>Choose a region...</option>
                  <option>North America</option>
                  <option>Europe</option>
                  <option>Asia Pacific</option>
                  <option>Latin America</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Size</label>
                <select class="form-select">
                  <option>Small</option>
                  <option selected>Medium</option>
                  <option>Large</option>
                  <option>Enterprise</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Checkboxes, radios, switches */}
        <div class="row g-3">
          <div class="col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title mb-3">Checkboxes</h5>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="check1" checked />
                  <label class="form-check-label" for="check1">Email notifications</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="check2" />
                  <label class="form-check-label" for="check2">SMS alerts</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="check3" checked />
                  <label class="form-check-label" for="check3">Push notifications</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="check4" disabled />
                  <label class="form-check-label" for="check4">Webhooks (Pro)</label>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title mb-3">Radio Buttons</h5>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="radio" name="plan" id="plan1" checked />
                  <label class="form-check-label" for="plan1">Free</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="radio" name="plan" id="plan2" />
                  <label class="form-check-label" for="plan2">Pro - $19/mo</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="radio" name="plan" id="plan3" />
                  <label class="form-check-label" for="plan3">Business - $49/mo</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="plan" id="plan4" />
                  <label class="form-check-label" for="plan4">Enterprise - Custom</label>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title mb-3">Switches</h5>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="sw1" checked />
                  <label class="form-check-label" for="sw1">Dark mode</label>
                </div>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="sw2" />
                  <label class="form-check-label" for="sw2">Compact view</label>
                </div>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="sw3" checked />
                  <label class="form-check-label" for="sw3">Auto-refresh</label>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="sw4" disabled />
                  <label class="form-check-label" for="sw4">Beta features</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Complete form */}
        <div class="card">
          <div class="card-header">Create New User</div>
          <div class="card-body">
            <form>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">First Name</label>
                  <input type="text" class="form-control" value="Jane" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Last Name</label>
                  <input type="text" class="form-control" value="Doe" />
                </div>
                <div class="col-md-8">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" value="jane@example.com" />
                </div>
                <div class="col-md-4">
                  <label class="form-label">Role</label>
                  <select class="form-select">
                    <option>Viewer</option>
                    <option selected>Editor</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div class="col-12">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="terms" checked />
                    <label class="form-check-label" for="terms">I agree to the terms and conditions</label>
                  </div>
                </div>
                <div class="col-12">
                  <button type="button" class="btn btn-primary me-2">Create User</button>
                  <button type="button" class="btn btn-outline-secondary">Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>

      </div>
    </section>
  );
}
