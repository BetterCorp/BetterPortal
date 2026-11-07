import assert from "node:assert/strict";
import { test } from "node:test";
import { execute } from "./index.mjs";
import { bsbOverrides, parseBsbProvisioning } from "./bsb.mjs";

const baseEnv = {
  "INPUT_CONTROL-PLANE-URL": "https://config.example",
  "INPUT_GROUP-ID": "group-id",
  "INPUT_KEY": "123",
  "INPUT_AUDIENCE": "bp-preview-group-id",
  "INPUT_HOSTNAME": "pr-123.example.com",
  "INPUT_SERVICES-JSON": JSON.stringify({ "org.example.service": "https://service-pr-123.example.com/" }),
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com/token?job=1",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token"
};

test("upsert requests GitHub OIDC, masks credentials, and exposes structured outputs", async () => {
  const requests = [];
  const outputs = new Map();
  const commands = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) return Response.json({ value: "oidc-token" });
    return Response.json({
      created: true,
      preview: { key: "123", hostname: "pr-123.example.com", expiresAt: null },
      credentials: [{ environment: { BP_SERVICE_API_KEY: "bp-secret", BP_CONTROL_PLANE_URL: "https://config.example" } }]
    }, { status: 201 });
  };

  await execute(baseEnv, {
    fetchImpl,
    setOutput: (name, value) => outputs.set(name, value),
    command: (name, value) => commands.push([name, value])
  });

  assert.match(requests[0].url, /audience=bp-preview-group-id/);
  assert.equal(requests[1].init.method, "POST");
  assert.equal(requests[1].init.headers.authorization, "Bearer oidc-token");
  assert.deepEqual(JSON.parse(requests[1].init.body).services, { "org.example.service": "https://service-pr-123.example.com" });
  assert.equal(outputs.get("created"), "true");
  assert.equal(JSON.parse(outputs.get("credentials-json"))[0].environment.BP_SERVICE_API_KEY, "bp-secret");
  assert.ok(commands.some(([name, value]) => name === "add-mask" && value === "bp-secret"));
});

test("delete authenticates with OIDC and does not require deployment inputs", async () => {
  const methods = [];
  await execute({ ...baseEnv, "INPUT_OPERATION": "delete", "INPUT_HOSTNAME": "", "INPUT_SERVICES-JSON": "" }, {
    fetchImpl: async (_url, init) => {
      methods.push(init?.method ?? "GET");
      return methods.length === 1 ? Response.json({ value: "oidc-token" }) : new Response(null, { status: 204 });
    },
    setOutput: () => {},
    command: () => {}
  });
  assert.deepEqual(methods, ["GET", "DELETE"]);
});

test("control-plane and service credentials cannot be sent over plaintext HTTP", async () => {
  await assert.rejects(() => execute({ ...baseEnv, "INPUT_CONTROL-PLANE-URL": "http://config.example" }), /must use HTTPS/);
  await assert.rejects(() => execute({
    ...baseEnv,
    "INPUT_SERVICES-JSON": JSON.stringify({ "org.example.service": "http://service.example" })
  }, {
    fetchImpl: async () => Response.json({ value: "oidc-token" })
  }), /must be an HTTPS origin/);
});

const serviceId = "org.example.service";
const previewKey = `bp_pck_${Buffer.alloc(32, 1).toString("base64url")}`;
const provision = { [serviceId]: { alias: "orders", overrides: {
  services: { orders: { database: { name: "preview-db" }, betterportal: { trustedProxyIps: ["10.0.0.1"] } }, mail: { token: "unrelated" } },
  observable: { logs: { enabled: true } }
} } };
const credential = { serviceId, environment: { BP_CONTROL_PLANE_URL: "https://config.example", BP_SERVICE_API_KEY: "new-secret" } };

test("BSB provisioning preserves existing overrides, rotates keys, and retains them on refresh", async () => {
  const output = bsbOverrides(provision, [credential], previewKey, "https://config.example");
  assert.equal(output[serviceId].services.orders.betterportal.serviceApiKey, "new-secret");
  assert.equal(output[serviceId].services.orders.betterportal.previewConfigKey, previewKey);
  assert.equal(output[serviceId].services.orders.database.name, "preview-db");
  assert.deepEqual(output[serviceId].services.orders.betterportal.trustedProxyIps, ["10.0.0.1"]);
  assert.deepEqual(output[serviceId].observable, provision[serviceId].overrides.observable);
  assert.equal(output[serviceId].services.mail.token, "unrelated");
  assert.equal(provision[serviceId].overrides.services.orders.betterportal.serviceApiKey, undefined);
  const saved = { [serviceId]: { alias: "orders", overrides: output[serviceId] } };
  assert.deepEqual(bsbOverrides(saved, [], undefined, "https://config.example"), output);
  const rotated = bsbOverrides(saved, [{ ...credential, environment: { ...credential.environment, BP_SERVICE_API_KEY: "rotated" } }], undefined, "https://config.example");
  assert.equal(rotated[serviceId].services.orders.betterportal.serviceApiKey, "rotated");
  assert.equal(rotated[serviceId].services.orders.betterportal.previewConfigKey, previewKey);
});

