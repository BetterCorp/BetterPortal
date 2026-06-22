# Fragment HTML Conventions

**Version:** `bp-protocol/1`

This document specifies the HTML conventions a BetterPortal service MUST follow when emitting fragment, page, or component HTML for any theme. The browser-side rewriter (in the theme) depends on these conventions to absolutize URLs, route navigation, and rebind HTMX after swap.

## 1. Origins and URL resolution

### 1.1 Server emits **only** relative URLs

In every HTML response, all of the following MUST be root-relative paths (starting with `/`), not absolute URLs:

- `<a href="...">`
- `hx-get`, `hx-post`, `hx-put`, `hx-patch`, `hx-delete`
- `hx-sse:connect`, `sse-connect` (legacy)
- `<script src="...">`, `<img src="...">`, `<link href="...">` for resources owned by the service
- `hx-push-url` (always public path, no origin)

The client rewriter resolves them to absolute service-origin URLs at swap time.

### 1.2 Every interactive element MUST have service context

The client rewriter resolves root-relative URLs against the service that produced the HTML. The service URL is the authority; the theme origin is never the fallback target for service-owned HTML.

For normal service-rendered HTML, the theme wraps the response with a service context such as `data-bp-service="<bindingId>"`. The rewriter uses that context and the `data-bp-services="{...}"` JSON on the shell root to resolve `bindingId -> origin`.

Services do not control the shell root. They control fragment HTML. Therefore:

- Fragment responses MUST be wrapped in an element with `data-bp-service="<own-bindingId>"` if the fragment will be inserted into a context where no ancestor provides it.
- OR the theme inserts fragments inside a placeholder that already carries `data-bp-service`. The bootstrap1 theme does this; services SHOULD assume it.

When in doubt, set `data-bp-service` on the outermost element of the fragment.

If an element or subtree intentionally talks to another registered service, set an explicit service override:

```html
<section bp-service-id="service.betterportal.docs-site">
  <a href="/docs">Docs</a>
</section>
```

`bp-service-id`, `data-bp-service-id`, and `data-bp-config="service=<id>"` are equivalent service-context overrides. Use them for direct cross-service fragments/forms/widgets. Do not make the URL absolute by hand.

### 1.3 Cross-service route links

A link to another service's view (e.g., a hello-view fragment containing a Settings link to config-manager) uses the destination's **public path**, with no special hint:

```html
<a href="/settings">Settings</a>
```

The rewriter matches the path against the known route map and rewrites both the `href` (to the tenant path) and adds `hx-get` (to the service URL). The author does not need to know which service serves `/settings`.

Use route-map resolution for navigation links. Use `bp-service-id`/`data-bp-config="service=<id>"` when the element is not route navigation and the request should be executed directly against a specific service.

## 2. Shell elements (theme-owned)

Themes own these elements; services MUST NOT emit duplicates. Services MAY rely on their presence in the page DOM:

| Selector | Purpose |
|---|---|
| `#bp-main` | Primary content outlet for full-page swaps. |
| `[data-bp-shell-root]` | Root of the shell; carries `data-bp-services="{...}"`. |
| `[data-bp-route-link]` | Nav link with `data-bp-route-request`, `data-bp-service`, `data-bp-route-title`. |
| `[data-bp-current-title]` | Where the active route's title is mirrored. |
| `[data-bp-current-breadcrumb]` | Where the breadcrumb is mirrored. |
| `[data-bp-fragment]` / `[data-bp-fragment-location]` | Fragment placeholders. |
| `[data-bp-no-route]` | Element opted out of URL rewriting (set by themes on shell internals like style and brand). |

## 3. HTMX attributes

### 3.1 Targeted (contextual) requests

A button that swaps content into a specific element:

```html
<button
  hx-get="/items?_f=nav.refresh"
  hx-target="#some-region"
  hx-swap="innerHTML">Refresh</button>
```

The rewriter sees `hx-target` and treats this as a contextual swap: it absolutizes the URL but does not add navigation behavior.

### 3.2 Untargeted (navigation) requests

A button that should navigate the main outlet:

```html
<button hx-get="/orders/42">View order 42</button>
```

The rewriter sees no `hx-target`, treats this as full-page navigation, and:

1. Resolves `/orders/42` against the route map (finds `/orders/:orderId` on the orders service).
2. Sets `href` and `hx-push-url` to the tenant path.
3. Adds `hx-target="#bp-main"` and `hx-swap="innerHTML"`.
4. Tags the element with `data-bp-shell-route="page"`.

For best results, services SHOULD use plain anchors:

```html
<a href="/orders/42">View order 42</a>
```

The rewriter upgrades anchors into HTMX-boosted nav automatically when the path is in-tenant. External anchors (with `target="_blank"`, `download`, `mailto:`, etc.) are skipped.

### 3.3 Forms

POST/PUT/PATCH/DELETE forms work the same:

```html
<form hx-post="/orders" hx-target="#order-list" hx-swap="outerHTML">
  <input name="qty" type="number" />
  <button type="submit">Add</button>
</form>
```

### 3.4 SSE

For an SSE-connected element:

```html
<span hx-ext="sse" hx-sse:connect="/items/__sse?_f=nav.refresh">Loading...</span>
```

The rewriter rewrites `hx-sse:connect` to the absolute service URL. See `sse.md`.

