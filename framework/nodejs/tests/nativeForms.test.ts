import assert from "node:assert/strict";
import test from "node:test";
import * as av from "anyvali";
import { createH3Router } from "../src/adapters/h3.js";
import type { RegisteredRoute } from "../src/contracts/registry.js";
import { MultipartRequestSchema } from "../src/contracts/route.js";
import { createNoopObservability, type ObservabilityAttributes } from "../src/contracts/observability.js";
import { createBetterPortalApp } from "../src/runtime/h3.js";
import { createRawHandler } from "../src/runtime/handler.js";

function adapter(request?: av.BaseSchema<unknown, unknown>) {
  let calls = 0;
  const outcomes: ObservabilityAttributes[] = [];
  const app = createBetterPortalApp({
    createRequestObservability: () => {
      const obs = createNoopObservability();
      obs.end = (attributes = {}) => { outcomes.push(attributes); };
      return obs;
    }
  });
  const schemas = { request, multipart: MultipartRequestSchema };
  const handler = createRawHandler(schemas, ctx => {
    calls++;
    return ctx.response(JSON.stringify({ body: ctx.request, multipart: ctx.multipart }, (_key, value) =>
      value instanceof Uint8Array ? Array.from(value) : value), {
      headers: { "content-type": "application/json" }
    });
  });
  const methodRoute = {
    operationId: "form.submit", title: "Form", description: "", schemas, handler,
    auth: { required: false, permissions: [] }, cacheHints: {}, demoScenarios: []
  };
  const route: RegisteredRoute = {
    ...methodRoute,
    viewId: "form.index", path: "/form", methods: ["POST", "PUT", "PATCH"], paramNames: [],
    handlers: { POST: handler, PUT: handler, PATCH: handler },
    methodRoutes: {
      POST: { ...methodRoute, method: "POST" },
      PUT: { ...methodRoute, method: "PUT" },
      PATCH: { ...methodRoute, method: "PATCH" }
    },
    renderers: {}
  };
  createH3Router({ routes: [route] }, app, {
    resolveContext: () => ({
      tenant: { id: "tenant", slug: "tenant", title: "Tenant", active: true, branding: {}, services: [], activatedPlatformServices: [] },
      app: {
        id: "app", tenantId: "tenant", slug: "app", title: "App", hostnames: ["forms.test"],
        originOverrides: [], refererOverrides: [], themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
        defaultRoute: "/form",
        routes: [{ id: "route", kind: "api", path: "/form", serviceId: "service", viewId: route.viewId, enabled: true, operations: ["form.submit"] }],
        menu: [], slots: [], fragments: {}, shellFragments: {}
      }
    })
  });
  return {
    submit: (body: BodyInit, method = "POST", headers?: HeadersInit) =>
      app.fetch(new Request("https://forms.test/form", { method, body, headers })),
    calls: () => calls,
    outcomes
  };
}

const encodings = ["urlencoded", "multipart"] as const;
function encode(entries: Array<[string, string]>, encoding: typeof encodings[number]): BodyInit {
  if (encoding === "urlencoded") return new URLSearchParams(entries);
  const form = new FormData();
  for (const [key, value] of entries) form.append(key, value);
  return form;
}

const requestSchema = av.object({
  clientName: av.string(),
  existingAssets: av.optional(av.array(av.object({
    productId: av.string(), platformId: av.string(), amount: av.number().coerce()
  }))),
  tags: av.array(av.string())
});
const assetEntries: Array<[string, string]> = [
  ["clientName", "Example"],
  ["existingAssets[1].amount", "250"],
  ["existingAssets[0].productId", "UNITTRUSTS"],
  ["existingAssets[0].platformId", "EXAMPLE"],
  ["existingAssets[0].amount", "1000"],
  ["existingAssets[1].productId", "CASH"],
  ["existingAssets[1].platformId", "BANK"],
  ["tags", "first"], ["tags", "second"]
];
const assets = [
  { productId: "UNITTRUSTS", platformId: "EXAMPLE", amount: 1000 },
  { productId: "CASH", platformId: "BANK", amount: 250 }
];

