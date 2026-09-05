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
    serviceIdByOrigin: { "https://auth.test": "auth", "https://service.test": "service" },
    serviceOrigins: { auth: "https://auth.test", service: "https://service.test" },
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
  saved = JSON.stringify({ Authorization: { value: "one" }, authorization: { value: "two" } });
  assert.equal(api.readBpHeaders().authorization, undefined);
});
