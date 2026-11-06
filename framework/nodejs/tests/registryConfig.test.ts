import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRegistryUrl } from "../src/cli/project.js";

test("registry credentials require HTTPS with exact loopback development exceptions", () => {
  for (const url of ["https://registry.test", "https://registry.test/api", "http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal(normalizeRegistryUrl(url + "/"), url);
  }
  for (const url of ["http://registry.test", "http://127.1:3000", "http://2130706433:3000", "https://user:pass@registry.test",
    "https://registry.test?", "https://@registry.test", "http://127.0.0.1.evil.test", "https://registry.test?token=value", "https://registry.test#fragment", "https://registry.test:0", "not-a-url", " https://registry.test"]) {
    assert.throws(() => normalizeRegistryUrl(url), /Registry URL/, url);
  }
});
