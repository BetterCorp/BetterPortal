# BetterPortal Authress.io Auth Service

Authress.io auth provider for BetterPortal. The service accepts Authress identity data from the browser flow, issues BetterPortal tokens through the shared auth framework, and exposes login, refresh, logout, profile, and background refresh fragments for BP themes.

Registry org: `betterportal`.

After-login and after-logout destinations are app-owned `app.auth.redirects` view references configured in Tenants & Apps, not provider addon fields.

Login renderers resolve their token POST and provider callback destinations from `ViewRenderContext`. This remains correct when the login UI is loaded as a fragment/modal while the address bar points to another page. A public mounted GET page is preferred for the callback; an available absolute service view is the fallback. Preserve the resolver's POST destination through submission.

```ts
// In the login renderer, after deriving the validated next destination:
const post = ctx.route({ path: "/login", method: "POST" })?.absoluteApiPath;
const callback = ctx.route({ path: "/login", method: "GET", query: { next } });
const returnTo = callback?.absoluteUiPath ?? callback?.absoluteViewPath;
```
