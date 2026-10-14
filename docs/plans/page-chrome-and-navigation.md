# Page chrome and service navigation plan

Status: implemented and validated locally; not deployed. Related issue: [#62](https://github.com/BetterCorp/BetterPortal/issues/62).

Dependency baseline: the current repository lockfiles, including the shared `ctx.route` / `BPRoute` navigation contract.

## Contract

Add a typed, request-scoped `ctx.chrome()` setter for HTML page presentation, keeping returned business data and JSON API schemas unchanged. Merge dynamic settings over the operation's declared chrome. Extend the existing chrome response mechanism with `title` and ordered `parents` rather than introducing a separate router or service-local link wrapper.

Handler usage:

```ts
ctx.chrome({
  title: `Order ${order.number}`,
  parents: ["Sales", "/customers", `/customers/${order.customerId}`]
});
return order;
```

- Parents run from outermost ancestor to immediate parent.
- A parent starting with `/` is a service path relative to the responding service, never a precomputed UI route. Preserve query parameters and resolve it through existing mounted-route logic. Reject protocol-relative `//` destinations rather than treating them as another origin.
- A parent without a leading `/` is literal breadcrumb text. Render it as escaped text without an anchor; never interpret it as HTML or a URL.
- For path breadcrumbs, prefer the configured app/UI route title, then the service view title. Carry the required trusted metadata to the runtime if its current route index lacks the fallback title. Omit unresolved destinations rather than inventing a route or silently linking to the service origin.
- The last parent is the logical parent. It can supply an Up link only when it resolves to a navigable path; do not substitute an earlier breadcrumb when the last entry is text. Browser Back remains browser history, with no history fallback for Up.
- A nonempty custom title replaces the visible page title and sets the browser title to `Custom title - App Name`. With no custom title, preserve existing defaults exactly. Do not scrape service headings.
- Apply metadata only when a successful HTML page response is committed to the main outlet. JSON, nested fragments, component mutations, errors and background/preload requests must not change the active page header. Store preloaded metadata until navigation commits it.
- Reset omitted metadata on a new page and restore matching metadata on history navigation. Breadcrumbs remain theme-owned, with accessible labels and current-page semantics.
- When the active theme supplies the page title/header and Back/Up controls, service views must omit their own page titles and Back/Up buttons or links. State this in theme notes, UI guides, skills and templates. Keep meaningful section headings and task-specific actions; themes that delegate these responsibilities to service content must document that explicitly.

## Implementation boundaries

1. Extend `framework/nodejs/src/contracts/chrome.ts` with typed `title` and `parents` fields. The current scalar-only record and content-type encoder/parser need deliberate array handling, validation and round-trip encoding; preserve existing scalar chrome compatibility.
2. Document and implement the handler setter in `contracts/route.ts` and `adapters/h3.ts`. Keep metadata separate from response data and emit it only for the page representation. Trace other adapters and native contract consumers before updating exported conformance schemas.
3. Reuse service-path mapping in `themes/nodejs/runtime/src/runtime.ts`. Cover initial load, successful swaps, history and preload without introducing a second navigation lifecycle. Use trusted route titles and text-safe DOM updates.
4. Add presentation to Bootstrap1/2's existing header/breadcrumb outlets. Document the shared contract for Embedded and custom theme authors; do not force an extra header into a theme that does not provide one.

## Documentation and TSDoc

Resolve #62 consistently across root `llms.txt`, generated `/llms-dev.txt` and `/llms-ui.txt`, route/view docs, theme guides, skills, examples and scaffolding:

- Use inline `ctx.route({ viewId, query })?.viewPath` anchors inside service-rendered shell content; the runtime handles the service-to-UI mapping. Explain required shell behavior, unresolved destinations and intentional native navigation separately.
- Keep the same `ctx.route` resolver in handlers and renderers; document service request fields separately from explicit public UI URLs and history.
- Put a complete renderer-directory/signature/query example beside its expected request and browser URL behavior. Keep page markup in the documented renderer; do not add a generic PageLink wrapper.
- Explain the shared `ctx.route` destination fields and build errors for removed literal route tokens.
- Document title and breadcrumb ownership, text parents, ordering, service-relative path resolution, title fallback and reset/history behavior. Retain the pending theme-title/navigation and Bootstrap1 card/table spacing guidance.
- Fix parameterized route title lookup so a configured `/batches/:batchId` mount supplies its static title at `/batches/1`, including detail pages absent from the app menu.
- Add TSDoc to the new setter and affected public URL helpers: parameters, return values, representation restrictions, null/unresolved behavior and copyable examples. Validate it with the existing `tsdoc/syntax` ESLint rule; do not disable lint rules or add redundant lint configuration.

## Verification

Use existing test suites. Check dynamic metadata isolation from JSON/fragments; Unicode and delimiter-safe encoding; mixed text/path parents; query preservation; invalid/unmounted paths; title fallback/default restoration; actual mounted shell navigation; direct loads; preloads; failed requests; and Back/Forward. Check header/breadcrumb accessibility and title synchronization in Bootstrap1/2. Run affected tests, canonical contract checks, lint and the workspace build before committing the implementation.

The local implementation includes the related routing fixes: complete parameter-pattern matching instead of implicit child mounts, same-service current-page form resolution, decoding URL parameters once before re-encoding, and page presentation committed only after a successful swap. Regression coverage also checks cancelled swaps, failed navigation, ambiguous parents, text immediate parents and history restoration. The workspace build, affected lint, framework/runtime/Bootstrap suites, portable contract and fixture checks, native type checks and cross-language rendering conformance pass.

## Additional confirmed Bootstrap1 styling findings

Local Chromium reproduction with the actual Bootstrap CSS and generated dark-mode theme styles confirms:

- Dropdown styling is scoped to `.bp-shell__main`. Header menus and menus in modals/offcanvas moved to `document.body` fall back to Bootstrap's different background, padding, radius and active color.
- The scoped `.dropdown-item` color overrides Bootstrap's disabled-item color, making disabled entries look enabled.
- The `.form-select` `background` shorthand clears Bootstrap's arrow image, including on focus. Use background-color styling when preserving that image.

These findings are analysis only; dropdown CSS has not been changed. A theme-level fix should cover header/content/teleported menus, disabled and active states, palette tokens, and select arrows in both appearance modes.

## Completion commit

The implementation commit must include the issue-closing trailer after #62's documentation and navigation validation requirements are addressed. Do not close the issue with this preparation alone.

```text
feat: add page titles and parent breadcrumbs

Resolve service paths in the shell and clarify navigation ownership.

Closes #62
```
