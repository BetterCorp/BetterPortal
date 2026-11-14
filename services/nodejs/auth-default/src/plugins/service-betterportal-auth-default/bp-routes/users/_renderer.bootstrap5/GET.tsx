/* @jsxImportSource @betterportal/framework */
import { js } from "jsx-htmx";
import { BPRoute, type HtmlRenderable, type ViewRenderContext } from "@betterportal/framework";

export function render(data: Record<string, any>, ctx: ViewRenderContext): HtmlRenderable {
  const roleIds = (data.roleIds ?? []).filter((id: string) => id !== "*");
  const rolePicker = (selected: string[] = []) => <fieldset class="mb-3" data-role-picker="">
    <legend class="form-label fs-6">App roles</legend>
    <div class="d-flex flex-wrap gap-3">{roleIds.map((id: string) => <label class="d-flex align-items-center gap-2">
      <input class="form-check-input m-0" type="checkbox" name="roles" value={id} checked={selected.includes(id)} />{id}
    </label>)}</div>
    {!roleIds.length ? <p class="text-body-secondary mb-0">No roles configured for this app.</p> : null}
    {selected.filter(id => id !== "*" && !roleIds.includes(id)).map(id => <small class="d-block text-warning-emphasis">Unavailable role: {id}. Saving removes this assignment.</small>)}
  </fieldset>;
  const users = data.users ?? [], groups = data.groups ?? [];
  const person = (user: any, fallback = "User no longer available") => <span><strong class="d-block">{user?.name || user?.email || user?.username || fallback}</strong>{user?.name && (user.email || user.username) ? <small class="d-block text-body-secondary">{user.email || user.username}</small> : null}</span>;
  const time = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? <time data-local-time="" datetime={new Date(value).toISOString()}>{new Date(value).toISOString()}</time> : <span class="text-body-secondary">Not recorded</span>;
  const eventLabels: Record<string, string> = {
    "user.created": "Account created", "login.success": "Signed in", "refresh.replay": "Session revoked after token reuse",
    "roles.initialized": "Default roles assigned", "session.revoked": "Session revoked", "invitation.accepted": "Invitation accepted",
    "admin.verification.link": "Verification link generated", "admin.verification.mark": "Email marked as verified",
    "admin.roles": "App roles updated", "admin.disable": "Account status updated", "admin.sessions.revoke": "All sessions revoked",
    "admin.invite": "Invitation sent", "admin.invite.revoke": "Invitation revoked", "admin.mail.retry": "Email delivery retried",
    "admin.group.save": "Group saved", "admin.group.delete": "Group deleted", "admin.group.roles": "Group roles updated",
    "account.verify": "Email verified", "account.email.verify": "New email verified", "account.reset": "Password reset",
    "account.password": "Password changed", "account.email.change": "Email change requested", "account.profile": "Profile updated",
    "account.session.revoke": "Session revoked", "account.factor.start": "Factor enrollment started", "account.factor.complete": "Factor enrolled",
    "account.factor.remove": "Factor removed", "account.identity.unlink": "Sign-in provider unlinked", "auth.elevated": "Additional authentication completed"
  };
  const deliveryReason: Record<string, string> = {
    accepted: "Accepted by the email provider. Inbox delivery is not confirmed.", not_configured: "Email delivery is not configured.",
    configuration_invalid: "Check the email transport, sender, URL and API key in auth configuration.", payload_invalid: "The queued message could not be read.",
    network_error: "Could not connect to the email provider. Check its URL and network availability.", timeout: "The email provider did not respond in time.",
    provider_access_denied: "The provider rejected the API key. Check the server credential in auth configuration.",
    provider_rejected: "The provider rejected the message. Check the sender and provider configuration.", http_error: "The email provider returned an HTTP error."
  };
  const endpoint = ctx.route({ method: "POST" })?.absoluteApiPath;
  const query = { after: String(ctx.request.query.after ?? ""), mailAfter: String(ctx.request.query.mailAfter ?? ""), mailState: String(ctx.request.query.mailState ?? "all") };
  if (!endpoint) throw new Error("Users service route is unavailable");
  return <section id="bp-users-ui" class="container-fluid py-4" data-endpoint={endpoint}>
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div><h1 class="h3 mb-1">User management</h1><p class="text-body-secondary mb-0">Manage access, invitations and groups for this app.</p></div>
      <div class="d-flex align-items-center gap-3"><span class="text-body-secondary">{data.isolation === "tenant" ? "Shared tenant directory" : "App directory"}</span><button class="btn btn-sm btn-outline-secondary" type="button" data-refresh-users="">Refresh</button></div>
    </header>
    <div role="status" aria-live="polite" class="alert d-none" />
    <nav aria-label="User management sections" class="nav nav-underline mb-4 border-bottom">
      <a class="nav-link" href="#bp-users-list">Users</a><a class="nav-link" href="#bp-users-invitations">Invitations</a><a class="nav-link" href="#bp-users-groups">Groups</a><a class="nav-link" href="#bp-users-mail">Email deliveries</a><a class="nav-link" href="#bp-users-activity">Account activity</a>
    </nav>
    <div class="row g-4">
      <div class="col-12"><section id="bp-users-list" class="card"><div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3"><h2 class="h5 mb-0">Users</h2><label class="form-label mb-0">Find on this page<input type="search" class="form-control form-control-sm" data-user-search="" placeholder="Name, email or username" /></label></div><div class="card-body">
        {!users.length ? <p class="text-body-secondary">No users in this directory yet.</p> : <div class="table-responsive"><table class="table align-middle"><thead><tr><th scope="col">User</th><th scope="col">Status</th><th scope="col">App roles</th><th scope="col">Actions</th></tr></thead><tbody>{users.map((u: any) => <tr data-user-row="" data-user-search-value={`${u.name || ""} ${u.email || ""} ${u.username || ""}`}>
          <td>{person(u)}<details class="small text-body-secondary mt-1"><summary>User ID</summary><code class="text-break">{u.id}</code></details></td>
          <td><span data-account-status="" class={`badge mb-1 ${u.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{u.enabled ? "Enabled" : "Disabled"}</span><small data-email-status="" class={`d-block ${u.emailVerified ? "text-body-secondary" : "text-warning-emphasis"}`}>{u.emailVerified ? "Email verified" : u.email ? "Email not verified" : "No email address"}</small></td>
          <td>{u.protected ? <span class="text-body-secondary">Bootstrap administrator</span> : <><span data-role-summary="">{u.roles?.join(", ") || "No direct roles"}</span><details class="mt-2"><summary class="text-primary">Edit roles</summary><form class="mt-2" data-bp-no-route=""><input type="hidden" name="action" value="roles" /><input type="hidden" name="id" value={u.id} />{rolePicker(u.roles)}<button class="btn btn-sm btn-primary" type="submit">Save roles</button></form></details></>}
            {u.effectiveRoles?.filter((id: string) => !u.roles.includes(id)).length ? <small class="d-block text-body-secondary mt-2">From groups: {u.effectiveRoles.filter((id: string) => !u.roles.includes(id)).join(", ")}</small> : null}</td>
          <td>{data.canManageDirectory && !u.protected ? <>
            {u.enabled && u.email && !u.emailVerified ? <div data-user-verification="">
              <form class="mb-2" data-bp-no-route=""><input type="hidden" name="action" value="verification.mark" /><input type="hidden" name="id" value={u.id} /><button class="btn btn-sm btn-primary" type="submit">Mark as verified</button></form>
              <form data-bp-no-route=""><input type="hidden" name="action" value="verification.link" /><input type="hidden" name="id" value={u.id} /><button class="btn btn-sm btn-outline-primary" type="submit">Generate verification link</button>
                <div class="mt-2" data-verification-output="" hidden><label class="form-label d-block">Verification link<input class="form-control form-control-sm mt-1" data-verification-value="" type="text" readonly /></label><div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-outline-secondary" data-copy-verification="" type="button">Copy link</button><a class="btn btn-sm btn-outline-primary" data-verification-link="" target="_blank" rel="noopener noreferrer">Open verification link</a></div><small class="d-block text-body-secondary mt-1">Expires in 30 minutes.</small></div>
              </form>
            </div> : null}
            <details class="mt-2"><summary class="text-primary">Manage account</summary><div class="d-flex flex-wrap gap-2 mt-2"><form data-bp-no-route=""><input type="hidden" name="action" value="disable" /><input type="hidden" name="id" value={u.id} /><input type="hidden" name="enabled" value={String(!u.enabled)} /><button class="btn btn-sm btn-outline-secondary" type="submit">{u.enabled ? "Disable" : "Enable"}</button></form><form data-bp-no-route=""><input type="hidden" name="action" value="sessions.revoke" /><input type="hidden" name="id" value={u.id} /><button class="btn btn-sm btn-outline-danger" type="submit">Revoke sessions</button></form></div></details>
          </> : <span class="text-body-secondary">{u.protected ? "Protected account" : "Managed in directory app"}</span>}</td>
        </tr>)}</tbody></table><p data-no-user-matches="" hidden>No users on this page match your search.</p></div>}
        {data.nextCursor ? <BPRoute ctx={ctx} query={{ ...query, after: data.nextCursor }} class="btn btn-outline-secondary"><bp-ok>Next users</bp-ok><bp-error as="span" aria-disabled="true">Next users unavailable</bp-error></BPRoute> : null}
      </div></section></div>
      <div class="col-12 col-lg-6"><section id="bp-users-invitations" class="card h-100"><div class="card-header"><h2 class="h5 mb-0">Invite user</h2></div><div class="card-body">
        {data.registration === "closed" ? <p class="text-body-secondary mb-0">Registration is closed. Enable invitations in auth configuration to invite users.</p> : <form data-bp-no-route=""><input type="hidden" name="action" value="invite" /><label class="form-label d-block mb-3">Email<input class="form-control mt-1" type="email" name="email" required /></label>{rolePicker()}<button class="btn btn-primary" type="submit">Send invitation</button></form>}
      </div></section></div><div class="col-12 col-lg-6"><section class="card h-100"><div class="card-header"><h2 class="h5 mb-0">Pending invitations</h2></div><div class="card-body">
        {!data.invitations?.length ? <p class="text-body-secondary mb-0">No pending invitations.</p> : data.invitations.map((invite: any) => <form class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3" data-bp-no-route=""><input type="hidden" name="action" value="invite.revoke" /><input type="hidden" name="id" value={invite.id} /><span>{invite.email}<small class="d-block text-body-secondary">Expires {time(invite.expiresAt)}</small></span><button class="btn btn-sm btn-outline-danger" type="submit">Revoke</button></form>)}
      </div></section></div>
      <div class="col-12"><section id="bp-users-groups" class="card"><div class="card-header"><h2 class="h5 mb-0">Groups</h2></div><div class="card-body">
        {!data.canManageDirectory ? <p class="text-body-secondary">Manage shared group membership in the tenant’s directory administration app. Role mappings below apply to this app.</p> : null}
        <div class="row g-3">{(data.canManageDirectory ? [...groups, { id: "", name: "", members: [], roles: [] }] : groups).map((g: any) => <div class="col-12 col-lg-6"><details class="border rounded p-3">
          <summary><strong>{g.name || "Create group"}</strong>{g.id ? <small class="text-body-secondary ms-2">{g.members.length} {g.members.length === 1 ? "member" : "members"} · {g.roles.join(", ") || "No app roles"}</small> : null}<span class="text-primary ms-2">{g.id ? "Edit group" : "Add members and roles"}</span></summary><div class="mt-3"><form data-bp-no-route=""><input type="hidden" name="action" value={data.canManageDirectory ? "group.save" : "group.roles"} /><input type="hidden" name="id" value={g.id} />
            {data.canManageDirectory ? <><label class="form-label d-block">Group name<input class="form-control" name="name" value={g.name} required /></label><fieldset class="mb-3" data-member-picker=""><legend class="form-label fs-6">Members</legend>
              {users.map((u: any) => <label class="d-flex align-items-center gap-2 mb-2"><input class="form-check-input m-0" type="checkbox" name="members" value={u.id} checked={g.members.includes(u.id)} />{u.email || u.username}</label>)}
              {g.members.filter((id: string) => !users.some((u: any) => u.id === id)).map((id: string) => <input type="hidden" name="members" value={id} />)}
              <small class="text-body-secondary">Members on other pages are preserved.</small>
            </fieldset></> : null}{rolePicker(g.roles)}<button class="btn btn-primary" type="submit">{g.id ? "Save group" : "Create group"}</button>
          </form>{data.canManageDirectory && g.id ? <form class="mt-2" data-bp-no-route=""><input type="hidden" name="action" value="group.delete" /><input type="hidden" name="id" value={g.id} /><button class="btn btn-sm btn-outline-danger" type="submit">Delete group</button></form> : null}
        </div></details></div>)}</div>
      </div></section></div>
      <div class="col-12"><section id="bp-users-mail" class="card"><div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3"><h2 class="h5 mb-0">Email deliveries</h2><div class="d-flex gap-2"><BPRoute ctx={ctx} query={{ ...query, mailState: "all", mailAfter: "" }} class={`btn btn-sm ${data.mailState !== "failed" ? "btn-secondary" : "btn-outline-secondary"}`}><bp-ok>All deliveries</bp-ok><bp-error as="span">All deliveries</bp-error></BPRoute><BPRoute ctx={ctx} query={{ ...query, mailState: "failed", mailAfter: "" }} class={`btn btn-sm ${data.mailState === "failed" ? "btn-secondary" : "btn-outline-secondary"}`}><bp-ok>Failed only</bp-ok><bp-error as="span">Failed only</bp-error></BPRoute></div></div><div class="card-body">
        {!data.mail?.length ? <p class="text-body-secondary mb-0">{data.mailState === "failed" ? "No failed deliveries." : "No email deliveries yet."}</p> : <div class="table-responsive"><table class="table align-middle"><thead><tr><th scope="col">Message</th><th scope="col">Delivery status</th><th scope="col">Last attempt</th><th scope="col">Action</th></tr></thead><tbody>{data.mail.map((m: any) => <tr data-mail-row="">
          <td><strong class="d-block">{m.to || "Recipient not retained"}</strong><span>{m.subject || "Subject not retained"}</span><details class="small text-body-secondary mt-1"><summary>Delivery details</summary><dl class="mb-0"><dt>Message ID</dt><dd class="text-break">{m.id}</dd><dt>Transport</dt><dd>{m.lastDelivery?.transport || "Not recorded"}</dd><dt>Provider code</dt><dd>{m.lastDelivery?.providerCode || "Not recorded"}</dd><dt>Created</dt><dd>{time(m.createdAt)}</dd></dl></details></td>
          <td><strong data-mail-state="" class={m.state === "failed" ? "text-danger-emphasis" : m.state === "sent" ? "text-success-emphasis" : "text-body"}>{({ failed: "Failed", pending: "Queued", sending: "Sending", sent: "Accepted by provider" } as Record<string, string>)[m.state] || m.state}</strong><span class="d-block">{m.attempts} {m.attempts === 1 ? "attempt" : "attempts"}</span><small data-mail-reason="" class="d-block text-body-secondary">{m.lastDelivery ? deliveryReason[m.lastDelivery.reason] || "Delivery outcome not recognized." : "No delivery result recorded. Older failures need another attempt to capture diagnostics."}{m.lastDelivery?.status ? ` HTTP ${m.lastDelivery.status}.` : ""}{m.lastDelivery?.providerCode && !["none", "unknown"].includes(m.lastDelivery.providerCode) ? ` ${m.lastDelivery.providerCode}.` : ""}</small>{m.state === "pending" && m.nextAttempt ? <small class="d-block text-body-secondary">Next attempt: {time(m.nextAttempt)}</small> : null}</td>
          <td>{time(m.lastDelivery?.at ?? m.updatedAt)}</td><td>{m.state === "failed" ? <form data-bp-no-route=""><input type="hidden" name="action" value="mail.retry" /><input type="hidden" name="id" value={m.id} /><button class="btn btn-sm btn-outline-primary" type="submit">Retry delivery</button></form> : null}</td>
        </tr>)}</tbody></table></div>}
        {data.mailNextCursor ? <BPRoute ctx={ctx} query={{ ...query, mailAfter: data.mailNextCursor }} class="btn btn-outline-secondary mt-3"><bp-ok>Older deliveries</bp-ok><bp-error as="span">More deliveries unavailable</bp-error></BPRoute> : null}
      </div></section></div>
      <div class="col-12"><section id="bp-users-activity" class="card"><div class="card-header"><h2 class="h5 mb-0">Recent account events</h2></div><div class="card-body">
        {!data.audit?.length ? <p class="text-body-secondary mb-0">No account events yet.</p> : <div class="table-responsive"><table class="table align-middle"><thead><tr><th scope="col">Event</th><th scope="col">Performed by</th><th scope="col">Affected user</th><th scope="col">When</th></tr></thead><tbody>{data.audit.map((a: any) => <tr>
          <td><strong>{a.event === "admin.disable" && typeof a.data?.enabled === "boolean" ? (a.data.enabled ? "Account enabled" : "Account disabled") : eventLabels[a.event] || a.event.replace(/[._]/g, " ")}</strong><details class="small text-body-secondary mt-1"><summary>Event details</summary><dl class="mb-0"><dt>Event code</dt><dd>{a.event}</dd><dt>Event ID</dt><dd class="text-break">{a.id}</dd><dt>Actor ID</dt><dd class="text-break">{a.actor}</dd>{a.data?.id ? <><dt>Target ID</dt><dd class="text-break">{a.data.id}</dd></> : null}{a.data?.roles?.length ? <><dt>Roles</dt><dd>{a.data.roles.join(", ")}</dd></> : null}</dl></details></td>
          <td>{person(a.actorUser, a.actor ? "User no longer available" : "System")}</td><td>{a.targetUser ? person(a.targetUser) : a.event.startsWith("admin.") ? <span class="text-body-secondary">{a.data?.email || a.data?.name || (a.data?.id ? "See event details" : "Not recorded")}</span> : person(a.actorUser)}</td><td>{time(a.at)}</td>
        </tr>)}</tbody></table></div>}
      </div></section></div>
    </div>
    <script>{js(`(() => {
      const root = document.getElementById("bp-users-ui"); if (!root) return;
      root.querySelector('[data-refresh-users]')?.addEventListener('click', () => location.reload());
      root.querySelectorAll('[data-local-time]').forEach(element => {
        const date = new Date(element.getAttribute('datetime'));
        element.textContent = date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        element.title = date.toISOString() + ' · ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
      });
      root.querySelector('[data-user-search]')?.addEventListener('input', event => {
        const query = event.target.value.trim().toLocaleLowerCase(); let shown = 0;
        root.querySelectorAll('[data-user-row]').forEach(row => { row.hidden = !row.dataset.userSearchValue.toLocaleLowerCase().includes(query); if (!row.hidden) shown++; });
        const empty = root.querySelector('[data-no-user-matches]'); if (empty) empty.hidden = shown !== 0;
      });
      root.querySelectorAll('[data-copy-verification]').forEach(button => button.addEventListener('click', async () => {
        const input = button.closest('form').querySelector('[data-verification-value]');
        try { await navigator.clipboard.writeText(input.value); button.textContent = 'Copied'; }
        catch { input.focus(); input.select(); button.textContent = 'Select and copy'; }
      }));
      root.querySelectorAll("form").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault(); event.stopPropagation(); if (form.dataset.submitting) return;
        form.dataset.submitting = 'true';
        const button = event.submitter || form.querySelector('button[type="submit"]'); button.disabled = true;
        const status = root.querySelector('[role="status"]');
        try {
          const values = new FormData(form), data = Object.fromEntries(values);
          if (form.querySelector("[data-role-picker]")) data.roles = values.getAll("roles");
          if (form.querySelector("[data-member-picker]")) data.members = values.getAll("members");
          if ("enabled" in data) data.enabled = data.enabled === "true";
          const endpoint = new URL(root.dataset.endpoint, location.href).href;
          const result = await window.BetterPortalAuth.fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          const body = await result.json();
          if (data.action === 'verification.link' && result.ok && body.verificationLink) {
            form.querySelector('[data-verification-value]').value = body.verificationLink;
            form.querySelector('[data-verification-link]').href = body.verificationLink;
            form.querySelector('[data-copy-verification]').textContent = 'Copy link';
            form.querySelector('[data-verification-output]').hidden = false;
          }
          const ok = result.ok && body.status !== 'error';
          if (ok && data.action === 'verification.mark') {
            const row = form.closest('[data-user-row]'); row.querySelector('[data-email-status]').textContent = 'Email verified';
            row.querySelector('[data-email-status]').className = 'd-block text-body-secondary'; row.querySelector('[data-user-verification]').remove();
          }
          if (ok && data.action === 'roles') form.closest('[data-user-row]').querySelector('[data-role-summary]').textContent = data.roles.join(', ') || 'No direct roles';
          if (ok && data.action === 'disable') {
            const badge = form.closest('[data-user-row]').querySelector('[data-account-status]');
            badge.textContent = data.enabled ? 'Enabled' : 'Disabled'; badge.className = 'badge mb-1 ' + (data.enabled ? 'text-bg-success' : 'text-bg-secondary');
            form.elements.enabled.value = String(!data.enabled); button.textContent = data.enabled ? 'Disable' : 'Enable';
            const verification = form.closest('[data-user-row]').querySelector('[data-user-verification]'); if (verification) verification.hidden = !data.enabled;
          }
          if (ok && data.action === 'mail.retry') {
            const row = form.closest('[data-mail-row]'); row.querySelector('[data-mail-state]').textContent = 'Queued'; row.querySelector('[data-mail-state]').className = 'text-body';
            row.querySelector('[data-mail-reason]').textContent = 'Queued for another attempt. Refresh to see the delivery result.'; button.hidden = true;
          }
          status.className = 'alert ' + (ok ? 'alert-success' : 'alert-danger');
          status.textContent = body.message || (body.error === 'insufficient_user_authentication' ? 'This action requires additional authentication, even for administrators. Open Account and check your authenticator or passkey, then try again.' : body.error) || (ok ? 'Saved. Refresh this page to see updated lists.' : 'Request failed.');
        } catch (error) { status.className = 'alert alert-danger'; status.textContent = error.message; } finally {
          delete form.dataset.submitting; button.disabled = false;
          if (form.isConnected) {
            let feedback = form.querySelector('[data-form-feedback]');
            if (!feedback) { feedback = document.createElement('p'); feedback.dataset.formFeedback = ''; feedback.setAttribute('role', 'status'); form.append(feedback); }
            feedback.className = 'small mt-2 mb-0 ' + (status.classList.contains('alert-danger') ? 'text-danger-emphasis' : 'text-success-emphasis'); feedback.textContent = status.textContent;
          }
        }
      }));
    })()`)}</script>
  </section>;
}
