# BetterPortal Default Auth

Default Auth owns the account directory; BP continues to own application permissions and role definitions. User IDs, groups and credentials are scoped to a tenant and, by default, an app. Access tokens and refresh sessions are always app-bound. No BP session is shared across apps.

Requires Node.js 24. Existing WorkOS and Authress login, refresh, role-sync and user-management behavior is unchanged. Their only integration change is the shared confirmation-elevation issuer hook.

## Deployment modes

| Setting | Simple (default) | Advanced |
| --- | --- | --- |
| `mode` | `simple`, including when omitted | `advanced`, explicitly configured |
| Storage | Atomic JSON, one writer | PostgreSQL, transactional records and tenant locks |
| Tenants per instance | One, using the BP tenant lock | Multiple activated tenants |
| Accounts | Ten total, including disabled/unverified/bootstrap accounts | No application account cap |
| Replicas | One | Multiple, with shared installation configuration and signing/encryption keys |

Plugin configuration retains `issuer`, `audience`, `accessTokenSeconds` (900), `refreshTokenSeconds` (604800), `keyStorePath` and `userStorePath`. Advanced adds `postgresUrl` and requires `encryptionKey`: a base64-encoded 32-byte key. Supply secrets using your deployment's secret configuration, and use the same issuer, audience, keys and PostgreSQL database on every replica. Provision the RSA key file before starting Advanced; never let individual replicas independently generate signing identities.

Simple creates a separate `<userStorePath>.crypto.json` key file with owner-only permissions. Back up this file with the identity store and signing keys. Advanced uses that exact encryption key when migrating existing encrypted factors or queued mail. JWT signing keys and the factor/mail encryption key have different purposes.

The JSON lock refuses concurrent writers. A demonstrably dead process on the same host can be recovered automatically; ambiguous ownership, another host, or an interrupted lock-recovery operation requires the operator to verify the former process has stopped before removing the indicated `.lock` / `.lock.recover` file. Graceful service disposal drains storage and releases its lock.

### One-way migration

1. Stop the Simple instance and back up identity, signing, encryption and BP bootstrap state.
2. Set `mode: advanced`, `postgresUrl` and the shared `encryptionKey`. Keep the original `userStorePath` for this startup.
3. Start one migration instance. It writes Advanced intent before database work, imports within a transaction, verifies every imported record, records the source checksum in PostgreSQL, marks completion and removes the active JSON identity file.
4. Start the remaining replicas with the same installation configuration and keys. Preserve each replica's durable state location.

`<userStorePath>.mode.json` and the PostgreSQL migration ledger survive cleanup. Simple startup rejects the marker even if `mode` is omitted or the JSON file is absent. A database outage never opens a JSON fallback. Restarting with an identical leftover source completes cleanup; a different source fails closed for operator investigation. Permission-restricted `.v1.backup` and `.advanced.backup` files are deliberate recovery copies: retain/remove them under your backup policy. Signing keys, encryption keys and BP bootstrap/configuration state are never removed by migration.

Legacy accounts keep IDs, bcrypt hashes and existing app-role assignments. Their directory remains tenant-scoped and locked, and existing app assignments—including empty assignments—are marked initialized. Bcrypt upgrades to Argon2id after successful password verification. Refresh sessions are invalidated during import; users sign in again. A legacy Simple store above ten users retains login/recovery but cannot create accounts; a store with accounts in multiple tenants requires Advanced.

Legacy identifier collisions never merge accounts or choose an owner by file order. Colliding usernames retain exact, case-sensitive password sign-in; ambiguous normalized identifiers remain reserved and cannot be used for email lookup or new registrations. Conflicting emails are preserved as `legacyEmail` migration metadata and removed from the active email field. These accounts can sign in with their original username and password, subject to MFA, then add and verify a unique email in Account. The original store remains in the migration backup.

All migrated legacy accounts retain password login, subject to enabled-account checks and MFA policy, even when mail delivery is not configured. This migration-only exception also applies to accounts with a retained email; migration never marks the address verified. Accounts without an active email can add and verify one from Account. New self-service registrations still require verified email.

## Tenant and app configuration

Set `userIsolation` only at tenant scope:

- `app`: each app has separate users, identifiers, groups and credentials. This is the default for new tenants.
- `tenant`: apps share the tenant's account directory. Role assignments, external redirects, sessions and tokens remain app-specific.

The setting is persisted and locked by the first account creation, including bootstrap, invitation acceptance and social provisioning. The config API rejects subsequent changes; identity transactions also enforce the boundary. Sharing a tenant directory does not log a user into another app.

For tenant-shared accounts, set tenant-only `directoryAdminAppId` to the trusted administration app in that tenant. Only its authorized administrators (and the existing management app) can disable shared accounts, revoke all their sessions, or modify group membership. Other app administrators can assign roles, invite accounts and map existing groups to their own app's roles. They cannot grant themselves directory authority through app configuration. Account listing uses cursor pagination, and role editing keeps direct assignments separate from group-derived permissions.

