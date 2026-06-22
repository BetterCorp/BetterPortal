# assets.tsx Cleanup Tracker

## Purpose

`assets.tsx` currently mixes static asset serving with the generated browser shell runtime. The runtime owns htmx integration, service URL rewriting, BP auth headers, Bootstrap lifecycle cleanup, route UI state, and dev recovery.

## Review Matrix

| Area | What it does | htmx duplicate? | Recommendation |
|---|---|---:|---|
| Asset path constants + `loadBootstrap1Asset` | Serves Bootstrap, htmx, htmx extensions, and shell bundle | No | Keep, maybe shorten cache helper |
| `shellRuntimeSource()` wrapping | Embeds browser runtime via `jsx-htmx/js` | No | Keep for now |
| `htmx.config.sse` | Sets global SSE defaults | No | Keep |
| DOM query helpers | Find shell/nav/error/loading elements | No | Keep, maybe inline some |
| `syncProfileMirror` | Copies profile slot into mobile mirror | No | Keep unless theme markup changes |
| `isMainTarget` / `requestTargetsMain` | Detects `#bp-main` requests | Partial htmx glue | Keep |
| chrome `Content-Type` parsing | Reads `bp-chrome-*` params and toggles shell fullscreen | No | Keep, document server contract |
| Bootstrap modal/offcanvas teleport | Moves swapped overlays to `body` | No | Keep unless services render body-level overlays |
| stale Bootstrap overlay cleanup | Removes orphaned backdrops/classes | No | Keep |
| sidebar conversion from `data-bp-sidebar` | Converts custom markup to Bootstrap offcanvas | No | Candidate removal if services emit real Bootstrap markup |
| tooltip/popover init/dispose | Initializes Bootstrap after swaps | No | Keep |
| scroll-to-top | Resets shell scroll containers after main swap | No | Keep |
| loading state | Toggles shell frame/topbar classes | htmx has indicators but not exact shell UI | Simplify later |
| error HTML builders | Client-rendered fallback errors | Mostly htmx/server status view duplicate | Remove for HTTP responses; keep only no-response fallback if needed |
| service route map | Maps service paths to tenant paths and back | No | Keep; core BP protocol |
| BP header localStorage | Stores `BP-SetHeader` auth/client headers | No | Keep; auth protocol glue |
| header refresh timers | Refreshes tokens before expiry | No | Keep |
| `attachBpHeaders` | Adds stored headers to htmx requests | Partial `hx-headers` overlap | Keep; dynamic scoped headers need JS |
| `applyBpHeaderDirectives` | Reads `BP-SetHeader` / `BP-RemoveHeader` | No | Keep |
| dev service health/reload | Polls health and reloads route on recovery | No | Keep or gate harder behind dev |
| route matching / tenant URL conversion | Keeps visible URL tenant-facing while requests go to services | No | Keep |
| `triggerShellLink` | Creates hidden anchor and processes it | Yes-ish; `htmx.ajax` exists | Replace with `htmx.ajax` after verifying v4 `push`/`replace` behavior |
| `data-bp-config` parser | Inherited shell config for rewrite/preload/service | No | Keep unless protocol changes |
| service context resolution | Finds owning service for relative URLs | No | Keep |
| `bpLoginSubmit` global fetch handler | Manual login POST and JSON parse | Mostly htmx duplicate | Replace with normal htmx form flow |
| `applyPreloadConfig` | Adds/removes `hx-preload` | No | Keep as policy |
| `bindBpPreload` | Custom authenticated prefetch/fetch reuse | No | Keep; external `hx-preload` was removed from the core bundle because it bypassed BP stored headers |
| lane/target sanitizer | Prevents fragments replacing outside their lane | No | Keep; containment guard |
| `resolveServiceLinks` | Rewrites links/forms/assets/SSE and adds htmx attrs | Partial htmx initialization overlap | Keep; BP protocol requires root-relative service URLs |
| default bare form `hx-post="this"` | Makes plain forms post to current service route | No | Keep if this convenience remains desired |
| active route management | Updates nav active state/title/breadcrumb | No | Keep |
| error action click handler | Reload/sign-in fallback buttons | Mostly fallback-only | Remove when fallback error HTML is gone |
| route click handler | Closes offcanvas before htmx nav | No | Keep |
| `DOMContentLoaded` setup | Initial processing/bootstrap/health | No | Keep |
| menu health checks | Marks service menu items down | No | Product choice |
| split-pane toggle click handler | UI state toggle | No | Keep if split-pane remains |
| `htmx.registerExtension("bp-shell")` | BP integration with htmx lifecycle | Correct htmx hook | Keep |
| `htmx_before_init` + `htmx_after_process` | Rewrites before/after processing | Some duplicate passes | Keep one path later |
| `htmx_config_request` | Accept header, service-origin rewrite, BP headers | No | Keep |
| `htmx_before_request` | lane guard, loading, invalid route guard | No | Keep |
| `htmx_before_swap` | JSON guard, 401 auth, Bootstrap dispose | Partial duplicate | Keep only BP-specific pieces |
| `htmx_after_request` | BP headers, HX-Location normalization, SSE response rewrite | Mostly BP-specific | Keep; re-check SSE text rewrite |
| `htmx_after_swap` | cleanup/init after swap | No | Keep |
| `htmx_after_settle` | backup loading cleanup | Maybe duplicate | Candidate removal after proving hooks cover it |
| history hooks | active nav update | No | Keep |
| `htmx_error` / `htmx_timeout` | fallback route errors and dev recovery | htmx has events; custom UI is duplicate | Use htmx defaults for HTTP; keep no-response/dev recovery only |

## Actions Taken

- Added this tracker next to `assets.tsx`.
- Changed generic HTTP error handling to lean on htmx v4 defaults:
  - server-rendered status HTML now swaps normally;
  - generic client-rendered `Error 4xx/5xx` pages are no longer generated for HTTP responses;
  - JSON responses are still blocked from swapping into HTML targets;
  - 401 refresh/login handling remains custom because it is BetterPortal auth behavior.
- Added `htmx_response_error` only for BP dev recovery scheduling on `502/503/504`; it does not render custom error content.
- Removed the `htmx_timeout` extension hook. htmx v4 reports timeout through `htmx:error`.
- Removed the unused `showErrorBanner` helper.

## Not Taken Yet

- Did not remove `renderRouteError`, `renderErrorAction`, or `handleErrorAction` yet. They still back the no-response/network fallback and invalid client-side route configuration case.
- Did not replace `triggerShellLink` with `htmx.ajax`; needs one focused behavior check for `push` versus `replace`.
- Kept `bindBpPreload`; BP needs an authenticated preloader because generic `hx-preload` can fetch service URLs without stored BP headers.
- Did not replace `bpLoginSubmit`; login should move to normal htmx v4 events and `HX-Location`, but that touches the auth service renderer too.
- Did not split the browser runtime out of `assets.tsx`; this pass only reduces duplicate error handling.
- Did not clean every mojibake comment in `assets.tsx`; a few encoded comments remain because behavior cleanup mattered more than comment churn.

## Next Cleanup Cuts

1. Remove `bindBpPreload`.
2. Replace `triggerShellLink` with `htmx.ajax`.
3. Convert login form to htmx v4 events and remove `window.bpLoginSubmit`.
4. Move Bootstrap lifecycle/auth-header/dev-recovery helpers out of the asset loader file.
