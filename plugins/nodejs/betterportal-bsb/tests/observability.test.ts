import assert from "node:assert/strict";
import { test } from "node:test";
import type { Observable } from "@bsb/base";
import { createBsbObservability } from "../src/index.js";

test("BetterPortal logs inherit request correlation attributes", () => {
  const sessionId = "019fe2a6-8278-704e-b879-3bf90ce062a3";
  let captured: Record<string, unknown> | undefined;
  let capturedErrorMessage = "";
  let capturedError: Record<string, unknown> | undefined;
  const observable = {
    traceId: "019fe2a68278704eb8793bf90ce062a3",
    spanId: "878e449c3e33bb71",
    resource: { "service.name": "test" },
    attributes: { "bp.session.id": sessionId, "http.request.method": "GET" },
    log: {
      debug: () => undefined,
      info: (_message: string, meta?: Record<string, unknown>) => { captured = meta; },
      warn: () => undefined,
      error: (message: string, meta?: Record<string, unknown>) => {
        capturedErrorMessage = message;
        capturedError = meta;
      }
    },
    metrics: {}
  } as unknown as Observable;

  createBsbObservability(observable).logger.info("request complete", { status: 200 });

  assert.deepEqual(captured, {
    "bp.session.id": sessionId,
    "http.request.method": "GET",
    status: 200
  });

  createBsbObservability(observable).logger.error(new Error("failed"), { status: 500 });
  assert.equal(capturedErrorMessage, "failed");
  assert.equal(capturedError?.["bp.session.id"], sessionId);
  assert.equal(capturedError?.status, 500);
});
