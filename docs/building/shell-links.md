# Shell Links and BP Config Attributes

BetterPortal's shell runtime rewrites service-owned links so services can emit portable, root-relative HTML.

Services should normally render simple links:

```html
<a href="/docs/getting-started/quick-start">Quick Start</a>
```

The shell resolves the owning service, rewrites the request to that service origin, adds HTMX attributes, and keeps the visible browser URL on the BP app route.

If a rewritten anchor is inserted by a later fragment and HTMX misses its normal click initialization, the shell still catches the click and dispatches the same HTMX request. This prevents BP-routed links from falling back to a full browser navigation.

## Dev service reload

On local dev hosts, the shell monitors the currently displayed service's `/.well-known/bp/health` endpoint.

If the service goes unavailable and then comes back, the shell reloads the active BP route into `#bp-main`. This keeps the current page in sync when `npm run dev` restarts the service you are working on.

The same recovery path also runs after connection, 502, 503, or 504 errors for main content requests. The shell waits for the service health check to pass, then retries the route if the browser is still on the same BP path.

The shell root exposes `data-bp-dev-reload="auto"`. Set it to `false` to disable this behavior, or `true` to force it on for a non-local development origin.

## Automatic preload

The Bootstrap theme enables `hx-preload`.

Any preloadable `<a href="...">` gets `hx-preload="mouseover"` by default. This lets the browser warm the route content when users hover or focus links before clicking.

This also applies to links returned later by service fragments, such as profile dropdown links in the top header.

The shell skips preload for:

- empty links
- hash-only links
- `mailto:`
- `tel:`
- `javascript:`
- download links
- links with `target` other than `_self`

## `data-bp-config`

Use `data-bp-config` to control shell behavior for one element or a subtree.

`bp-config` is also accepted as a shorter alias.

Values are semicolon-separated:

```html
<a href="/docs" data-bp-config="preload=false">Docs</a>
```

Boolean options support three equivalent forms:

```html
data-bp-config="preload=false"
data-bp-config="no-preload"
data-bp-config="preload"
```

`no-<key>` means the same thing as `<key>=false`. A bare key means `<key>=true`.

## Options

| Option | Effect |
|---|---|
| `preload` | Enables link preload. This is already the default for anchors. |
| `preload=false` or `no-preload` | Prevents the shell from adding `hx-preload`. |
| `service=<id>` | Resolves this element's root-relative URLs against another registered service id. |
| `rewrite=false` or `no-rewrite` | Leaves URLs untouched, but still allows preload unless disabled. |
| `ignore` | Completely skips shell processing for this element. |

## Examples

Disable preload for a link:

```html
<a href="/reports/export" data-bp-config="no-preload">Export</a>
```

Link to a route owned by another service:

```html
<a href="/admin-services" data-bp-config="service=config-manager">
  Service registry
</a>
```

Leave a URL alone:

```html
<a href="/local-only" data-bp-config="no-rewrite;no-preload">Local only</a>
```

Opt out entirely:

```html
<div data-bp-config="ignore">
  <a href="/untouched">Untouched</a>
</div>
```

## Inheritance

Config applies from ancestors down to children. Child elements can override parent values.

```html
<section data-bp-config="service=docs-site">
  <a href="/docs">Docs</a>
  <a href="/admin-services" data-bp-config="service=config-manager">Admin services</a>
</section>
```

Use this sparingly. Most service content should rely on the normal `data-bp-service` context and root-relative URLs.
