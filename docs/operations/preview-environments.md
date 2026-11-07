# Preview environments

Preview groups clone one source tenant/app into isolated, non-editable preview resources. CI continues to own service builds, deployment, DNS, and TLS; BetterPortal owns the cloned application configuration and lifecycle.

Creating a group does not require a service list. BP plugin IDs may be declared before deployment, without URLs or production registrations. Each new preview records the service IDs and URLs supplied by its create request, allowing different deployment keys in the same group to contain different services.

## BP plugin setup before deployment

Enter **BP plugin IDs** when creating the PVE group, or open its **Settings** and use **Add BP plugin**. Known plugins use config schemas from cached service manifests, including the source application's production services.

For a new BP plugin, expand its entry under **BP plugins** and upload or paste its BP config schema JSON. Accepted formats are a nonempty `ConfigSchemaDescriptor[]` array or a BP manifest/config-schema response containing `configSchemas`. If the artifact includes `pluginId` or `serviceId`, it must match the declared BP plugin ID. These are BP tenant/app schema descriptors, including `jsonSchema`, field defaults, visibility and UI metadata; BSB plugin configuration remains in Vault.

Uploaded schemas belong only to this PVE group's plugin definition and take precedence over cached schemas. Use **Encrypted service configuration** to enter tenant/app values before deployment. Secret values retain the existing browser-side encryption flow; the config manager never receives the preview encryption key. An ID without a known or uploaded schema may be declared, but has no editable config fields yet.

CI supplies the actual service URL when provisioning the deployment. The new PVE captures its group's configured values and uploaded schemas in its own effective settings, which are delivered to the service through BP sync. Uploading a schema creates no service registration or credentials, and does not contact a service URL.

Manifest sync does not overwrite uploaded definitions or saved values. Settings shows a warning when synced BP config schemas differ from an upload. A replacement upload preserves saved values and rejects removal of configured fields or changes to their secret classification; new required fields can be filled before saving configuration. Group edits affect future previews and newly added services, while existing service settings remain in each PVE's snapshot.

Production registration and plugin sync remain separate manual operations. PVE declarations and uploads do not register or promote the BP plugin in production.

## Preview role elevation

Each group's **Preview admin role IDs** setting accepts exact role IDs separated by commas or newlines (for example, `admin`, `staff`, `client`). It defaults to empty, preserving normal role permissions. It does not assign roles to users: the authenticated user's token must already contain a listed role.

Listed roles receive read/create/update/delete grants for enabled routes and their declared permission requirements in that group's previews. Config manager derives these grants when sending scoped config, so existing previews pick up changes and newly discovered routes on their next config sync. Removing an ID restores that role's normal permissions. Source app roles are never modified, and elevation does not grant platform-administrator access or bypass token validation and tenant/app isolation.

## Readiness and diagnostics

The services' shared BSB client submits its manifest before opening the config update stream. Submissions time out after 30 seconds and failures retry after five seconds; receiving cached config alone is not manifest acceptance. Live public health responses contain only `ok`. Setup-mode probes and authenticated users of the admin tenant's management app can also see the service version and sync diagnostics. Health responses must not be cached. Control-plane clients remain unready until their first successful manifest submission. Local-config and setup modes keep their existing readiness behavior.

Config manager persists service metadata, preview routes/menu, and automatic connection approvals in one config revision. Revision conflicts retry the whole mutation on a fresh snapshot, up to five attempts; remaining failures are retried by the client. File storage detects concurrent writes within one process; replicated config managers require PostgreSQL.

The PVE list distinguishes missing registrations, missing manifests, incomplete route reconciliation, pending config delivery, and **Configured**. Configured means persisted operations have enabled mounts and config delivery was recorded after manifest acceptance; it is not a live availability check or a service-side acknowledgement that every dependency works.

Each deployment has a **Debug** button opening an on-demand sidebar. It shows source/preview IDs, service origins, persisted manifest versions and timestamps, last-seen/config-delivery timestamps, missing operation mounts, auth redirect bindings, and route/menu inclusion. It does not include credentials, encrypted config values, or replay payloads, and uses the existing preview read permission. Remote retry/error state is available in authorized service health responses and service logs, not persisted in this sidebar.

For previews created before these fixes, rebuild/redeploy services with the updated BSB plugin so they resubmit their manifests. Rebuild themes with the updated shared theme runtime to receive browser navigation/preload fixes, including custom Bootstrap-based themes. Updating config manager alone cannot replace JavaScript already bundled into a theme image.

