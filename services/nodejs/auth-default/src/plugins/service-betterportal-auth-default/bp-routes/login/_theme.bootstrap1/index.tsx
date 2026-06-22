/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function loginScript(): HtmlRenderable {
  // IIFE — htmx executes swapped <script> content as a plain script, where a
  // top-level `return` inside a bare block is a SyntaxError.
  return js(`(() => {
    const form = document.getElementById("bp-login-form");
    if (!form) return;
    // Capture ?next= from URL into the hidden input so the server returns
    // the correct HX-Location post-login.
    const nextInput = form.querySelector('input[name="next"]');
    if (nextInput) {
      nextInput.value = new URLSearchParams(window.location.search).get("next") || "";
    }
    form.addEventListener("htmx:beforeRequest", () => {
      const errEl = document.getElementById("bp-login-error");
      if (errEl) errEl.classList.add("d-none");
    });
    form.addEventListener("htmx:responseError", (ev) => {
      const xhr = ev.detail.xhr;
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      const errEl = document.getElementById("bp-login-error");
      if (errEl) {
        errEl.textContent = (body && body.message) || ("Login failed (HTTP " + xhr.status + ")");
        errEl.classList.remove("d-none");
      }
    });
    form.addEventListener("htmx:afterRequest", (ev) => {
      const xhr = ev.detail.xhr;
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      const errEl = document.getElementById("bp-login-error");
      if (!xhr.status || xhr.status >= 400 || !body || body.status !== "ok") {
        if (errEl) {
          errEl.textContent = (body && body.message) || ("Login failed (HTTP " + xhr.status + ")");
          errEl.classList.remove("d-none");
        }
        return;
      }
      // Token storage happens via BP-SetHeader directives (shell shim) — writing
      // bp.headers here too would stamp the wrong lock owner and block the
      // server's later BP-RemoveHeader / refresh overwrites.
      // Server sets HX-Location: next — htmx soft-navigates automatically. No reload.
    });
  })()`);
}

export function render(data: ResponseData): HtmlRenderable {
  if (data.loggedOut) {
    const next = data.nextUrl || "/";
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

  // Zero users → this deployment still needs its first admin. Soft-redirect to
  // the register view in-shell; URL bar follows via hx-push-url.
  if (data.requiresFirstAdmin && data.firstAdminUrl) {
    return (
      <div
        hx-get={data.firstAdminUrl}
        hx-trigger="load"
        hx-target="#bp-main"
        hx-swap="innerHTML"
        hx-push-url="/register"
      >
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border" role="status"><span class="visually-hidden">Redirecting to first-admin setup…</span></div>
        </div>
      </div>
    );
  }

  // Already signed in with an explicit destination — go there immediately,
  // no interstitial. The shell maps the tenant path to its owning service.
  if (data.alreadyLoggedIn && data.nextUrl) {
    const next = data.nextUrl;
    return (
      <div class="d-flex justify-content-center py-5">
        <div class="spinner-border" role="status"><span class="visually-hidden">Redirecting…</span></div>
        <script>{js(`window.htmx.ajax("GET", ${JSON.stringify(next)}, { target: "#bp-main", swap: "innerHTML", push: ${JSON.stringify(next)} })`)}</script>
      </div>
    );
  }

  // Request already carried a valid token — show the signed-in state with a
  // way out (logout path from app config) instead of a pointless login form.
  if (data.alreadyLoggedIn) {
    const displayName = data.user?.name || data.user?.username || data.user?.email || "your account";
    return (
      <div class="container py-5" style="max-width: 420px;">
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center">
            <h3 class="card-title mb-1">Already signed in</h3>
            <p class="text-secondary small mb-4">You are signed in as <strong>{displayName}</strong>.</p>
            <button id="bp-login-continue" class="btn btn-primary w-100 mb-2">Continue</button>
            <button
              class="btn btn-outline-secondary w-100"
              hx-get={data.logoutUrl || "/login?action=logout"}
              hx-target="#bp-main"
              hx-swap="innerHTML"
              hx-push-url="/login?action=logout"
            >Sign out</button>
          </div>
        </div>
        <script>{js(`(() => {
          // Honour ?next= the same way the login form does, and soft-navigate
          // inside the shell. The shell's config_request hook maps the tenant
          // path to its owning service origin.
          const next = new URLSearchParams(window.location.search).get("next") || "/";
          document.getElementById("bp-login-continue")?.addEventListener("click", () => {
            window.htmx.ajax("GET", next, { target: "#bp-main", swap: "innerHTML", push: next });
          });
        })()`)}</script>
      </div>
    );
  }

  return (
    <div class="container py-5" style="max-width: 420px;">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h3 class="card-title mb-1 text-center">Sign in</h3>
          <p class="text-secondary text-center small mb-4">BetterPortal admin</p>
          <form
            id="bp-login-form"
            hx-post="this"
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
            <input type="hidden" name="next" value="" />
            <div class="alert alert-danger d-none" id="bp-login-error"></div>
            <button type="submit" class="btn btn-primary w-100">Sign in</button>
          </form>
        </div>
      </div>
      <script>{loginScript()}</script>
    </div>
  );
}
