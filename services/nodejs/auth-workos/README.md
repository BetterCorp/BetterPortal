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
- service config `workosStatePath` defaults to `./workos-state.json`; set it to a persistent path such as `/data/workos-state.json` in production
- service config `syncIntervalSeconds` defaults to `21600` and retries stale permission/role sync every 6 hours

Registry org: `betterportal`.

Role sync keeps BP as the permission source of truth. WorkOS permission slugs are short service-owned keys, `bp_<shortId>_<read|create|update|delete>`, with the full tenant/service/view mapping stored in `workosStatePath`. Roles are mirrored per app from WorkOS role slugs into BP app roles.
