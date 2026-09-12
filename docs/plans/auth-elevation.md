# Action-triggered authentication elevation

Status: approved protocol/design reference, implemented in this workspace. Companion to [default-auth expansion](shared-auth-platform.md). See the [implementation guide](../../services/nodejs/auth-default/README.md#elevated-authentication) and shared conformance cases for the delivered API.

## Requested behavior

A service can require additional confirmation/authentication before an action. The BP browser runtime pauses that request, contacts the app's selected auth service using the current token, displays the appropriate confirmation or factor flow, receives a newly signed access token, and retries the original request. The elevation covers all eligible actions within the current app until expiry, as confirmed by the user. It expires with the access token and is absent from ordinary refreshed tokens.

The common runtime supplies the interaction and a default confirmation flow. Auth providers can extend the server-side flow to require their supported authenticators. Default auth uses an enrolled factor when its policy requires one; a factor failure must not silently fall back to confirmation. Both Simple and Advanced support elevation with the same security semantics.

This adds shared framework, auth-provider SDK and browser-runtime work to the earlier default-auth scope. It does not redesign WorkOS/Authress authentication or user management. Their adoption of the new generic capability requires compatible SDK support and signing integration; existing deployed binaries cannot gain token-issuance behavior from a browser update alone.

## Two explicit requirements

| Action policy | What can satisfy it |
|---|---|
| Confirmation (`confirm`) | Default explicit confirmation under the current authenticated session, or a stronger provider flow. Default auth requires an appropriate enrolled factor when configured by its account/app policy. |
| Verified MFA (`mfa`) | A newly completed factor/strong-authentication ceremony that the auth service validates against its assurance policy. A confirmation button alone never qualifies. |

An app that only wants a second deliberate user interaction can use `confirm`. An action that requires 2FA declares `mfa`. If the user has no suitable factor, the auth service offers secure enrollment/recovery if supported, or returns an actionable unavailable result. It never labels simple confirmation as MFA.

Passkeys, TOTP, SMS and WhatsApp are authenticator/transport capabilities, not interchangeable assurance levels. A passkey flow must validate the required user-verification evidence; merely having a passkey registered or sending a message proves nothing. Factor enrollment, recovery, attempt limits and supported delivery channels belong to the provider. This extension does not commit the initial default-auth release to implementing every channel.

## Challenge protocol

Use `401 Unauthorized` with a distinct step-up challenge:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="urn:betterportal:auth:mfa", max_age="300"
Cache-Control: no-store
```

The status and authentication challenge follow [RFC 9470](https://www.rfc-editor.org/rfc/rfc9470.html); BP's assurance names and operation binding are proposed extensions. That standard describes requesting stronger or more recent authentication, issuing another access token, and repeating the request. It does not define BP-specific route policies or request storage.

BP already assigns `406` to representation/renderer failures in [the protocol](../../spec/protocol.md); keep that meaning. Ordinary missing/expired credentials still take the normal 401 authentication path. An authenticated caller missing role permissions gets 403, with no elevation prompt. A capability that is not implemented must report that explicitly, rather than repeatedly returning a recoverable challenge.

Expose `WWW-Authenticate` and any BP challenge header through existing cross-origin response-header configuration. Add a versioned `BP-Auth-Challenge` header (encoded, bounded structured metadata; final wire encoding to be specified) for tenant/app, installed service instance, operation ID, HTTP method, minimum assurance and freshness. JSON clients also receive a documented typed body. HTML keeps the existing status-rendering conventions. Runtime detection uses declared headers/contracts, never English message parsing or the numeric status alone.

Resolve the auth endpoint from trusted `app.auth` metadata and manifest-discovered operations such as proposed `auth.elevate.start` and `auth.elevate.complete`. Never send the current token to a URL supplied by the denying service. Validate that the challenge corresponds to the original configured service/operation and current app. Render trusted operation titles; treat contextual service text as untrusted text, not injected HTML.

## Route and token contracts

Extend [ApiAuthRequirement](../../framework/nodejs/src/contracts/route.ts) with an optional policy, for example:

```ts
auth: {
  required: true,
  permissions: [/* existing service/view/action requirements */],
  elevation: {
    minimum: "mfa", // or "confirm"
    maxAgeSeconds: 300
  }
}
```

These names are proposals, not currently available APIs. Validate that elevation requires user authentication. For normal declared requirements, authenticate and authorize the caller, then check elevation before invoking the action handler. The existing `*` permission shortcut must not skip this check; root administrators also satisfy declared elevation.

For conditional requirements based on action data, provide a runtime helper such as `ctx.requireElevation(...)`. The service author calls it after resource authorization and before any state mutation, message dispatch, external call with side effects, or streaming response. A denial is explicitly a pre-execution response. Never retrofit this by returning a challenge after partially completing the operation.

A signed access-token extension needs evidence beyond a bare `elevated: true`:

```ts
elevation?: {
  assurance: "confirmed" | "mfa";
  verifiedAt: number;
  expiresAt: number;
}
```

Token-level `sub`, tenant, app, issuer, audience, purpose and expiry remain mandatory. The service checks the elevation's signed assurance and freshness against its current route policy, with the enclosing token enforcing the exact tenant/app. A convenience `isElevated` value can be derived server-side; a boolean alone is not authorization evidence. Unknown/absent assurance never satisfies a required level. Elevation does not add roles or bypass resource permissions.

Confirmed scope: all eligible actions in the current app until token expiry. This does not grant roles: each action still authorizes its caller normally and requires compatible assurance/freshness. A confirmed token can satisfy confirmation actions; it cannot satisfy an MFA action. An MFA token may satisfy both subject to each action's freshness requirement. Tenant/app isolation is unchanged.

The initiating service/operation/method remain part of the challenge transaction, dialog context and audit, not a restriction on which app actions may reuse the issued elevation. App-wide elevation is not cryptographic approval of an exact resource/body. The runtime preserves the original submitted values, but transaction-specific approval would require a separate signed resource/request binding and one-use server-side consumption. UI copy must describe a temporary app-wide elevation rather than promise approval limited to the first action. The implementation records action context as client-reported diagnostic data, never as authorization evidence.


## Auth service and extension hooks

1. Receive the current BP access token and validated target challenge. Revalidate token scope/purpose, current account/session state where available, applicable connection policy, target operation and required assurance. Recompute current roles in default auth; never accept role/assurance claims supplied as request data.
2. Default Auth creates a short-lived, one-use elevation transaction bound to subject, current session/token, tenant/app, target operation and minimum assurance. The generic confirmation-only fallback uses a purpose-separated signed receipt so another replica can complete it. Its completion is repeatable for five minutes, but neither the original assurance timestamp nor the elevated expiry can be renewed by replay. Return a confirm view or a provider challenge flow. Protect start/completion against CSRF, cross-origin misuse, challenge substitution, enumeration and brute-force attempts.
3. Complete confirmation through an explicit authenticated POST, or verify the selected factor server-side. Enrollment status alone and MFA from an arbitrarily old login cannot complete the challenge. A fresh challenge is needed when the app-wide elevation no longer meets the requesting action's assurance or freshness policy.
4. Consume the transaction atomically and issue a new BP access token using the configured trusted signing authority. Preserve current scope and permitted roles. Do not issue an elevated refresh token. Audit the challenge, outcome and issuance without recording codes, factor secrets or bearer tokens.

The common auth-provider server SDK should supply start/complete transaction handling and the confirmation renderer. Providers may implement hooks for factor selection, verification and account/session policy. They must integrate their BP token issuer; [registerAsAuthProvider](../../plugins/nodejs/betterportal-bsb/src/service.ts) currently publishes public metadata/JWKS only and does not give the base runtime access to a provider's signing key. Add an explicit trusted issuer hook rather than guessing private subclass methods or exposing keys to the shell.

A provider with that baseline SDK/issuer integration but no custom factor hook can perform confirmation only. A provider running an older SDK with no server-side issuance endpoint cannot support verifiable elevation: the browser may explain capability unavailability but cannot fabricate a token or satisfy an elevation-protected route with a local flag. This compatibility boundary must appear in capability discovery and rollout tests.

Default auth must not use the generic confirmation fallback to bypass its own known factor policy. A provider error, unavailable channel, missing SDK endpoint or unsupported MFA capability is never permission to downgrade a `mfa` requirement.

## Browser runtime sequence

```mermaid
sequenceDiagram
  participant U as User
  participant R as BP runtime
  participant S as Target service
  participant A as Auth service
  U->>R: Perform action
  R->>S: Original request + normal token
  S-->>R: 401 step-up challenge; action not executed
  R->>A: Start elevation + current token + target
  A-->>R: Confirmation or factor challenge
  R->>U: Show dialog
  U->>R: Confirm or complete factor
  R->>A: Complete bound challenge
  A-->>R: Signed elevated access token
  R->>S: Retry original request with elevated token
  S-->>R: Action result
```

Add this branch before existing refresh/login, error-modal, fragment-hide and response-swap handlers in [the browser runtime](../../themes/nodejs/runtime/src/runtime.ts). Otherwise the new 401 can trigger a normal refresh, strip elevation or clear login. Apply it to all supported BP-managed user requests, not only the main view; background polling/prefetch must not open unsolicited dialogs.

Capture the original request before sending: resolved service/app, operation, method, URL, headers and a replayable body snapshot. Preserve submitted values, content type, existing CSRF/idempotency tokens, rendering target and request generation. Do not reconstruct a form after the user has edited it. Credentials are refreshed separately when resending; use the issued elevated access token only within its tenant/app scope. The current `retryMainRequest` handles GET navigation only, so it cannot implement POST/PUT/PATCH/DELETE elevation retries as-is.

Automatically retry once only after a recognized pre-execution elevation denial and successful challenge completion. Keep transport-failure retries separate. Mutating operations need their normal server-side idempotency protection for ambiguous responses or duplicate submissions; a browser retry counter alone cannot guarantee exactly-once effects. Do not buffer unbounded uploads or silently replay streams/non-repeatable bodies: complete elevation then ask for explicit resubmission or support preflight elevation before upload.

Cancel closes the dialog and abandons the action without logging the user out. Navigation, logout, app/user change, expired challenge or changed request context cancels the pending continuation. Capture pending bodies/tokens in bounded in-memory state only. Never persist action payloads in localStorage/history or send the business payload to the auth service merely to request MFA.

Serialize dialogs, disable duplicate submission, and bind completions to their pending request. A second challenge after the one allowed retry surfaces an error instead of looping. Concurrent refresh/elevation completions require generation control so a late response cannot restore an elevated token after logout or replace a newer session. Missing/expired base credentials first require normal login/refresh; any elevation transaction must then be rebound or restarted.

Store the elevated token in a runtime-managed in-memory slot alongside the ordinary app token, keyed by user/session and tenant/app with explicit expiry metadata from the auth response. It is a new auth token attached as `Authorization` for the retry and subsequent eligible app actions, not an additional client-asserted header. Use that elevated token on subsequent BP-managed user requests in the same app while it remains current; action-specific permission/assurance checks stay server-side. Keep the baseline token available for ordinary refresh/fallback after elevation is cleared. Ordinary refresh clears elevation state and issues baseline claims; it never copies elevation from a previous token. No elevation survives an app switch, logout or browser reload through persistent header storage.

## Expiry and compatibility

Use the configured ordinary access lifetime as an upper bound for an elevated access token. The route's freshness requirement can force a new challenge sooner. Set elevation expiry no later than JWT `exp`, and enforce both server-side. If a generic provider can only reverify an existing signed token without refreshing current session/account state, cap elevation at that source token's remaining lifetime so it cannot extend stale access.

[The current issuer](../../framework/nodejs/src/runtime/auth/issuer.ts) explicitly constructs token claims. Add a dedicated verified-elevation issuance path; ordinary access issuance, login, refresh, import and session restoration must omit elevation. Refresh tokens never carry reusable elevation proof. A logged-in user with MFA configured is not perpetually elevated.

Publish versioned route/claim/challenge/provider capability schemas. Update affected Node/Python/Go/PHP/.NET verifiers, generated contracts and conformance before enabling elevated routes. Unsupported runtimes must reject unsupported mandatory elevation policies at registration/readiness; they must not silently ignore a new route field. Normal routes and old tokens continue working without elevation claims. Updating schemas alone does not implement enforcement.

Pure service credentials cannot complete human elevation and must not bypass it on an elevated user action. Reject incompatible caller declarations or require a separately explicit machine operation/policy. Delegated calls must carry verifiable user elevation meeting the actual target operation's assurance requirement within the same app in addition to existing machine and user permissions; deny unsupported delegation rather than accepting an elevation token from another tenant/app or one with insufficient assurance.

## Acceptance criteria and rollout

- Framework middleware denies the action before any handler side effect; ordinary permission denial remains 403. Root cannot bypass required elevation.
- Standard confirmation produces only confirmed assurance; MFA-required actions reject it. Enrolled-factor failures cannot downgrade. Client-supplied `elevated` fields have no effect.
- Wrong subject/session/tenant/app, tampered/expired proof, stale authentication and challenge replay fail. A challenge completion must match its initiating service/operation/method; the resulting elevation can be reused by other eligible actions in that app. Confirmation transactions are atomically consumed in JSON and PostgreSQL stores.
- POST/PUT/PATCH/DELETE retries preserve the submitted request exactly; cancellation/navigation, duplicate clicks, uploads and transport ambiguity behave as specified. No automatic infinite retry or duplicate side effect.
- Ordinary token refresh always returns baseline auth and clears cached elevation; races cannot resurrect it. Elevated access expires even if the normal session remains active.
- Generic SDK confirmation works with an issuer hook and no custom factor UI; default auth's enrolled-factor extension works; truly old providers report unsupported. No signing key reaches the browser.
- Browser handling works for supported page/fragment/element requests with cross-origin challenge headers exposed, without triggering ordinary login or repeated refresh. Non-browser clients receive structured challenges without an assumed popup.
- Shared conformance rejects runtimes that ignore elevation policy. Tenant/app identity isolation and per-app role initialization remain intact.

Delivery: define contracts and provider SDK hooks; implement middleware/verifier enforcement and conformance; implement default-auth transactions/confirmation/factor extension; implement browser capture/dialog/retry and race handling; finally enable a low-impact pilot action. Add elevation to the initial expanded-auth release in both storage modes. SAML/SMS/WhatsApp implementation remains separately scoped.