## CI API

The deployment API is intentionally outside BetterPortal route negotiation:

```http
POST /api/preview-groups/{groupId}/deployments/{key}
Authorization: Bearer {group API key or configured OIDC token}
Content-Type: application/json

{
  "name": "PR 123",
  "hostname": "pr-123.preview.example.com",
  "setupMode": "pull",
  "expiresInDays": 7,
  "services": {
    "org.example.shell": "https://shell-pr-123.example.com",
    "org.example.orders": "https://orders-pr-123.example.com"
  }
}
```

Repeating a request for the same deployment key must retain all existing services and may add new service IDs and URLs. Additions capture only the new service's current group settings and receive fresh credentials; unchanged services retain their credentials and configuration. Omitting an existing service is rejected. The request refreshes the stored lifetime; changed service URLs rotate only those service credentials. `setupMode` may be omitted and defaults to `pull`; other modes are rejected.

When an added BP plugin exists in the source app, its newly available shell, slots, fragments, auth references and configured routes are mapped into the preview. Existing preview settings and occupied slots are preserved; copied routes remain disabled until the added service syncs its manifest. This uses the source app's current bindings at the time of addition, without recloning the running preview app.

On first creation, apply the returned credentials to the matching service through its BSB configuration: map `BP_CONTROL_PLANE_URL` to `betterportal.controlPlaneUrl` and `BP_SERVICE_API_KEY` to `betterportal.serviceApiKey`. These response field names are deployment metadata; BSB services do not read them from the environment. `DELETE` on the same URL removes the preview immediately and is safe to repeat. Expired previews are deleted automatically.

## GitHub Actions

BetterPortal includes a reusable JavaScript action at `.github/actions/preview-environment`. It does not build or deploy services. The caller deploys its own resources, passes their public URLs to the action, then applies any newly issued BetterPortal credentials to those resources.

No self-hosted runner is required unless the caller's deployment target is reachable only from a private network. The action runs on GitHub-hosted runners and uses GitHub OIDC, so a BetterPortal group API key does not need to be stored in GitHub.

### Allow the action in private service repositories

The BetterPortal repository is public, so a private service repository can use the action without granting BetterPortal access to its source. If the service repository or organization restricts allowed actions, permit `BetterCorp/BetterPortal` under **Settings > Actions > General**. See GitHub's [allowed-actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

If BetterPortal is made private later, its **Settings > Actions > General > Access** policy must also allow callers in the BetterCorp organization. Review GitHub's [private action sharing guidance](https://docs.github.com/en/actions/how-tos/reuse-automations/share-with-your-organization) before changing visibility.

### Configure the preview group's GitHub OIDC trust

Use these values in the BetterPortal preview group:

```text
Issuer:   https://token.actions.githubusercontent.com
JWKS URL: https://token.actions.githubusercontent.com/.well-known/jwks
Audience: bp-preview-{groupId}
```

Lock the group to one repository using immutable IDs from the GitHub repository and organization APIs:

```json
{
  "repository_id": "123456789",
  "repository_owner_id": "987654321",
  "event_name": "pull_request"
}
```

The subject prefix can be left empty when these claims are set. If it is set, copy the repository's actual GitHub OIDC subject. Repositories created or renamed after GitHub's immutable-subject rollout include owner and repository IDs in `sub`, so do not assume the older `repo:ORG/REPO:pull_request` format. See GitHub's [OIDC reference](https://docs.github.com/en/actions/reference/security/oidc).

### Service repository workflow

The workflow must live in each repository that owns a deployable service. The implementation of the shared action remains in BetterPortal.

