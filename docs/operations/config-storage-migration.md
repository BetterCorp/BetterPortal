# PostgreSQL configuration storage v2

Configuration is persisted as independently revisioned records in
`bp_platform_config_entities`, keyed by installation scope, entity kind and ID.
App routes, roles, menu, theme and other app-owned settings belong to that app's
record. Tenant metadata and each tenant service registration have separate
records. Shared services, activations, manifests, preview groups, preview
deployments, their effective settings, M2M bindings/grants and webhook targets also have separate records.

`loadConfig()` remains a compatibility read projection. It assembles these
records; it is not the unit of persistence. `saveConfig()` requires a snapshot
loaded from the same store, computes its changed entities and writes only those
entities. Detached whole-platform replacements are rejected. A no-op save does
not generate a new revision or notification.

Concurrent changes to different apps (including apps in the same tenant) commit
independently. A stale edit to the same entity returns a revision conflict. A
mutation also checks the versions of referenced records it relied on, such as a
service registration or the tenant it belongs to. These are real dependencies:
a service revocation must not race an app edit that assumes it is available.
Conflicts are HTTP 409 unless an endpoint safely reloads and reapplies the full
operation. The route handlers do this with a bounded retry.

Writes lock changed entities exclusively and referenced entities in shared mode,
in deterministic order. There is no platform-wide mutation lock or revision
comparison. Cross-entity operations commit in one transaction, including pending
action completion and the notification outbox. A reference table enforces
foreign keys. Hostname and other uniqueness claims are locked separately to
prevent concurrent creation of conflicting records with different IDs.

Presence remains in the activity table and does not change config revisions.
Manifest acceptance and config delivery timestamps use the database clock.
Sequence values identify notifications, but do not imply commit order: replicas
process every invalidation, including one arriving after a higher sequence.
The aggregate read cache and invalidation broadcast remain platform-wide; this
change isolates persistence, not the cost of assembling the compatibility view.

## Preview effective configuration

A new preview deployment captures the group's service settings and elevated role
IDs in its own `effectiveConfig`, stored as a separate deployment-owned record. Existing preview app routes and settings remain
in that preview app's independently stored record. Template edits affect future
previews; source-app edits, group configuration edits and sibling preview edits
do not replace an existing preview's settings. Redeploying the same preview key
keeps that deployment's settings. Shared service registrations remain explicit
shared dependencies.

During migration, deployments without `effectiveConfig` capture the group's
current settings once. Missing group references fail migration instead of
silently replacing settings with empty defaults. Existing ciphertext is copied
without decrypting it or changing the configured preview encryption key.

## Cutover

This is a coordinated upgrade, not a mixed-version rolling deployment.

1. Test against a restored database backup first. Check for duplicate IDs,
   hostname claims and dangling references; migration fails on invalid data.
2. Stop all old config-manager replicas and config writers. Back up the entire
   database, including pending actions, outbox, identity and activity tables.
3. Start one new config-manager replica with the existing connection, table name
   and scope. Initialization runs migration v2 in a transaction under the schema
   migration advisory lock. It locks the old config row, validates it, copies
   entities and references, captures preview settings, backfills legacy presence,
   verifies the assembled result, installs the old-writer fence, and records v2.
4. Confirm initialization succeeds and perform route/role edits in two different
   apps. Confirm existing PVE settings and service credentials are unchanged.
5. Start the remaining upgraded replicas. Initialization is idempotent: an
   applied v2 migration never reimports the old document.

The old `bp_platform_config` row is retained unchanged as a migration snapshot.
A database trigger rejects attempts by old binaries to update or delete it after
cutover. Old binaries could still *read* that frozen row, so they must not remain
in service. Do not remove the fence to permit mixed-version operation.

A migration failure rolls back the entity tables/data and migration marker as
part of the transaction; the original config remains usable. Investigate the
reported validation error and restart initialization after correcting the data.

After successful cutover, rolling back the application alone is unsafe because
new writes exist only in the entity tables. Roll back using the complete
pre-cutover database backup with all writers stopped, accepting loss of writes
made after that backup. There is no automatic downgrade or dual-write mode.

## Verification

Set `BP_CONFIG_TEST_POSTGRES` to a disposable PostgreSQL database and run
`node --import tsx --test tests/postgresIsolation.test.ts` from the config-manager
workspace. Each test creates and drops its own schema. CI supplies this variable
using its PostgreSQL service. Tests cover migration and restart, legacy-writer
fencing, independent app/tenant/service writes, the role-creation HTTP handler,
same-app conflicts, atomic rollback, foreign keys, hostname races, pending action
leases, database timestamps, presence and PVE effective settings.