## 4. Live-refresh via `HX-Trigger`

The platform-wide live-refresh primitive. A mutation endpoint emits a response header:

```
HX-Trigger: bp:menu-changed
```

The theme renders passive regions (sidebar nav, topbar brand, fragments) that listen for these events:

```html
<nav
  id="bp-nav-desktop"
  hx-get="/.well-known/bp/theme/nav"
  hx-trigger="bp:menu-changed from:body"
  hx-swap="innerHTML"
  data-bp-no-route="">
  ...
</nav>
```

When the event fires (after htmx receives the `HX-Trigger` header), the element re-fetches itself.

### 4.1 Standard event names

| Event | Emitted by | Re-fetched by |
|---|---|---|
| `bp:menu-changed` | Menu editor save endpoints | Theme sidebar nav |
| `bp:fragments-changed` | Fragments editor save endpoints | Theme topbar/footer fragment wrappers |
| `bp:theme-changed` | Theme designer save endpoint | Theme `<style>` and brand elements |
| `bp:config-saved` | Any service config write | Optional toast / UI feedback |

Services and themes MAY define additional events with the `bp:` prefix. Non-reserved prefixes (e.g., `mycorp:`) are allowed.

### 4.2 Cross-origin trigger reception

For `HX-Trigger` to be readable cross-origin, the response MUST include the trigger headers in `Access-Control-Expose-Headers`. See `protocol.md` section 2.

## 5. Boolean attributes and special markers

### 5.1 `data-bp-no-route`

Opt-out for shell-internal elements that should never be processed by the rewriter:

```html
<div hx-get="/.well-known/bp/theme/brand"
     hx-trigger="bp:theme-changed from:body"
     hx-swap="innerHTML"
     data-bp-no-route="">{brandName}</div>
```

Use sparingly. Service fragments should not need this.

### 5.2 `data-htmx-powered`

Set by HTMX after `htmx.process()` runs on an element. Services MUST NOT set it manually.

### 5.3 `data-bp-shell-route`

Set by the client rewriter to track which elements it has processed. Values: `"page"`, `"ctx"` (contextual), `"asset"`, `"sse"`. Services MUST NOT set this manually.

## 6. Content modes

The same view path can return three different HTML shapes:

| `Accept` header / query | Response |
|---|---|
| `text/html; mode=page` (default) | Full body content. NO `<html>`, `<head>`, or `<body>` wrappers - the theme provides those. |
| `text/html; mode=fragment` (HTMX request) | Same content as `page` but optimized for swap (skip heavy decorations). |
| `text/html; mode=fragment` + `?_f=loc.id` | ONLY the fragment HTML for the given location/id. |
| `text/html; mode=fragment` + `?_c=componentId` | ONLY the component HTML. |
| `text/html; mode=embed` | Embed mode (third-party). MAY include more decoration than `page`. |

In every mode, the rules above (relative URLs, `data-bp-service` context) apply.

## 7. CSS and JS in fragments

- Fragments SHOULD NOT load CSS or JS via `<link>` or `<script>` tags. Use the theme's bundled assets.
- Inline `<style>` is allowed but discouraged. Prefer theme-provided utility classes.
- Inline `<script>` is allowed for one-off behaviors (e.g., color picker sync). Avoid for anything reusable.

## 8. Anti-patterns

The following are non-conformant:

- Hard-coded absolute URLs (`http://localhost:3200/...`) in any attribute.
- Fragments that wrap themselves in `<html>` or `<body>`.
- iframes around BetterPortal content.
- Inline event handlers (`onclick="..."`) for HTMX-equivalent behavior (use `hx-on::click`, `hx-get`, etc.).
- Client-side JS that re-fetches content with `fetch()` directly instead of HTMX. The exception is browser-side helpers that synthesize HTMX requests (e.g., drag-and-drop firing `form.requestSubmit()`).

## 9. Examples

### 9.1 Fragment with cross-service link

A profile dropdown rendered by `hello-view`, inserted into a placeholder with `data-bp-service="hello-view"`:

```html
<div class="dropdown">
  <button data-bs-toggle="dropdown">...</button>
  <ul class="dropdown-menu">
    <li><a class="dropdown-item" href="/config-admin">Settings</a></li>
  </ul>
</div>
```

Rewriter result (in DOM after processing):

```html
<a class="dropdown-item"
   href="/settings"
   data-bp-shell-route="page"
   hx-get="http://localhost:3300/config-admin"
   hx-target="#bp-main"
   hx-swap="innerHTML"
   hx-push-url="/settings">Settings</a>
```

### 9.2 Page response

`hello-view` rendering its main view:

```html
<section class="container-fluid">
  <h1>Hello, World</h1>
  <a href="/sales">Go to sales</a>
  <button hx-get="/items/refresh" hx-target="#items">Refresh</button>
  <div id="items">...</div>
</section>
```

All paths relative. `data-bp-service="hello-view"` provided by the main outlet ancestor.

### 9.3 SSE-connected element

```html
<div class="d-inline-flex align-items-center gap-2">
  <span class="badge bg-success rounded-circle p-1"></span>
  <span class="font-monospace small"
        hx-ext="sse"
        hx-sse:connect="/hello/__sse?_f=nav.clock">--:--:--</span>
</div>
```

After processing: `hx-sse:connect` becomes absolute, ext consumes the stream, span innerHTML updates per message.
