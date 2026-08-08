import assert from "node:assert/strict";
import { test } from "node:test";
import { createNoopObservability, type BetterPortalObservability, type ObservabilityAttributes } from "@betterportal/framework";
import { BPService } from "../src/service.js";

test("S2S fetch creates a client span and replaces caller trace headers", async () => {
  const traceId = "019fe2a68278704eb8793bf90ce062a3";
  const spanId = "878e449c3e33bb71";
  const ended: ObservabilityAttributes[] = [];
  const child = new Proxy(createNoopObservability({ trace: { traceId, spanId } }), {
    get(target, property, receiver) {
      if (property === "end") return (attributes: ObservabilityAttributes = {}) => ended.push(attributes);
      return Reflect.get(target, property, receiver);
    }
  });
  const parent = new Proxy(createNoopObservability(), {
    get(target, property, receiver) {
      if (property === "startSpan") return () => child;
      return Reflect.get(target, property, receiver);
    }
  });
  const m2mFetch = (BPService.prototype as unknown as {
    m2mFetch(context: unknown, parent: BetterPortalObservability): typeof globalThis.fetch;
  }).m2mFetch.call({}, {
    requestId: "reports.read",
    mode: "service",
    tenantId: "019f0000-0000-7000-8000-000000000001",
    appId: "019f0000-0000-7000-8000-000000000002",
    binding: { sourceServiceId: "source", targetServiceId: "target" },
    target: { hostname: "https://target.example" }
  }, parent);

  const originalFetch = globalThis.fetch;
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const response = await m2mFetch("https://target.example/report?secret=hidden", {
      method: "POST",
      headers: {
        traceparent: "caller-value",
        tracestate: "caller=value",
        baggage: "caller=value"
      }
    });
    assert.equal(response.status, 200);
    assert.equal(captured?.headers.get("traceparent"), `00-${traceId}-${spanId}-01`);
    assert.equal(captured?.headers.get("tracestate"), null);
    assert.equal(captured?.headers.get("baggage"), null);
    assert.equal(ended.length, 1);
    assert.equal(ended[0]["http.response.status_code"], 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
