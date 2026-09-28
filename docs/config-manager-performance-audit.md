# Config-manager structured-data performance audit

Prepared 2026-09-28 against 10.6.31. The inventory below records the baseline; implementation status is recorded separately. These changes are not deployed.

## Implementation status — PR #94

Implemented:

- PostgreSQL menu, route, role and grant edits use one app transaction and changed relational rows, shared by the editor and alternate APIs. No platform snapshot load/save or config document revision is involved. Existing dependency locks, foreign keys, rollback and change outbox remain.
- Request context resolves management app settings and then the matched app. Routes/menu/auth page models and app selectors use scoped reads. The tenant/app list reads route choices without route options or grants. Services/config/settings/preview-service pages use registration directories without operational collections or preview snapshots.
- Auth/manifest caches read their own datasets without routes, menus or effective preview configs. Empty webhook polls and no-expiry maintenance avoid platform reads.
- Menu access comes from linked-route permissions. Audience options are visible radio controls; legacy non-route restrictions are preserved. Menu projection is computed once per response.
- App settings cloning excludes operational collections before copying. Retained aggregate assembly uses keyed tenant/deployment lookups.

Remaining from this inventory:

- Tenant/app settings mutations, fragment settings, service registration/reconciliation, M2M and webhook target CRUD still use the legacy versioned aggregate paths. Preview-environment detail pages still need dedicated projections.
- Service sync still constructs its projection from the platform snapshot, and change events still invalidate broadly. Auth cache refresh is a smaller read but still global.
- Actual expired-preview graph cleanup, bootstrap and aggregate export retain full configuration reads.

Validation: focused browser checks cover live HTMX audience selection and readable light/dark controls; PostgreSQL CI checks scoped isolation, concurrent edits, rollback and no snapshot fallback. Production latency must be measured after release/deployment; local test durations are not production benchmarks.

## Verified baseline and scope

Source baseline: `4b79fa436153c987304441e120792cfadd78a118` (10.6.31 release version commit). Inventory covers storage API references across all 72 files under config-manager/src, plus the request middleware, storage internals, sync/cache consumers, workers, and framework menu visibility evaluator. The appendix records every lexical loadConfig/saveConfig/mutateApp occurrence, including declarations and file-backend fallbacks; counts are not executed query counts.

Axiom 2026-09-27 ~15:28–15:43 UTC, after 10.6.31:

- 163 traced config reads: median 1.247s, p95 4.518s.
- Reconstruction median 984ms; database-read span median 223ms, p95 2.445s, maximum 13.22s.
- Services page median 1.251s (8 requests); menu page median 1.324s (4).
- One auth page: 14.117s total, 12.569s read, 925ms reconstruction, 251ms pool wait, 24ms rendering.
- Menu reorder: 18.255s total; first config load 1.097s, final handler 15.511s without inner write spans.

Read spans include client round trip, decoding and scheduling; these are not PostgreSQL execution plans. Five-minute sync GET streams are deliberately long-lived and excluded. No production benchmark or database EXPLAIN was performed for this prep.

## Architectural decision

Normal operations read their own rows and update their own rows. Do not build a partial BetterPortalConfig and route it through whole-platform saveConfig: its validation and deletion semantics assume a complete snapshot. Keep explicit, typed reads and transaction boundaries in existing storage modules; no new ORM, repository framework, cache service, or general query language.

Configuration documents remain versioned where needed, at the affected entity boundary. Menus, routes, roles and grants already have relational tables; their CRUD must not use document revisions or full-platform reconstruction. Whole snapshots remain an explicit operation for export, migrations, initial bootstrap and genuinely platform-wide transformations. Service sync needs a complete *service-scoped* projection, not every unrelated app.

## Findings and replacement scope

