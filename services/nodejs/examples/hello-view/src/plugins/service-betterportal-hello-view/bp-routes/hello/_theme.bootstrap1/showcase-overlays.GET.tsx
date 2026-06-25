/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="bp-split-pane" data-bp-detail-open="false">
      <div class="bp-split-pane__content">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">Overlays &amp; Surfaces</h2>
          <p class="text-body-secondary">Modals, split-pane detail panels, toasts, tooltips, and popovers.</p>
        </div>

        {/* -- Modals -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Modals</h5>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modal-default">Default</button>
              <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal-large">Large</button>
              <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal-small">Small</button>
              <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal-centered">Centered</button>
              <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal-scrollable">Scrollable</button>
              <button class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#modal-confirm">Confirm Delete</button>
            </div>
          </div>
        </div>

        {/* Default modal */}
        <div class="modal fade" id="modal-default" tabindex={-1}>
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Default Modal</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>Standard modal with glass neumorphic treatment. Notice the frosted backdrop and rounded corners.</p>
                <div class="mb-3">
                  <label class="form-label">Example Input</label>
                  <input type="text" class="form-control" placeholder="Type something..." />
                </div>
                <div class="mb-3">
                  <label class="form-label">Select</label>
                  <select class="form-select">
                    <option>Option A</option>
                    <option>Option B</option>
                    <option>Option C</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        </div>

        {/* Large modal */}
        <div class="modal fade" id="modal-large" tabindex={-1}>
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Large Modal</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>Large modal for complex forms or detailed content. Two-column layout works well here.</p>
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
                    <label class="form-label">Notes</label>
                    <textarea class="form-control" rows="3" placeholder="Additional information..."></textarea>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary">Create</button>
              </div>
            </div>
          </div>
        </div>

        {/* Small modal */}
        <div class="modal fade" id="modal-small" tabindex={-1}>
          <div class="modal-dialog modal-sm">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Small Modal</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p class="mb-0">Compact modal for quick actions or simple confirmations.</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-primary btn-sm w-100" data-bs-dismiss="modal">Got it</button>
              </div>
            </div>
          </div>
        </div>

        {/* Centered modal */}
        <div class="modal fade" id="modal-centered" tabindex={-1}>
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Vertically Centered</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p class="mb-0">Centered in the viewport. Good for important notices that need attention.</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Dismiss</button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable modal */}
        <div class="modal fade" id="modal-scrollable" tabindex={-1}>
          <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Scrollable Content</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <h6>Terms of Service</h6>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
                <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
                <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
                <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.</p>
                <p class="mb-0">Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Decline</button>
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Accept</button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm delete modal */}
        <div class="modal fade" id="modal-confirm" tabindex={-1}>
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content">
              <div class="modal-body text-center py-4">
                <div class="mb-3">
                  <span class="badge text-bg-danger rounded-circle d-inline-flex align-items-center justify-content-center" style="width:3rem;height:3rem;font-size:1.25rem;">X</span>
                </div>
                <h5>Delete Item?</h5>
                <p class="text-body-secondary mb-0">This action cannot be undone. The item and all associated data will be permanently removed.</p>
              </div>
              <div class="modal-footer justify-content-center border-0 pt-0">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </div>

        {/* -- Detail Panel (split-pane) -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Detail Panel (Split-Pane)</h5>
            <p class="text-body-secondary mb-3">Desktop: content shifts left, panel appears as card on right. Mobile: slides in as overlay.</p>
            <button class="btn btn-primary" data-bp-toggle-detail>Toggle Detail Panel {"->"}</button>
          </div>
        </div>

        {/* -- Toasts -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Toasts (Static Preview)</h5>
            <p class="text-body-secondary mb-3">Toast notifications with glass styling. Shown inline for preview.</p>
            <div class="d-flex flex-column gap-2" style="max-width:360px;">
              <div class="toast show" role="alert" style="position:static;">
                <div class="toast-header">
                  <span class="badge text-bg-success me-2">&nbsp;</span>
                  <strong class="me-auto">Success</strong>
                  <small class="text-body-secondary">just now</small>
                  <button type="button" class="btn-close btn-close-sm" aria-label="Close"></button>
                </div>
                <div class="toast-body">Configuration saved successfully.</div>
              </div>
              <div class="toast show" role="alert" style="position:static;">
                <div class="toast-header">
                  <span class="badge text-bg-danger me-2">&nbsp;</span>
                  <strong class="me-auto">Error</strong>
                  <small class="text-body-secondary">2m ago</small>
                  <button type="button" class="btn-close btn-close-sm" aria-label="Close"></button>
                </div>
                <div class="toast-body">Failed to deploy. Check build logs for details.</div>
              </div>
              <div class="toast show" role="alert" style="position:static;">
                <div class="toast-header">
                  <span class="badge text-bg-info me-2">&nbsp;</span>
                  <strong class="me-auto">Info</strong>
                  <small class="text-body-secondary">5m ago</small>
                  <button type="button" class="btn-close btn-close-sm" aria-label="Close"></button>
                </div>
                <div class="toast-body">New team member <strong>Alex</strong> joined the workspace.</div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Tooltips & Popovers -- */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Tooltips &amp; Popovers</h5>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <button class="btn btn-outline-primary btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Tooltip on top">Hover: Top</button>
              <button class="btn btn-outline-primary btn-sm" data-bs-toggle="tooltip" data-bs-placement="right" title="Tooltip on right">Hover: Right</button>
              <button class="btn btn-outline-primary btn-sm" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Tooltip on bottom">Hover: Bottom</button>
              <button class="btn btn-outline-primary btn-sm" data-bs-toggle="tooltip" data-bs-placement="left" title="Tooltip on left">Hover: Left</button>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="popover" data-bs-title="Popover Title" data-bs-content="This is a popover with more detailed content. Popovers get the same glass treatment as dropdowns." data-bs-placement="top">Click: Popover Top</button>
              <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="popover" data-bs-title="Details" data-bs-content="Additional context, help text, or mini forms can live inside popovers." data-bs-placement="bottom">Click: Popover Bottom</button>
            </div>
          </div>
        </div>

      </div>
      </div>{/* end bp-split-pane__content */}

      {/* -- Detail panel (right column on desktop, overlay on mobile) -- */}
      <div class="bp-split-pane__detail">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0">User Details</h6>
          <button type="button" class="btn-close btn-sm" data-bp-close-detail aria-label="Close"></button>
        </div>
        <div class="text-center mb-3">
          <div class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mx-auto mb-2" style="width:3.5rem;height:3.5rem;font-size:1.2rem;">JD</div>
          <h6 class="mb-0">Jane Doe</h6>
          <small class="text-body-secondary">jane@example.com</small>
        </div>
        <div class="d-flex flex-column gap-3">
          <div>
            <label class="form-label">Role</label>
            <select class="form-select form-select-sm">
              <option>Viewer</option>
              <option selected>Editor</option>
              <option>Admin</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <div><span class="badge text-bg-success">Active</span></div>
          </div>
          <div>
            <label class="form-label">Joined</label>
            <div class="text-body-secondary small">March 15, 2025</div>
          </div>
          <div>
            <label class="form-label">Last Login</label>
            <div class="text-body-secondary small">2 hours ago</div>
          </div>
          <hr />
          <div class="d-grid gap-2">
            <button class="btn btn-outline-primary btn-sm">Send Message</button>
            <button class="btn btn-outline-danger btn-sm">Suspend User</button>
          </div>
        </div>
      </div>

      </div>{/* end bp-split-pane */}
    </section>
  );
}
