# BetterPortal preview environment action

Create, refresh, or delete a BetterPortal preview deployment from GitHub Actions using OIDC. The action never builds or deploys services.

For Node/BSB consumers, supply `bsb-provisioning-json` with each BP plugin ID's configured BSB alias and saved per-preview overrides. Optionally supply `preview-config-key` from the caller's secret store. Save the secret `bsb-overrides-json` output back to each preview resource and redeploy using the Vault configuration loader. The corresponding plugin paths must be declared and authorized in the published Vault deployment profile; the action cannot grant that permission. Unchanged services retain their saved keys, while newly issued or rotated keys replace only the matching service's values.

Legacy `BP_*` container injection does not configure BSB services on 11.0.8+. See the [migration and complete secret-store example](../../../docs/operations/preview-environments.md#bsbvault-provisioning-and-migration). The preview encryption key is never sent to the control plane. Keep secret outputs in the same job and do not print or upload them.

See [Preview environments](../../../docs/operations/preview-environments.md#github-actions) for setup, inputs, outputs, security constraints, and complete caller workflows.

Run its isolated tests with:

```bash
node --test .github/actions/preview-environment/index.test.mjs
```
