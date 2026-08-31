# Shell services and themes

Shell services render the BetterPortal host page and provide the visual theme. The shell service identity and its service-view renderer compatibility key are separate contracts.

Bootstrap1 declares `shell: { service: "bootstrap1", renderer: "bootstrap5" }`. Its stable shell identity remains `bootstrap1`; any service renderer compatible with Bootstrap 5 uses `_renderer.bootstrap5`.

## Shell responsibilities

A shell owns:

- shell layout
- navigation
- brand display
- theme assets
- theme configuration UI
- theme fragments and fragment blocks
- presentation hooks for loading, errors, swaps, and component lifecycle

It does not own service page content.

## Theme configuration ownership

The theme declares its BP configuration schema and defaults. Config Manager stores tenant defaults and optional app overrides through the service configuration API. Resolution is app override, then tenant default, then the theme's declared default. `sec-config.yaml` is process configuration and is not an app branding or palette source.

Bootstrap1 and Bootstrap2 map the effective BP values into Bootstrap semantic colors, brand name, browser title, logos, favicon, and mode. Service pages must not emit document titles, favicons, global logos, theme-mode scripts, or palette overrides; use `ViewRenderContext` only for page-local presentation.

## Shared Node shell runtime

Node shells use `@betterportal/theme-runtime` for shell behavior. The package owns service and tenant URL rewriting, managed BP headers, header-aware preload, HTMX request/response handling, generic route chrome state, SSE, history, auth failures, downloads, and `bp-element` lifecycle states.

The shared runtime automatically upgrades plain internal `<a href="/route">` links and forms using native GET or POST to HTMX requests owned by the rendering service. A bare `<form>` posts to the current service view. Put `bp-no-override` or `data-bp-no-override` on an element or ancestor when native browser navigation/submission is intentional; `data-bp-no-route` remains the shell-owned equivalent. External links/forms and unsupported form methods stay native.

The runtime also propagates one per-document correlation ID as W3C baggage. Shell HTML should include `<meta name="betterportal:session-id" content="<uuidv7>">` using the request session supplied by the framework. If it is absent, the runtime generates a browser fallback; that fallback cannot correlate the initial document request. The runtime exposes the active value on `document.documentElement.dataset.bpSessionId`. Do not store it in cookies or browser storage, sign it as a JWT, or treat it as security context.

The runtime is assembled on the backend in deterministic order: HTMX core, the shell adapter, the BetterPortal shell, and the bundled SSE extension. Browsers never discover or dynamically load HTMX extensions. A missing required asset fails during backend bundle creation.

Write adapters as TSX and use `jsx-htmx`'s typed `js()` helper:

BetterPortal v10 currently uses the exact `jsx-htmx` version `4.0.0-beta6`. Pin that version rather than installing npm's `latest` v2 release until jsx-htmx v4 is promoted to its stable channel.

```tsx
import { js } from "jsx-htmx";
import type { BetterPortalShellAdapter } from "@betterportal/theme-runtime";

export const MyShellAdapterSource = js(() => {
  window.BetterPortalShellAdapter = {
    setLoading(loading, outlet) {
      outlet?.classList.toggle("is-loading", loading);
    }
  } satisfies BetterPortalShellAdapter;
});
```

`js()` returns safe `RawText`. Pass it directly as `adapterSource` or place it directly in a `<script>` element; do not call `.toString()` or wrap it with `raw()`.

The optional `showRequestError(status, content, context)` hook receives the initiating `serviceId`. Error UI rendered outside the main outlet must retain that service context so relative HTMX actions continue to resolve to the service that produced the response.

The server emits initial chrome with `betterPortalChromeAttributes(currentRoute?.chrome)`. The browser runtime applies response `bp-chrome-*` values as `data-bp-chrome-*`, removes stale values, and calls the optional typed `applyChrome` hook. Prefer theme CSS for chrome presentation; use the hook only when the theme needs imperative behavior. Chrome is presentation state and never implies authentication.

Theme packages keep their public asset URLs and provide only presentation hooks. Bootstrap1 owns Bootstrap modal/offcanvas and component lifecycle behavior; Embedded owns its loading and error presentation. The required HTMX extension allowlist is `bp-shell, sse`. BetterPortal's header-aware preload is part of `bp-shell`; do not also load the stock preload extension.

In a theme's `package.json`, declare `@betterportal/theme-runtime` but not `htmx.org`; the runtime owns and bundles the browser HTMX package. The runtime imports `jsx-htmx`, but a theme that directly imports `jsx-htmx` for TSX must declare it directly rather than relying on a transitive dependency.

## Shell contract and fragments

The shell manifest is authoritative:

```ts
manifest: {
  shell: { service: "my-shell", renderer: "bootstrap5", fragments: [] }
}
```

The control plane persists only `app.shell.serviceId`. Scoped, read-only service context includes the resolved `app.shell = { serviceId, service, renderer }`. Services must not accept a client-selected renderer; browser context comes from Origin/Referer/effective host, while verified S2S envelopes carry tenant/app scope.

Declare the shell directory in `package.json`:

```json
{ "betterportal": { "shells": ["src/plugins/my-theme/shell"] } }
```

Codegen recognizes only these top-level forms:

```text
shell/
  _theme-selector.tsx  # singular, independently addressable fragment
  _nav/
    index.tsx          # ordered fragment block
```

A singular file exports `title`, `description`, and `render(ctx)`. A block also exports `defaultItems`, and its `render(ctx)` places `ctx.items`. Missing app configuration uses the shell default; `mode: "none"` is an explicit empty value; singular overrides and block items may reference service fragments. Settings are stored under the active shell service-instance UUID, so changing shells changes the available definitions without destroying the previous shell's dormant settings. An app with no shell has no shell fragments.

```tsx
import type { HtmlRenderable, ShellFragmentRenderContext } from "@betterportal/framework";

export const title = "Topbar fragments";
export const description = "Ordered content shown in the topbar.";
export const defaultItems = ["theme-selector"];

export function render(ctx: ShellFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
```

`ShellFragmentRenderContext` supplies the tenant, app, shell service configuration, request URL, fragment id, and server-resolved block items. Cross-service URLs are not constructed by shell code. Service views reuse a singular active-shell fragment with `<BPElement ctx={ctx} service="shell" fragment="theme-selector" />`; a successful response inserts directly when `bp-ok` is omitted. See [Routes and views](./routes-and-views.md).

There is no reserved `background` location and no browser-side fragment discovery. A theme that needs a background block declares `_background/index.tsx` explicitly.

## Service renderers

Each service view chooses renderer contracts by adding renderer folders:

```text
_renderer.bootstrap5/
  GET.tsx
  POST.tsx
  POST.422.tsx
```

Renderers are method/status-specific. The folder suffix is the shell's `renderer`, not its `service` identity. If a view does not provide an exact renderer match for the resolved app shell and request method/status, the service returns `406`; there is no fallback.

For Bootstrap1, the shell already provides the route header context. Service renderers should not add duplicate top-level page headings such as `<h1 class="h4 mb-3">Templates</h1>` unless that heading is part of the service content itself.

## Navigation belongs to the app

Service pages should not create their own persistent side navigation when the BP shell already provides navigation.

Use the app menu in `bp-config.yaml` for product-level navigation, and keep service pages focused on content and workflows.

## Service route links

Service HTML should use `{view.id}` tokens for service-owned links and HTMX paths:

```html
<a hx-get="{profile.summary}">Profile</a>
```

The framework rewrites those tokens to service route paths before sending HTML. Do not emit absolute service URLs from renderers.
