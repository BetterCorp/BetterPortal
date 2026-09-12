/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";

export function accountScript(): HtmlRenderable {
  return js(`(() => {
    const root = document.getElementById("bp-account-ui");
    if (!root) return;
    if (location.hash.startsWith("#bp-auth=")) {
      try {
        const ticket = JSON.parse(decodeURIComponent(location.hash.slice(9)));
        if (!["verify", "reset", "email.verify", "invite.accept"].includes(ticket.action) || typeof ticket.id !== "string" || typeof ticket.secret !== "string") throw new Error("Invalid verification link");
        const form = root.querySelector("#bp-link-verification");
        if (form) {
          root.querySelectorAll("form").forEach(other => other.hidden = true);
          form.hidden = false;
          for (const name of ["action", "id", "secret"]) form.elements.namedItem(name).value = ticket[name];
          const password = form.elements.namedItem("password");
          password.required = ticket.action === "reset" || (ticket.action === "invite.accept" && root.dataset.signedIn !== "true");
          password.closest("label").hidden = !password.required; password.disabled = !password.required;
        }
        history.replaceState(null, "", location.pathname + location.search);
      } catch { /* Show the ordinary account recovery controls for an invalid link. */ }
    }
    const output = root.querySelector('[role="status"]');
    const api = window.BetterPortalAuth;
    const complete = async (body) => {
      if (!api) throw new Error("Open this page inside your application.");
      const response = await api.fetch(root.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Request failed.");
      if (result.challenge) return factor(result.challenge, "factor.complete");
      output.textContent = result.message || "Saved.";
      if (result.recoveryCodes?.length) { const pre = document.createElement("pre"); pre.textContent = "Save these recovery codes securely. They are shown only once.\\n\\n" + result.recoveryCodes.join("\\n"); output.append(pre); }
      if (result.next) { const link = document.createElement("a"); link.href = result.next; link.textContent = "Continue"; link.className = "btn btn-primary"; output.append(link); }
    };
    const factor = async (challenge, action) => {
      if (!api) throw new Error("Open this page inside your application.");
      const result = await api.factor(challenge);
      if (!result) return;
      await complete({ action, id: challenge.id, secret: challenge.secret, next: new URLSearchParams(location.search).get("next") || "", ...result });
    };
    root.querySelectorAll("form").forEach(form => form.addEventListener("submit", async event => {
      event.preventDefault(); event.stopPropagation(); const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
      try { await complete(Object.fromEntries(new FormData(form))); }
      catch (error) { output.textContent = error.message; }
      finally { if (button) button.disabled = false; }
    }));
    const challengeButton = root.querySelector("[data-challenge]");
    if (challengeButton) challengeButton.addEventListener("click", async () => {
      challengeButton.disabled = true;
      try { await factor(JSON.parse(challengeButton.dataset.challenge), challengeButton.dataset.action); }
      catch (error) { output.textContent = error.message; }
      finally { challengeButton.disabled = false; }
    });
  })()`);
}
const field = (name: string, title: string, type = "text") => <label class="form-label d-block">{title}<input class="form-control" name={name} type={type} required autocomplete={type === "password" ? "new-password" : name} /></label>;
const form = (action: string, title: string, children?: HtmlRenderable) => <form class="border rounded p-3 mb-3" data-bp-no-route=""><h4>{title}</h4><input type="hidden" name="action" value={action} />{children}<button class="btn btn-primary mt-2" type="submit">{title}</button></form>;
export function renderChallenge(challenge: unknown, endpoint: string, action = "login.complete"): HtmlRenderable {
  return <section id="bp-account-ui" class="container py-4" style="max-width:540px" data-endpoint={endpoint}><h2>Verify your identity</h2><p>Complete authentication to continue.</p><button class="btn btn-primary" data-challenge={JSON.stringify(challenge)} data-action={action}>Continue verification</button><div role="status" class="mt-3" /><script>{accountScript()}</script></section>;
}
export function renderAccount(data: Record<string, any>): HtmlRenderable {
  if (data.challenge) return renderChallenge(data.challenge, data.accountUrl ?? "/account", "factor.complete");
  const action = ["verify", "reset", "email.verify", "invite.accept"].includes(data.action) ? data.action : "";
  return <section id="bp-account-ui" class="container py-4" style="max-width:620px" data-endpoint={data.accountUrl ?? "/account"} data-signed-in={String(!!data.signedIn)}>
    <h2>Account</h2>
    <form id="bp-link-verification" hidden data-bp-no-route="" class="border rounded p-3 mb-3"><h4>Complete account verification</h4><input type="hidden" name="action" /><input type="hidden" name="id" /><input type="hidden" name="secret" />{field("password", "New password (at least 12 characters)", "password")}<button class="btn btn-primary" type="submit">Continue</button></form>
    <div role="status" class="my-3" aria-live="polite">{data.message ?? ""}</div>
    {action ? form(action, action === "reset" ? "Reset password" : action === "invite.accept" ? "Accept invitation" : "Verify email", <><input type="hidden" name="id" value={data.id} /><input type="hidden" name="secret" value={data.secret} />{(action === "reset" || (action === "invite.accept" && !data.signedIn)) ? field("password", "New password (at least 12 characters)", "password") : null}</>) : data.signedIn ? <>
      <p>{data.user?.email || data.user?.username}</p>
      <a href={data.socialUrl} hx-get={data.socialUrl} hx-target="#bp-main">Link Google, Microsoft or GitHub</a>
      {(data.linkedIdentities ?? []).map((link: any) => form("identity.unlink", "Unlink provider", <><p>{link.provider}</p><input type="hidden" name="id" value={link.id} /></>))}
      {form("profile", "Update name", field("name", "Display name"))}
      {form("password", "Change password", <>{field("currentPassword", "Current password", "password")}{field("password", "New password (at least 12 characters)", "password")}</>)}
      {form("email.change", "Change email", field("email", "New email", "email"))}
      {form("factor.start", "Add an authentication factor")}
      {data.user?.totp ? form("factor.remove", "Remove authenticator", <input type="hidden" name="method" value="totp" />) : null}
      {(data.passkeys ?? []).map((key: any) => form("factor.remove", "Remove passkey", <><p>{key.name} · {key.rpId}</p><input type="hidden" name="method" value="passkey" /><input type="hidden" name="id" value={key.id} /></>))}
      {data.sessionNextUrl ? <a href={data.sessionNextUrl} hx-get={data.sessionNextUrl} hx-target="#bp-main">More active sessions</a> : null}
      <h3>Active sessions in this app</h3>{(data.sessions ?? []).map((session: any) => form("session.revoke", "Revoke session", <><p>{new Date(session.createdAt).toISOString()}</p><input type="hidden" name="id" value={session.id} /></>))}
    </> : <>
      {data.registration === "public" ? form("signup", "Create account", <>{field("email", "Email", "email")}{field("name", "Display name")}{field("password", "Password (at least 12 characters)", "password")}</>) : null}
      {form("request-reset", "Send password reset", field("email", "Email", "email"))}
      {form("resend", "Resend verification email", field("email", "Email", "email"))}
    </>}
    <script>{accountScript()}</script>
  </section>;
}
