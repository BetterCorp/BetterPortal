# Default auth expansion: isolated tenants, Simple and Advanced modes

Status: approved design reference; implementation is in this workspace. See the [deployment and feature guide](../../services/nodejs/auth-default/README.md) for the shipped behavior and operational requirements.
Reviewed: 2026-09-12. Repository baseline: `e71c489` (`10.6.21`).
Scope: expand `services/nodejs/auth-default`, plus shared framework/auth-provider SDK/browser-runtime support for action-triggered elevation. Existing WorkOS and Authress business flows stay unchanged; generic elevation adoption requires the new SDK capability and trusted signing integration. The source-review table below describes the pre-change baseline; the deployment guide describes the implementation. No production deployment has been performed.

## Confirmed product direction

- Each tenant is a separate company. Users, groups, roles, credentials, recovery, audit visibility and administrative authority never span tenants.
- Each tenant chooses user isolation: `app` (default for new tenants) or `tenant`. The setting locks permanently when the first user is created anywhere in that tenant.
- In `app` isolation, each app has its own accounts and groups; the same email or social identity in another app represents a separate account. In `tenant` isolation, apps use one tenant-owned user directory, while roles remain per app.
- Every app logs in independently in both settings. Account availability across a tenant does not create a session in another app. No BP cross-app SSO, central shared session, or cross-app session exchange.
- Social login requires registering each app's actual callback URL with its provider. One provider client registration may list several callbacks where the provider supports it; each login transaction still belongs to exactly one app.
- Default auth has two operating modes: `simple` by default uses JSON and one tenant; explicitly configured `advanced` requires PostgreSQL and supports scale. User-count and other Simple limits are part of the design.
- Advanced startup automatically imports existing Simple data and cleans up successfully migrated active data files. Advanced-to-Simple downgrade is unsupported.
- Keep `*` unchanged. Ordinary users default to no roles; an optional per-app default-role list is assigned once on first successful login.
- Add app-wide temporary elevation: an action challenge opens confirmation or provider-specific factor verification, obtains a signed elevated access token and retries the original request. All eligible actions in the app may reuse elevation until expiry; normal refresh clears it. See [elevation design](auth-elevation.md).
- BP keeps its current per-app role/permission model. Default auth owns users, credentials, groups and role assignments; this work does not turn BP into a global user-management system.

Storage mode and identity isolation are separate settings. Upgrading JSON to PostgreSQL must not change which company or app owns an account.

## Current implementation and implications

| Area | Source-reviewed behavior | Plan implication |
|---|---|---|
| Local users | [UserStore](../../services/nodejs/auth-default/src/userStore.ts) stores a password hash, one tenant ID and `appRoles`; username uniqueness is per tenant. | Preserve the tenant boundary. Add explicit app ownership for new app-isolated directories. Existing data has tenant-wide account semantics. |
| Storage | One cached JSON file, atomic file replacement, single-process support. | Retain a bounded Simple implementation and implement PostgreSQL for Advanced. Add exclusive file ownership and versioned storage metadata. |
| Tenant restriction | [BPService](../../plugins/nodejs/betterportal-bsb/src/service.ts) supplies `tenantLock` through `validateTenantApp`; [default auth](../../services/nodejs/auth-default/src/plugins/service-betterportal-auth-default/index.ts) overrides this with `validateConfigScope`. | Simple must enforce both valid service activation and the single-tenant lock. Advanced retains activation checks without the Simple tenant-count restriction. This limits this auth instance, not the entire BP deployment. |
| Bootstrap | [Registration](../../services/nodejs/auth-default/src/plugins/service-betterportal-auth-default/registrationFlow.ts) creates only the first user in the whole store, assigns `*` for the current app, then closes. | Split management bootstrap from configurable customer signup. A new app or tenant must never bootstrap a platform administrator. |
| Passwords | bcrypt cost 12; registration minimum eight characters; optional unverified email. | Preserve hashes and user IDs; add verification, recovery, policy and UI. |
| Login | [Login flow](../../services/nodejs/auth-default/src/plugins/service-betterportal-auth-default/loginFlow.ts) looks up a tenant user and resolves roles for the requested app, defaulting to `[]`. | Preserve per-app role enforcement. Tenant mode uses the same account directory, with independent login and method policy per app. |
| Sessions | [Refresh](../../services/nodejs/auth-default/src/plugins/service-betterportal-auth-default/bp-routes/refresh/POST.ts) checks scope, enabled state, password version and revoked `jti`; the refresh token is reusable until expiry/revocation. | Add app-scoped session records, refresh rotation/replay handling and session management in both stores. |
| Tokens | [Contracts](../../framework/nodejs/src/contracts/auth.ts) and [spec](../../spec/auth.md) bind tokens to tenant/app and expand roles against the current app. | Preserve these contracts. No token or refresh session can authenticate another app. |
| Browser | [Auth design](../platform/auth-flow.md) defers cross-app SSO; [transport](../platform/security-and-auth.md) uses BP-managed headers. | Keep independent app sessions and existing shell header management. No central-cookie architecture. |
| Providers | WorkOS/Authress are separate services. | Their capabilities inform the comparison below; findings about their internals are outside this implementation backlog. |