```yaml
name: Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: read
  id-token: write

concurrency:
  group: preview-${{ github.repository }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  deploy:
    if: >-
      github.event.action != 'closed' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Build and provision preview resources
        id: deploy
        run: ./ci/deploy-preview.sh
        # Write a compact services-json value to GITHUB_OUTPUT, for example:
        # services-json={"org.example.shell":"https://shell-pr-123.example.com"}
        # Also load saved per-preview overrides and output bsb-provisioning-json
        # as described below; do not reset saved overrides to {} on refresh.

      - name: Create or refresh BetterPortal preview
        id: betterportal
        uses: BetterCorp/BetterPortal/.github/actions/preview-environment@cd2b9edc63d6a44d18c48e36fb030d3131451431
        with:
          control-plane-url: ${{ vars.BP_CONTROL_PLANE_URL }}
          group-id: ${{ vars.BP_PREVIEW_GROUP_ID }}
          audience: ${{ vars.BP_PREVIEW_AUDIENCE }}
          key: ${{ github.event.pull_request.number }}
          name: PR ${{ github.event.pull_request.number }}
          hostname: pr-${{ github.event.pull_request.number }}.preview.example.com
          expires-in-days: "7"
          services-json: ${{ steps.deploy.outputs.services-json }}
          bsb-provisioning-json: ${{ steps.deploy.outputs.bsb-provisioning-json }}
          preview-config-key: ${{ secrets.BP_PREVIEW_CONFIG_KEY }}

      - name: Save and apply merged BSB preview configuration
        env:
          BSB_PREVIEW_CONFIG_JSON: ${{ steps.betterportal.outputs.bsb-overrides-json }}
        run: ./ci/apply-bsb-preview-config.sh
        # Implement the secret-store/update/readiness handoff shown below.

  cleanup:
    if: >-
      github.event.action == 'closed' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v7

      - name: Delete deployed preview resources
        run: ./ci/delete-preview.sh

      - name: Delete BetterPortal preview
        if: always()
        uses: BetterCorp/BetterPortal/.github/actions/preview-environment@cd2b9edc63d6a44d18c48e36fb030d3131451431
        with:
          operation: delete
          control-plane-url: ${{ vars.BP_CONTROL_PLANE_URL }}
          group-id: ${{ vars.BP_PREVIEW_GROUP_ID }}
          audience: ${{ vars.BP_PREVIEW_AUDIENCE }}
          key: ${{ github.event.pull_request.number }}
```

The same job may request a separate OIDC token for GCP Workload Identity Federation. Each token has its own audience; the BetterPortal action requests its token only when it calls the preview API.

Provision resources with stable URLs before calling BetterPortal. On a new preview, save and apply the merged BSB output and start or redeploy the services. On later pushes with unchanged URLs, BetterPortal returns an empty credential list and resets the existing expiry; the action retains credentials from the saved overrides. If a URL changes, only that service's credential is rotated and replaced in its output.

The action masks returned `BP_SERVICE_API_KEY` values before exposing `credentials-json`. Do not print that output. Store the group-level key as `betterportal.previewConfigKey` in the BSB configuration platform; BetterPortal deliberately cannot recover it.

### BSB/Vault provisioning and migration

The action's `bsb-provisioning-json`, `preview-config-key`, and `bsb-overrides-json` support requires the action revision containing this change; the `v11.0.8` action does not provide it. Pin the action to the reviewed commit containing this integration. Upgrading the service package alone does not migrate its CI provisioning.

For each consumer plugin, declare the three allowed credential paths in its **BSB** config schema metadata and publish that schema to Vault. Built-in consumer plugins declare these paths. Custom plugins must declare them too:

```typescript
import { createConfigSchema } from "@bsb/base";
import { BetterPortalPreviewOverridePaths } from "@betterportal/plugin-bsb";

const Config = createConfigSchema({
  name: "service-orders",
  description: "Orders service",
  envOverridePaths: BetterPortalPreviewOverridePaths
}, PluginConfigSchema); // contains betterportal: BetterPortalConfigSchema
```

For services staying on 11.0.8, use the literal paths instead of the new exported constant:
`["betterportal.controlPlaneUrl", "betterportal.serviceApiKey", "betterportal.previewConfigKey"] as const`.

In the preview's Vault deployment profile, enable **Allow environment overrides** for the exact consumer plugin, then publish the profile. Vault only includes the plugin's declared paths in the runtime response when the profile authorizes them. Do not grant overrides for the whole `betterportal` object, development token bypasses, or unrelated settings. Other CI settings such as database routing require their own plugin declarations and profile authorization. Do not change production profile policy to make a preview work.

The runtime configuration plugin must be `@bsb/config-vault` 9.7.5 or newer. It owns reading and validating `BSB_CONFIG_OVERRIDES`; the BP service does not read the environment. Vault recursively merges authorized overrides into its published configuration in memory, without sending the override values to Vault or persisting them in its last-known-good cache. Regular service settings remain in the published profile.

`bsb-provisioning-json` maps **BP plugin IDs** to **configured BSB aliases** and their saved per-preview override objects. These are different identifiers; do not guess an alias from a package or plugin ID:

Include only the BSB subset of a mixed-runtime preview. Python and other consumers remain in `services-json`, and their credentials remain in `credentials-json` for their own provisioning. The aggregate BSB input is bounded at 1 MiB; Vault's 128 KiB limit applies separately to each service's overrides, including the merged credentials.