for (const encoding of encodings) {
  test(`${encoding}: nested native fields reach Anyvali before validation for each body method`, async () => {
    const api = adapter(requestSchema);
    for (const method of ["POST", "PUT", "PATCH"]) {
      const response = await api.submit(encode(assetEntries, encoding), method);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result.body, { clientName: "Example", existingAssets: assets, tags: ["first", "second"] });
      assert.equal(result.multipart.fields["existingAssets[0].amount"], "1000");
      assert.deepEqual(result.multipart.fields.tags, ["first", "second"]);
      assert.deepEqual(result.multipart.files, {});
    }
    assert.equal(api.calls(), 3);
  });

  test(`${encoding}: preserves nested repeated values, scalar arrays, matrices and own property names`, async () => {
    const api = adapter();
    const response = await api.submit(encode([
      ["profile.name", "Jane"], ["profile.labels", "one"], ["profile.labels", "two"],
      ["values[1]", "b"], ["values[0]", "a"], ["values[0]", "again"],
      ["matrix[0][0]", "cell"], ["toString", "own"], ["toString", "second"],
      ["profile.hasOwnProperty", "safe"], ["empty", ""]
    ], encoding));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.body, {
      profile: { name: "Jane", labels: ["one", "two"], hasOwnProperty: "safe" },
      values: [["a", "again"], "b"], matrix: [["cell"]], toString: ["own", "second"], empty: ""
    });
    assert.deepEqual(result.multipart.fields.toString, ["own", "second"]);
  });

  const invalid: Array<[string, Array<[string, string]>]> = [
    ...["", ".name", "name.", "a..b", "tags[]", "a[b]", "a[-1]", "a[01]", "a[1.5]", "a[0", "a]", "a[0]b", "a.[0]", "a\u0000b", "a[1000]", "a[999999999999999999999999999]", "a[1]", "a[0][1]", "x".repeat(1025), Array(33).fill("a").join(".")]
      .map(name => [name, [[name, "x"]]] as [string, Array<[string, string]>]),
    ...["__proto__", "constructor", "prototype", "a.__proto__.polluted", "a.constructor.prototype.polluted", "a[0].prototype"]
      .map(name => [name, [[name, "x"]]] as [string, Array<[string, string]>]),
    ["scalar then object", [["a", "x"], ["a.b", "y"]]],
    ["object then scalar", [["a.b", "x"], ["a", "y"]]],
    ["scalar then array", [["a", "x"], ["a[0]", "y"]]],
    ["array then scalar", [["a[0]", "x"], ["a", "y"]]],
    ["object then array", [["a.b", "x"], ["a[0]", "y"]]],
    ["array then object", [["a[0]", "x"], ["a.b", "y"]]],
    ["repeated scalar then indexed", [["a", "x"], ["a", "y"], ["a[0]", "z"]]],
    ["indexed object then scalar", [["a[0].b", "x"], ["a[0]", "y"]]]
  ];
  test(`${encoding}: invalid and conflicting paths return classified 400s without calling the handler`, async t => {
    const api = adapter();
    for (const [name, entries] of invalid) {
      await t.test(JSON.stringify(name.length > 80 ? `${name.slice(0, 40)}... (${name.length} characters)` : name), async () => {
        const response = await api.submit(encode(entries, encoding));
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error, "Invalid form request");
        assert.equal(api.outcomes.at(-1)?.["bp.http.outcome_code"], "request.body.invalid");
      });
    }
    assert.equal(api.calls(), 0);
    assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  });

  test(`${encoding}: bounds field count and total structure size`, async () => {
    const api = adapter();
    for (const entries of [
      Array.from({ length: 10_001 }, (): [string, string] => ["tags", "x"]),
      Array.from({ length: 5_001 }, (_, i): [string, string] => [`field${i}.value`, "x"])
    ]) {
      const response = await api.submit(encode(entries, encoding));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "Invalid form request");
    }
    assert.equal(api.calls(), 0);
  });

  test(`${encoding}: accepts documented index, depth, field and name boundaries`, async () => {
    const api = adapter();
    for (const entries of [
      Array.from({ length: 1000 }, (_, i): [string, string] => [`values[${i}]`, String(i)]),
      [[Array(32).fill("a").join("."), "deep"], ["x".repeat(1024), "long"]] as Array<[string, string]>,
      Array.from({ length: 10_000 }, (): [string, string] => ["tags", "x"])
    ]) {
      const response = await api.submit(encode(entries, encoding));
      assert.equal(response.status, 200);
      await response.json();
    }
  });

  test(`${encoding}: schema errors still reject decoded data`, async () => {
    const api = adapter(requestSchema);
    const response = await api.submit(encode(assetEntries.map(([key, value]) =>
      [key, key === "existingAssets[0].amount" ? "invalid" : value]), encoding));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid request body");
    assert.equal(api.calls(), 0);
  });

  test(`${encoding}: omitted optional arrays and empty forms keep their existing meaning`, async () => {
    const api = adapter(requestSchema);
    const response = await api.submit(encode([["clientName", "Example"], ["tags", "one"], ["tags", "two"]], encoding));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).body, { clientName: "Example", tags: ["one", "two"] });
    const raw = adapter();
    const empty = await raw.submit(encode([], encoding));
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).body, {});
  });
}