| Priority | Area / source | Current unnecessary work | Required replacement |
|---|---|---|---|
| P0 | index.ts resolveRequestContext / describeCorsContextFailure | Every request loads all config before handler execution | Resolve management settings, candidate app/hostname, owning tenant, relevant service aliases and auth only. Reuse existing host/context rules; preserve admin-tenant check. Diagnostics query identifiers/hostnames only. |
| P0 | index.ts page populate*Context | Whole config feeds even app selectors and service summaries | Summary queries for app/tenant selectors; selected-app routes/menu/roles only; page-specific service/manifest fields. No preview effective configs or unrelated manifests in lists. |
| P0 | menuEditor.ts all GET/POST endpoints | Full reads before edits, whole save, full reads after edits | App menu read; linked route metadata/grants for access summary; direct row updates in one short transaction. Render committed result without a second global reload. |
| P0 | adminApi.ts app menu API | Alternate API would retain the old slow path | Share the same scoped menu persistence and validation as editor; validate replacement against that app only. |
| P0 | postgres.ts mutateApp | Full read/clone/parse/compare, full reference validation, second full read | Replace callback over global config with scoped app-data operations. Lock affected app/rows; validate relevant dependencies under lock; use existing FKs and uniqueness checks. |
| P0 | adminApi.ts roles and role grants | App transaction still reconstructs all apps and data | Read/update selected app's roles/grants; preserve role authority, reserved root-role rules and service/view/action validation. Handle provider role sync through same scoped path. |
| P0 | adminApi.ts routes, manage/routes and menu link binding | Full config needed for route CRUD; multiple entry points | One scoped route operation, including valid service allocation, operation/parameter validation, aliases, page/API path rules, menu references and auth redirects. Recompute display groups from current mounts. |
| P0 | webhooks.ts processDeliveries | Loads full config before checking for pending work, every 30 seconds per replica | Claim work first; empty queue returns without config reads. Load claimed target and active tenant only. Keep leases, retry policy, disabled-target checks and cleanup. |
| P1 | index.ts refreshConfigCaches / warmAuthCache / refreshAuthCache | Any change reloads full config and warms all verifiers; lazy refresh also loads all | Read auth/alias data only; refresh affected app/provider where known. Keep generation fence, deletion/revocation handling and existing verifier continuity. Coalesce duplicate in-flight refreshes. |
| P1 | syncApi.ts projections / core.ts getScopedConfig | Clears every projection on every change; cache miss loads full platform before filtering | Build service-scoped SQL read from its tenant/app/service dependencies. Carry affected identities in change events and invalidate affected consumers; preserve full invalidation fallback for older/unknown events. |
| P1 | syncApi.ts reconcileServiceRegistry | Manifest submission can load/save global config and regenerate derived data | Upsert changed manifest once; reconcile only referencing apps/routes/permissions. Unchanged manifest should not write or broadcast. Reuse operation/permission derivation. |
| P1 | core.ts registerServicePublicKey | Full read/save for one service key | Conditional update of service entity, preserving matched/mismatch/replace semantics and affected auth metadata refresh. |
| P1 | fragmentsEditor.ts / manage/fragments / theme-config | Full load/save/reload for settings on one app | Read selected shell, fragment definitions and valid app targets. Version-check/update only that app's settings entity; return updated fragment model. |
| P1 | tenantManagement.ts / adminApi service CRUD | Whole config loaded for list, create, edit, deactivate or delete | List projections and single-entity changes. Deletion/activation transactions check indexed references; show real dependants without unrelated config assembly. Preserve tenant activation and installed-service protections. |
| P1 | shared-service activation/purge/migrate-to-shared | Platform scan and document merge | Query affected activations/apps/references. Transaction spans actual dependants; retain preview/dry-run diagnostics and all-or-nothing migration semantics. |
| P1 | adminApi.ts configure/config-ticket/automation/manage-current | One service/app lookup pulls all relational data | Target service/app/settings projection; keep credential redaction and tenant/app ownership checks. Contract generation reads only needed manifests. |
| P1 | adminApi.ts M2M + m2mConnections.ts | Global arrays scanned for app connections/grants | Scope bindings/grants/services/manifests to selected app/tenant. Conditional entity writes and existing approval rules; no need to invent additional tables just to read existing keyed entities. |
| P1 | webhooks.ts target CRUD/event enqueue | Global config for target listings, subscriptions, tenant checks | Target projections/filter by event/service/tenant; conditional target entity updates; enqueue only matched subscriptions. Never return target secrets in lists. |
| P1 | previewEnvironmentManagement.ts / previewApi.ts | Lists/details/expiry edits load every effective preview config; GET also performs expiry cleanup | Lightweight group/deployment list; effective config only on explicit detail/provisioning access. Scoped updates; expired item not visible; move global cleanup out of GET. |
| P1 | index.ts removeExpiredPreviews | Five-minute maintenance loads everything even if nothing expired | Query due expiry/replay rows first. Delete affected deployment graph transactionally; retain exclusive maintenance ownership and credential cleanup. |
| P1 | setupTokens.ts / bootstrapEndpoint.ts / install/wizard handlers | Simple existence/service lookups load everything | Targeted existence/service/tenant reads. Keep redemption claim and configuration write in one transaction, replay result and secret redaction. Initial bootstrap may assemble initial config once. |
| P1 | postgres.ts saveConfig | Parses/splits proposed full object, reads current/validated/committed snapshots, clones after commit | Gradually remove normal CRUD callers. For retained aggregate operations, read changed entities and dependencies, validate under appropriate locks, and avoid needless committed reread. Do not remove conflict protection without replacement. |
| P2 | postgres.ts readSnapshot / core.ts parse/canonicalize | Legacy migrations, schema parsing and auth metadata resolution rerun over every snapshot | Move actual legacy conversions to explicit idempotent migrations; validate writes and decode selected reads. Separate dynamic auth-provider metadata derivation from legacy conversion before removing read-time logic. |
| P2 | entities.ts assembleConfig / splitConfig | Repeated structuredClone and nested tenant/deployment finds; appSettings clones operational collections before dropping them | Once scoped paths exist, remove redundant copies; use maps in retained full-snapshot assembly. Make ownership explicit so mutations cannot leak between callers. |
| P2 | appData.ts read/hydrate/rows/save | Aggregates every app's tables; repeated row-map construction; per-row write round trips | Scoped predicates/projections first. Reuse maps within transaction. Batch affected position updates/grants only where measurement warrants; never replace unrelated rows. |
| P2 | SQL indexes and pool | Query/filter scope dominates; no measured justification for a larger pool | Existing PKs already begin scope_id/app_id for operational data. Explain scoped reads and add only demonstrated missing indexes: hostname/service dependencies, outbox due work, expiry. Tune pool only after removing full reads and measuring contention. |
| P2 | response rendering | getRoutes(appDef) rescanned for each menu row; repeated service/role searches; editor swaps trigger more work | Compute selected-app route/service/access maps once per response. Update affected row for simple edits; tree response for structural moves. Check sidebar refresh does not force unrelated reloads. |

