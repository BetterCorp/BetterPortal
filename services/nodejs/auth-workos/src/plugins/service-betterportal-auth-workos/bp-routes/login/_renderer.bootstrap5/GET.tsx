/** @jsxImportSource jsx-htmx */

import type { HtmlRenderable } from "@betterportal/framework";
import { css, js } from "jsx-htmx";
import type { ResponseData } from "../GET.js";

export function render(data: ResponseData): HtmlRenderable {
  const next = data.nextUrl || "/";
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

  const redirectUrl = data.authorizationUrl || (data.alreadyLoggedIn || data.signedIn ? next : "");
  const loginUI = data.loginUI || "default";
  const cleanLogin = loginUI === "clean" || loginUI === "redirect";
  const autoRedirect = loginUI === "default" || loginUI === "redirect";

  return (
    <main class={cleanLogin ? "bp-workos-shell bp-workos-clean" : "bp-workos-shell"} data-redirect-url={redirectUrl} data-mode={data.status} data-auto-redirect={autoRedirect ? "true" : "false"}>
      <section class="bp-workos-panel">
        {!cleanLogin ? <div class="bp-workos-mark" aria-hidden="true">W</div> : null}
        <h1>Sign in</h1>
        <p class="bp-workos-copy">{cleanLogin ? "Continue to your account." : "Continue with WorkOS."}</p>
        {data.status === "error" ? (
          <div class="alert alert-danger mb-0" role="alert">{data.message || "WorkOS sign in failed."}</div>
        ) : (
          <a class="btn btn-primary w-100" href={redirectUrl || next}>
            Continue
          </a>
        )}
      </section>
      <script>
        {js(() => {
          const root = document.currentScript?.closest(".bp-workos-shell") as HTMLElement | null;
          const url = root?.dataset.redirectUrl;
          if (!url || root?.dataset.mode === "error" || root?.dataset.autoRedirect !== "true") return;
          const link = document.createElement("a");
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
        })}
      </script>
      <style>
        {css(`
          .bp-workos-shell {
            min-height: 100vh;
            width: 100%;
            display: grid;
            place-items: center;
            padding: 24px;
            background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
            color: #111827;
          }
          .bp-workos-panel {
            width: min(420px, 100%);
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.96);
            padding: 32px;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
          }
          .bp-workos-clean {
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          }
          .bp-workos-clean .bp-workos-panel {
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.1);
          }
          .bp-workos-mark {
            width: 44px;
            height: 44px;
            display: grid;
            place-items: center;
            border-radius: 8px;
            background: #111827;
            color: #fff;
            font-weight: 700;
            margin-bottom: 18px;
          }
          .bp-workos-panel h1 {
            margin: 0 0 6px;
            font-size: 26px;
            line-height: 1.2;
            font-weight: 700;
          }
          .bp-workos-copy {
            margin: 0 0 24px;
            color: #64748b;
            font-size: 14px;
          }
        `)}
      </style>
    </main>
  );
}
