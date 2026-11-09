# Easy1 release deployment

The normal signed release flow deploys all seven services in `services.json` after
both publication workflows and master CI succeed for that same commit. Config Manager
is triggered first. Every service must report the target manifest version and healthy
status three times before the rollout succeeds. Package selection is exact; BSB remains
on the reviewed 9.7.5 baseline and anyvali on 1.1.7.

Each service's inline Easypanel Dockerfile is the corresponding file here. It reads the
root package version from `deploy/easy1`, a Git branch pointing at a signed release
commit. Builds verify the installed service, framework, plugin and BSB package versions.
No application data, environment settings, mounts, domains or replica counts are changed.
The registry and PostgreSQL are independent services and are not release targets.

## Credentials and bootstrap

The repository Actions secret `EASY1_DEPLOY_WEBHOOKS` is a JSON object mapping exactly
the seven service names to their scoped HTTPS deployment trigger URLs on
`easy1.eu2.betterweb.co.za`. Do not commit or log these URLs. An Easypanel administrator
token is not required. Changing a deployment token requires updating this secret.

Before enabling the workflow, initialize `deploy/easy1` to the currently deployed signed
release commit and `deploy/easy1-previous` to the prior signed release commit, and install
all seven Dockerfiles. The workflow uses the repository's normal `GITHUB_TOKEN` with
contents write access to move those refs atomically with leases. Release tags and their
referenced commits remain unchanged. Keep branch rules compatible with these deployment
pointers; normal application changes still go through master pull requests.

## Rollback

A failed release restores the previous active pointer and rebuilds **all seven** services
at the old version, then verifies their public version and health. The workflow remains
failed so the failed release is visible. A failed rollback reports `rollback-failed` and
requires operator attention. Each rollout and rollback has a 20 minute readiness budget;
the job has 90 minutes to allow completion of recovery.

For a later manual rollback, run **Deploy Easy1** from master with action **rollback**;
this uses `deploy/easy1-previous`. To deploy a specific older signed release, choose
**deploy** and supply its version. Repeating the current version rebuilds/verifies all
seven services. Automatic events ignore already deployed or older versions. Concurrent
runs are serialized and leased pointer writes reject external changes.

The workflow checks public endpoints; Easypanel/Swarm manages the configured fifteen
replicas and their container health checks. Public checks cannot enumerate individual
replicas. Container-level inspection remains available in Easypanel.

Deployment outcomes (without credentials) are retained as the `easy1-deployment` Actions
artifact. Logic and failure recovery tests run in CI and before every deployment.
