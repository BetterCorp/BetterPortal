import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { signSetupToken } from "@betterportal/framework";
import { createBetterPortalApp } from "@betterportal/framework/lib/runtime/h3.js";
import { BPService } from "../src/service.js";

test("public service setup endpoints stop oversized streamed uploads before parsing", async () => {
  const service = Object.create(BPService.prototype) as BPService & {
    app: ReturnType<typeof createBetterPortalApp>;
    registerInstallEndpoint(observer: unknown): void;
    registerHostnameChangeEndpoint(observer: unknown): void;
  };
  service.app = createBetterPortalApp();
  service.registerInstallEndpoint({});
  service.registerHostnameChangeEndpoint({});

  for (const path of ["install", "hostname-change"]) {
    let chunks = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks++;
        if (chunks <= 32) controller.enqueue(new Uint8Array(64 * 1024));
        else controller.close();
      },
      cancel() { cancelled = true; }
    });
    const response = await service.app.fetch(new Request(`https://service.test/.well-known/bp/${path}`, {
      method: "POST", body, duplex: "half"
    } as RequestInit & { duplex: "half" }));
    assert.equal(response.status, 413, path);
    assert.ok(cancelled && chunks <= 18, `${path} must stop reading at the 1 MiB limit`);
  }
});

test("installed service refuses a foreign control plane before fetching its JWKS", async (t) => {
  const service = Object.create(BPService.prototype) as BPService & {
    app: ReturnType<typeof createBetterPortalApp>;
    registerInstallEndpoint(observer: unknown): void;
  };
  service.app = createBetterPortalApp();
  Object.assign(service, { inSetupMode: false, resolvedCpUrl: "https://trusted.example" });
  service.registerInstallEndpoint({ log: { warn() {} } });
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    return new Response("", { status: 404 });
  });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "foreign" })).toString("base64url");
  const response = await service.app.fetch(new Request("https://service.test/.well-known/bp/install", {
    method: "POST", body: JSON.stringify({
      cpUrl: "https://foreign.example", setupToken: `${header}.e30.signature`
    })
  }));
  assert.equal(response.status, 403);
  assert.equal(fetches, 0, "untrusted control plane must not receive a JWKS request");
});

test("unconfigured first installation proceeds to verification without saving failed pairing trust", async (t) => {
  const service = Object.create(BPService.prototype) as BPService & {
    app: ReturnType<typeof createBetterPortalApp>;
    registerInstallEndpoint(observer: unknown): void;
  };
  service.app = createBetterPortalApp();
  Object.assign(service, { inSetupMode: true, resolvedCpUrl: null });
  service.registerInstallEndpoint({ log: { warn() {} } });
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    return new Response("", { status: 404 });
  });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "foreign" })).toString("base64url");
  const install = () => service.app.fetch(new Request("https://service.test/.well-known/bp/install", {
    method: "POST", body: JSON.stringify({
      cpUrl: "https://foreign.example", setupToken: `${header}.e30.signature`
    })
  }));
  const response = await install();
  assert.equal(response.status, 400);
  assert.equal(fetches, 1, "first pairing must reach token verification");
  assert.equal((service as unknown as { resolvedCpUrl: string | null }).resolvedCpUrl, null);
  Object.assign(service, { resolvedCpUrl: "https://foreign.example" });
  assert.equal((await install()).status, 400, "preconfigured control plane may proceed to token verification");
  assert.equal(fetches, 2);
});

test("a stalled unverified pairing request does not block another candidate", async (t) => {
  const service = Object.create(BPService.prototype) as BPService & {
    app: ReturnType<typeof createBetterPortalApp>;
    registerInstallEndpoint(observer: unknown): void;
  };
  service.app = createBetterPortalApp();
  Object.assign(service, { inSetupMode: true, resolvedCpUrl: null });
  service.registerInstallEndpoint({ log: { warn() {} } });
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const fetching = new Promise<void>(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (url) => {
    if (new URL(String(url)).origin === "https://first-pair.example") {
      started();
      await blocked;
    }
    return new Response("", { status: 404 });
  });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "racing" })).toString("base64url");
  const install = (cpUrl: string) => service.app.fetch(new Request("https://service.test/.well-known/bp/install", {
    method: "POST", body: JSON.stringify({ cpUrl, setupToken: `${header}.e30.signature` })
  }));
  const first = install("https://first-pair.example");
  await fetching;
  try {
    assert.equal((await install("https://second-pair.example")).status, 400,
      "an unverified request must not hold the pairing guard");
  } finally { release(); }
  assert.equal((await first).status, 400);
  assert.equal((await install("https://second-pair.example")).status, 400,
    "failed pairing must allow another attempt to reach verification");
});


