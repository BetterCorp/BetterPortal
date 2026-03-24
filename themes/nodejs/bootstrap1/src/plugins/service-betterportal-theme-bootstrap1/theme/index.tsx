/** @jsxImportSource jsx-htmx */
import { createPluginManifest, type PluginManifest, type HtmlRenderable } from "@betterportal/framework-nodejs";

export interface Bootstrap1ShellContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  bodyHtml: HtmlRenderable;
  loginUrl?: string;
  logoutUrl?: string;
}

export interface Bootstrap1HostPageContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  helloServiceOrigin: string;
  defaultName: string;
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

function shellStyles(mode: "light" | "dark"): string {
  const isDark = mode === "dark";
  return `
    :root {
      color-scheme: ${isDark ? "dark" : "light"};
      --bp-bg: ${isDark ? "#0b1220" : "#f3f6fb"};
      --bp-surface: ${isDark ? "#111827" : "#ffffff"};
      --bp-surface-alt: ${isDark ? "#0f172a" : "#e8eef6"};
      --bp-text: ${isDark ? "#f8fafc" : "#0f172a"};
      --bp-text-soft: ${isDark ? "#94a3b8" : "#526277"};
      --bp-border: ${isDark ? "#243244" : "#d6deea"};
      --bp-accent: #0d6efd;
      --bp-accent-soft: ${isDark ? "rgba(13,110,253,0.18)" : "rgba(13,110,253,0.10)"};
      --bp-shadow: ${isDark ? "0 28px 72px rgba(2, 6, 23, 0.45)" : "0 28px 72px rgba(15, 23, 42, 0.12)"};
    }
    html, body {
      margin: 0;
      min-height: 100%;
      background:
        radial-gradient(circle at top, rgba(13, 110, 253, 0.12), transparent 32%),
        linear-gradient(180deg, var(--bp-bg), var(--bp-surface-alt));
      color: var(--bp-text);
    }
    body {
      font-family: "Inter", "Segoe UI", sans-serif;
    }
    .bp-shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
    }
    .bp-shell__nav {
      background: color-mix(in srgb, var(--bp-surface) 88%, transparent);
      border: 1px solid var(--bp-border);
      border-radius: 1.5rem;
      box-shadow: var(--bp-shadow);
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      backdrop-filter: blur(14px);
    }
    .bp-shell__panel {
      background: color-mix(in srgb, var(--bp-surface) 94%, transparent);
      border: 1px solid var(--bp-border);
      border-radius: 1.75rem;
      box-shadow: var(--bp-shadow);
      padding: 1.5rem;
    }
    .bp-shell__brand {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .bp-shell__meta {
      color: var(--bp-text-soft);
      font-size: 0.95rem;
    }
    .bp-shell__hero {
      display: grid;
      gap: 1.5rem;
    }
    .bp-shell__grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .bp-shell__card {
      background: var(--bp-surface);
      border: 1px solid var(--bp-border);
      border-radius: 1.25rem;
      padding: 1.1rem;
      height: 100%;
    }
    .bp-shell__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border-radius: 999px;
      background: var(--bp-accent-soft);
      color: var(--bp-accent);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.45rem 0.85rem;
    }
    .bp-fragment-slot {
      min-height: 180px;
      border: 1px dashed var(--bp-border);
      border-radius: 1.25rem;
      padding: 1.25rem;
      background: color-mix(in srgb, var(--bp-surface-alt) 72%, var(--bp-surface));
    }
    .bp-loading {
      color: var(--bp-text-soft);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    @media (max-width: 768px) {
      .bp-shell {
        padding: 1rem 0.75rem 2rem;
      }
      .bp-shell__panel {
        padding: 1rem;
      }
    }
  `;
}

function AuthLink(props: { loginUrl?: string; logoutUrl?: string }): string {
  if (props.logoutUrl) {
    return String(<a class="btn btn-outline-secondary btn-sm" href={props.logoutUrl}>Sign out</a>);
  }

  if (props.loginUrl) {
    return String(<a class="btn btn-primary btn-sm" href={props.loginUrl}>Sign in</a>);
  }

  return "";
}

