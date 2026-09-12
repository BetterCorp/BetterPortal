/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
export function render(data: Record<string, any>): HtmlRenderable {
  return <section id="bp-social-ui" class="container py-4" style="max-width:540px" data-endpoint={data.endpoint} data-code={data.code} data-state={data.state}>
    <h2>{data.signedIn ? "Link a sign-in provider" : "Sign in"}</h2><p role="status">{data.error ? "The provider declined sign-in. Try again." : ""}</p>
    {data.connections.map((c: any) => <button class="btn btn-outline-primary m-2" data-connection={c.id} data-action={data.signedIn ? "link" : "start"}>Continue with {c.title}</button>)}
    <script>{js(`(() => {
      const root = document.getElementById("bp-social-ui"); if (!root) return;
      const status = root.querySelector('[role="status"]');
      const api = window.BetterPortalAuth;
      const send = async (body, endpoint = root.dataset.endpoint) => {
        if (!api) throw new Error("Open sign-in inside your app.");
        const response = await api.fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
        const result = await response.json(); if (!response.ok) throw new Error(result.message || "Sign-in failed."); return result;
      };
      root.querySelectorAll("[data-connection]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        try { const result = await send({ action: button.dataset.action, connection: button.dataset.connection }); sessionStorage.setItem("bp.oauth." + result.id, result.secret); location.assign(result.authorizationUrl); }
        catch (error) { status.textContent = error.message; button.disabled = false; }
      }));
      if (root.dataset.code && root.dataset.state) void (async () => {
        const id = root.dataset.state; const secret = sessionStorage.getItem("bp.oauth." + id); sessionStorage.removeItem("bp.oauth." + id);
        history.replaceState(null, "", location.pathname);
        if (!secret) { status.textContent = "Sign-in was started in a different app or browser. Start again."; return; }
        try {
          let result = await send({ action: "complete", id, secret, code: root.dataset.code });
          if (result.challenge) {
            const factor = await api.factor(result.challenge); if (!factor) { status.textContent = "Sign-in cancelled."; return; }
            result = await send({ action: "login.complete", id: result.challenge.id, secret: result.challenge.secret, ...factor }, result.accountUrl);
          }
          status.textContent = result.message || "Signed in.";
          if (result.recoveryCodes?.length) { const pre = document.createElement("pre"); pre.textContent = "Save your recovery codes:\\n" + result.recoveryCodes.join("\\n"); status.append(pre); }
          if (result.next) { const link = document.createElement("a"); link.href = result.next; link.textContent = "Continue"; link.className = "btn btn-primary d-block"; status.append(link); }
        } catch (error) { status.textContent = error.message; }
      })();
    })()`)}</script>
  </section>;
}
