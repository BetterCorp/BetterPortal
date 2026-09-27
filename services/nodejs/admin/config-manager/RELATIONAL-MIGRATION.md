# Relational app data migration (PostgreSQL schema 3)

Roles, individual permission grants, routes, and menu items live in dedicated tables:
- bp_platform_config_roles
- bp_platform_config_role_grants
- bp_platform_config_routes
- bp_platform_config_menu_items

The prefix follows tableName. Primary keys include scope and app ID.
Menu parent/route relationships and role grant ownership have foreign keys.
Route options (SEO, fixed parameters, chrome) remain JSON configuration on their own route.
App settings retain revisions. Operational edits do not increment the app settings revision.
The outbox sequence signals service snapshot updates; it is not a CRUD concurrency token.

Admin role/route/menu edits use app-scoped transactions that load current state and write changed rows.
Reads query PostgreSQL in repeatable-read transactions instead of relying on replica cache broadcasts.
Existing sync/setup/preview snapshot writers use a compatibility delta writer: unchanged rows are
never replaced, and conflicting changes to the same row fail rather than silently overwrite data.

## Production rollout

Do not roll old and new config-manager replicas together. Older code cannot read the new tables.

1. Back up the config-manager database and identity/configuration state; verify restoration.
2. Stop all config-manager replicas and pause administration/sync writes.
3. Start one new replica. Migration runs in one transaction under the existing migration lock.
4. Original app records are preserved in bp_platform_config_app_data_backup. The migration populates
   relational tables, reconstructs and compares the complete config, then records version 3.
   Invalid/duplicate data or failed comparisons roll back the migration.
5. Verify IDs, grants, routes and nested menu ordering against the backup, and test the management app.
6. Start remaining replicas at the same version. Alternate reads across replicas and test a role edit.
7. Resume writes and verify service snapshot distribution.

A trigger fences old app-document writers after migration. It does not make mixed-version reads safe.
Keys, issuer, user accounts and identity configuration are unchanged.

## Recovery

Failed migration rolls back. Preserve the error and diagnose the source data.
After successful migration, do not downgrade the live database or delete migration markers.
Restore the pre-cutover database only with all replicas stopped and an agreed plan for subsequent writes.
The app backup supports recovery; it is not an automatic downgrade mechanism.

File storage remains a single-process development option with its existing document format.
