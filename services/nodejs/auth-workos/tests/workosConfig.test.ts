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
  const slug = bpPermissionSlug("019f0000-0000-7000-8000-000000000000", "reports.index", "read");
  assert.equal(slug, "bp:019f0000-0000-7000-8000-000000000000:reports.index:read");
  assert.deepEqual(parseBpPermissionSlug(slug), {
    serviceId: "019f0000-0000-7000-8000-000000000000",
    viewId: "reports.index",
    action: "read"
  });
  assert.equal(parseBpPermissionSlug("bp:svc:view:bad"), null);
});