test("pairing resumes activation from saved credentials without redeeming twice", async (t) => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cpUrl = "https://activation-retry.example";
  const token = signSetupToken({ privateKeyPem: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    kid: "activation-retry", claims: {
      iss: cpUrl, expiresInSeconds: 300,
      jti: "first-pair-activation", tokenType: "setup", instanceId: "01952200-0000-7000-8000-000000000004",
      serviceUrl: "https://service.test", cpUrl, cpJwksUri: `${cpUrl}/.well-known/jwks.json`
    } });
  let stored: Record<string, any> = { version: 1 };
  let activations = 0;
  let redeems = 0;
  const service = Object.assign(Object.create(BPService.prototype), {
    app: createBetterPortalApp(), inSetupMode: true, resolvedCpUrl: null,
    manifest: { pluginId: "com.example.service", version: "1.0.0", configSchemas: [] },
    manifestSync: { state: "pending" },
    bootstrapState: { read: () => stored, write: (value: Record<string, any>) => { stored = { ...stored, ...value }; } },
    resolveConfigEncryptionKey: () => stored.configEncryptionKey,
    deriveOwnUrl: () => "https://service.test",
    initializeS2SIdentity: () => { if (++activations === 1) throw new Error("Temporary activation failure"); },
    connectToControlPlane: async () => true
  });
  service.registerInstallEndpoint({ log: { warn() {}, info() {} } });
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/jwks.json")) return Response.json({ keys: [{
      ...keys.publicKey.export({ format: "jwk" }), kid: "activation-retry", alg: "RS256", use: "sig"
    }] });
    redeems++;
    return Response.json({ apiKey: "paired-api-key", cpId: "test", cpJwksUri: `${cpUrl}/.well-known/jwks.json` });
  });
  const install = () => service.app.fetch(new Request("https://service.test/.well-known/bp/install", {
    method: "POST", body: JSON.stringify({ cpUrl, setupToken: token })
  }));
  const first = await install();
  assert.equal(first.status, 503);
  assert.equal((await first.json()).installed, true);
  assert.equal(service.inSetupMode, false);
  assert.equal(service.manifestSync.state, "retrying");
  assert.equal(stored.cpUrl, cpUrl);
  assert.equal((await install()).status, 200);
  assert.equal(redeems, 1);
  assert.equal(activations, 2);
});

test("unpaired setup bounds concurrent verification and releases capacity after failure", async (t) => {
  const service = Object.assign(Object.create(BPService.prototype), {
    app: createBetterPortalApp(), inSetupMode: true, resolvedCpUrl: null
  });
  service.registerInstallEndpoint({ log: { warn() {} } });
  let release!: () => void;
  let started!: () => void;
  let requests = 0;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const fetching = new Promise<void>(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async () => {
    if (++requests === 4) started();
    await blocked;
    return new Response("", { status: 404 });
  });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "bounded" })).toString("base64url");
  const install = (index: number) => service.app.fetch(new Request("https://service.test/.well-known/bp/install", {
    method: "POST", body: JSON.stringify({ cpUrl: `https://verify-budget-${index}.example`, setupToken: `${header}.e30.signature` })
  }));
  const pending = [0, 1, 2, 3].map(install);
  await fetching;
  try { assert.equal((await install(4)).status, 429); }
  finally { release(); }
  assert.ok((await Promise.all(pending)).every(response => response.status === 400));
  assert.equal((await install(5)).status, 400);
  assert.equal(requests, 5);
});
