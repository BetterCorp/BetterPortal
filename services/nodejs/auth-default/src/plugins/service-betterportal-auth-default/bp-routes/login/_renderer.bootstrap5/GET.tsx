import { BPRoute } from "@betterportal/framework";
/* @jsxImportSource @betterportal/framework */
import { renderChallenge } from "../../../../../accountUI.js";
import { js } from "jsx-htmx";
import { resolveAppAuthRedirect, type HtmlRenderable, type ViewRenderContext } from "@betterportal/framework";
import type { ResponseData } from "../../../loginFlow.js";

function loginScript(): HtmlRenderable {
  // IIFE - htmx executes swapped <script> content as a plain script, where a
  // top-level `return` inside a bare block is a SyntaxError.
  return js(`(() => {
    const form = document.getElementById("bp-login-form");
    if (!form) return;
    // Capture ?next= from URL into the hidden input so the server returns
    // the correct HX-Location post-login.
    const nextInput = form.querySelector('input[name="next"]');
    if (nextInput) {
      nextInput.value = new URLSearchParams(window.location.search).get("next") || nextInput.value;
    }
    form.addEventListener("htmx:before:request", () => {
      const errEl = document.getElementById("bp-login-error");
      if (errEl) errEl.classList.add("d-none");
    });
    form.addEventListener("htmx:response:error", (ev) => {
      const xhr = { status: ev.detail.ctx?.response?.status, responseText: ev.detail.ctx?.text };
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      const errEl = document.getElementById("bp-login-error");
      if (errEl) {
        errEl.textContent = (body && body.message) || new DOMParser().parseFromString(xhr.responseText || "", "text/html").getElementById("bp-login-error")?.textContent?.trim() || ("Login failed (HTTP " + xhr.status + ")");
        errEl.classList.remove("d-none");
      }
    });
    form.addEventListener("htmx:after:request", (ev) => {
      const xhr = { status: ev.detail.ctx?.response?.status, responseText: ev.detail.ctx?.text };
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      const errEl = document.getElementById("bp-login-error");
      if (!xhr.status || xhr.status >= 400 || !body || body.status !== "ok") {
        if (errEl) {
          errEl.textContent = (body && body.message) || new DOMParser().parseFromString(xhr.responseText || "", "text/html").getElementById("bp-login-error")?.textContent?.trim() || ("Login failed (HTTP " + xhr.status + ")");
          errEl.classList.remove("d-none");
        }
        return;
      }
      // Token storage happens via BP-SetHeader directives (shell shim) - writing
      // bp.headers here too would stamp the wrong lock owner and block the
      // server's later BP-RemoveHeader / refresh overwrites.
      // Server sets HX-Location: next - htmx soft-navigates automatically. No reload.
    });
  })()`);
}

