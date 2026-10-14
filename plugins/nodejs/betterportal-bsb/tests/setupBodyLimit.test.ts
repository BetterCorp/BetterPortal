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