## Existing efficient operations to retain

- PostgreSQL validateApiKey already queries matching hash and tenant activation directly; credential index exists. Do not regress to replica credential caching.
- touchServiceActivity already upserts its own table (last-seen writes throttled); file fallback legitimately loads its file.
- Identity, pending-action claims/completion, webhook delivery claims, outbox claims and cleanup already use dedicated tables. Preserve lease/transaction semantics.
- Outbox and delivery claims already use SKIP LOCKED; do not replace with a global process lock.
- Sync already coalesces projection promises per service. Improve its data scope/invalidation, not add a second cache.
- Pure renderer modules, roleAuthority, route validation, credential redaction and diagnostic helpers do not independently query storage. Feed scoped inputs; do not rewrite them merely because they accept config today.
- File storage is a supported separate backend; its necessary whole-file behaviour must not dictate PostgreSQL internals.

## Menu behaviour and UI

The runtime already supports automatic route auth via authRequired/menuPermissions produced by syncApi.injectResolvedServicePaths, plus service aliases and platform-root handling. Manual rolesAnyOf currently adds a separate gate before those rules. Remove that redundant editor input and use the same permission semantics to derive access information. Do not duplicate role IDs into menu rows.

Display visible, labelled radio/segmented choices per row: Automatic, Everyone, Signed in, Signed out, Has permission. Highlight the active choice; no collapsed Visibility section or dropdown. Show derived access beneath it (public, authenticated, matching roles, or unresolved metadata), plus a visible service-unavailable choice where relevant. Explain that menu visibility does not grant route access. Non-route links have no route permission to derive; groups follow visible children and explicit audience rules.

