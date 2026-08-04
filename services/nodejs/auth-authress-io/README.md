# BetterPortal Authress.io Auth Service

Authress.io auth provider for BetterPortal. The service accepts Authress identity data from the browser flow, issues BetterPortal tokens through the shared auth framework, and exposes login, refresh, logout, profile, and background refresh fragments for BP themes.

Registry org: `betterportal`.

After-login and after-logout destinations are app-owned `app.auth.redirects` view references configured in Tenants & Apps, not provider addon fields.
