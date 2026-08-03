/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

/** Tenant-relative path (+query) of an absolute self-origin URL, for hx-push-url. */
function pushPathOf(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}

/** Client-side confirm-password gate; everything else is server-rendered. */
function registerScript(): HtmlRenderable {
  // IIFE - htmx executes swapped <script> content as a plain script, where a
  // top-level `return` inside a bare block is a SyntaxError.
  return js(`(() => {
    const form = document.getElementById("bp-register-form");
    if (!form) return;
    form.addEventListener("htmx:beforeRequest", (ev) => {
      const errEl = document.getElementById("bp-register-error");
      const pw = form.querySelector('input[name="password"]');
      const confirm = document.getElementById("bp-register-confirm");
      if (pw && confirm && pw.value !== confirm.value) {
        if (errEl) { errEl.textContent = "Passwords do not match."; errEl.classList.remove("d-none"); }
        ev.preventDefault();
        return;
      }
      if (errEl) errEl.classList.add("d-none");
    });
  })()`);
}

function redirectStub(url: string, pushUrl: string, label: string): HtmlRenderable {
  return (
    <div
      hx-get={url}
      hx-trigger="load delay:1200ms"
      hx-target="#bp-main"
      hx-swap="innerHTML"
      hx-push-url={pushUrl}
    >
      <div class="d-flex justify-content-center py-3">
        <div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">{label}</span></div>
      </div>
    </div>
  );
}

function renderForm(data: ResponseData): HtmlRenderable {
  return (
    <div class="container py-5" style="max-width: 420px;">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h3 class="card-title mb-1 text-center">Create first admin</h3>
          <p class="text-secondary text-center small mb-4">
            This deployment has no users yet. The account you create here becomes the platform administrator.
          </p>
          <form
            id="bp-register-form"
            hx-post="this"
            hx-target="#bp-main"
            hx-swap="innerHTML"
          >
            <div class="mb-3">
              <label class="form-label">Username *</label>
              <input type="text" class="form-control" name="username" autocomplete="username" required autofocus />
            </div>
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" name="email" autocomplete="email" />
            </div>
            <div class="mb-3">
              <label class="form-label">Password * <span class="text-secondary small">(min 8 chars)</span></label>
              <input type="password" class="form-control" name="password" autocomplete="new-password" minlength="8" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Confirm password *</label>
              <input type="password" class="form-control" id="bp-register-confirm" autocomplete="new-password" minlength="8" required />
            </div>
            <div class={`alert alert-danger ${data.status === "error" && data.message ? "" : "d-none"}`} id="bp-register-error">
              {data.status === "error" ? (data.message ?? "") : ""}
            </div>
            <button type="submit" class="btn btn-primary w-100">Create admin account</button>
          </form>
        </div>
      </div>
      <script>{registerScript()}</script>
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  // POST success - server-rendered confirmation, then on to sign-in.
  if (data.status === "ok" && data.user) {
    return (
      <div class="container py-5" style="max-width: 420px;">
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center">
            <h3 class="card-title mb-2">Admin created</h3>
            <div class="alert alert-success mb-3">
              <strong>{data.user.username}</strong> is now the platform administrator.
            </div>
            <p class="text-secondary small mb-0">Taking you to sign in...</p>
            {data.loginUrl
              ? redirectStub(data.loginUrl, pushPathOf(data.loginUrl, "/login"), "Redirecting to sign in...")
              : <a class="btn btn-primary mt-3" href="/login">Sign in</a>}
          </div>
        </div>
      </div>
    );
  }

  // POST validation error (rendered via the 400 status view) - form + message.
  if (data.status === "error") {
    return renderForm(data);
  }

  // GET with users already present - registrations are closed; bounce to login.
  if (!data.registrationOpen) {
    if (data.loginUrl) {
      return redirectStub(data.loginUrl, pushPathOf(data.loginUrl, "/login"), "Redirecting to sign in...");
    }
    return (
      <div class="container py-5" style="max-width: 420px;">
        <div class="alert alert-secondary">Registration is closed. <a href="/login">Sign in</a> instead.</div>
      </div>
    );
  }

  // GET, zero users - the first-admin form.
  return renderForm(data);
}