Audit all existing rolesAnyOf consumers and stored values before removal. Do not silently clear an independent existing restriction on external links/groups. Define an explicit compatibility/migration treatment, with a visible warning for legacy manual restrictions until resolved. For route links the accepted end state is route-derived access, not a hidden legacy field. Unknown route auth metadata must retain fail-closed automatic behaviour.

Reuse permission derivation used by runtime, including transitive operation dependencies, alias mapping, AND/OR requirements and root-role scope. A naive join of route.viewId to a role is insufficient where permission requirements span operations/services.

## Implementation order and completion checks

1. Request-context/auth reads and menu persistence end to end, including alternate menu API and link-edit route path. Query guard asserts zero full snapshot loads for PostgreSQL menu operations. Deliver visibility controls and derived access together.
2. Roles/grants/routes plus scoped editor/list reads. Test two apps in parallel, edits to different rows, same-row conflicts, reorders/removals, invalid cross-app references, reserved roles, route aliases and manifest-controlled API routes.
3. Workers, cache refresh and service-scoped sync. Verify empty webhook/expiry runs do not load config; committed changes propagate across replicas; revoked permissions and deleted apps disappear; a failed transaction emits no notification.
4. Remaining entity settings, tenants/services/shared activation, fragments, M2M, webhooks, previews and onboarding. Keep each operation's authorization, validation and atomicity. Real app/tenant-specific reads, not partial global configs masquerading as full snapshots.
5. Remove obsolete snapshot callers/read-time conversions; optimise retained exports/migrations and evaluate indexes from plans.

For each converted operation, record query count, rows/bytes read, lock/pool wait and elapsed time using existing request ctx.obs/eventObservability. No credentials, tokens, full configs or SQL parameters in logs. Instrument read, validation, write, commit/outbox and render; worker spans use their existing worker observability.

Run PostgreSQL integration tests with unrelated large apps/manifests/previews to prove per-app work does not grow with platform size; use structural query-scope assertions rather than fragile millisecond unit thresholds. Measure p50/p95 under concurrent representative traffic, then verify deployed Axiom timings separately. Target ordinary menu edits below 250ms server-side under representative load; this is a target, not a measured promise.

Check rendered light/dark UI and keyboard controls, HTMX success/error handling, rapid repeated edits and sidebar update after commit. No optimistic success before persistence. Keep production deployment separate from this prep; no live configuration changes were made.

## Complete storage-call inventory

Paths below are relative to services/nodejs/admin/config-manager/src/plugins/service-betterportal-config-manager. Declarations and file fallbacks are deliberately included to make exclusions explicit.

### adminApi.ts