```json
{
  "org.example.orders": {
    "alias": "orders",
    "overrides": {
      "services": { "orders": { "database": { "name": "preview-orders-123" } } }
    }
  }
}
```

The action returns `bsb-overrides-json`, an object keyed by BP plugin ID. Each value is a **complete merged override object** for that service's deployment resource. It preserves unrelated plugins, nested settings, events and observability overrides; only newly issued/rotated credentials and an explicitly supplied encryption key replace their corresponding BP values. The encryption key is never included in an OIDC or preview API request.

Save each result in the preview's secret store and redeploy with that secret as `BSB_CONFIG_OVERRIDES`. On every later run, read that saved object before calling the action. An unchanged service receives no new API key; supplying `{}` again would lose its binding. The action rejects that refresh with a migration diagnostic rather than outputting incomplete credentials. Serialize provisioning and secret updates with the workflow's existing per-preview concurrency group.

Before the mutating upsert, the action reads the deployment's current service bindings. It checks saved credentials for unchanged BSB services and validates the projected merged objects for newly added or URL-rotated BSB services. Missing state, a mismatched saved CP URL or an oversized result therefore fails before another service's key can be issued or revoked. This validates local provisioning state, not the authenticity of a saved API key; retain only this preview's latest issued values.

The following GCP steps show the complete handoff for one service, after deploying its stable public URL and authenticating the runner to GCP. Provision a **separate secret per preview service** containing `{}` initially; `steps.deploy.outputs.overrides-secret`, `cloud-run-service`, and `service-url` identify those caller-owned resources. The runner needs access only to that preview secret and deployment. For multiple services, supply all BP IDs/aliases and save each output to its own resource.

```yaml
- name: Read this preview's saved overrides
  id: state
  shell: bash
  env:
    OVERRIDES_SECRET: ${{ steps.deploy.outputs.overrides-secret }}
  run: |
    set -euo pipefail
    umask 077
    gcloud secrets versions access latest --secret="$OVERRIDES_SECRET" > "$RUNNER_TEMP/current-overrides.json"
    provisioning=$(jq -cn --slurpfile saved "$RUNNER_TEMP/current-overrides.json" \
      '{"org.example.orders": {alias: "orders", overrides: $saved[0]}}')
    masked=${provisioning//%/%25}
    printf '::add-mask::%s\n' "$masked"
    printf 'bsb-provisioning-json=%s\n' "$provisioning" >> "$GITHUB_OUTPUT"

- name: Provision BetterPortal configuration
  id: betterportal
  uses: BetterCorp/BetterPortal/.github/actions/preview-environment@cd2b9edc63d6a44d18c48e36fb030d3131451431
  with:
    control-plane-url: ${{ vars.BP_CONTROL_PLANE_URL }}
    group-id: ${{ vars.BP_PREVIEW_GROUP_ID }}
    audience: ${{ vars.BP_PREVIEW_AUDIENCE }}
    key: ${{ github.event.pull_request.number }}
    hostname: pr-${{ github.event.pull_request.number }}.preview.example.com
    services-json: '{"org.example.orders":"${{ steps.deploy.outputs.service-url }}"}'
    bsb-provisioning-json: ${{ steps.state.outputs.bsb-provisioning-json }}
    preview-config-key: ${{ secrets.BP_PREVIEW_CONFIG_KEY }}

- name: Save and apply this preview's BSB configuration
  shell: bash
  env:
    MERGED_OVERRIDES: ${{ steps.betterportal.outputs.bsb-overrides-json }}
    OVERRIDES_SECRET: ${{ steps.deploy.outputs.overrides-secret }}
    CLOUD_RUN_SERVICE: ${{ steps.deploy.outputs.cloud-run-service }}
    CLOUD_RUN_REGION: ${{ vars.CLOUD_RUN_REGION }}
    SERVICE_URL: ${{ steps.deploy.outputs.service-url }}
  run: |
    set -euo pipefail
    umask 077
    trap 'rm -f "$RUNNER_TEMP/current-overrides.json" "$RUNNER_TEMP/merged-overrides.json" "$RUNNER_TEMP/preview-health.json"' EXIT
    jq -ce '."org.example.orders" | select(type == "object")' <<< "$MERGED_OVERRIDES" > "$RUNNER_TEMP/merged-overrides.json"
    secret_version=$(gcloud secrets versions add "$OVERRIDES_SECRET" \
      --data-file="$RUNNER_TEMP/merged-overrides.json" --format='value(name)')
    printf 'Saved override secret version: %s\n' "$secret_version"
    gcloud run services update "$CLOUD_RUN_SERVICE" --region="$CLOUD_RUN_REGION" \
      --update-secrets="BSB_CONFIG_OVERRIDES=$OVERRIDES_SECRET:${secret_version##*/}"
    for attempt in $(seq 1 60); do
      if curl --fail --silent "$SERVICE_URL/.well-known/bp/health" -o "$RUNNER_TEMP/preview-health.json" && \
        jq -e '.ok == true and .setupMode != true' "$RUNNER_TEMP/preview-health.json" > /dev/null; then
        exit 0
      fi
      sleep 2
    done
    echo '::error::Preview did not finish BP setup/sync; check Vault profile authorization and scoped configuration delivery.'
    exit 1
```

