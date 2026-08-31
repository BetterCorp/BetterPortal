# BetterPortal preview environment action

Create, refresh, or delete a BetterPortal preview deployment from GitHub Actions using OIDC. The action never builds or deploys services.

See [Preview environments](../../../docs/operations/preview-environments.md#github-actions) for setup, inputs, outputs, security constraints, and complete caller workflows.

Run its isolated tests with:

```bash
node --test .github/actions/preview-environment/index.test.mjs
```
