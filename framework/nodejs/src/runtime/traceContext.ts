import type { BetterPortalRemoteTraceContext } from "../contracts/observability.js";

const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BAGGAGE_KEY = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const SIMPLE_TRACESTATE_KEY = /^[a-z][a-z0-9_\-*\/]{0,255}$/;
const MULTI_TENANT_TRACESTATE_KEY = /^[a-z0-9][a-z0-9_\-*\/]{0,240}@[a-z][a-z0-9_\-*\/]{0,13}$/;

export interface BetterPortalRequestPropagation {
  readonly parent?: BetterPortalRemoteTraceContext;
  readonly baggage?: string;
  readonly sessionId?: string;
}

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

export function parseTraceParent(value: string | null | undefined): BetterPortalRemoteTraceContext | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const match = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(.*)$/.exec(normalized);
  if (!match || match[1] === "ff") return undefined;
  if (match[1] === "00" ? match[5] !== "" : match[5] !== "" && !match[5].startsWith("-")) return undefined;
  if (match[2] === ZERO_TRACE_ID || match[3] === ZERO_SPAN_ID) return undefined;
  return {
    traceId: match[2],
    spanId: match[3],
    traceFlags: Number.parseInt(match[4], 16)
  };
}

export function formatTraceParent(context: Pick<BetterPortalRemoteTraceContext, "traceId" | "spanId" | "traceFlags">): string {
  const flags = context.traceFlags & 0xff;
  return `00-${context.traceId.toLowerCase()}-${context.spanId.toLowerCase()}-${flags.toString(16).padStart(2, "0")}`;
}

export function parseTraceState(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) return undefined;
  const members = normalized.split(",").map((member) => member.trim());
  const keys = new Set<string>();
  if (members.length > 32 || members.some((member) => {
    const separator = member.indexOf("=");
    const key = member.slice(0, separator);
    const memberValue = member.slice(separator + 1);
    if (separator <= 0
      || memberValue.length === 0
      || memberValue.length > 256
      || memberValue.endsWith(" ")
      || /[=,\u0000-\u001f\u007f]/.test(memberValue)
      || (!SIMPLE_TRACESTATE_KEY.test(key) && !MULTI_TENANT_TRACESTATE_KEY.test(key))
      || keys.has(key)) return true;
    keys.add(key);
    return false;
  })) return undefined;
  return members.join(",");
}

export function parseBaggage(value: string | null | undefined): { baggage?: string; sessionId?: string } {
  if (!value || new TextEncoder().encode(value).byteLength > 8192) return {};
  const members = value.split(",");
  if (members.length > 64) return {};

  const valid: string[] = [];
  let sessionId: string | undefined;
  for (const rawMember of members) {
    const member = rawMember.trim();
    const separator = member.indexOf("=");
    if (separator <= 0) continue;
    const key = member.slice(0, separator).trim();
    const valueAndProperties = member.slice(separator + 1).trim();
    if (!BAGGAGE_KEY.test(key) || !valueAndProperties || /[\u0000-\u001f\u007f,\\\"]/.test(valueAndProperties)) continue;
    if (key === "bp.session_id") {
      const candidate = valueAndProperties.split(";", 1)[0];
      if (!isUuidV7(candidate) || sessionId !== undefined) continue;
      sessionId = candidate.toLowerCase();
    }
    valid.push(`${key}=${valueAndProperties}`);
  }
  const baggage = valid.join(",");
  return {
    ...(baggage ? { baggage } : {}),
    ...(sessionId ? { sessionId } : {})
  };
}

export function baggageWithSession(value: string | null | undefined, sessionId: string): string {
  const parsed = parseBaggage(value).baggage ?? "";
  if (!isUuidV7(sessionId)) return parsed;
  const existing = parsed.split(",").filter((member) => member && !member.startsWith("bp.session_id="));
  const members = [`bp.session_id=${sessionId}`, ...existing].slice(0, 64);
  while (new TextEncoder().encode(members.join(",")).byteLength > 8192) members.pop();
  return members.join(",");
}

export function requestPropagation(headers: Headers): BetterPortalRequestPropagation {
  const parent = parseTraceParent(headers.get("traceparent"));
  const traceState = parent ? parseTraceState(headers.get("tracestate")) : undefined;
  const baggage = parseBaggage(headers.get("baggage"));
  return {
    ...(parent ? { parent: { ...parent, ...(traceState ? { traceState } : {}) } } : {}),
    ...baggage
  };
}