App settings:

| Setting | Behavior |
| --- | --- |
| `registration` | `invite-only` by default; `public` and `closed` supported |
| `defaultRoleIds` | JSON array, default `[]`; existing app role IDs only, never `*` |
| `requireMfa` | Require factor enrollment/verification at login |
| `mailTransport` | `postal` or `http` |
| `mailUrl`, `mailFrom` | Delivery endpoint/base URL and sender |
| `mailApiKey` | Protected Postal server API key |
| `mailHeaders` | Protected JSON object of headers for a custom HTTP service |
| `socialConnections` | Protected JSON array of connection objects described below |

Default roles are applied once at the first completed login, after required verification/factors. Empty initialization is persisted too. Administrative/invitation assignments take precedence. Changing defaults or revoking roles never regrants them on later login. Group membership contributes only the current app's role mappings. The existing `*` root meaning is unchanged; ordinary users have no roles unless assigned.

## Mount the account routes

Alongside existing `/login`, `/logout`, `/register` and `/refresh`, mount these routes in each app that uses them:

- `/account` (`account.index`): registration, email verification/resend, password reset, profile/password/email changes, factor enrollment/removal, recovery-code display and active-session revocation.
- `/social` (`social.index`): social sign-in and explicit account linking; its app-shell URL is the provider's registered callback.
- `/users` (`users.index`): account enable/disable, invitations, app roles, groups, delivery failures and audit events. Grant its read/update permissions to the intended administrators. Mutations require MFA elevation.

The Bootstrap renderer runs in the BP shell and uses its shared auth runtime. Email links keep their one-use proof in the URL fragment and submit it only in a POST body, keeping it out of access-log URLs. They use the mounted app-shell account URL; enabling public registration or inviting users without that mount fails instead of sending an unusable link.

`/register` remains deployment bootstrap, restricted to the configured management tenant/app and a deployment setup token. Advanced requires the same explicit `setupToken` on every replica; Simple can generate an owner-only `<userStorePath>.setup.json` file. Customer registration does not close management bootstrap; its own durable completion marker prevents a second administrator bootstrap. The bootstrap administrator must enroll TOTP or a passkey before receiving a usable session. This endpoint cannot grant root in arbitrary apps, and the administrative user API cannot modify the bootstrap identity.

Passwords created/reset now use Argon2id, a minimum of 12 characters and a maximum of 1024 UTF-8 bytes, with common-password rejection. Password recovery requires email verification and preserves enrolled factors. TOTP uses replay protection; passkeys require user verification and validate the RP, origin, challenge and credential ownership. Enrollment produces ten one-use recovery codes, displayed once and stored hashed. Enroll a replacement before removing the last factor.

For tenant-shared accounts, passkeys only work on their registered hostname. Keep an authenticator or recovery codes available for other app hostnames. If neither is available, sign in on the passkey's original app and add an authenticator in Account before retrying the other app. Login and elevation return recovery instructions instead of an empty challenge; they never bypass existing MFA or authorize replacement enrollment using only a password.

The refresh token rotates on every refresh. Replay revokes its family; logout, account disable, password changes and factor changes revoke the applicable sessions. Browser refreshes use the Web Locks API to coordinate tabs where available. Already-issued access tokens at other services remain bounded by their normal expiry; immediate distributed access-token revocation is not promised.

### Email delivery

