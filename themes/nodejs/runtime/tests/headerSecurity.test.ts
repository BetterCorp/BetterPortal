import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("browser header ownership is case-insensitive and credentials stay on registered origins", () => {
  const source = readFileSync(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf('const BP_HEADERS_KEY ='), source.indexOf('const contentDispositionFilename ='));
  let saved = JSON.stringify({ Authorization: { value: "Bearer secret", owner: "auth", locked: true, scope: null } });
  const api = runInNewContext(ts.transpile(code + '\n({attachBpHeaders, applyBpHeaderDirectives, readBpHeaders});'), {
    URL, TextEncoder, Response, sessionId: "session", htmx: {}, document: { body: {} },
    window: { location: { origin: "https://app.test" }, clearTimeout() {}, setTimeout() {} },
    serviceIdByOrigin: { "https://auth.test": "auth", "https://service.test": "service", "https://app.test": "app", "http://service.test": "http", "http://localhost:8080": "local", "http://127.0.0.1": "ipv4", "http://[::1]": "ipv6" },
    serviceOrigins: { auth: "https://auth.test", service: "https://service.test", app: "https://app.test", http: "http://service.test", local: "http://localhost:8080", ipv4: "http://127.0.0.1", ipv6: "http://[::1]" },
    localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } }
  });
  const external = {};
  api.attachBpHeaders(external, "https://external.test/download", "auth");
  assert.deepEqual(external, {});
  const trusted: Record<string, string> = {};
  api.attachBpHeaders(trusted, "https://service.test/file");
  assert.equal(trusted.authorization, "Bearer secret");
  const explicit = { AUTHORIZATION: "Bearer explicit" };
  api.attachBpHeaders(explicit, "https://service.test/file");
  assert.equal(Object.keys(explicit).filter(key => key.toLowerCase() === "authorization").length, 1);
  api.applyBpHeaderDirectives(new Response(null, { headers: { "BP-SetHeader": "authorization=evil; locked=true" } }), "https://service.test/");
  api.applyBpHeaderDirectives(new Response(null, { headers: { "BP-RemoveHeader": "AUTHORIZATION" } }), "https://service.test/");
  assert.equal(api.readBpHeaders().authorization.value, "Bearer secret");
  api.applyBpHeaderDirectives(new Response(null, { headers: { "BP-RemoveHeader": "AUTHORIZATION" } }), "https://auth.test/");
  assert.equal(api.readBpHeaders().authorization, undefined);
  saved = JSON.stringify({ Authorization: { value: "legacy", owner: "https://auth.test", locked: true, scope: "https://auth.test" } });
  const legacy: Record<string, string> = {};
  api.attachBpHeaders(legacy, "https://auth.test/refresh", "https://auth.test");
  assert.equal(legacy.authorization, "legacy");
  const wrongScope = {};
  api.attachBpHeaders(wrongScope, "https://service.test/refresh", "https://auth.test");
  assert.deepEqual(wrongScope, {});
  saved = JSON.stringify({ authorization: { value: "secret", owner: "auth", scope: null } });
  for (const [url, owner] of [["http://service.test/file", "http"], ["https://app.test/file", "unknown"]]) {
    const blocked = {};
    api.attachBpHeaders(blocked, url, owner);
    assert.deepEqual(blocked, {});
  }
  for (const url of ["http://localhost:8080/file", "http://127.0.0.1/file", "http://[::1]/file"]) {
    const local: Record<string, string> = {};
    api.attachBpHeaders(local, url);
    assert.equal(local.authorization, "secret");
  }
  saved = JSON.stringify({ Authorization: { value: "one" }, authorization: { value: "two" } });
  assert.equal(api.readBpHeaders().authorization, undefined);
});