## Identity isolation

Store a tenant-level `userIsolation: app | tenant` setting in default auth's scoped configuration. Persist its selected value and an irreversible `isolationLockedAt` in the identity store. Editing config, deleting the last user, removing an app, or upgrading storage must not clear the lock. All user creation paths—registration, invitations, social JIT, admin creation, import and future SCIM—use the same atomic lock operation. Pending invitations do not create users; first-account creation freezes the setting and any incompatible pending invitation must then fail or be reissued.

| Behavior | App isolation (new default) | Tenant isolation (explicit opt-in before first user) |
|---|---|---|
| Account lookup | Tenant + app + account identifier | Tenant + account identifier |
| Same email in two apps | Two independent accounts and credentials | One account, usable for independent sign-in to either app |
| Groups | Owned by that app within the tenant | Owned by the tenant; mappings to roles remain app-specific |
| Roles and assignments | Existing app-specific BP roles | Existing app-specific BP roles |
| Password/MFA/profile change | Affects only this app's account | Affects that account across the tenant's apps |
| Account disable/reset | Revokes sessions for that app-owned account | Revokes sessions for that tenant-owned account across its apps |
| Ordinary logout | Current app session | Current app session |
| Other tenants | Always separate accounts, even with equal email/provider subject | Always separate accounts, even with equal email/provider subject |

Example: a company's internal and external apps default to separate directories. An external customer cannot reset, link to, or modify an internal employee's account by using the same email address. Tenant mode is appropriate only when sharing account lifecycle across those apps is intentional.

A single directory record serves all app logins in tenant mode; no password or profile copying between app records is required. Authentication can succeed with `roles: []` when the app allows the login method/account and the route only requires authentication. Permission-protected routes still require their configured grants. Do not introduce a new mandatory app-membership gate that defeats the requested tenant-wide account behavior.

Resolve directory scope from trusted tenant/app context and locked configuration, never from an untrusted form field. Unique keys, foreign keys, queries, group membership, caches, background jobs, recovery and admin APIs all include the owning scope. A shared PostgreSQL database is sufficient for logical company isolation; a database per tenant is not required by this proposal.

## Simple and Advanced modes

| Concern | Simple | Advanced |
|---|---|---|
| Selection | Default on a fresh or legacy Simple installation when mode is omitted | Explicit `mode: advanced` |
| Identity persistence | Versioned JSON; current path retained; atomic writes | PostgreSQL required; fail readiness on unavailable/invalid storage |
| Tenant count | Exactly one bound tenant per auth instance using the existing tenant-lock mechanism | Multiple independently isolated activated tenants |
| Users | Proposed cap: 10 stored accounts total across the instance, including disabled/unverified accounts and administrators | No Simple product cap; apply operational quotas/rate limits |
| Apps | Multiple apps within the one tenant; no extra app-count cap proposed | Multiple apps per tenant |
| Processes | One writer/process; reject a second owner of the file store | Multiple replicas with database transactions and coordinated jobs |
| Isolation setting | App or tenant, locked at first user | Same choices; upgrade preserves the locked value |
| Security | Verification, recovery, MFA, safe protocols, revocation, abuse controls | Same security baseline |
| Later enterprise features | Proposed Advanced-only SAML/SCIM provisioning and bulk operations | Enterprise extensions added in later stages |
| Downgrade | Not a target for any previously Advanced installation | One-way mode transition, recorded durably |

The 10-account total and Advanced-only enterprise feature gates are proposals. An account in two app-isolated directories counts twice. Tenant-wide accounts count once. No mode should silently drop users or weaken security to satisfy a limit. Bound pending registrations/challenges, invitations, sessions, mail sends and audit retention independently; do not invent arbitrary numeric caps until operational requirements are known.

User-limit checks apply atomically to every creation path, including social login, imports and future provisioning. Disabling an account does not free a stored-account slot. Use bounded retention/deletion rules for stale unverified signups and challenge records, with abuse protection against exhausting the cap.

For existing Simple files already exceeding the chosen limits, propose blocking new account/tenant creation while preserving existing login and recovery, and surface the need to upgrade. Multiple tenants already present must not be silently reduced to whichever tenant requests first: require Advanced mode before serving that incompatible legacy store. Preserve all data for automatic import.

The Simple lock must bind a validated configured tenant, never an arbitrary unauthenticated tenant hint. Serialize the limit check, isolation lock and user write together; in Advanced use PostgreSQL transactions/constraints. Limits and isolation decisions are enforced on the server regardless of UI controls.

## Roles and first-login defaults

The existing `*` identifier and its display/semantics stay unchanged. It is platform-root authority in the configured management tenant/app, as defined by [Config Manager](../../services/nodejs/admin/config-manager/src/plugins/service-betterportal-config-manager/storage/core.ts) and [runtime authorization](../../framework/nodejs/src/adapters/h3.ts). An empty role list remains the ordinary default and grants no role-based permissions.

