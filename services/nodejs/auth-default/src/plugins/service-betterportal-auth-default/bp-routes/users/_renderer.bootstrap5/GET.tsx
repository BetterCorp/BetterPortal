/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
export function render(data: Record<string, any>): HtmlRenderable {
  return <section id="bp-users-ui" class="container py-4" data-endpoint={data.endpoint ?? "/users"}>
    <h2>Users and groups</h2><p>{data.mode} mode · {data.isolation === "tenant" ? "Accounts shared within this tenant" : "Accounts isolated to this app"}</p>
    <p role="status" aria-live="polite" /><p>Available role IDs: {(data.roleIds ?? []).join(", ") || "None configured"}</p>
    <form class="border p-3 mb-3" data-bp-no-route=""><h3>Invite user</h3><input type="hidden" name="action" value="invite" /><label class="form-label">Email<input class="form-control" type="email" name="email" required /></label><label class="form-label ms-2">Role IDs (comma separated)<input class="form-control" name="roles" /></label><button class="btn btn-primary ms-2" type="submit">Send invitation</button></form>
    <div class="table-responsive"><table class="table"><thead><tr><th>User</th><th>Roles</th><th>Account</th></tr></thead><tbody>{(data.users ?? []).map((u: any) => <tr><td>{u.email || u.username}<small class="d-block">{u.id}</small></td><td><form data-bp-no-route=""><input type="hidden" name="action" value="roles" /><input type="hidden" name="id" value={u.id} /><input aria-label="Role IDs" class="form-control" name="roles" value={u.roles.join(",")} /><button class="btn btn-sm btn-primary" type="submit">Save roles</button></form></td><td>{data.canManageDirectory ? <form data-bp-no-route=""><input type="hidden" name="action" value="disable" /><input type="hidden" name="id" value={u.id} /><input type="hidden" name="enabled" value={String(!u.enabled)} /><button class="btn btn-sm btn-outline-danger" type="submit">{u.enabled ? "Disable" : "Enable"}</button></form> : (u.enabled ? "Enabled" : "Disabled")}</td></tr>)}</tbody></table></div>
    {data.nextUrl ? <a class="btn btn-outline-secondary mb-3" href={data.nextUrl} hx-get={data.nextUrl} hx-target="#bp-main">Next users</a> : null}
    <h3>Pending invitations</h3>{(data.invitations ?? []).map((invite: any) => <form data-bp-no-route=""><input type="hidden" name="action" value="invite.revoke" /><input type="hidden" name="id" value={invite.id} /><span>{invite.email} </span><button class="btn btn-sm btn-outline-danger" type="submit">Revoke invitation</button></form>)}
    <h3>Groups</h3>{data.canManageDirectory ? [...(data.groups ?? []), { id: "", name: "", members: [], roles: [] }].map((g: any) => <form class="border p-3 mb-3" data-bp-no-route=""><input type="hidden" name="action" value="group.save" /><input type="hidden" name="id" value={g.id} /><label class="form-label d-block">Name<input class="form-control" name="name" value={g.name} required /></label><label class="form-label d-block">Member user IDs (comma separated)<input class="form-control" name="members" value={g.members.join(",")} /></label><label class="form-label d-block">App role IDs (comma separated)<input class="form-control" name="roles" value={g.roles.join(",")} /></label><button class="btn btn-primary" type="submit">Save group</button></form>) : <p>Manage shared groups in the tenant’s directory administration app.</p>}
    {data.canManageDirectory ? (data.groups ?? []).map((g: any) => <form data-bp-no-route=""><input type="hidden" name="action" value="group.delete" /><input type="hidden" name="id" value={g.id} /><span>{g.name} </span><button class="btn btn-sm btn-outline-danger" type="submit">Delete group</button></form>) : null}
    {!data.canManageDirectory ? (data.groups ?? []).map((g: any) => <form class="border p-3 mb-3" data-bp-no-route=""><input type="hidden" name="action" value="group.roles" /><input type="hidden" name="id" value={g.id} /><label class="form-label">{g.name}: role IDs in this app<input class="form-control" name="roles" value={g.roles.join(",")} /></label><button class="btn btn-sm btn-primary" type="submit">Save app mapping</button></form>) : null}
    <h3>Failed email deliveries</h3>{(data.mail ?? []).map((m: any) => <form data-bp-no-route=""><input type="hidden" name="action" value="mail.retry" /><input type="hidden" name="id" value={m.id} /><span>{m.id} · {m.attempts} attempts </span><button class="btn btn-sm btn-secondary" type="submit">Retry</button></form>)}
    {data.mailNextUrl ? <a class="btn btn-outline-secondary my-3" href={data.mailNextUrl} hx-get={data.mailNextUrl} hx-target="#bp-main">More failed deliveries</a> : null}
    <h3 class="mt-3">Recent account events</h3><ul>{(data.audit ?? []).map((a: any) => <li>{new Date(a.at).toISOString()} · {a.event} · {a.actor}</li>)}</ul>
    <script>{js(`(() => {
      const root = document.getElementById("bp-users-ui"); if (!root) return;
      root.querySelectorAll("form").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault(); event.stopPropagation(); const button = form.querySelector("button"); button.disabled = true;
        try {
          const data = Object.fromEntries(new FormData(form)); for (const key of ["roles", "members"]) if (key in data) data[key] = data[key].split(",").map(s => s.trim()).filter(Boolean);
          if ("enabled" in data) data.enabled = data.enabled === "true";
          const endpoint = new URL(root.dataset.endpoint, location.href).href;
          const result = await window.BetterPortalAuth.fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          const body = await result.json(); root.querySelector('[role="status"]').textContent = body.message || (result.ok ? "Saved. Reload this page to see changes." : "Request failed.");
        } catch (error) { root.querySelector('[role="status"]').textContent = error.message; } finally { button.disabled = false; }
      }));
    })()`)}</script>
  </section>;
}
