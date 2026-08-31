# Preview environments

Preview groups clone one source tenant/app into isolated, non-editable preview resources. CI continues to own service builds, deployment, DNS, and TLS; BetterPortal owns the cloned application configuration and lifecycle.

Creating a group does not require a service list. Each new preview records the service IDs and URLs supplied by its create request, allowing different deployment keys in the same group to contain different services. Service-specific preview configuration becomes available after those services are discovered and sync their manifests.

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

Repeating a request for the same deployment key must use that preview's original service set. It refreshes the stored lifetime; changed service URLs rotate only those service credentials. `setupMode` may be omitted and defaults to `pull`; other modes are rejected.

On first creation, copy each returned `BP_CONTROL_PLANE_URL` and `BP_SERVICE_API_KEY` into the matching service deployment. `DELETE` on the same URL removes the preview immediately and is safe to repeat. Expired previews are deleted automatically.

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

      - name: Create or refresh BetterPortal preview
        id: betterportal
        uses: BetterCorp/BetterPortal/.github/actions/preview-environment@v10.6.0
        with:
          control-plane-url: ${{ vars.BP_CONTROL_PLANE_URL }}
          group-id: ${{ vars.BP_PREVIEW_GROUP_ID }}
          audience: ${{ vars.BP_PREVIEW_AUDIENCE }}
          key: ${{ github.event.pull_request.number }}
          name: PR ${{ github.event.pull_request.number }}
          hostname: pr-${{ github.event.pull_request.number }}.preview.example.com
          expires-in-days: "7"
          services-json: ${{ steps.deploy.outputs.services-json }}

      - name: Apply newly issued BetterPortal credentials
        if: steps.betterportal.outputs.credentials-json != '[]'
        env:
          BP_PREVIEW_CREDENTIALS_JSON: ${{ steps.betterportal.outputs.credentials-json }}
        run: ./ci/apply-betterportal-credentials.sh

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
        uses: BetterCorp/BetterPortal/.github/actions/preview-environment@v10.6.0
        with:
          operation: delete
          control-plane-url: ${{ vars.BP_CONTROL_PLANE_URL }}
          group-id: ${{ vars.BP_PREVIEW_GROUP_ID }}
          audience: ${{ vars.BP_PREVIEW_AUDIENCE }}
          key: ${{ github.event.pull_request.number }}
```

The same job may request a separate OIDC token for GCP Workload Identity Federation. Each token has its own audience; the BetterPortal action requests its token only when it calls the preview API.

Provision resources with stable URLs before calling BetterPortal. On a new preview, apply the returned credentials and start or redeploy the services. On later pushes with unchanged URLs, BetterPortal returns an empty credential list and resets the existing expiry. If a URL changes, only that service's credential is rotated and returned.

The action masks returned `BP_SERVICE_API_KEY` values before exposing `credentials-json`. Do not print that output. Store the group-level `BP_PREVIEW_CONFIG_KEY` in the deployment platform's secret manager; BetterPortal deliberately cannot recover it.

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

| Output | Purpose |
|---|---|
| `created` | `true` only when a new preview was cloned. |
| `preview-json` | Preview key, name, hostname, and expiry metadata. |
| `credentials-json` | Credentials for new or URL-rotated services; otherwise `[]`. |

## Encrypted preview config

The admin browser generates a 32-byte key formatted as `bp_pck_{base64url}`. Store it in the preview services as `BP_PREVIEW_CONFIG_KEY`. The key is never submitted to or stored by BetterPortal.

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
