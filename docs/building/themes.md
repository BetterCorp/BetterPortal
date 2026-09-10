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

The configuration flow is: theme-declared schema/defaults → tenant values → app overrides → shell CSS variables and component styles → service HTML. Configure branding through the selected theme's service configuration UI/API in Config Manager. Services inherit the resulting CSS; they do not need to fetch palette values or add branding fields to their response schemas.

Field names and extra color roles belong to each theme. `apps[].themeConfig.bootstrap` is a compatibility configuration shape, not a universal palette specification. Sharing the `bootstrap5` renderer makes markup compatible; it does not make Bootstrap1, Bootstrap2 and custom Bootstrap themes visually identical. Read the active theme's manifest and resources before choosing tokens or components.

### Semantic colors and component states

Choose a role based on meaning, not on its current hex value:

| Intent | Bootstrap-compatible markup | Meaning |
| --- | --- | --- |
| Principal action | `.btn.btn-primary` | The theme's primary action treatment; not necessarily blue |
| Supporting text | `.text-body-secondary`, `.form-text` | Lower-emphasis text; distinct from the secondary brand color |
| Positive status | `.alert.alert-success` with text | A successful outcome, not decorative brand emphasis |
| Warning | `.alert.alert-warning` with text | Attention required |
| Destructive action | `.btn.btn-danger` or `.btn.btn-outline-danger` | A destructive action with an explicit label |
| Input | `.form-control`, `.form-select` | Coordinated text, surface, border, focus and disabled styling |

Prefer complete component classes over assembling unrelated foreground/background utilities. Do not assume a white label contrasts with every configured primary color, or that `secondary` means muted text. Color alone must not convey state.

For custom local presentation, consume the active theme's documented tokens. Bootstrap1 and Bootstrap2 currently expose these roles:

| CSS variable | Role |
| --- | --- |
| `--bp-bg` | Page background |
| `--bp-surface`, `--bp-surface-alt` | Primary and alternate surfaces |
| `--bp-text`, `--bp-text-soft` | Main and supporting text |
| `--bp-border` | Border color |
| `--bp-accent`, `--bp-accent-secondary` | Primary and secondary accents |
| `--bp-accent-success`, `--bp-accent-info`, `--bp-accent-warning`, `--bp-accent-danger` | Semantic status accents |

These are theme-specific CSS contracts, not universal tokens for Embedded or third-party themes. Bootstrap1/2 also emit `--bs-*` semantic colors and style components directly; do not assume stock Bootstrap variables alone describe the final computed component style. Service-local CSS may use documented role variables, but must not redefine root tokens, replace the palette or load another Bootstrap/font asset.

### Appearance mode and contrast

The shell owns light/dark/system preference, persistence, mode-specific surfaces, text and logos. Bootstrap shells set `data-bs-theme` and generate the effective mode's styles. Reuse a declared `theme-selector` shell fragment when needed. A service must not set document appearance, add its own theme switch/storage or install a separate `prefers-color-scheme` controller.

Check light/dark modes with the effective app palette, including select options, placeholders, read-only/disabled controls, hover and keyboard focus. If defaults are unreadable, inspect configuration and computed styles and reproduce with an unmodified themed component. Report the failing pairing to the theme owner instead of adding hardcoded colors or `!important` patches in each service view.

## Shared Node shell runtime

Node shells use `@betterportal/theme-runtime` for shell behavior. The package owns service and tenant URL rewriting, managed BP headers, header-aware preload, HTMX request/response handling, generic route chrome state, SSE, history, auth failures, downloads, and `bp-element` lifecycle states.

The shared runtime automatically upgrades plain internal `<a href="/route">` links and forms using native GET or POST to HTMX requests owned by the rendering service. A bare `<form>` posts to the current service view. Put `bp-no-override` or `data-bp-no-override` on an element or ancestor when native browser navigation/submission is intentional; `data-bp-no-route` remains the shell-owned equivalent. External links/forms and unsupported form methods stay native.

The runtime also propagates one per-document correlation ID as W3C baggage. Shell HTML should include `<meta name="betterportal:session-id" content="<uuidv7>">` using the request session supplied by the framework. If it is absent, the runtime generates a browser fallback; that fallback cannot correlate the initial document request. The runtime exposes the active value on `document.documentElement.dataset.bpSessionId`. Do not store it in cookies or browser storage, sign it as a JWT, or treat it as security context.

The runtime is assembled on the backend in deterministic order: HTMX core, the shell adapter, the BetterPortal shell, and the bundled SSE extension. Browsers never discover or dynamically load HTMX extensions. A missing required asset fails during backend bundle creation.

Write adapters as TSX and use `jsx-htmx`'s typed `js()` helper:

BetterPortal v10 uses the exact stable `jsx-htmx` version `4.0.0`.

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

## Guidance for generated service views

