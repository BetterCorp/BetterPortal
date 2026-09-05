# BetterPortal Auth Plugin for Node.js

Default BetterPortal v10 auth plugin package.

The file-backed user store is single-process; do not share it between auth replicas. First-admin registration is exclusive within that process. Logout revokes the presented `X-BP-Refresh` session, and password changes or disabling a user invalidate all their refresh sessions. Revocations survive restarts. Already-issued access tokens remain valid until expiry.

This package defines the initial JWT-oriented auth contract for:

- runtime identity
- control-plane identity
- refresh flows
- user-management-adjacent APIs

It depends on the BetterPortal framework contracts and keeps auth as a plugin category rather than core behavior.

After-login and after-logout destinations are app-owned `app.auth.redirects` view references configured in Tenants & Apps, not provider addon fields.
