/** @jsxImportSource jsx-htmx */
import { css } from "jsx-htmx";
import { createPluginManifest, type PluginManifest, type HtmlRenderable } from "@betterportal/framework-nodejs";

export interface EmbeddedShellContext {
  title: string;
  bodyHtml: HtmlRenderable;
}

export const EmbeddedManifest: PluginManifest = createPluginManifest({
  pluginId: "theme.betterportal.embedded",
  title: "BetterPortal Embedded Theme",
  description: "Minimal wrapper theme for BetterPortal embed use cases.",
  version: "1.0.0",
  category: "theme",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted"],
  capabilities: ["theme.embed", "theme.htmx", "theme.bootstrap5"],
  supportedThemes: ["embedded"],
  supportedRenderModes: ["fragment", "embed"],
  views: [],
  configSchemas: [],
  permissions: [],
  adminApis: [],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

function EmbeddedDocument(context: EmbeddedShellContext): HtmlRenderable {
  return (
    <html lang="en">
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
        <style>{css({
          "body.shell-embed": {
            margin: 0,
            background: "transparent",
            padding: 0
          }
        })}</style>
      </head>
      <body class="shell-embed">{context.bodyHtml}</body>
    </html>
  );
}

export function renderEmbeddedShell(context: EmbeddedShellContext): string {
  return `<!DOCTYPE html>${EmbeddedDocument(context)}`;
}
