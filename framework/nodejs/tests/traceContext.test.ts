import assert from "node:assert/strict";
import { test } from "node:test";
import {
  baggageWithSession,
  formatTraceParent,
  parseBaggage,
  parseTraceParent,
  parseTraceState
} from "../src/runtime/traceContext.js";

const TRACE_ID = "019fe2a68278704eb8793bf90ce062a3";
const SPAN_ID = "878e449c3e33bb71";
const SESSION_ID = "019fe2a6-8278-704e-b879-3bf90ce062a3";

test("W3C trace context parses, normalizes, and formats supported parents", () => {
  assert.deepEqual(parseTraceParent(`00-${TRACE_ID.toUpperCase()}-${SPAN_ID.toUpperCase()}-01`), {
    traceId: TRACE_ID,
    spanId: SPAN_ID,
    traceFlags: 1
  });
  assert.equal(formatTraceParent({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 257 }), `00-${TRACE_ID}-${SPAN_ID}-01`);
  assert.ok(parseTraceParent(`01-${TRACE_ID}-${SPAN_ID}-01-vendor`));
  assert.equal(parseTraceParent(`00-${TRACE_ID}-${SPAN_ID}-01-vendor`), undefined);
  assert.equal(parseTraceParent(`00-${"0".repeat(32)}-${SPAN_ID}-01`), undefined);
  assert.equal(parseTraceParent(`00-${TRACE_ID}-${"0".repeat(16)}-01`), undefined);
  assert.equal(parseTraceParent("invalid"), undefined);
});

test("tracestate and baggage apply bounded validation", () => {
  assert.equal(parseTraceState("vendor=value,other=state"), "vendor=value,other=state");
  assert.equal(parseTraceState("missing-value="), undefined);
  assert.equal(parseTraceState("vendor=value,vendor=duplicate"), undefined);
  assert.deepEqual(parseBaggage(`other=value,bp.session_id=${SESSION_ID}`), {
    baggage: `other=value,bp.session_id=${SESSION_ID}`,
    sessionId: SESSION_ID
  });
  assert.deepEqual(parseBaggage("bp.session_id=not-a-uuid,other=value"), { baggage: "other=value" });
  assert.equal(baggageWithSession("other=value", SESSION_ID), `bp.session_id=${SESSION_ID},other=value`);
  assert.equal(baggageWithSession("other=value", "not-a-uuid"), "other=value");
});
