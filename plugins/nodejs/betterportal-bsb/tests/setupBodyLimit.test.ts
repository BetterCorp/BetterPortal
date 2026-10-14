import assert from "node:assert/strict";
import test from "node:test";
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