| Line | Call / declaration |
|---|---|
| 115 | `if (store.mutateApp) return await store.mutateApp(appId, apply);` |
| 116 | `const config = await store.loadConfig();` |
| 118 | `await store.saveConfig(config);` |
| 1121 | `const config = await store.loadConfig();` |
| 1131 | `const config = await store.loadConfig();` |
| 1136 | `const config = await store.loadConfig();` |
| 1143 | `const config = await store.loadConfig();` |
| 1152 | `const config = await store.loadConfig();` |
| 1177 | `const config = await store.loadConfig();` |
| 1184 | `const config = await store.loadConfig();` |
| 1205 | `await store.saveConfig(config);` |
| 1211 | `const config = await store.loadConfig();` |
| 1218 | `const config = await store.loadConfig();` |
| 1230 | `await store.saveConfig(config);` |
| 1235 | `const config = await store.loadConfig();` |
| 1242 | `const config = await store.loadConfig();` |
| 1249 | `const config = await store.loadConfig();` |
| 1266 | `await store.saveConfig(config);` |
| 1273 | `const config = await store.loadConfig();` |
| 1286 | `const config = await store.loadConfig();` |
| 1300 | `await store.saveConfig(config);` |
| 1316 | `const config = await store.loadConfig();` |
| 1350 | `await store.saveConfig(config);` |
| 1359 | `const config = await store.loadConfig();` |
| 1378 | `await store.saveConfig(config);` |
| 1386 | `const config = await store.loadConfig();` |
| 1397 | `await store.saveConfig(config);` |
| 1410 | `const config = await store.loadConfig();` |
| 1437 | `await store.saveConfig(config);` |
| 1450 | `const config = await store.loadConfig();` |
| 1475 | `await store.saveConfig(config);` |
| 1488 | `const config = await store.loadConfig();` |
| 1500 | `await store.saveConfig(config);` |
| 1519 | `const config = await store.loadConfig();` |
| 1536 | `const config = await store.loadConfig();` |
| 1558 | `await store.saveConfig(config);` |
| 1567 | `const config = await store.loadConfig();` |
| 1582 | `await store.saveConfig(config);` |
| 1597 | `const config = await store.loadConfig();` |
| 1605 | `await store.saveConfig(config);` |
| 1629 | `const config = await store.loadConfig();` |
| 1657 | `const config = await store.loadConfig();` |
| 1667 | `await store.saveConfig(config);` |
| 1683 | `const config = await store.loadConfig();` |
| 1689 | `await store.saveConfig(config);` |
| 1699 | `const config = await store.loadConfig();` |
| 1704 | `await store.saveConfig(config);` |
| 1715 | `const config = await store.loadConfig();` |
| 1746 | `await store.saveConfig(config);` |
| 1788 | `const config = await store.loadConfig();` |
| 1995 | `await store.saveConfig(config);` |
| 2104 | `const config = await store.loadConfig();` |
| 2130 | `const config = await store.loadConfig();` |
| 2135 | `if (result.created.length > 0) await store.saveConfig(config);` |
| 2149 | `const config = await store.loadConfig();` |
| 2154 | `await store.saveConfig(config);` |
| 2164 | `const config = await store.loadConfig();` |
| 2348 | `const config = await store.loadConfig();` |
| 2376 | `const config = await store.loadConfig();` |
| 2390 | `return htmlResponse(renderWizardStep1(await store.loadConfig(), "Tenant and hostname are required.", undefined, adminApiBase), 200, "text/html; mode=fragment");` |
| 2398 | `const config = await store.loadConfig();` |
| 2406 | `const config = await store.loadConfig();` |
| 2443 | `const config = await store.loadConfig();` |
| 2578 | `await store.saveConfig(config);` |
| 2608 | `const config = await store.loadConfig();` |
| 2611 | `if (result.removed) await store.saveConfig(config);` |
| 2619 | `const config = await store.loadConfig();` |
| 2637 | `const config = await store.loadConfig();` |
| 2680 | `const config = await store.loadConfig();` |

### bootstrapEndpoint.ts

| Line | Call / declaration |
|---|---|
| 99 | `const config = await input.storage.loadConfig();` |
| 128 | `const freshConfig = await input.storage.loadConfig();` |
| 168 | `const freshConfig = await input.storage.loadConfig();` |
| 369 | `await input.storage.saveConfig(freshConfig);` |

