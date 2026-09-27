/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";

export function render(data: Record<string, any>): HtmlRenderable {
  const roleIds = (data.roleIds ?? []).filter((id: string) => id !== "*");
  const rolePicker = (selected: string[] = []) => <fieldset class="mb-3" data-role-picker="">
    <legend class="form-label fs-6">App roles</legend>
    <div class="d-flex flex-wrap gap-3">{roleIds.map((id: string) => <label class="d-flex align-items-center gap-2">
      <input class="form-check-input m-0" type="checkbox" name="roles" value={id} checked={selected.includes(id)} />{id}
    </label>)}</div>
    {!roleIds.length ? <p class="text-body-secondary mb-0">No roles configured for this app.</p> : null}
    {selected.filter(id => id !== "*" && !roleIds.includes(id)).map(id => <small class="d-block text-warning">Unavailable role: {id}. Saving removes this assignment.</small>)}
  </fieldset>;
  const users = data.users ?? [], groups = data.groups ?? [];
  return <section id="bp-users-ui" class="container-fluid py-4" data-endpoint={data.endpoint ?? "/users"}>
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div><h1 class="h3 mb-1">User management</h1><p class="text-body-secondary mb-0">Manage access, invitations and groups for this app.</p></div>
      <span class="badge text-bg-secondary">{data.isolation === "tenant" ? "Shared tenant directory" : "App directory"}</span>
    </header>
    <div role="status" aria-live="polite" class="alert d-none" />
    <div class="row g-4">
      <div class="col-12 col-xl-8"><section class="card h-100"><div class="card-header"><h2 class="h5 mb-0">Users</h2></div><div class="card-body">
        {!users.length ? <p class="text-body-secondary">No users in this directory yet.</p> : <div class="table-responsive"><table class="table align-middle"><thead><tr><th scope="col">User</th><th scope="col">Access</th><th scope="col">Account</th></tr></thead><tbody>{users.map((u: any) => <tr>
          <td><strong>{u.name || u.email || u.username}</strong>{u.name ? <small class="d-block text-body-secondary">{u.email || u.username}</small> : null}<small class="d-block text-body-secondary">{u.emailVerified ? "Email verified" : "Email not verified"}</small></td>
          <td>{u.protected ? <span class="badge text-bg-secondary">Bootstrap administrator</span> : <form data-bp-no-route=""><input type="hidden" name="action" value="roles" /><input type="hidden" name="id" value={u.id} />{rolePicker(u.roles)}<button class="btn btn-sm btn-primary" type="submit">Save roles</button></form>}
            {u.effectiveRoles?.filter((id: string) => !u.roles.includes(id)).length ? <small class="d-block text-body-secondary mt-2">From groups: {u.effectiveRoles.filter((id: string) => !u.roles.includes(id)).join(", ")}</small> : null}</td>
          <td><span class={`badge mb-2 ${u.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{u.enabled ? "Enabled" : "Disabled"}</span>{data.canManageDirectory && !u.protected ? <form data-bp-no-route=""><input type="hidden" name="action" value="disable" /><input type="hidden" name="id" value={u.id} /><input type="hidden" name="enabled" value={String(!u.enabled)} /><button class="btn btn-sm btn-outline-secondary" type="submit">{u.enabled ? "Disable" : "Enable"}</button></form> : null}</td>
        </tr>)}</tbody></table></div>}
        {data.nextUrl ? <a class="btn btn-outline-secondary" href={data.nextUrl} hx-get={data.nextUrl} hx-target="#bp-main">Next users</a> : null}
      </div></section></div>
      <div class="col-12 col-xl-4"><section class="card"><div class="card-header"><h2 class="h5 mb-0">Invite user</h2></div><div class="card-body">
        {data.registration === "closed" ? <p class="text-body-secondary mb-0">Registration is closed. Enable invitations in auth configuration to invite users.</p> : <form data-bp-no-route=""><input type="hidden" name="action" value="invite" /><label class="form-label d-block mb-3">Email<input class="form-control mt-1" type="email" name="email" required /></label>{rolePicker()}<button class="btn btn-primary" type="submit">Send invitation</button></form>}
      </div></section><section class="card mt-4"><div class="card-header"><h2 class="h5 mb-0">Pending invitations</h2></div><div class="card-body">
        {!data.invitations?.length ? <p class="text-body-secondary mb-0">No pending invitations.</p> : data.invitations.map((invite: any) => <form class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3" data-bp-no-route=""><input type="hidden" name="action" value="invite.revoke" /><input type="hidden" name="id" value={invite.id} /><span>{invite.email}</span><button class="btn btn-sm btn-outline-danger" type="submit">Revoke</button></form>)}
      </div></section></div>
      <div class="col-12"><section class="card"><div class="card-header"><h2 class="h5 mb-0">Groups</h2></div><div class="card-body">
        {!data.canManageDirectory ? <p class="text-body-secondary">Manage shared group membership in the tenant’s directory administration app. Role mappings below apply to this app.</p> : null}
        <div class="row g-3">{(data.canManageDirectory ? [...groups, { id: "", name: "", members: [], roles: [] }] : groups).map((g: any) => <div class="col-12 col-lg-6"><div class="border rounded p-3 h-100">
          <h3 class="h6">{g.name || "Create group"}</h3><form data-bp-no-route=""><input type="hidden" name="action" value={data.canManageDirectory ? "group.save" : "group.roles"} /><input type="hidden" name="id" value={g.id} />
            {data.canManageDirectory ? <><label class="form-label d-block">Group name<input class="form-control" name="name" value={g.name} required /></label><fieldset class="mb-3" data-member-picker=""><legend class="form-label fs-6">Members</legend>
              {users.map((u: any) => <label class="d-flex align-items-center gap-2 mb-2"><input class="form-check-input m-0" type="checkbox" name="members" value={u.id} checked={g.members.includes(u.id)} />{u.email || u.username}</label>)}
              {g.members.filter((id: string) => !users.some((u: any) => u.id === id)).map((id: string) => <input type="hidden" name="members" value={id} />)}
              <small class="text-body-secondary">Members on other pages are preserved.</small>
            </fieldset></> : null}{rolePicker(g.roles)}<button class="btn btn-primary" type="submit">{g.id ? "Save group" : "Create group"}</button>
          </form>{data.canManageDirectory && g.id ? <form class="mt-2" data-bp-no-route=""><input type="hidden" name="action" value="group.delete" /><input type="hidden" name="id" value={g.id} /><button class="btn btn-sm btn-outline-danger" type="submit">Delete group</button></form> : null}
        </div></div>)}</div>
      </div></section></div>
      <div class="col-12 col-lg-6"><section class="card"><div class="card-header"><h2 class="h5 mb-0">Failed email deliveries</h2></div><div class="card-body">
        {!data.mail?.length ? <p class="text-body-secondary mb-0">No failed deliveries.</p> : data.mail.map((m: any) => <form class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3" data-bp-no-route=""><input type="hidden" name="action" value="mail.retry" /><input type="hidden" name="id" value={m.id} /><span>{m.attempts} attempts <small class="d-block text-body-secondary">{m.id}</small></span><button class="btn btn-sm btn-outline-primary" type="submit">Retry</button></form>)}
        {data.mailNextUrl ? <a class="btn btn-outline-secondary mt-3" href={data.mailNextUrl} hx-get={data.mailNextUrl} hx-target="#bp-main">More failed deliveries</a> : null}
      </div></section></div>
      <div class="col-12 col-lg-6"><section class="card"><div class="card-header"><h2 class="h5 mb-0">Recent account events</h2></div><div class="card-body">
        {!data.audit?.length ? <p class="text-body-secondary mb-0">No account events yet.</p> : <ul class="list-group list-group-flush">{data.audit.map((a: any) => <li class="list-group-item"><strong>{a.event}</strong><small class="d-block text-body-secondary">{new Date(a.at).toISOString()} · {a.actor}</small></li>)}</ul>}
      </div></section></div>
    </div>
    <script>{js(`(() => {
      const root = document.getElementById("bp-users-ui"); if (!root) return;
      root.querySelectorAll("form").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault(); event.stopPropagation(); const button = form.querySelector("button"); button.disabled = true;
        const status = root.querySelector('[role="status"]');
        try {
          const values = new FormData(form), data = Object.fromEntries(values);
          if (form.querySelector("[data-role-picker]")) data.roles = values.getAll("roles");
          if (form.querySelector("[data-member-picker]")) data.members = values.getAll("members");
          if ("enabled" in data) data.enabled = data.enabled === "true";
          const endpoint = new URL(root.dataset.endpoint, location.href).href;
          const result = await window.BetterPortalAuth.fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          const body = await result.json();
          status.className = "alert " + (result.ok ? "alert-success" : "alert-danger");
          status.textContent = body.message || body.error || (result.ok ? "Saved. Reload this page to see changes." : "Request failed.");
        } catch (error) { status.className = "alert alert-danger"; status.textContent = error.message; } finally { button.disabled = false; }
      }));
    })()`)}</script>
  </section>;
}