test("multipart files keep original field names, metadata, byte contents and submission order", async () => {
  const api = adapter();
  const form = new FormData();
  form.append("assets[0].label", "Document");
  form.append("assets[0].upload", new Blob(["first"], { type: "text/plain" }), "first.txt");
  form.append("assets[0].upload", new Blob(["second"], { type: "text/plain" }), "second.txt");
  form.append("toString", new Blob(["own"]), "own.bin");
  form.append("mixed", "text");
  form.append("mixed", new Blob(["file"]), "mixed.bin");
  const response = await api.submit(form);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.body, { assets: [{ label: "Document", upload: ["first.txt", "second.txt"] }], toString: "own.bin", mixed: ["text", "mixed.bin"] });
  assert.deepEqual(result.multipart.fields, { "assets[0].label": "Document", mixed: "text" });
  assert.deepEqual(result.multipart.files["assets[0].upload"], ["first", "second"].map(text => ({
    fieldName: "assets[0].upload", filename: `${text}.txt`, contentType: "text/plain", size: text.length,
    data: Array.from(new TextEncoder().encode(text))
  })));
  assert.equal(result.multipart.files.toString.filename, "own.bin");
  assert.equal(result.multipart.files.mixed.filename, "mixed.bin");
});

test("multipart uploads retain the total 25 MiB file limit and its 413 classification", async () => {
  const api = adapter();
  const form = new FormData();
  form.append("documents", new Blob([new Uint8Array(13 * 1024 * 1024)]), "first.bin");
  form.append("documents", new Blob([new Uint8Array(12 * 1024 * 1024 + 1)]), "second.bin");
  const response = await api.submit(form);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "Multipart payload too large");
  assert.equal(api.calls(), 0);
  assert.equal(api.outcomes.at(-1)?.["bp.http.outcome_code"], "request.multipart.too_large");
});

test("malformed multipart bodies return a classified 400 instead of an empty request", async () => {
  const api = adapter();
  const response = await api.submit("broken", "POST", { "content-type": "multipart/form-data" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid form request");
  assert.equal(api.calls(), 0);
  assert.equal(api.outcomes.at(-1)?.["bp.http.outcome_code"], "request.body.invalid");
});

test("JSON requests preserve structured values and literal dotted keys", async () => {
  const api = adapter(requestSchema);
  const input = { clientName: "Example", existingAssets: assets, tags: ["first", "second"] };
  const response = await api.submit(JSON.stringify(input), "POST", { "content-type": "application/json" });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).body, input);
  const raw = adapter();
  const literal = { "a.b": "literal", "tags[0]": "value", nested: { amount: 1000 }, checked: true };
  const rawResponse = await raw.submit(JSON.stringify(literal), "POST", { "content-type": "application/json" });
  assert.equal(rawResponse.status, 200);
  assert.deepEqual((await rawResponse.json()).body, literal);
});