Do not echo outputs, enable shell tracing, upload the temporary files as artifacts, or supply secret contents on command lines. The GitHub secret above is a CI input; it is **not** `BP_PREVIEW_CONFIG_KEY` injected into the service. The action masks the key and merged output before exposing them. Keep provisioning/apply steps in the same job; GitHub may suppress secret-valued job outputs. Cloud Run `--update-secrets` preserves unrelated secret bindings; avoid replacing the resource's entire environment or secret list.

If the Cloud Run update fails after rotation, the newly added secret version already contains the valid key. The example records the non-secret `secret_version` resource name; retry the update with that exact version. Do not roll back to the revoked key or call upsert again to recover it.

If saving the secret failed, normal BSB provisioning preflight will reject an unchanged binding whose key was never saved. For immediate recovery, run the same action with the identical upsert inputs but omit `bsb-provisioning-json` and `preview-config-key`. Capture its masked `credentials-json` in the same job, securely merge those credentials into the saved overrides using the three documented BSB fields, and resume normal provisioning. The deployment API replays an identical request's credentials for only 15 minutes; retain exactly the same hostname, service URLs, name and expiry. Beyond that window an empty credential list cannot recover a lost key, and the preview must be recreated. The generic action's legacy-injection warning is expected during this recovery; never inject the recovered values as consumer `BP_*` variables.

For an existing legacy preview, securely import its current API key, CP URL and encryption key into the saved override object once, using the three `betterportal` fields. Remove the old `BP_*` container entries and publish the Vault policy before upgrading the service. If the key was not retained, an unchanged upsert cannot recover it: delete/recreate that **preview** and use fresh credentials. Do not delete production state or reuse another preview's bootstrap state. Existing browser pairing state remains authoritative over BSB provisioning credentials.

For a preview previously installed by browser pairing, perform an explicit offline migration before relying on CI key rotation. Stop all processes using that preview's bootstrap file and securely back up both that file and its `.key` sibling. With the plugin revision containing this change, run the following on the stopped preview host using its exact configured `betterportal.bootstrapStatePath`:

```bash
node --input-type=module - /mounted/preview/bootstrap-state.json <<'JS'
import { existsSync } from "node:fs";
import { BootstrapStateStore } from "@betterportal/plugin-bsb";
const filePath = process.argv[2];
if (!existsSync(filePath) || !existsSync(`${filePath}.key`)) {
  throw new Error("Expected the existing preview bootstrap file and its key; no state was changed");
}
new BootstrapStateStore({ filePath }).clearPairing();
JS
```

`clearPairing()` removes only the saved CP binding, API key and installation/replay metadata. It retains the configuration encryption key, tenant lock, local bootstrap encryption key and other state. It does not clear configuration stores or signing keys. Apply the saved BSB overrides containing the current key before restarting. Do not call `clear()` or delete the bootstrap files: that discards unrelated state. Once migrated, later BSB key rotations need only the secret update/redeployment. A preview still using persisted pairing credentials will not adopt a rotated key merely because the secret was updated.

An HTTP 200 alone is insufficient: setup mode intentionally serves discovery while awaiting pairing. The readiness check above rejects `setupMode: true` and requires `ok: true`; synced public health is deliberately minimal. Also check the expected version at `/.well-known/bp/manifest` and the PVE Debug sidebar's manifest/config-delivery status before promotion. The integration regression runs the action output through the published Vault loader, tests policy denial, then verifies manifest submission, scoped secret decryption and exit from setup mode.

Fork pull requests are excluded in the example because they execute untrusted code. Use a protected GitHub environment with approval if fork previews are required.

### Action inputs and outputs

