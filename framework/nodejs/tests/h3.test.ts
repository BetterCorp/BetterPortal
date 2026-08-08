import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { BetterPortalObservability, ObservabilityAttributes } from "../src/contracts/observability.js";
import { createNoopObservability } from "../src/contracts/observability.js";
import {
  createBetterPortalApp,
  createBetterPortalNodeHandler,
  eventSessionId,
  eventTracePropagation,
  jsonResponse,
  withCoreHttpOutcome
} from "../src/runtime/h3.js";
import type { BetterPortalRemoteTraceContext } from "../src/contracts/observability.js";

function recordingObservability(records: Array<{ name: string; attributes: ObservabilityAttributes }>): BetterPortalObservability {
  const wrap = (base: BetterPortalObservability, name: string): BetterPortalObservability => new Proxy(base, {
    get(target, property, receiver) {
      if (property === "startSpan") {
        return (childName: string, attributes: ObservabilityAttributes = {}) =>
          wrap(target.startSpan(childName, attributes), childName);
      }
      if (property === "end") {
        return (attributes: ObservabilityAttributes = {}) => { records.push({ name, attributes }); };
      }
      return Reflect.get(target, property, receiver);
    }
  });
  return wrap(createNoopObservability(), "bp.http.request");
}

test("middleware response headers survive error responses", async () => {
  const app = createBetterPortalApp();
  app.use("/**", (event) => {
    event.res.headers.set("Access-Control-Allow-Origin", "https://root.example");
  });
  app.get("/conflict", () => new Response("details", { status: 409 }));

  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/conflict`);
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://root.example");
    assert.equal(await response.text(), "details");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("request observability inherits W3C context and correlates a shell session", async () => {
  const traceId = "019fe2a68278704eb8793bf90ce062a3";
  const parentSpanId = "878e449c3e33bb71";
  const sessionId = "019fe2a6-8278-704e-b879-3bf90ce062a3";
  let receivedParent: BetterPortalRemoteTraceContext | undefined;
  let receivedAttributes: ObservabilityAttributes | undefined;
  let activeSpanId = "";
  const app = createBetterPortalApp({
    createRequestObservability: (_name, attributes, parent) => {
      receivedParent = parent;
      receivedAttributes = attributes;
      return createNoopObservability({
        trace: { traceId: parent?.traceId ?? traceId, spanId: "server-span" },
        attributes
      });
    }
  });
  app.get("/trace", (event) => {
    const propagation = eventTracePropagation(event);
    activeSpanId = propagation.parent?.spanId ?? "";
    return jsonResponse({ sessionId: eventSessionId(event) ?? "" });
  });

  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/trace`, {
      headers: {
        traceparent: `00-${traceId}-${parentSpanId}-01`,
        tracestate: "vendor=value",
        baggage: `bp.session_id=${sessionId}`
      }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(receivedParent, { traceId, spanId: parentSpanId, traceFlags: 1, traceState: "vendor=value" });
    assert.equal(receivedAttributes?.["bp.session.id"], sessionId);
    assert.notEqual(activeSpanId, "server-span");
    assert.equal((await response.json() as { sessionId: string }).sessionId, sessionId);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("document requests receive a new UUIDv7 session without trace headers", async () => {
  const sessions: string[] = [];
  const app = createBetterPortalApp({ createRequestObservability: () => createNoopObservability() });
  app.get("/", (event) => {
    const sessionId = eventSessionId(event) ?? "";
    sessions.push(sessionId);
    return new Response(sessionId, { headers: { "content-type": "text/html" } });
  });
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/`;
    await fetch(url, { headers: { accept: "text/html" } });
    await fetch(url, { headers: { accept: "text/html" } });
    assert.match(sessions[0], /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(sessions[0], sessions[1]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP outcomes classify core, inferred, and successful responses", async () => {
  const records: Array<{ name: string; attributes: ObservabilityAttributes }> = [];
  const app = createBetterPortalApp({ createRequestObservability: () => recordingObservability(records) });
  app.get("/classified", () => withCoreHttpOutcome(
    jsonResponse({ error: "Denied" }, 403),
    {
      code: "auth.permissions_insufficient",
      reason: "Insufficient\npermissions",
      attributes: {
        "bp.http.outcome_code": "overridden",
        "bp.http.response_kind": "overridden"
      }
    }
  ));
  app.get("/fallback", () => jsonResponse({ error: "Derived failure detail" }, 418));
  app.get("/large", () => new Response("x".repeat(3_000), {
    status: 500,
    headers: { "content-type": "text/plain" }
  }));
  app.get("/success", () => jsonResponse({ ok: true }));

  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/classified`)).status, 403);
    assert.equal((await fetch(`${base}/fallback`)).status, 418);
    assert.equal((await fetch(`${base}/large`)).status, 500);
    assert.equal((await fetch(`${base}/success`)).status, 200);

    const classified = records.find((record) => record.name === "bp.http.request"
      && record.attributes["bp.http.outcome_code"] === "auth.permissions_insufficient");
    assert.equal(classified?.attributes["bp.http.outcome_source"], "core");
    assert.equal(classified?.attributes["bp.http.response_kind"], "json");
    assert.equal(classified?.attributes["bp.http.outcome_reason"], "Insufficient permissions");

    const fallback = records.find((record) => record.name === "bp.http.request"
      && record.attributes["bp.http.outcome_reason"] === "Derived failure detail");
    assert.equal(fallback?.attributes["bp.http.outcome_source"], "response-body");

    const large = records.find((record) => record.name === "bp.http.request"
      && record.attributes["bp.http.outcome_detail_truncated"] === true);
    assert.equal(large?.attributes["bp.http.outcome_source"], "response-body");
    assert.equal((large?.attributes["bp.http.outcome_reason"] as string).length, 2_048);

    const successful = records.find((record) => record.name === "bp.http.request"
      && record.attributes["http.response.status_code"] === 200);
    assert.equal(successful?.attributes["bp.http.response_kind"], "json");
    assert.equal(successful?.attributes["bp.http.outcome_code"], undefined);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
