# Publishing BetterPortal to PyPI

The `Python package` workflow (`.github/workflows/publish-python.yml`) builds a
wheel and source distribution on relevant PRs, release tags and manual runs.
Only a stable `vX.Y.Z` tag matching both package versions can publish. A successful
`Build` workflow on **the same commit on master** is required before upload.
Manual runs on branches build and validate only; they do not publish.

## One-time account configuration

On [PyPI account publishing](https://pypi.org/manage/account/publishing/), add a
pending GitHub publisher with these exact values:

| Field | Value |
| --- | --- |
| PyPI project name | `betterportal` |
| Repository owner | `BetterCorp` |
| Repository name | `BetterPortal` |
| Workflow filename | `publish-python.yml` |
| Environment name | `pypi` |

A pending publisher creates the project on the first successful upload; it does
not reserve the name. For an already-created project, add the same publisher
under the project's Publishing settings instead. No PyPI token or password is
stored in GitHub. See [PyPI's pending publisher instructions](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/).

A repository admin must create the `pypi` GitHub environment. Under deployment
branches and tags, choose **Selected branches and tags**, then add a **Tag** rule
matching `v*`. Do not add a branch rule. The workflow supplies the same environment
name to PyPI. The build job has no OIDC write permission; only the isolated upload
job can request the short-lived publishing identity. Uploads include attestations.

## Release

1. Run `node scripts/release/set-workspace-version.mjs X.Y.Z` as part of the normal
   release preparation, and update the npm lockfile as usual. This now updates
   Python's `project.version` too. Commit and merge the release changes.
2. Wait for master `Build` CI to pass, including both native Python gates.
3. Create and push the normal signed `vX.Y.Z` release tag under `bcbetterninja`.
   Python publishing runs alongside the existing Node release workflow.
4. Confirm the `Python package` workflow succeeds and inspect
   `https://pypi.org/project/betterportal/X.Y.Z/`. Install the release in a fresh
   environment with `python -m pip install 'betterportal[asgi]==X.Y.Z'`.

The setup PR aligns Python with the current 10.6.35 workspace. Do not move the
existing v10.6.35 tag: the first release after this workflow merges should use the
next normal release version and a new signed tag. Tags from before this workflow
existed cannot run it.

PyPI versions are immutable. Upload failures fail the job (no `skip-existing`);
inspect a partial upload before retrying. Never replace an existing tag or silently
rebuild different bytes for an already-published version. Roll back a deployment
by pinning the previous published wheel; publish a new version for a correction.

The version updater maps alpha/beta/rc/dev SemVer suffixes to PEP 440, but this
publishing workflow deliberately accepts stable releases only. Build metadata
and unsupported prerelease names fail before version files are modified.
