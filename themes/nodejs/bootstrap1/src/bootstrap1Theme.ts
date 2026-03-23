import { createPluginManifest, PluginManifest } from "@betterportal/framework-nodejs";

export interface Bootstrap1ShellContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  bodyHtml: string;
  loginUrl?: string;
  logoutUrl?: string;
}

export const Bootstrap1Manifest: PluginManifest = createPluginManifest({
  pluginId: "theme.betterportal.bootstrap1",
  title: "BetterPortal Bootstrap1 Theme",
  description: "Custom Bootstrap 5 plus HTMX shell for BetterPortal v10.",
  version: "1.0.0",
  category: "theme",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted"],
  capabilities: [
    "theme.shell",
    "theme.bootstrap5",
    "theme.htmx",
    "theme.light-dark"
  ],
  supportedThemes: ["bootstrap1"],
  supportedRenderModes: ["page", "fragment", "embed"],
  views: [],
  configSchemas: [],
  permissions: [],
  adminApis: [],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

function renderShellStyles(mode: "light" | "dark"): string {
  const isDark = mode === "dark";
  return `
    :root {
      --bp-bg: ${isDark ? "#111827" : "#f8fafc"};
      --bp-surface: ${isDark ? "#1f2937" : "#ffffff"};
      --bp-surface-alt: ${isDark ? "#0f172a" : "#eef2f7"};
      --bp-text: ${isDark ? "#f8fafc" : "#0f172a"};
      --bp-text-soft: ${isDark ? "#cbd5e1" : "#475569"};
      --bp-border: ${isDark ? "#334155" : "#dbe2ea"};
      --bp-accent: #0d6efd;
    }
    body {
      background: linear-gradient(180deg, var(--bp-bg), var(--bp-surface-alt));
      color: var(--bp-text);
      min-height: 100vh;
    }
    .bp-shell {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem 3rem;
    }
    .bp-shell__nav {
      background: color-mix(in srgb, var(--bp-surface) 86%, transparent);
      border: 1px solid var(--bp-border);
      border-radius: 1.25rem;
      backdrop-filter: blur(10px);
      margin-bottom: 1.5rem;
      padding: 1rem 1.25rem;
    }
    .bp-shell__panel {
      background: var(--bp-surface);
      border: 1px solid var(--bp-border);
      border-radius: 1.5rem;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 1.5rem;
    }
    .bp-shell__meta {
      color: var(--bp-text-soft);
      font-size: 0.95rem;
    }
    .bp-shell__brand {
      font-weight: 700;
      letter-spacing: 0.02em;
    }
  `;
}

export function renderBootstrap1Shell(context: Bootstrap1ShellContext): string {
  const authLink = context.logoutUrl
    ? `<a class="btn btn-outline-secondary btn-sm" href="${context.logoutUrl}">Sign out</a>`
    : context.loginUrl
      ? `<a class="btn btn-primary btn-sm" href="${context.loginUrl}">Sign in</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="${context.themeMode}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${context.title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
    <style>${renderShellStyles(context.themeMode)}</style>
  </head>
  <body>
    <div class="bp-shell">
      <nav class="bp-shell__nav d-flex align-items-center justify-content-between gap-3">
        <div>
          <div class="bp-shell__brand">${context.brandName}</div>
          <div class="bp-shell__meta">Bootstrap 5 shell with HTMX-first composition</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge text-bg-light border">${context.themeMode}</span>
          ${authLink}
        </div>
      </nav>
      <main class="bp-shell__panel">
        ${context.bodyHtml}
      </main>
    </div>
    <script>
      document.body.addEventListener("htmx:responseError", function (event) {
        console.error("BetterPortal HTMX response error", event.detail);
      });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  </body>
</html>`;
}