Add an optional app-scoped `defaultRoleIds: string[]` setting in default auth's service configuration, defaulting to `[]`. An authorized administrator selects a subset of that app's existing BP roles. On a user's first successful login to that app, assign those roles once. This applies to both local and social sign-in, and eventually enterprise login where the app's provisioning policy permits it.

- Validate selected role IDs against the current app's configured roles and the configuring administrator's grant authority. `*` is forbidden as a default. Do not create or rename BP roles to implement defaults.
- Defaults belong to an app even in tenant isolation. A tenant-wide account receives app A's defaults on its first login to A and app B's defaults only after independently logging in to B. App-isolated accounts naturally initialize separately.
- Apply defaults after account/method policy, email verification and required MFA succeed, before issuing the first usable session/token. Failed or incomplete authentication does not assign roles.
- Persist a per-user/per-app initialization record atomically with role assignment. Concurrent first logins and retries cannot duplicate grants. Persist the record even when defaults are empty.
- Later logins/refreshes use current assignments and never reapply defaults. Removing all roles does not reset initialization; changing defaults does not retroactively change existing assignments.
- Proposed precedence: explicit admin/invitation/provisioning assignments, including an intentional empty assignment, mark initialization complete and take precedence over defaults. Do not silently add privileges to an explicitly provisioned account. Group-to-role mappings remain a separate, current source of app-specific assignments.
- Revalidate referenced roles at assignment time. If a configured default role has disappeared or become invalid, fail first-login provisioning with an actionable configuration error; never substitute a wildcard or broaden the grant. Existing initialized users can continue using their own valid assignments.
- Audit initial grants with app, user, selected roles and configuration revision. Admin role removal and subsequent login must be tested together.

Preserve legacy users' assignments during migration and mark their initialization complete for apps already configured at cutover, including empty lists. This avoids retroactively granting defaults to imported users or undoing earlier role removals. Newly added apps can apply their own first-login defaults under the normal rules. Preserve root assignments through migration; ordinary signup or external group/default-role mappings cannot grant `*`.

Default roles add default-auth configuration and assignment behavior using BP's existing per-app roles. They do not require a BP role-label change or changes to another auth provider. Elevation is a separate shared-runtime extension.

## Provider landscape and lessons

This covers the main relevant product families and named providers, rather than claiming an exhaustive inventory of every vendor. Links are first-party documentation checked during this review. Fit assessments are our architectural judgment. Product editions, limits, regional availability, and commercial terms require validation in a shortlisted-provider proof of concept.