function inlineScriptJson(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  const account = ctx.route({ path: "/account", method: "POST" });
  const accountPage = ctx.route({ path: "/account" });
  const social = ctx.route({ path: "/social" });
  const logout = ctx.route({ path: "/login", query: { action: "logout" } });
  const requestedNext = typeof ctx.request.query.next === "string" ? ctx.request.query.next : undefined;
  const next = resolveAppAuthRedirect(ctx, data.loggedOut ? "afterLogout" : "afterLogin", requestedNext);
  const register = ctx.route({ path: "/register", query: { next: requestedNext } });
  if (data.challenge) {
    if (!account?.absoluteApiPath) throw new Error("Account service route is unavailable");
    return renderChallenge(data.challenge, account.absoluteApiPath, "login.complete", next);
  }
  if (data.loggedOut) {
    return (
      <div class="container py-5" style="max-width: 420px;">
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center">
            <h3 class="card-title mb-1">Signed out</h3>
            <p class="text-secondary small mb-4">You have been signed out.</p>
            <a class="btn btn-primary w-100" href={next}>Continue</a>
          </div>
        </div>
      </div>
    );
  }

  // Zero users -> this deployment still needs its first admin. Soft-redirect to
  // the register view in-shell; URL bar follows via hx-push-url.
  if (data.requiresFirstAdmin && register?.absoluteViewPath) {
    return (
      <div
        hx-get={register.absoluteViewPath}
        hx-trigger="load"
        hx-target="#bp-main"
        hx-swap="innerHTML"
        hx-push-url={register.uiPath ?? false}
      >
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border" role="status"><span class="visually-hidden">Redirecting to first-admin setup...</span></div>
        </div>
      </div>
    );
  }

  // Already signed in with an explicit destination - go there immediately,
  // no interstitial. The shell maps the tenant path to its owning service.
  if (data.alreadyLoggedIn && requestedNext) {
    return (
      <div class="d-flex justify-content-center py-5">
        <div class="spinner-border" role="status"><span class="visually-hidden">Redirecting...</span></div>
        <script>{js(`window.htmx.ajax("GET", ${inlineScriptJson(next)}, { target: "#bp-main", swap: "innerHTML", push: ${inlineScriptJson(next)} })`)}</script>
      </div>
    );
  }

  // Request already carried a valid token - show the signed-in state with a
  // way out (logout path from app config) instead of a pointless login form.
  if (data.alreadyLoggedIn) {
    const displayName = data.user?.name || data.user?.username || data.user?.email || "your account";
    return (
      <div class="container py-5" style="max-width: 420px;">
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center">
            <h3 class="card-title mb-1">Already signed in</h3>
            <p class="text-secondary small mb-4">You are signed in as <strong>{displayName}</strong>.</p>
            <button id="bp-login-continue" data-next={next} class="btn btn-primary w-100 mb-2">Continue</button>
            <button
              class="btn btn-outline-secondary w-100"
              hx-get={logout?.absoluteViewPath ?? undefined}
              hx-target="#bp-main"
              hx-swap="innerHTML"
              hx-push-url={logout?.uiPath ?? false}
            >Sign out</button>
          </div>
        </div>
        <script>{js(`(() => {
          // Honour ?next= the same way the login form does, and soft-navigate
          // inside the shell. The shell's config_request hook maps the tenant
          // path to its owning service origin.
          const button = document.getElementById("bp-login-continue");
          const next = button?.dataset.next;
          button?.addEventListener("click", () => {
            if (next) window.htmx.ajax("GET", next, { target: "#bp-main", swap: "innerHTML", push: next });
          });
        })()`)}</script>
      </div>
    );
  }

  const login = ctx.route({ path: "/login", method: "POST" })?.absoluteApiPath;
  if (!login) throw new Error("Login action route is unavailable");
  return (
    <div class="container py-5" style="max-width: 420px;">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h3 class="card-title mb-1 text-center">Sign in</h3>
          <p class="text-secondary text-center small mb-4">BetterPortal admin</p>
          <form
            id="bp-login-form"
            data-factor-endpoint={account?.absoluteApiPath ?? undefined}
            hx-post={login}
            hx-headers='{"Accept":"application/json"}'
            hx-swap="none"
            onsubmit="return window.bpLoginSubmit ? window.bpLoginSubmit(event) : false"
            {...{
              "hx-on::response-error": "const xhr=event.detail.xhr;let body=null;try{body=JSON.parse(xhr.responseText)}catch(e){};const errEl=document.getElementById('bp-login-error');if(errEl){errEl.textContent=(body&&body.message)||('Login failed (HTTP '+xhr.status+')');errEl.classList.remove('d-none')}"
            }}
          >
            <div class="mb-3">
              <label class="form-label">Username *</label>
              <input type="text" class="form-control" name="username" autocomplete="username" required autofocus />
            </div>
            <div class="mb-3">
              <label class="form-label">Password *</label>
              <input type="password" class="form-control" name="password" autocomplete="current-password" required />
            </div>
            <input type="hidden" name="next" value={next} />
            <div class="alert alert-danger d-none" id="bp-login-error"></div>
            <button type="submit" class="btn btn-primary w-100">Sign in</button>
          </form>
          {social?.uiPath ? <BPRoute ctx={ctx} {...{ path: "/social" }} class="d-block mt-3"><bp-ok>Sign in with Google, Microsoft or GitHub</bp-ok></BPRoute> : null}
          {accountPage?.uiPath ? <BPRoute ctx={ctx} {...{ path: "/account" }} class="d-block mt-3"><bp-ok>Register or recover your account</bp-ok></BPRoute> : null}
        </div>
      </div>
      <script>{loginScript()}</script>
    </div>
  );
}