### fragmentsEditor.ts

| Line | Call / declaration |
|---|---|
| 160 | `const config = await store.loadConfig();` |
| 174 | `const config = await store.loadConfig();` |
| 182 | `await store.saveConfig(config);` |

### index.ts

| Line | Call / declaration |
|---|---|
| 236 | `const config = await this.storage.loadConfig();` |
| 254 | `const config = snapshot ?? await this.storage.loadConfig();` |
| 292 | `const config = await this.storage.loadConfig();` |
| 327 | `? this.postgresStorage.loadConfig({ readOnly: true, obs: eventObservability(event) })` |
| 328 | `: this.storage.loadConfig();` |
| 373 | `hydrateManifestCache(await this.storage.loadConfig());` |
| 491 | `const config = await this.storage.loadConfig();` |
| 499 | `if (changed) await this.storage.saveConfig(config);` |
| 519 | `loadConfig: () => store.loadConfig(),` |
| 523 | `await store.saveConfig(config, metadata.backend === "file" && options?.notify !== false` |

### menuEditor.ts

| Line | Call / declaration |
|---|---|
| 573 | `const config = await store.loadConfig();` |
| 582 | `const config = await store.loadConfig();` |
| 637 | `const config = await store.loadConfig();` |
| 647 | `await store.saveConfig(config);` |
| 653 | `const config = await store.loadConfig();` |
| 660 | `await store.saveConfig(config);` |
| 662 | `const config2 = await store.loadConfig();` |
| 676 | `const config = await store.loadConfig();` |
| 701 | `await store.saveConfig(config);` |
| 730 | `const config = await store.loadConfig();` |
| 749 | `const config = await store.loadConfig();` |
| 764 | `await store.saveConfig(config);` |
| 775 | `const config = await store.loadConfig();` |
| 806 | `await store.saveConfig(config);` |
| 812 | `const config = await store.loadConfig();` |
| 819 | `await store.saveConfig(config);` |
| 825 | `const config = await store.loadConfig();` |
| 832 | `await store.saveConfig(config);` |
| 838 | `const config = await store.loadConfig();` |
| 847 | `await store.saveConfig(config);` |
| 853 | `const config = await store.loadConfig();` |
| 863 | `await store.saveConfig(config);` |
| 869 | `const config = await store.loadConfig();` |
| 879 | `await store.saveConfig(config);` |
| 885 | `const config = await store.loadConfig();` |
| 899 | `await store.saveConfig(config);` |
| 905 | `const config = await store.loadConfig();` |
| 937 | `await store.saveConfig(config);` |
| 986 | `await store.saveConfig(config);` |
| 992 | `const config = await store.loadConfig();` |
| 1006 | `await store.saveConfig(config);` |

### previewApi.ts

| Line | Call / declaration |
|---|---|
| 34 | `const config = await input.storage.loadConfig();` |
| 39 | `if (expired.length) await input.storage.saveConfig(config);` |
| 52 | `const config = await input.storage.loadConfig();` |
| 96 | `await input.storage.saveConfig(config);` |
| 103 | `const config = await input.storage.loadConfig();` |
| 112 | `await input.storage.saveConfig(config);` |

### previewEnvironmentManagement.ts

| Line | Call / declaration |
|---|---|
| 171 | `const config = await routeContext.storage.loadConfig();` |
| 183 | `await routeContext.storage.saveConfig(config);` |
| 188 | `await routeContext.storage.saveConfig(config);` |
| 193 | `await routeContext.storage.saveConfig(config);` |
| 207 | `await routeContext.storage.saveConfig(config);` |
| 221 | `const config = await routeContext.storage.loadConfig();` |
| 229 | `await routeContext.storage.saveConfig(config);` |
| 238 | `await routeContext.storage.saveConfig(config);` |
| 249 | `const config = await routeContext.storage.loadConfig();` |
| 254 | `await routeContext.storage.saveConfig(config);` |
| 284 | `const fullConfig = await routeContext.storage.loadConfig();` |