| Input | Required | Purpose |
|---|---:|---|
| `operation` | No | `upsert` by default, or `delete`. |
| `control-plane-url` | Yes | Public HTTPS config-manager base URL. |
| `group-id` | Yes | Preview group ID from the admin UI. |
| `key` | Yes | Stable deployment key, normally the PR number. |
| `audience` | Yes | Exact OIDC audience configured on the group. |
| `name` | No | Display name used on first creation. |
| `hostname` | Upsert | Public preview app hostname. |
| `expires-in-days` | No | Positive whole days or `never`; defaults to 7 and is capped by the group. |
| `services-json` | Upsert | JSON object mapping exact service plugin IDs to public HTTPS URLs. |
| `bsb-provisioning-json` | No | BP plugin ID → `{alias, overrides}` for every requested BSB service; supplies saved per-preview overrides. |
| `preview-config-key` | No | Secret group encryption key, applied only to BSB output. Requires `bsb-provisioning-json`. |

| Output | Purpose |
|---|---|
| `created` | `true` only when a new preview was cloned. |
| `preview-json` | Preview key, name, hostname, and expiry metadata. |
| `credentials-json` | Credentials for new or URL-rotated services; otherwise `[]`. |
| `bsb-overrides-json` | Complete merged override objects keyed by BP plugin ID; `{}` when BSB provisioning was not requested. Secret, same-job output. |

## Encrypted preview config

The admin browser generates a 32-byte key formatted as `bp_pck_{base64url}`. Store it in each preview service as `betterportal.previewConfigKey` through BSB configuration. The key is never submitted to or stored by BetterPortal.

Sensitive AnyVali fields use this language-neutral envelope:

```text
encrypted:bp-aes256gcm-v1:{base64url 12-byte IV}:{base64url ciphertext || 16-byte tag}
```

- Cipher: AES-256-GCM.
- Key: the 32 decoded bytes after `bp_pck_`; no KDF.
- Plaintext: UTF-8 string, maximum 255 characters.
- Additional authenticated data, as UTF-8: `betterportal.preview-config.v1\n{scope}\n{fieldPath}`.
- `scope` is `tenant` or `app`; `fieldPath` is the dot-joined AnyVali transform path.

The config manager calls AnyVali `safeParseEncrypted` and treats sensitive contents as opaque. Each service calls AnyVali `decrypt` locally, validates the plaintext schema, and replaces its local preview config. Non-preview scoped config never includes `previewConfig`.

## Menu visibility

Generated PVE menus use the same **Automatic (route permissions)** default as
normal apps: public pages are visible, authenticated pages require sign-in, and
permission-restricted pages require the user's effective grants (including the
preview group's configured role elevation). A service operation with `menu: false`
remains mounted but is excluded from the generated menu on every reconciliation.
Fragment configuration continues to inherit from the source app when cloned.


## API mount migration during refresh

A source app can contain separate API mounts for each operation of one view. During preview manifest reconciliation, mounts that migrate to the same generated API URL are consolidated into one mount. For example, GET, PUT and DELETE mounts for `reports.owner.report` targeting `/internal/reports/owner/reports/:reportId` become:

```yaml
kind: api
path: /_bp/service/za.co.robertgroup.one.reports/internal/reports/owner/reports/:reportId
viewId: reports.owner.report
operations:
  - reports.owner.report.get
  - reports.owner.report.put
  - reports.owner.report.delete
```

The first mount's ID and route position survive. Compatible fixed parameters, query strings and presentation settings are preserved. Generated mounts receive all current API operations; a valid custom alias keeps its path and selected operations. Distinct aliases and service-path variants remain separate. If aliases do not cover a newly declared operation, reconciliation adds a generated mount for it.

Repeated manifest refreshes and same-key redeployments using the accepted manifest cache keep the resulting routes stable. Incompatible request or presentation settings and URL patterns occupied by unrelated routes remain HTTP 409 errors; reconciliation does not silently pick one configuration. After upgrading Config Manager, rerun the failed staging deployment to refresh its routes. Keep the staging environment and service report URLs intact. An identical deployment POST inside the credential replay window still replays its response rather than forcing a refresh.

Preview reconciliation also owns API mounts during normal service manifest sync. Generic source-app normalization does not rewrite preview aliases or strip their query strings, fixed parameters or path variants before reconciliation.

A rejected preview reconciliation during service manifest POST returns HTTP 409 with the conflict reason. Its manifest, service identity and route changes are not committed. Resolve the conflicting mount settings before retrying.
