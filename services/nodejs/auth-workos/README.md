# BetterPortal WorkOS Auth Service

WorkOS AuthKit provider for BetterPortal. The service redirects users to WorkOS, exchanges the callback code server-side with the WorkOS Node SDK, issues BetterPortal tokens, and refreshes BP tokens from the WorkOS refresh token.

Per-app service config requires:

- `clientId`
- `apiKey`

Optional config:

- `provider` defaults to `authkit`
- `connectionId`, `organizationId`, `domainHint`
- `scopes`
- `loginRedirectPath`, `logoutRedirectPath`
- `roleClaimPath` defaults to `roles`

Registry org: `betterportal`.