function Bootstrap1Document(context: Bootstrap1ShellContext): HtmlRenderable {
  return (
    <html lang="en" data-bs-theme={context.themeMode}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="htmx-config" content='{"selfRequestsOnly": false}' />
        <title>{context.title}</title>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <style>{shellStyles(context.themeMode)}</style>
      </head>
      <body>
        <div class="bp-shell">
          <nav class="bp-shell__nav d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
              <div class="bp-shell__brand">{context.brandName}</div>
              <div class="bp-shell__meta">Bootstrap 5 shell with HTMX-first composition</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge rounded-pill text-bg-light border text-dark text-uppercase">
                {context.themeMode}
              </span>
              <AuthLink loginUrl={context.loginUrl} logoutUrl={context.logoutUrl} />
            </div>
          </nav>
          <main class="bp-shell__panel">{context.bodyHtml}</main>
        </div>
        <script>
          {`
            document.body.addEventListener("htmx:responseError", function (event) {
              console.error("BetterPortal HTMX response error", event.detail);
            });
          `}
        </script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  );
}

function Bootstrap1LandingBody(context: Bootstrap1HostPageContext): HtmlRenderable {
  const fragmentUrl = `${context.helloServiceOrigin}/hello?name=${encodeURIComponent(context.defaultName)}`;

  return (
    <div class="bp-shell__hero">
      <section class="row g-4 align-items-center">
        <div class="col-12 col-lg-7">
          <span class="bp-shell__badge mb-3">HTMX-first micro frontend shell</span>
          <h1 class="display-5 fw-semibold mb-3">
            BetterPortal Bootstrap1
          </h1>
          <p class="lead text-secondary mb-4">
            This theme is running as a BSB service. It serves the shell and lets HTMX fetch the
            business fragment directly from the example service.
          </p>
          <div class="d-flex gap-2 flex-wrap">
            <a class="btn btn-primary" href={fragmentUrl} target="_blank" rel="noreferrer">
              Open service HTML
            </a>
            <a class="btn btn-outline-secondary" href={`${context.helloServiceOrigin}/manifest`} target="_blank" rel="noreferrer">
              Service manifest
            </a>
          </div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="bp-shell__card">
            <div class="text-secondary small text-uppercase fw-semibold mb-2">Remote fragment</div>
            <div
              id="bp-fragment-slot"
              class="bp-fragment-slot"
              hx-get={fragmentUrl}
              hx-trigger="load"
              hx-target="#bp-fragment-slot"
              hx-swap="innerHTML"
              hx-headers={{ Accept: "text/html; theme=bootstrap1; mode=fragment" }}
            >
              <div class="bp-loading">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>Loading hello-view from {context.helloServiceOrigin}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="bp-shell__grid">
        <div class="bp-shell__card">
          <div class="text-secondary text-uppercase small fw-semibold mb-2">Theme</div>
          <h2 class="h5 mb-2">Bootstrap 5, modern and minimal</h2>
          <p class="mb-0 text-secondary">
            Light and dark-ready shell styling, scoped shell classes, and HTMX loaded once by the theme.
          </p>
        </div>
        <div class="bp-shell__card">
          <div class="text-secondary text-uppercase small fw-semibold mb-2">Runtime</div>
          <h2 class="h5 mb-2">BSB started</h2>
          <p class="mb-0 text-secondary">
            Start this package with <code>npm run start</code>. No custom demo process is required.
          </p>
        </div>
        <div class="bp-shell__card">
          <div class="text-secondary text-uppercase small fw-semibold mb-2">Composition</div>
          <h2 class="h5 mb-2">Direct plugin calls</h2>
          <p class="mb-0 text-secondary">
            The browser calls the example service directly, matching the BetterPortal v10 direction.
          </p>
        </div>
      </section>
    </div>
  );
}

export function renderBootstrap1Shell(context: Bootstrap1ShellContext): string {
  return `<!DOCTYPE html>${Bootstrap1Document(context)}`;
}

export function renderBootstrap1HostPage(context: Bootstrap1HostPageContext): string {
  return renderBootstrap1Shell({
    title: context.title,
    brandName: context.brandName,
    themeMode: context.themeMode,
    bodyHtml: Bootstrap1LandingBody(context),
    loginUrl: context.loginUrl,
    logoutUrl: context.logoutUrl
  });
}