test("action masks BSB output and keeps the encryption key and existing overrides out of API calls", async () => {
  const requests = [], outputs = new Map(), order = [];
  await execute({ ...baseEnv, "INPUT_BSB-PROVISIONING-JSON": JSON.stringify(provision), "INPUT_PREVIEW-CONFIG-KEY": previewKey }, {
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return requests.length === 1 ? Response.json({ value: "oidc-token" })
        : Response.json({ created: true, preview: {}, credentials: [credential] });
    },
    command: (name, value) => order.push([name, value]),
    setOutput: (name, value) => { order.push([name, value]); outputs.set(name, value); }
  });
  assert.ok(!JSON.stringify(requests).includes(previewKey));
  assert.ok(!JSON.stringify(requests).includes("preview-db"));
  const output = outputs.get("bsb-overrides-json");
  assert.deepEqual(JSON.parse(output), bsbOverrides(provision, [credential], previewKey, "https://config.example"));
  assert.ok(order.findIndex(([n, v]) => n === "add-mask" && v === output) < order.findIndex(([n]) => n === "bsb-overrides-json"));
});

test("missing saved keys and unsafe or incomplete provisioning fail with migration diagnostics", () => {
  assert.throws(() => bsbOverrides(provision, [], undefined, "https://config.example"), /load the saved per-preview overrides/);
  for (const raw of ['{"__proto__":{}}', '{"org.example.service":{"alias":"constructor","overrides":{}}}', '{}']) {
    assert.throws(() => parseBsbProvisioning(raw, { [serviceId]: "https://service.example" }));
  }
  assert.throws(() => bsbOverrides(provision, [{ ...credential, environment: { ...credential.environment, BP_CONTROL_PLANE_URL: "https://foreign.example" } }], previewKey, "https://config.example"), /does not match/);
});

test("separate service resources receive only their own issued credential", () => {
  const other = "org.example.mail";
  const provisioning = { ...provision, [other]: { alias: "mailer", overrides: {} } };
  const output = bsbOverrides(provisioning, [credential, { serviceId: other, environment: { BP_CONTROL_PLANE_URL: "https://config.example", BP_SERVICE_API_KEY: "other-secret" } }], previewKey, "https://config.example");
  assert.ok(!JSON.stringify(output[serviceId]).includes("other-secret"));
  assert.ok(!JSON.stringify(output[other]).includes("new-secret"));
});

test("a configured alias matching an Object method creates an own entry without mutating prototypes", () => {
  const provisioning = parseBsbProvisioning(JSON.stringify({ [serviceId]: { alias: "toString", overrides: {} } }), { [serviceId]: "https://service.example" });
  const output = bsbOverrides(provisioning, [credential], undefined, "https://config.example");
  assert.ok(Object.hasOwn(output[serviceId].services, "toString"));
  assert.equal(output[serviceId].services.toString.betterportal.serviceApiKey, "new-secret");
  assert.equal(Object.prototype.toString.betterportal, undefined);
});

test("invalid preview keys fail before provisioning and legacy callers receive a migration warning", async () => {
  let requests = 0;
  await assert.rejects(() => execute({ ...baseEnv, "INPUT_PREVIEW-CONFIG-KEY": "invalid-secret", "INPUT_BSB-PROVISIONING-JSON": JSON.stringify(provision) }, {
    command() {}, fetchImpl() { requests++; throw new Error("unexpected"); }
  }), /canonical 32-byte/);
  assert.equal(requests, 0);
  const commands = [];
  await execute(baseEnv, { fetchImpl: async () => ++requests === 1 ? Response.json({ value: "oidc" }) : Response.json({ created: true, preview: {}, credentials: [credential] }),
    command: (name, value) => commands.push([name, value]), setOutput() {} });
  assert.ok(commands.some(([name, value]) => name === "warning" && value.includes("BSB/Vault")));
});