| Offering | Documented model/capabilities relevant here | Lesson or fit for BetterPortal |
|---|---|---|
| WorkOS AuthKit | User management, local/social login, MFA, organizations, memberships; enterprise SSO and directory products. [AuthKit](https://workos.com/docs/authkit/overview), [users/organizations](https://workos.com/docs/authkit/users-organizations), [SSO](https://workos.com/docs/sso). | Strong managed B2B reference and an existing integration. Its documented email-based automatic linking needs particular review against our identity-isolation policy. |
| Authress | Federation, local/passwordless methods, MFA, passkeys, tenant connections, and authorization capabilities. Tenant/connection combinations can yield different subject IDs. [Authentication](https://authress.io/knowledge-base/docs/authentication/user-authentication), [tenant model](https://authress.io/knowledge-base/docs/authentication/tenants). | Existing integration and useful reference for customer-owned connections. Reference its connection isolation when designing default auth; the BP Authress adapter is unchanged. |
| Google direct | OpenID Connect sign-in; stable subject, issuer/audience checks, email and hosted-domain claims. [OIDC](https://developers.google.com/identity/openid-connect/openid-connect). | A login adapter, not a customer membership or local password-reset platform. Workspace domain restrictions require validated claims and BP policy. |
| Microsoft direct / Entra ID | OIDC authentication with account/tenant-specific authorities. [Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc). | Separate personal Microsoft login from organizational Entra federation. Bind enterprise connections to allowed directory tenants and issuer rules. |
| GitHub direct | OAuth authorization-code login followed by authenticated API identity lookup. [OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps). | Dedicated OAuth adapter. Do not treat GitHub Actions workload OIDC as end-user sign-in. Use stable user ID, not a mutable login name. |
| Google Identity Platform / upgraded Firebase Auth | Separate user/configuration silos with password, social, SAML, and OIDC authentication. Tenant limitations include inability to disable account linking. [Multi-tenancy](https://docs.cloud.google.com/identity-platform/docs/multi-tenancy). | Full auth backend, distinct from Google direct. Tenant silos are a relevant isolation reference; test further app isolation and linking rules. |
| Microsoft Entra External ID | Customer-facing identity in external tenants; local signup/recovery and federated methods. [Overview](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam), [methods](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers). | Full CIAM option, distinct from direct Microsoft sign-in and workforce tenants. Validate the exact federation methods and release status required; product names do not imply parity. |
| Auth0 / Okta Customer Identity | Organizations and multi-organization application architectures. [Architecture](https://auth0.com/docs/get-started/architecture-scenarios/multiple-organization-architecture). | Broad managed-platform benchmark. Map customer organizations separately from provider deployment tenants. Customer Okta workforce directories can instead be upstream enterprise IdPs. |
| Clerk | Organization memberships, roles, and organization-associated SAML/OIDC enterprise connections. [Organizations](https://clerk.com/docs/guides/organizations/overview), [connections](https://clerk.com/docs/reference/backend/enterprise-connections/create-enterprise-connection). | Useful admin/self-service UX reference. Test integration with BP's existing themes and headers rather than assuming frontend components fit. |
| Stytch B2B | Organization/member model, SSO, SCIM, and configurable organization authentication methods. [Enterprise features](https://stytch.com/docs/get-started/guides/enterprise-ready), [organizations](https://stytch.com/docs/api-reference/b2b/api/organizations/overview). | Good reference for organization-specific policy. Use separate company accounts as the BP requirement, regardless of a vendor's organization-sharing model. |
| Kinde | Organization-based multi-tenancy and enterprise connections. Its enterprise identity model has linking constraints. [Organizations](https://docs.kinde.com/build/organizations/multi-tenancy-using-organizations/), [enterprise identities](https://docs.kinde.com/authenticate/auth-guides/enterprise-connections-identity/). | Another managed B2B option; compare its isolation and connection rules against separate tenant/app directories. |
| Amazon Cognito | User-pool federation and documented tenancy patterns using pools, app clients, or custom approaches. [Tenancy](https://docs.aws.amazon.com/cognito/latest/developerguide/multi-tenant-application-best-practices.html), [federation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html). | Cloud-operated building block; BP must still model membership, provisioning, and app authorization. |
| Supabase Auth | Project authentication with SAML SSO and explicit identity/account-linking behavior. [SAML](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml). | Relevant if adopting its backend; review organization management and lifecycle separately from database authentication. |
| Keycloak | Realms, clients, organizations, OIDC/SAML identity brokering, and user administration. [Administration guide](https://www.keycloak.org/docs/latest/server_admin/). | Strong self-hosted protocol-engine candidate. Operations, upgrades, recovery, and tenant mapping become our responsibilities. |
| ZITADEL | Organizations/projects and instance-wide or organization-specific OIDC/SAML identity providers. [Organizations](https://zitadel.com/docs/guides/manage/console/organizations-overview), [identity providers](https://zitadel.com/docs/guides/integrate/identity-providers/introduction). | Strong reference for explicit organizational ownership, delegated access, and per-organization login policies. |
| FusionAuth | Tenants, users, applications and registrations, plus OAuth/OIDC/SAML. [Tenants](https://fusionauth.io/docs/get-started/core-concepts/tenants), [documentation](https://fusionauth.io/docs/). | Good fit to investigate for isolated directories and explicit application registration. Check features and licensing for the intended deployment. |
| Ory | Kratos handles identity/self-service; Hydra provides OAuth/OIDC authorization-server functionality. [Kratos](https://www.ory.com/docs/network/kratos/intro), [Hydra](https://www.ory.com/docs/network/hydra). | Clear separation of identity management and protocols. More assembly work; evaluate the exact hosted/open-source/enterprise combination. |
| Better Auth | In-process TypeScript auth library with organization and SSO plugins supporting OIDC/SAML. [Plugins](https://better-auth.com/docs/plugins), [SSO](https://better-auth.com/docs/plugins/sso). | Candidate to prototype inside expanded default auth. Validate storage, session/cookie expectations, security maintenance, and BP integration before adopting it. |
| Ping Identity / PingFederate | Enterprise federation and identity bridging for employee, partner, and customer SSO. [PingFederate](https://docs.pingidentity.com/pingfederate/13.0/introduction_to_pingfederate/pf_intro_to_pf.html). | An enterprise interoperability target; evaluate as a platform only if customer or deployment requirements justify it. |

These products are capability and protocol references for expanding default auth. This project does not replace, refactor, or change the existing WorkOS/Authress services, and does not select a hosted replacement. Evaluate maintained in-process protocol libraries against the default service's JSON/PostgreSQL storage and independent-app requirements.

Commercial evaluation should price realistic numbers of monthly active users, active organizations, enterprise SSO connections, directory connections, applications, machine identities, email/SMS sends, regions, custom domains, audit retention, and support. Include migration/export rights and operational effort. This review does not assert vendor prices or plan entitlements.

## Initial platform capabilities

These are requirements for expanded default auth. Simple and Advanced share the same account-security behavior; storage/scale and selected later enterprise capabilities distinguish the modes.

| Area | Initial release | Later extension |
|---|---|---|
| Signup and invitations | Configurable public/invite-only/closed, verified email, expiring/revocable invitations, safe retries, no client-selected roles | Approval queues, bulk onboarding |
| Local credentials | Password login and change, legacy usernames, long-password support, versioned hashes | Passwordless-first policies |
| Account recovery | Forgot/reset password, one-use expiring challenges, generic responses, throttling, session invalidation and notification | Audited assisted recovery |
| Email lifecycle | Verification/resend; pending email change with proof and reauthentication | Multiple verified addresses, custom mail branding |
| Social login | Google, Microsoft and GitHub through maintained adapters; per-app callback and connection policy | Further providers and custom enterprise OIDC |
| Identity linking | Prove ownership of both methods; link only inside the same tenant/app directory; prevent removal of last allowed method | Controlled provider migration within a directory |
| MFA | TOTP and recovery codes; proposed mandatory MFA for administrators; sensitive-operation reauthentication | Passkeys/WebAuthn and trusted upstream assurance mappings |
| Elevation | App-wide temporary confirmation or verified MFA; middleware challenge, auth-service token issuance and runtime request retry; ordinary refresh removes elevation | Provider-specific factor hooks and stricter assurance policies; see [design](auth-elevation.md) |
| Sessions | Per-app/device session inventory, rotation/replay handling, current-session and account-session revocation, idle/absolute expiry | More restrictive enterprise policies and risk checks |
| Users/groups/roles | Scoped account administration; small group membership, group-to-app-role mapping and one-time per-app default roles; existing BP permissions | SCIM-managed groups and attribute mappings |
| Self-service UI | Profile, password, linked accounts, MFA and sessions; scoped deletion/disable with last-admin protection | Account export and support workflows |
| Admin UI | User/group management, signup policy, connection setup, default-role selection, app-role assignment and audit events in default-auth views | Enterprise connection testing and certificate rollover |
| Abuse controls | Account/IP/tenant/app-aware throttling, signup/mail quotas, bounded challenge attempts, generic safe errors | Risk-based challenges and anomaly alerts |
| Operations | Encrypted secrets, key rotation, health checks, mail queue/retries, backups/restores, scoped audit and redacted logs | Extended retention/export, regional deployment |

Local passwords should support managers and long input, reject common/compromised choices and avoid arbitrary periodic rotation. Use recent authentication for sensitive changes. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Preserve legacy bcrypt hashes; consider Argon2id for new hashes and upgrade on successful authentication. Handle bcrypt input limits explicitly. [Password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Recovery tokens are random, hashed at rest, purpose/scope-bound, expiring and atomically consumed. Requesting a reset must not modify the account. Avoid enumeration and reset links built from untrusted hosts. In app isolation a challenge for the external app cannot reset an internal app account. [Recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Default-auth implementation boundaries

Keep identity/storage/account implementation in default auth using its service configuration, routes, renderers and existing framework helpers. BP continues distributing app role definitions and validating tokens. The requested elevation feature explicitly adds shared route/claim/challenge contracts, server verification, auth-provider SDK hooks and browser retry behavior; affected cross-language conformance is required before enabling it. The [separate elevation plan](auth-elevation.md) specifies this extension.

Both persistence adapters implement domain operations, including `createUserWithinLimit`, `lockIsolation`, `consumeChallenge`, `acceptInvitation`, `rotateRefresh`, `initializeAppRolesOnce`, and `setPasswordAndRevokeSessions`. Generic CRUD cannot express the atomicity guarantees required. Simple uses a single-process lock and atomic persisted updates; Advanced uses PostgreSQL transactions, unique constraints and scoped foreign keys.

| Entity | Ownership and behavior |
|---|---|
| Store metadata | Schema version, installation identity, operating-mode history and migration state |
| Tenant identity settings | Tenant ID, chosen isolation, permanent first-user lock; scope must match service configuration |
| User | Immutable BP subject, mandatory tenant ID, directory scope (tenant or app), enabled state, profile and timestamps |
| Credential/authenticator | Same directory and user; optional password, hash version, encrypted MFA secrets, hashed recovery codes |
| External identity | Directory + trusted issuer/provider namespace + stable provider subject mapped to a local user |
| Group/membership | Same directory as users; groups cannot include identities from another isolated app or tenant |
| Role assignment/group mapping | Tenant, app and local user/group; only roles in that app's BP configuration |
| First-login role initialization | Tenant/app/user, completed flag/time and config revision; survives clearing assignments; prevents reapplying defaults |
| Connection/app binding | Tenant-owned configuration with explicit app bindings, client credentials, callback URLs, protocol/claim constraints and secret references |
| Elevation transaction | Current subject/session, tenant/app, initiating action and requested assurance; one-use confirmation/factor completion; issues app-wide elevation without changing roles |
| Login transaction | Tenant/app/directory, connection, browser binding, state/nonce/PKCE, exact callback and safe return destination; expiring and one-use |
| App session/refresh family | User, exact tenant/app, authentication evidence, expiry, revocation, rotation and replay status |
| Provider credentials | Encrypted server-side secrets attached to that app session; never placed in browser-readable JWTs |
| Invitation/challenge | Issuing app, target directory and purpose, recipient/user, hash, expiry, attempts and consumption |
| Audit/outbox | Tenant/app visibility, actor/subject/outcome, correlation and idempotent durable delivery |

Tenant isolation can share an identity across its apps using an explicitly trusted upstream identity namespace. App isolation always includes the app directory in the key, even if two apps use the same Google client ID or upstream subject. No automatic cross-directory linking or account merging, including by an administrator or import routine.

Each request resolves trusted tenant/app scope and service activation, then enforces the configured directory, account status, allowed login connection and required authentication strength. BP then applies current app permissions. For tenant-mode identities, an app administrator must not gain authority to reset or disable a tenant-wide identity merely through an app-specific role; those lifecycle actions require tenant-directory authority. Tenant admins may manage their own tenant's app directories through explicit permissions.

Signup mode governs account creation, not whether an existing tenant-directory user must create another account for each app. Group names, role assignments and signup grants never transfer between independent apps by coincidence. Enabling a new app does not automatically give a user any of its protected permissions.

### Independent app login

Each app owns its login start, callback registration, return destination, BP headers, refresh state and logout. Even in tenant mode, app B must complete its own authentication flow; a BP session from app A cannot bootstrap it. No cross-app token exchange, shared login cookie, or central login authority is introduced.

Register all app callbacks explicitly in Google/Microsoft/provider settings where supported. If a provider's registration cannot accommodate the required callback set, use separate provider client registrations. Upstream providers may reuse their own session during an app's independent redirect flow; that is not a BP cross-app session or a guarantee that another app is authenticated.

Every callback validates a browser-bound, random one-use transaction and its original app/connection. Follow authorization code/PKCE and OIDC nonce/issuer/audience/signature/expiry validation; return paths are separate from state. Keep exchanges and upstream credentials server-side, with only scoped BP credentials returned through the existing shell transport. [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

Keep the existing signed refresh wire contract initially, with a server-side session reference in `refreshContext`. Rotation and replay handling must work atomically, including concurrent browser tabs and bounded retries. No database/file error may fall back to unvalidated refresh or silently switch storage modes.

Current default access-token lifetime is 15 minutes unless configured otherwise. Disabling users or resetting passwords denies refresh immediately, but already-issued access tokens remain usable until expiry. Decide a target lifetime before promising revocation latency. Role-definition changes apply after BP config propagation; assignment changes are reflected in newly issued tokens. Immediate distributed access-token revocation is a separate platform change, not silently included here.

## Future enterprise support

Generic enterprise OIDC and SAML are incoming login methods to each app, compatible with the independent-app rule. Enterprise IdP SSO is distinct from BP cross-app SSO. Design adapter/connection capabilities now; implement provider setup and enterprise UX later, proposed Advanced-only.

- **OIDC:** trusted discovery/issuer, app-specific callbacks, client credentials, allowed upstream directory/organization IDs, claim mapping and trusted assurance. Protect discovery/JWKS fetches against SSRF and unsafe redirects. Do not treat equal email as proof of shared identity.
- **SAML:** configured IdP entity/metadata/certificates, app-specific SP/ACS mapping, immutable subject attributes, certificate rollover and maintained protocol implementation. Verify signature, recipient/audience/destination, time, request correlation and replay; prevent unsafe XML parsing/signature wrapping. Start SP-initiated, with IdP-initiated behavior and single logout separately specified. [SAML guidance](https://cheatsheetseries.owasp.org/cheatsheets/SAML_Security_Cheat_Sheet.html).
- **SCIM:** directory-scoped provisioning credentials, stable external IDs, users/groups, idempotent create/update/deactivate, PATCH, pagination/filtering and reconciliation. Deprovision only that directory. In tenant mode disabling the shared tenant user affects all its app sessions; in app mode other app accounts are unaffected. [SCIM protocol](https://www.rfc-editor.org/info/rfc7644/).
- **Enterprise policy:** domain verification, enforced provider login, group-to-app-role mappings, connection test/activate, audit export and explicit recovery. Password/reset/social paths must not bypass an app's enterprise-only policy.
- **External API OAuth:** if required later, model separate user/tenant/app grants, consent/scopes and encrypted API credentials. Login must not implicitly grant calendar/mail/repository access.

Acting as a downstream OAuth/OIDC/SAML identity provider for unrelated software is outside this plan. Adding ordinary enterprise login adapters does not require operating a general-purpose authorization server.

## Automatic Simple-to-Advanced migration

Migration is a startup state machine, not “read JSON, write rows, delete file.” It is automatic for valid, unambiguous data when Advanced is explicitly selected. Ambiguous ownership or conflicting imports fail readiness with a repairable diagnostic instead of guessing, deleting records, or serving an empty auth database.

### Startup selection

| Configuration and persisted state | Required outcome |
|---|---|
| Mode omitted; no Advanced history | Start Simple, including on legacy JSON deployments |
| Advanced explicitly selected; no Simple identity data; new/owned PostgreSQL store | Validate schema/installation identity and start Advanced; record mode durably |
| Advanced explicitly selected; valid Simple data exists | Lock, validate, import, verify, commit, mark Advanced, clean active source data, then serve |
| Advanced selected; PostgreSQL unavailable | Fail readiness; never serve from Simple as fallback |
| Simple selected or omitted; migration intent or Advanced history exists | Refuse downgrade/fallback; explain that Advanced and its database configuration are required |
| Advanced already migrated; matching leftover JSON exists | Resume verified cleanup without importing again or overwriting newer PostgreSQL data |
| Advanced database has unrelated/conflicting data | Refuse blind merge; preserve source and target for reconciliation |

Use a durable marker in the existing persistent bootstrap/state location plus a PostgreSQL migration ledger. The marker is retained after source cleanup and checked before Simple startup. Write migration intent before modifying PostgreSQL; even a crash between database commit and local completion must not allow a subsequent omitted-mode restart to reopen Simple. A new replica must share/receive the installation identity and Advanced configuration; deleting or replacing all durable identity metadata is not a supported downgrade path.

### Import sequence

1. **Exclusive ownership and readiness:** reject traffic/writes during migration; take the Simple file ownership lock and a PostgreSQL migration lock. Other replicas wait for the completed ledger. Verify both stores belong to the same auth installation.
2. **Preflight:** validate source schema, checksum, IDs, tenant/app references, isolation, roles, revocation records and readable secrets. Detect duplicate/conflicting IDs and existing target data. Preserve unknown fields through a versioned mapping or fail explicitly; never silently discard them.
3. **Durable intent and backup:** record an import ID/source checksum and migrating state. Create a protected recoverable snapshot outside the active Simple data path; keep signing/encryption keys available. A backup is for recovery/audit, not a supported downgrade target.
4. **Transactional import:** insert tenant settings, users, hashes, groups/assignments and role-initialization records, challenges/sessions where compatible, and revocation state. Use a migration ledger bound to the source snapshot so retries cannot duplicate users or overwrite later changes. Commit the imported identity data and completion record atomically.
5. **Verify:** compare counts, stable IDs, hashes, scope/role mappings, root account, settings and revocation state. Verify imported account authentication against the storage adapter and availability of signing/encryption keys before cutover; do not need or expose users' plaintext passwords.
6. **Cutover:** mark the installation Advanced durably, persist effective isolation locks, and make PostgreSQL authoritative. Preserve existing signing identity/JWKS to avoid breaking downstream verification. Readiness stays closed until import/cutover requirements are met.
7. **Cleanup:** remove only the recognized imported Simple identity/session data files after verified durable commit and mode recording. Retain bootstrap/install state, signing keys, encryption keys, mode markers, unrelated files and the protected recovery snapshot. Never delete an entire state directory. If deletion fails, keep the completed migration marker, report degraded cleanup and retry without reimporting; PostgreSQL remains authoritative.
8. **Crash recovery:** resume by import ID and checksum. A crash before commit reruns the transaction; after commit it verifies the ledger and finishes markers/cleanup. A different source checksum or unexplained target conflict stops automatic recovery. Test every boundary, including simultaneous startup and interrupted cleanup.

Migration does not relax Simple caps by discarding excess users: Advanced imports all valid records, including disabled accounts and over-limit legacy stores. It also does not clear the original tenant boundary or convert root authority into a default role.

### Legacy isolation and session compatibility

Existing JSON records are tenant-owned and may have roles in multiple apps. Proposed compatibility rule: infer `userIsolation: tenant` for a tenant that already has legacy users, preserve each user ID and all per-app assignments, and persist its already-locked setting. New empty tenants default to `app`. A request to reinterpret populated legacy data as app-isolated is rejected; it requires a separate migration plan for downstream user references, not an implicit storage upgrade.

Once a tenant has ever had a user, deletion cannot unlock isolation. This applies to legacy imports as well as fresh creation. Database constraints and persisted lock history enforce the rule even if config is edited outside the UI.

Preserve bcrypt hashes, password-version counters, disabled flags and revoked-refresh entries. Email remains unverified unless verification evidence exists. Proposed session cutover: invalidate all legacy refresh sessions using a persisted cutoff/version recognized by the new refresh handler, and require independent sign-in again. Already-issued access tokens expire normally; no unrecorded session revival is allowed. This is separate from keeping user credentials valid. A legacy user does not need a password reset just because storage changed.

After Advanced accepts writes, a stale JSON backup cannot be restored as Simple. Recovery restores/repairs PostgreSQL and current key/state material, preserving subsequent password changes and revocations.

## Delivery and acceptance

| Stage | Deliverable | Acceptance gate |
|---|---|---|
| 1 — Modes and scoped storage | Simple JSON adapter, PostgreSQL adapter, activation + tenant lock, cap enforcement, tenant/app directories and immutable isolation setting | Two tenants cannot access each other's records. App-mode accounts cannot resolve in sibling apps. Concurrent first-user creation/config edits cannot change the locked setting. |
| 2 — Migration and bootstrap | Startup state machine, legacy compatibility, markers/ledger/cleanup, controlled management bootstrap | Automatic upgrade preserves user IDs/passwords/roles; crashes and concurrent replicas do not duplicate/delete data; omitted/Simple mode after upgrade fails; root access is preserved. |
| 3 — Self-service and administration | Signup/invites/verification/reset, groups/role assignments, MFA, sessions, abuse controls, default-auth admin/account views | All creation paths honor quota/scope; challenges are one-use; account lifecycle cannot cross directory boundaries; ordinary signup cannot acquire root privilege; first-login defaults apply once and cannot restore revoked roles. |
| 4 — Elevation | Shared enforcement/contracts, generic confirmation and provider hook, default-auth factor verification, browser request capture/dialog/retry | Confirmation cannot satisfy MFA; elevation is reusable for eligible actions in one app; expiry/normal refresh removes it; retries cannot silently duplicate writes. |
| 5 — Social sign-in | Google/Microsoft/GitHub adapters, app-specific registration/callbacks, safe linking and browser flows | Login in A leaves B unauthenticated in both isolation settings. Wrong app/state/issuer/organization and replay are rejected. Same external identity cannot merge app-isolated users. |
| 6 — Enterprise additions | Generic OIDC, SAML, then SCIM/group sync; explicit Advanced feature gates | Independent app authentication is preserved; enterprise-only login cannot be bypassed; provisioning affects only the configured directory. |

Mode/storage/isolation decisions land before adding public signup. Initial production capabilities cover stages 1–5. Enterprise protocol interfaces are designed early; cross-app SSO remains excluded. Existing provider business flows remain outside the refactor, while the common elevation SDK requires an explicit issuer integration for any provider adopting it.

### Implementation verification

- Extend [default user-store tests](../../services/nodejs/auth-default/tests/userStore.test.ts) for JSON/PostgreSQL parity, scope isolation, tenant locks and quota races.
- Test two companies with the same email/provider subject; internal/external apps with independent users; tenant-mode shared account changes with app-specific roles and separate sessions.
- Test isolation edits racing with registration/import/JIT; the lock survives deleting every user and upgrading storage.
- Test user 10 versus user 11, parallel creates, disabled/unverified users, invitation acceptance, account linking and existing over-limit data. Linking an existing account must not consume an extra slot.
- Test every migration crash point, changed sources, foreign/nonempty databases, PostgreSQL outages, interrupted cleanup, leftover files, marker tampering/missing installation state and attempted downgrade.
- Test per-app default-role validation, MFA-before-assignment, concurrent first login, empty defaults, explicit provisioning precedence, changed defaults, deleted role references and legacy initialization. Removing defaults/roles must not cause later login to restore them.
- Test callbacks/PKCE/state, scoped recovery, email changes, MFA recovery, refresh rotation/reuse, account/group disable, per-app logout and role changes.
- Test email retries, limited disk space, backups/restores, key continuity and logs without secrets. No migration is successful merely because row insertion succeeded.
- Preserve normal framework/wire behavior and add elevation conformance across supported runtimes. Test generic confirmation, factor-policy enforcement, app-wide reuse, expiry/refresh stripping, role checks (including root), exact request preservation and one bounded retry. Existing WorkOS/Authress business flows are outside the change set; old binaries without elevation issuance advertise no capability.

## Planning assumptions resolved by implementation

Confirmed: tenant/company isolation; new default app isolation; immutable setting after first user; independent app logins; JSON Simple versus PostgreSQL Advanced; one tenant in Simple; automatic one-way upgrade; existing providers unchanged; `*` unchanged; optional one-time per-app default roles, with an empty list by default; app-wide temporary elevation through shared runtime and extensible auth-service verification.

The implementation selects these defaults; the service README is the deployment reference:

1. Simple user cap: 10 stored accounts across the instance. Disabled and unverified users count. Existing over-limit installations retain login/recovery and can migrate to Advanced; accounts are never silently removed.
2. First-login defaults: explicit-assignment precedence and legacy initialization described above; these preserve administrative decisions while implementing the requested defaults.
3. Legacy compatibility: preserve populated tenant-wide directories during automatic upgrade; reject automatic conversion to app isolation. This preserves existing account identity/access.
4. Signup defaults and feature gates: invite-only when unspecified, otherwise configurable public/invite-only/closed; proposed Advanced-only enterprise/bulk provisioning. No separate Simple app cap proposed.
5. Postal/custom HTTP delivery, explicit PostgreSQL deployment with shared keys, 15-minute access tokens and seven-day absolute sessions are implemented. Enterprise connections, external API OAuth, automated key rotation and assisted recovery remain later work. Load testing and live provider credentials belong to deployment validation.

This revision supersedes the earlier shared-global-identity, central-SSO and multi-provider-refactor proposals. The [elevation companion](auth-elevation.md) records the subsequently requested shared-runtime extension. The implementation now includes the default-auth service, shared elevation runtime and SDK contracts, tests, and deployment documentation.
