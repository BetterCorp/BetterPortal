/** @jsxImportSource jsx-htmx */
import { css } from "jsx-htmx";
import { createPluginManifest, type PluginManifest, type HtmlRenderable } from "@betterportal/framework";

export interface EmbeddedShellContext {
  title: string;
  assetBaseUrl: string;
  bodyHtml: HtmlRenderable;
  aiManifestUrl?: string;
  automationCatalogUrl?: string;
  managementDiscoveryUrl?: string;
}

export interface EmbeddedRouteLink {
  id: string;
  href: string;
  requestUrl?: string;
  serviceId: string;
  active: boolean;
  error?: string;
}

export interface EmbeddedHostPageContext {
  title: string;
  assetBaseUrl: string;
  initialRouteUrl?: string;
  initialServiceId?: string;
  initialRouteError?: string;
  routeLinks: EmbeddedRouteLink[];
  backgroundServices: Array<{ serviceId: string; origin: string }>;
  aiManifestUrl?: string;
  automationCatalogUrl?: string;
  managementDiscoveryUrl?: string;
}

export const EmbeddedManifest: PluginManifest = createPluginManifest({
  pluginId: "service.betterportal.theme.embedded",
  title: "BetterPortal Embedded Theme",
  description: "Minimal wrapper theme for BetterPortal embed use cases.",
  version: "1.0.0",
  category: "theme",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted"],
  capabilities: ["theme", "theme.embed", "theme.htmx"],
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
        <meta name="htmx-config" content='{"selfRequestsOnly":false,"historyCacheSize":0,"mode":"cors","extensions":"bp-embedded"}' />
        <link rel="llms" href="/llms.txt" />
        <link rel="alternate" type="application/json" title="BetterPortal AI Manifest" href={context.aiManifestUrl ?? "/.well-known/bp/ai.json"} />
        <meta name="betterportal:ai-manifest" content={context.aiManifestUrl ?? "/.well-known/bp/ai.json"} />
        {context.automationCatalogUrl ? <meta name="betterportal:automation-catalog" content={context.automationCatalogUrl} /> : ""}
        {context.managementDiscoveryUrl ? <meta name="betterportal:management-discovery" content={context.managementDiscoveryUrl} /> : ""}
        <title>{context.title}</title>
        <script src={`${context.assetBaseUrl}/embedded-core.js`} defer></script>
        <style>{css({
          "html, body": {
            width: "100%",
            height: "100%",
            margin: 0,
            padding: 0,
            background: "transparent"
          },
          "body.shell-embed": {
            width: "100%",
            minHeight: "100%",
            overflow: "hidden"
          },
          ".bp-embedded": {
            width: "100%",
            height: "100%",
            minHeight: "100%",
            position: "relative"
          },
          ".bp-embedded__main": {
            width: "100%",
            height: "100%",
            minHeight: "100%",
            position: "relative"
          },
          ".bp-embedded__loader": {
            width: "100%",
            minHeight: "12rem",
            display: "grid",
            placeItems: "center",
            color: "#64748b",
            font: "14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          },
          ".bp-embedded__error": {
            boxSizing: "border-box",
            width: "100%",
            padding: "1rem",
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            font: "14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          },
          ".bp-embedded__loading": {
            opacity: "0.72",
            transition: "opacity 120ms ease"
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

function buildServiceMap(routeLinks: EmbeddedRouteLink[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const route of routeLinks) {
    if (route.serviceId && !map[route.serviceId]) {
      try {
        if (!route.requestUrl) continue;
        map[route.serviceId] = new URL(route.requestUrl).origin;
      } catch {
        continue;
      }
    }
  }
  return map;
}

function EmbeddedBody(context: EmbeddedHostPageContext): HtmlRenderable {
  const serviceMap = buildServiceMap(context.routeLinks);
  const hasInitialRouteError = Boolean(context.initialRouteError);
  return (
    <div
      class="bp-embedded"
      data-bp-embedded-root=""
      data-bp-services={JSON.stringify(serviceMap)}
      data-bp-background-services={JSON.stringify(context.backgroundServices)}
      data-bp-initial-service={context.initialServiceId}
      hx-ext="bp-embedded"
    >
      <div data-bp-background-fragments="" hidden></div>
      <div
        class="bp-embedded__main"
        data-bp-main-outlet=""
        data-bp-service={context.initialServiceId}
        hx-get={context.initialRouteUrl ?? ""}
        hx-trigger={context.initialRouteUrl && !hasInitialRouteError ? "load" : undefined}
        hx-target="this"
        hx-swap="innerHTML"
      >
        {hasInitialRouteError ? (
          <div class="bp-embedded__error">{context.initialRouteError}</div>
        ) : (
          <div class="bp-embedded__loader">Loading</div>
        )}
      </div>
    </div>
  );
}

export function renderEmbeddedHostPage(context: EmbeddedHostPageContext): string {
  return renderEmbeddedShell({
    title: context.title,
    assetBaseUrl: context.assetBaseUrl,
    aiManifestUrl: context.aiManifestUrl,
    automationCatalogUrl: context.automationCatalogUrl,
    managementDiscoveryUrl: context.managementDiscoveryUrl,
    bodyHtml: EmbeddedBody(context)
  });
}
