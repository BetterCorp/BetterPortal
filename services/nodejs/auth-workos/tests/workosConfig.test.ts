import test from "node:test";
import assert from "node:assert/strict";
import {
  bpPermissionSlug,
  parseBpPermissionSlug,
  resolveWorkOSAppConfig,
  resolveWorkOSBrowserConfig
} from "../src/plugins/service-betterportal-auth-workos/index.js";

test("workos config requires client id and api key", () => {
  assert.equal(resolveWorkOSAppConfig({ clientId: "client_123" }), null);
  assert.equal(resolveWorkOSAppConfig({ apiKey: "sk_test" }), null);
});

test("workos browser config never exposes api key", () => {
  const config = resolveWorkOSBrowserConfig({
    clientId: "client_123",
    apiKey: "sk_test",
    provider: "authkit"
  });

  assert.deepEqual(config, {
    clientId: "client_123",
    provider: "authkit"
  });
});

test("bp permission slugs round trip", () => {
  const state = {
    permissionMappings: {
      "tenant|019f0000-0000-7000-8000-000000000000|reports.index": {
        shortId: "a7k9q2m4",
        tenantId: "tenant",
        serviceId: "019f0000-0000-7000-8000-000000000000",
        viewId: "reports.index",
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z"
      }
    },
    roleMappings: {},
    appSync: {}
  };
  const slug = bpPermissionSlug("a7k9q2m4", "read");
  assert.equal(slug, "bp_a7k9q2m4_read");
  assert.equal(slug.length < 48, true);
  assert.deepEqual(parseBpPermissionSlug(slug, state), {
    serviceId: "019f0000-0000-7000-8000-000000000000",
    viewId: "reports.index",
    action: "read"
  });
  assert.equal(parseBpPermissionSlug("bp_a7k9q2m4_bad", state), null);
});
