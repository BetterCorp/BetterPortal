import assert from "node:assert/strict";
import { test } from "node:test";
import { execute } from "./index.mjs";

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