### setupTokens.ts

| Line | Call / declaration |
|---|---|
| 63 | `const config = await input.storage.loadConfig();` |
| 118 | `const config = await input.storage.loadConfig();` |
| 133 | `await input.storage.saveConfig(config);` |
| 170 | `const config = await input.storage.loadConfig();` |
| 309 | `await input.storage.saveConfig(config);` |
| 389 | `const config = await input.storage.loadConfig();` |

### storage/core.ts

| Line | Call / declaration |
|---|---|
| 356 | `abstract loadConfig(): Promise<BetterPortalConfig>;` |
| 357 | `abstract saveConfig(config: BetterPortalConfig, options?: { notify?: boolean }): Promise<void>;` |
| 648 | `const config = await this.loadConfig();` |
| 684 | `const config = await this.loadConfig();` |
| 686 | `if (result === "registered") await this.saveConfig(config);` |
| 695 | `const config = await this.loadConfig();` |

### storage/file.ts

| Line | Call / declaration |
|---|---|
| 20 | `async loadConfig(): Promise<BetterPortalConfig> {` |
| 31 | `async saveConfig(config: BetterPortalConfig, options?: { notify?: boolean }): Promise<void> {` |

### storage/postgres.ts

| Line | Call / declaration |
|---|---|
| 141 | `async loadConfig(options: { readOnly?: boolean; obs?: BetterPortalObservability } = {}): Promise<BetterPortalConfig> {` |
| 192 | `async saveConfig(config: BetterPortalConfig, options?: { notify?: boolean; completeAction?: PendingActionCompletion }): Promise<void> {` |
| 566 | `if (config) return this.saveConfig(config, { completeAction: input });` |

### syncApi.ts

| Line | Call / declaration |
|---|---|
| 48 | `const config = await store.loadConfig();` |
| 54 | `await store.saveConfig(config, { notify: false });` |
| 1050 | `const config = await store.loadConfig();` |
| 1058 | `await store.saveConfig(config);` |

### tenantManagement.ts

| Line | Call / declaration |
|---|---|
| 156 | `const config = visibleAdminConfig(await routeContext.storage.loadConfig());` |
| 209 | `const config = await routeContext.storage.loadConfig();` |
| 220 | `await routeContext.storage.saveConfig(config);` |
| 228 | `const config = await routeContext.storage.loadConfig();` |
| 239 | `await routeContext.storage.saveConfig(config);` |
| 255 | `const config = await routeContext.storage.loadConfig();` |
| 260 | `await routeContext.storage.saveConfig(config);` |
| 269 | `const config = await routeContext.storage.loadConfig();` |
| 303 | `await routeContext.storage.saveConfig(config);` |
| 311 | `const config = await routeContext.storage.loadConfig();` |
| 352 | `await routeContext.storage.saveConfig(config);` |
| 358 | `const config = await routeContext.storage.loadConfig();` |
| 362 | `await routeContext.storage.saveConfig(config);` |

### webhooks.ts

| Line | Call / declaration |
|---|---|
| 103 | `const config = await store.loadConfig();` |
| 166 | `const config = await store.loadConfig();` |
| 171 | `const config = await store.loadConfig();` |
| 186 | `const config = await store.loadConfig();` |
| 195 | `const config = await store.loadConfig();` |
| 218 | `await store.saveConfig(config);` |
| 224 | `const config = await store.loadConfig();` |
| 232 | `await store.saveConfig(config);` |
| 238 | `const config = await store.loadConfig();` |
| 274 | `const config = await store.loadConfig();` |
| 290 | `await store.saveConfig(config);` |
| 296 | `const config = await store.loadConfig();` |
| 298 | `await store.saveConfig(config);` |
| 304 | `const config = await store.loadConfig();` |
| 343 | `const config = await store.loadConfig();` |

