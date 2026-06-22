/** @jsxImportSource jsx-htmx */

import type { HtmlRenderable } from "@betterportal/framework";
import { js } from "jsx-htmx";
import type { ResponseData } from "../index.js";

export function render(data: ResponseData): HtmlRenderable {
  if (data.status === "error" || !data.authressApiUrl) return <div></div>;

  return (
    <div
      data-bp-authress-background=""
      data-authress-api-url={data.authressApiUrl}
      data-authress-application-id={data.authressApplicationId || ""}
    >
      <script src="https://cdn.jsdelivr.net/npm/@authress/login/dist/authress.min.js"></script>
      <form data-bp-authress-refresh-form="" hx-post="/refresh" hx-headers='{"Accept":"application/json"}' hx-swap="none">
        <input type="hidden" name="accessToken" value="" />
      </form>
      <script>
        {js(() => {
          (() => {
            const root = document.currentScript?.closest("[data-bp-authress-background]") as HTMLElement | null;
            if (!root || root.dataset.monitorStarted === "1") return;
            root.dataset.monitorStarted = "1";

            const browserWindow = window as typeof window & {
              htmx?: { process: (elt: Element) => void };
              Authress?: {
                LoginClient: new (settings: Record<string, unknown>) => {
                  userSessionExists: () => Promise<boolean>;
                  ensureToken: () => Promise<string | null>;
                }
              };
              authress?: {
                LoginClient: new (settings: Record<string, unknown>) => {
                  userSessionExists: () => Promise<boolean>;
                  ensureToken: () => Promise<string | null>;
                }
              };
            };

            const waitForAuthress = async () => {
              while (browserWindow.Authress === undefined && browserWindow.authress === undefined) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              return browserWindow.Authress || browserWindow.authress;
            };

            const form = root.querySelector<HTMLFormElement>("[data-bp-authress-refresh-form]");
            if (form && browserWindow.htmx) browserWindow.htmx.process(form);

            let lastToken = "";
            const refreshBpToken = async () => {
              const sdk = await waitForAuthress();
              if (!sdk) return;
              const settings: Record<string, unknown> = { authressApiUrl: root.dataset.authressApiUrl };
              if (root.dataset.authressApplicationId) settings.applicationId = root.dataset.authressApplicationId;
              const loginClient = new sdk.LoginClient(settings);
              if (!(await loginClient.userSessionExists())) return;
              const accessToken = await loginClient.ensureToken();
              if (!accessToken || accessToken === lastToken) return;
              lastToken = accessToken;
              const input = form?.querySelector<HTMLInputElement>('input[name="accessToken"]');
              if (input) input.value = accessToken;
              form?.requestSubmit();
            };

            void refreshBpToken();
            window.setInterval(() => { void refreshBpToken(); }, 60_000);
            document.addEventListener("visibilitychange", () => {
              if (!document.hidden) void refreshBpToken();
            });
          })();
        })}
      </script>
    </div>
  );
}