Postal sends JSON to `<mailUrl>/api/v1/send/message`, with `X-Server-API-Key` and Postal's `to`, `from`, `subject`, `plain_body`, `html_body` fields. Both HTTP success and a JSON `status: "success"` are required. See [Postal's send API](https://apiv1.postalserver.io/controllers/send/message.html).

Custom HTTP delivery POSTs `{from,to,subject,text,html}` to `mailUrl` using the configured server-side headers; any 2xx response succeeds. HTTPS is required, with a localhost exception for development. Redirects are rejected. There is no SMTP transport.

Mail jobs commit with their corresponding identity/challenge mutations and encrypt their sensitive payloads. A leased worker retries failures up to five times with backoff. PostgreSQL selects at most 100 due pending/expired-lease jobs using a partial index, excluding delivery history. Delivery revalidates the current configured URL before decrypting or sending a queued message. Simple limits outstanding/failed jobs to 500 per app and retains the latest 100 successful delivery records. `/users` shows failed delivery IDs and supports retry, without exposing keys or reset links. Provider response bodies and credentials are not logged. Delivery is at least once: a crash after delivery but before acknowledgement can resend the same one-use link.

### Social connections

Each entry contains `id`, `kind` (`google`, `microsoft`, `github`), `clientId`, `clientSecret`, and—for Microsoft—an explicit directory `tenantId`. Register each app's own `/social` shell URL with its provider. Microsoft personal accounts can use their dedicated consumer directory; unrestricted `common`/multi-issuer discovery is intentionally not enabled.

Google/Microsoft use OIDC code flow; GitHub uses its OAuth code and profile/email APIs. All use S256 PKCE and short-lived, one-use server state bound to a browser-held secret and the initiating app/origin. OIDC additionally validates nonce, issuer and audience through `openid-client`. Provider access tokens are discarded after identity lookup.

New social provisioning requires public registration and a verified provider email. An existing matching email is never automatically linked: sign in first and explicitly link the provider from Account. Providers that do not attest a verified email (including some Microsoft tenants) require email registration/verification first. Linked identities use issuer + stable subject, independent of subsequent email changes.

Link approval is bound to the initiating app session and survives the provider redirect and ordinary refresh; another or revoked session cannot complete it. Unlinking requires elevation and a verified local password as a remaining sign-in method. Provider unlinking revokes existing sessions.

## Elevated authentication

Declare it alongside existing route authorization:

```ts
export const auth = {
  required: true,
  permissions: [], // Supply this action's actual permissions.
  elevation: { minimum: "mfa" as const, maxAgeSeconds: 300 }
};
```

Use `minimum: "confirm"` for confirmation-only actions. The presence of `elevation` makes authentication required even if `required` was omitted/false. Permissions are checked first; root does not bypass elevation. For a resource-dependent decision, call `ctx.requireElevation({minimum: "mfa"})` after resource authorization and before any side effect. Streaming routes should declare elevation on the route, before streaming begins.

Insufficient assurance returns HTTP 401 with RFC 9470's `insufficient_user_authentication`, `WWW-Authenticate`, and a scoped `BP-Auth-Challenge` header. A sufficient elevated token goes directly to the handler without another challenge.

The runtime asks the configured app auth service at `/.well-known/bp/auth/elevate`, displays its confirmation/factor flow, then retries the captured request exactly once. It preserves submitted method/body/headers and rejects stale page/session results. Cancellation does not log out. Background loads do not open dialogs, and file uploads require explicit verification/resubmission. Do not perform effects before returning a challenge; network failures after a retried mutation are never automatically retried again.

The signed claim is `elevation: {assurance: "confirmed" | "mfa", verifiedAt, expiresAt}`. It covers all eligible actions in that app until expiry, subject to each action's minimum assurance, freshness and ordinary permissions. Confirmation never satisfies MFA. Elevation cannot outlive the access token, is kept only in browser memory, and disappears on normal refresh, logout, reload or session/app changes. No elevated refresh token is issued.

Default Auth verifies enrolled factors and current session state. WorkOS/Authress expose the generic confirmation fallback only; it cannot satisfy MFA, revalidate upstream state or extend the original access token lifetime. Custom auth providers opt into the issuer hook and may override `beginAuthElevation` / `finishAuthElevation`. SMS/WhatsApp, SAML, generic enterprise OIDC, SCIM and external API grants remain later adapters; they are not advertised as implemented providers.

Generic confirmation uses a purpose-separated signed receipt, bound to the source token, subject and app, with a maximum five-minute completion window. Replicas sharing signing keys can complete it after a redirect or restart. Completion is repeatable within that window, but its original assurance timestamp and access expiry cannot be renewed by replay. Default Auth factor challenges remain stored and one-use.

Node, Python and .NET enforce declared elevation before handlers and provide conditional helpers. Go/PHP currently ship protocol helpers only, consistent with their existing SDK scope: hosts must first verify JWT signatures, tenant/app binding and permissions, and must fail closed when they cannot enforce a declared requirement.

## Verification

Run the normal workspace build, lint and test gates. Additional checks:

```sh
# Use an isolated test database, never production.
BP_AUTH_TEST_POSTGRES=postgres://... node --import tsx services/nodejs/auth-default/tests/postgres.test.ts
python framework/conformance/check_elevation.py
cd framework/go && go test ./...
# From repository root:
php framework/php/tests/elevation.php
dotnet framework/dotnet/Conformance/bin/Debug/net10.0/Conformance.dll --elevation framework/conformance/elevation-cases.json
```

Shared fixtures cover minimum assurance, freshness, expiry, token type and root behavior. Browser tests cover exact mutation replay, cancellation, memory-only elevation and app-specific credential migration. Storage tests exercise caps, isolation, default roles, challenge rollback/replay, TOTP/recovery, legacy migration and PostgreSQL replica races.

WebAuthn tests use Chromium's virtual authenticator and verify enrollment, origin, ownership and replay. Social identity tests mock provider responses, and email delivery tests mock the HTTP transport. Live provider sign-ins, production delivery, deployment load and recovery procedures must be verified with the deployment's actual configuration.
