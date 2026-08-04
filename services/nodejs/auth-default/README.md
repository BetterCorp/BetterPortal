# BetterPortal Auth Plugin for Node.js

Default BetterPortal v10 auth plugin package.

This package defines the initial JWT-oriented auth contract for:

- runtime identity
- control-plane identity
- refresh flows
- user-management-adjacent APIs

It depends on the BetterPortal framework contracts and keeps auth as a plugin category rather than core behavior.

After-login and after-logout destinations are app-owned `app.auth.redirects` view references configured in Tenants & Apps, not provider addon fields.
