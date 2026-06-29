/** @jsxImportSource jsx-htmx */

import type { HtmlRenderable } from "@betterportal/framework";
import { js } from "jsx-htmx";
import type { ResponseData } from "../route.impl.js";

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

  const nextUrl = data.nextUrl || "/";
  const scopes = JSON.stringify(data.scopes?.length ? data.scopes : ["openid", "profile", "email"]);

  return (
    <main
      id="bp-authress-page"
      class="bp-authress-shell"
      data-authress-api-url={data.authressApiUrl || ""}
      data-authress-application-id={data.authressApplicationId || ""}
      data-next-url={nextUrl}
      data-scopes={scopes}
      data-mode={data.alreadyLoggedIn ? "signed-in" : data.status === "error" ? "error" : "login"}
    >
      <script src="https://cdn.jsdelivr.net/npm/@authress/login/dist/authress.min.js"></script>
      <form id="bp-authress-token-form" hx-post="/login" hx-headers='{"Accept":"application/json"}' style="display:none" >
        <input type="hidden" name="accessToken" value="" />
        <input type="hidden" name="next" value={nextUrl} />
        <input type="hidden" name="userId" value="" />
        <input type="hidden" name="name" value="" />
        <input type="hidden" name="email" value="" />
        <input type="hidden" name="picture" value="" />
      </form>
      <section class="bp-authress-panel">
        <div class="bp-authress-mark" aria-hidden="true">A</div>
        <h1>Sign in</h1>
        <p class="bp-authress-copy">Continue with your Authress account.</p>
        <div class="bp-authress-status-row" role="status" aria-live="polite">
          <span class="bp-authress-spinner" aria-hidden="true"></span>
          <span id="bp-authress-status">{data.message || "Preparing sign in."}</span>
        </div>
      </section>
      <script>
        {js(() => {
          const page = document.getElementById("bp-authress-page");
          const form = document.getElementById("bp-authress-token-form") as HTMLFormElement | null;
          const status = document.getElementById("bp-authress-status");
          const browserWindow = window as typeof window & {
            htmx?: { ajax: (method: string, url: string, options: Record<string, unknown>) => void };
            Authress?: { LoginClient: new (settings: Record<string, unknown>) => {
              userSessionExists: () => Promise<boolean>;
              authenticate: (options: Record<string, unknown>) => Promise<void>;
              ensureToken: () => Promise<string | null>;
              getUserIdentity?: () => Promise<Record<string, unknown>>;
            } };
            authress?: { LoginClient: new (settings: Record<string, unknown>) => {
              userSessionExists: () => Promise<boolean>;
              authenticate: (options: Record<string, unknown>) => Promise<void>;
              ensureToken: () => Promise<string | null>;
              getUserIdentity?: () => Promise<Record<string, unknown>>;
            } };
          };

          const setStatus = (message: string) => {
            if (status) status.textContent = message;
            page?.classList.toggle("is-error", /failed|missing|could not|did not|requires/i.test(message || ""));
          };

          const softNavigate = (target: string) => {
            const href = target || "/";
            const link = document.createElement("a");
            link.href = href;
            if (browserWindow.htmx && !href.startsWith("http://") && !href.startsWith("https://")) {
              link.setAttribute("hx-get", href);
              link.setAttribute("hx-target", "#bp-main");
              link.setAttribute("hx-swap", "innerHTML");
              link.setAttribute("hx-push-url", href);
              link.setAttribute("data-bp-shell-route", "page");
              document.body.appendChild(link);
              browserWindow.htmx.process(link);
              link.click();
              link.remove();
            } else {
              link.rel = "noreferrer";
              document.body.appendChild(link);
              link.click();
              link.remove();
            }
          };

          const waitForAuthress = async () => {
            while (browserWindow.Authress === undefined && browserWindow.authress === undefined) {
              await new Promise((resolve) => setTimeout(resolve, 80));
            }
            const authressClient = browserWindow.Authress || browserWindow.authress;
            if (!authressClient) throw new Error("Authress SDK did not load");
            return authressClient;
          };

          form?.addEventListener("htmx:afterRequest", (event: Event) => {
            const xhr = (event as CustomEvent<{ xhr: XMLHttpRequest; successful: boolean }>).detail.xhr;
            let body: { status?: string; message?: string; nextUrl?: string } | null = null;
            try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
            if (xhr.status >= 400 || body?.status === "error") {
              setStatus(body?.message || `Sign in failed (HTTP ${xhr.status})`);
              return;
            }
            softNavigate(body?.nextUrl || page?.dataset.nextUrl || "/");
          });

          (async () => {
            if (!page) return;
            const target = page.dataset.nextUrl || "/";
            if (page.dataset.mode === "signed-in") {
              softNavigate(target);
              return;
            }
            if (page.dataset.mode === "error") {
              return;
            }

            setStatus("Checking Authress session");
            const authress = await waitForAuthress();
            const settings: Record<string, unknown> = { authressApiUrl: page.dataset.authressApiUrl };
            if (page.dataset.authressApplicationId) {
              settings.applicationId = page.dataset.authressApplicationId;
            }
            const loginClient = new authress.LoginClient(settings);
            const scopes = JSON.parse(page.dataset.scopes || "[]");

            if (!(await loginClient.userSessionExists())) {
              setStatus("Opening sign in");
              await loginClient.authenticate({
                redirectUrl: `${window.location.origin}${window.location.pathname}?next=${encodeURIComponent(target)}`,
                scopes
              });
              return;
            }

            setStatus("Storing session");
            const accessToken = await loginClient.ensureToken();
            if (!accessToken) {
              setStatus("Authress did not return an access token");
              return;
            }
            const tokenInput = form?.querySelector<HTMLInputElement>('input[name="accessToken"]');
            const nextInput = form?.querySelector<HTMLInputElement>('input[name="next"]');
            const readProfile = async (): Promise<Record<string, unknown>> => {
              const identity = loginClient.getUserIdentity
                ? await Promise.resolve(loginClient.getUserIdentity()).catch(() => null)
                : null;
              return identity && typeof identity === "object" ? identity : {};
            };
            const profile = await readProfile();
            const profileString = (...keys: string[]) => {
              for (const key of keys) {
                const value = key.split(".").reduce<unknown>((current, segment) => {
                  return current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined;
                }, profile);
                if (typeof value === "string" && value.trim()) return value.trim();
              }
              return "";
            };
            const fullName = [
              profileString("given_name", "givenName"),
              profileString("family_name", "familyName")
            ].filter(Boolean).join(" ");
            const profileFields: Record<string, string> = {
              userId: profileString("userId", "sub", "id", "data.id"),
              name: profileString("name", "displayName", "preferred_username", "nickname", "data.name", "data.login") || fullName,
              email: profileString("email", "email_address"),
              picture: profileString("picture", "avatar", "avatarUrl", "data.avatar_url")
            };
            if (tokenInput) tokenInput.value = accessToken;
            if (nextInput) nextInput.value = target;
            for (const [key, value] of Object.entries(profileFields)) {
              const input = form?.querySelector<HTMLInputElement>(`input[name="${key}"]`);
              if (input && value) input.value = value;
            }
            form?.setAttribute("hx-post", `${window.location.pathname}${window.location.search}`);
            form?.requestSubmit();
          })().catch((error) => {
            setStatus(error?.message || "Sign in could not start.");
          });
        })}
      </script>
      <style>
        {`
          .bp-authress-shell {
            min-height: 100vh;
            width: 100%;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
              radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 34%),
              linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
            color: #111827;
          }
          .bp-authress-panel {
            width: min(440px, 100%);
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.94);
            padding: 32px;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
          }
          .bp-authress-mark {
            width: 44px;
            height: 44px;
            display: grid;
            place-items: center;
            border-radius: 8px;
            background: #2563eb;
            color: #fff;
            font-weight: 700;
            margin-bottom: 18px;
          }
          .bp-authress-panel h1 {
            margin: 0 0 6px;
            font-size: 26px;
            line-height: 1.2;
            font-weight: 700;
          }
          .bp-authress-copy {
            margin: 0 0 24px;
            color: #64748b;
            font-size: 14px;
          }
          .bp-authress-status-row {
            display: flex;
            align-items: center;
            gap: 12px;
            border: 1px solid rgba(37, 99, 235, 0.18);
            border-radius: 8px;
            background: rgba(37, 99, 235, 0.06);
            padding: 14px 16px;
          }
          .bp-authress-spinner {
            width: 18px;
            height: 18px;
            flex: 0 0 18px;
            border-radius: 999px;
            border: 2px solid rgba(37, 99, 235, 0.22);
            border-top-color: #2563eb;
            animation: bp-authress-spin 0.8s linear infinite;
          }
          #bp-authress-status {
            margin: 0;
            color: #1e3a8a;
            font-size: 14px;
            line-height: 1.4;
          }
          .bp-authress-shell.is-error .bp-authress-status-row {
            border-color: rgba(220, 38, 38, 0.24);
            background: rgba(220, 38, 38, 0.07);
          }
          .bp-authress-shell.is-error .bp-authress-spinner {
            display: none;
          }
          .bp-authress-shell.is-error #bp-authress-status {
            color: #991b1b;
          }
          @keyframes bp-authress-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </main>
  );
}
