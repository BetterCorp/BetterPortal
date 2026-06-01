import { App, Tenant } from "../contracts/binding.js";
import { toHtmlString } from "./http.js";
import { NegotiatedViewResponse } from "./view.js";

export interface ShellThemeContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  bodyHtml: string;
  loginUrl?: string;
  logoutUrl?: string;
}

export type ShellRenderer = (context: ShellThemeContext) => string;

export interface ComposeShellInput {
  tenant: Tenant;
  app: App;
  response: NegotiatedViewResponse;
  renderShell: ShellRenderer;
  mode?: "light" | "dark";
  loginUrl?: string;
  logoutUrl?: string;
}

export function composeShellPage(input: ComposeShellInput): NegotiatedViewResponse {
  if (!input.response.contentType.startsWith("text/html")) {
    return input.response;
  }

  const bodyHtml = toHtmlString(input.response.body ?? "");

  return {
    status: input.response.status,
    contentType: input.response.contentType,
    body: input.renderShell({
      title: input.app.title,
      brandName: input.tenant.title,
      themeMode: input.mode ?? "light",
      bodyHtml,
      loginUrl: input.loginUrl,
      logoutUrl: input.logoutUrl
    })
  };
}
