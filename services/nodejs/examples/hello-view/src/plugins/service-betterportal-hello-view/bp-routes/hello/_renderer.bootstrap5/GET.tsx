/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function statCard(label: string, value: string, change: string, positive: boolean): HtmlRenderable {
  return (
    <div class="col">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body">
          <div class="small text-body-secondary mb-1">{label}</div>
          <div class="h4 mb-1">{value}</div>
          <div class={`small ${positive ? "text-success" : "text-danger"}`}>
            {positive ? "^" : "v"} {change}
          </div>
        </div>
      </div>
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        {/* -- Hero -- */}
        <div>
          <h1 class="h3 mb-1">{data.greeting}</h1>
          <p class="text-body-secondary mb-0">
            This HTML representation is rendered from the same validated API output.
          </p>
        </div>

        {/* -- Stat cards -- */}
        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
          {statCard("Total Users", "12,482", "14% vs last month", true)}
          {statCard("Revenue", "$48,290", "8.2% vs last month", true)}
          {statCard("Active Sessions", "1,847", "3.1% vs yesterday", false)}
          {statCard("Avg. Response", "124ms", "12% improvement", true)}
        </div>

        {/* -- Content sections -- */}
        <div class="row g-3">
          <div class="col-lg-8">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h2 class="h5 mb-3">Platform Overview</h2>
                <p class="text-body-secondary">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </p>
                <p class="text-body-secondary">
                  Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                </p>
                <p class="text-body-secondary mb-0">
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
                </p>
              </div>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Quick Actions</h2>
                <div class="d-grid gap-2">
                  <button class="btn btn-outline-primary btn-sm text-start">View Analytics</button>
                  <button class="btn btn-outline-primary btn-sm text-start">Manage Users</button>
                  <button class="btn btn-outline-primary btn-sm text-start">System Settings</button>
                  <button class="btn btn-outline-primary btn-sm text-start">Export Reports</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Table-like section -- */}
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">Recent Activity</h2>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th class="text-body-secondary fw-semibold">Event</th>
                    <th class="text-body-secondary fw-semibold">User</th>
                    <th class="text-body-secondary fw-semibold">Status</th>
                    <th class="text-body-secondary fw-semibold text-end">Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Deployment completed</td><td>System</td><td><span class="badge text-bg-success">Success</span></td><td class="text-end text-body-secondary">2 min ago</td></tr>
                  <tr><td>User login</td><td>jane@example.com</td><td><span class="badge text-bg-primary">Active</span></td><td class="text-end text-body-secondary">5 min ago</td></tr>
                  <tr><td>Config updated</td><td>admin@example.com</td><td><span class="badge text-bg-warning text-dark">Pending</span></td><td class="text-end text-body-secondary">12 min ago</td></tr>
                  <tr><td>Backup initiated</td><td>System</td><td><span class="badge text-bg-info">Running</span></td><td class="text-end text-body-secondary">18 min ago</td></tr>
                  <tr><td>Service restart</td><td>ops@example.com</td><td><span class="badge text-bg-success">Success</span></td><td class="text-end text-body-secondary">32 min ago</td></tr>
                  <tr><td>Alert triggered</td><td>monitoring</td><td><span class="badge text-bg-danger">Critical</span></td><td class="text-end text-body-secondary">45 min ago</td></tr>
                  <tr><td>User invited</td><td>admin@example.com</td><td><span class="badge text-bg-primary">Sent</span></td><td class="text-end text-body-secondary">1 hr ago</td></tr>
                  <tr><td>Schema migration</td><td>System</td><td><span class="badge text-bg-success">Success</span></td><td class="text-end text-body-secondary">2 hr ago</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* -- Long-form content -- */}
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">Architecture Notes</h2>
            <p class="text-body-secondary">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Cras mattis consectetur purus sit amet fermentum. Aenean lacinia bibendum nulla sed consectetur. Donec sed odio dui. Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus.
            </p>
            <p class="text-body-secondary">
              Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Maecenas sed diam eget risus varius blandit sit amet non magna. Cras justo odio, dapibus ut facilisis in, egestas eget quam. Vestibulum id ligula porta felis euismod semper. Morbi leo risus, porta ac consectetur ac, vestibulum at eros. Nullam quis risus eget urna mollis ornare vel eu leo.
            </p>
            <p class="text-body-secondary">
              Etiam porta sem malesuada magna mollis euismod. Donec ullamcorper nulla non metus auctor fringilla. Maecenas faucibus mollis interdum. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Curabitur blandit tempus porttitor. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum.
            </p>
            <p class="text-body-secondary mb-0">
              Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Nullam id dolor id nibh ultricies vehicula ut id elit. Donec id elit non mi porta gravida at eget metus. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