Every theme serves the shared view-authoring rules through `/llms-ui.txt`, followed by links to its own UI guide, skill and templates. `/llms.txt` and the AI manifest also link to `/llms-drop.txt` for tools that need a single full local export. It combines the guides, theme resources and theme schemas with full source URLs, separate framework/theme versions, UTC export time and expiry; remote service schemas remain linked to their authoritative sources. Node themes using `BPService` receive the endpoint automatically with the framework/plugin update, including custom themes. Standalone Node shells pass an app-context resolver as `llmsContext` to `registerBpWellKnownRoutes`; the shell manifest and generated schema supply the exported resources/contracts. See the [drop contract](../../spec/ai.md#7-full-llm-drop). `/llms-dev.txt` links to these rules too. Keep theme resources consistent with this shared guidance.

Views render typed handler data, semantic controls, theme components and HTMX attributes. Formatting, conditional presentation and small local widgets belong here. Authorization, business defaults, eligibility rules, authoritative validation, calculations, persistence and report generation belong in method handlers or typed domain helpers. HTML constraints and hidden inputs do not enforce a business policy.

### Initialization must not submit

A view can be inserted on initial load, an HTMX swap, history navigation or a prefetched navigation. Initialization and draft restoration must not submit a form or replay a mutation. Keep recalculation and final submission as explicit handler intents with appropriate server validation. User changes may trigger recalculation; loading the same markup must not simulate user changes. Do not leave action flags behind after failed validation or cancellation.

Prefer native forms, HTMX triggers, `hx-indicator` and HTMX 4 `hx-disable`. Use the installed runtime's event names when a local interaction needs them: `htmx:before:request` and `htmx:finally:request`, not HTMX 2 camelCase names. Service views must not inject HTMX, inline extension files, register extensions or add unsupported `hx-ext` values. Match the published input schema and supported form encoding; report serialization gaps upstream.

For necessary local JavaScript, use typed `jsx-htmx` `js(() => ...)` and pass its safe result directly. Avoid generated script strings and custom escaping helpers. Bind once to the owned component, scope selectors to it, and clean up listeners/timers when removed. Do not install global submission functions or a second document-wide request/error lifecycle from swapped content.

### Preserve HTML5 form validation

The backend input schema defines the constraints. Render its browser-expressible rules as appropriate `type`, `required`, `min`, `max`, `step`, `minlength`, `maxlength` and `pattern` attributes, including in replacement fragments. The browser validates those HTML controls, not an AnyVali/JSON schema automatically. Preserve those constraints in scripts; do not maintain a competing client schema. For `type="number"`, use range and step constraints; `pattern` does not apply. Hidden inputs and controls barred from constraint validation are not checked by these APIs; validate computed payloads against the published input contract and always on the server.

Prefer a normal submit button. A necessary programmatic submission uses `form.requestSubmit(submitter)`, which runs native validation and the submit event HTMX handles. If custom code needs to check first, `form.reportValidity()` returns a boolean and displays validation errors; `form.checkValidity()` checks without displaying the browser's error UI. Stop without sending a request when invalid.

```ts
// Inside an explicit user-action handler, with the owned form and submit button:
if (!form.reportValidity()) return;
form.requestSubmit(submitButton);
```

Do not use `form.submit()`, synthetic submit events, a direct fetch/HTMX call, `noValidate`, `formNoValidate`, `novalidate`, `formnovalidate` or disabled HTMX validation to post an invalid form. A recalculation that accepts fewer fields needs a separate, non-nested form/component with its own schema-backed constraints. It must not switch off validation on the full form. Server validation remains mandatory, including cross-field and business rules HTML cannot express.

Verify invalid submissions by button, Enter and custom triggers produce no POST, and that valid submissions produce the intended request. See the [HTML form API](https://html.spec.whatwg.org/multipage/forms.html#dom-form-requestsubmit-dev) and [constraint validation API](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api).

### Drafts need an explicit contract

Prefer handler-owned drafts or existing component-state primitives. Do not add browser persistence as an incidental fix for a rerender. If browser drafts are required, define allowed fields, schema version, tenant/app/service/user scope, expiry and clearing rules. Validate stored data on restore and submitted data on the server; preserve types and repeated fields, exclude action/auth fields, and never create hidden inputs from arbitrary stored keys. Browser owner metadata does not authorize access. Restore without requests and provide an explicit resume/recalculate action when server work is necessary.

### Use reporting tools for platform defects

When documented theme or framework behavior fails, use the available project issue/reporting tools. Search existing reports, then capture a minimal reproduction, package/theme versions, expected and actual behavior, and relevant request initiators/statuses or computed styles. Remove credentials and customer data. If access is unavailable, provide a ready-to-file report; only claim submission with an issue reference. Attribute confirmed service bugs to the service and label unverified platform causes as hypotheses.

Unreadable themed controls, missing shell navigation and broken loading behavior need evidence and a fix in the owning project. Do not conceal them in service views with hardcoded light/dark palettes, `!important` patches, duplicate shell navigation or replacement runtime code. Service-specific layout CSS is fine; theme defaults remain theme-owned.

Runtime diagnostics are separate from defect reports: method handlers call `ctx.diagnostic({ code, reason, attributes? })` before service-specific responses outside HTTP 200-399. Use stable lowercase dotted codes without secrets or unnecessary personal data. Views display the safe error state.

### Verify the actual request initiator

Check a failed POST followed by menu navigation, Back/Forward, prefetched navigation, repeated swaps and invalid/stale drafts. A navigation GET can be satisfied from preload before a service startup script issues a POST; do not infer that the menu changed methods from the last network entry alone. Navigation and restoration must not mutate; one user action should produce its intended request without duplicates. Check that failure/cancellation leaves controls usable, and verify applicable light/dark modes and keyboard behavior.

## Service route links

Service HTML should use `{view.id}` tokens for service-owned links and HTMX paths:

```html
<a hx-get="{profile.summary}">Profile</a>
```

The framework rewrites those tokens to service route paths before sending HTML. Do not emit absolute service URLs from renderers.
