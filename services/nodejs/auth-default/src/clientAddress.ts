import { isIP } from "node:net";
import { getEventPeerIp, type BetterPortalEvent } from "@betterportal/framework/lib/runtime/h3.js";

interface ProxyTrust { trustedProxyHeaders?: boolean; cfProxy?: boolean; trustedProxyIps?: string[] }
function normalizeIp(value: string | undefined): string | undefined {
  if (!value || !isIP(value) || value.includes("%")) return undefined;
  if (isIP(value) === 4) return value;
  return new URL(`http://[${value}]`).hostname.slice(1, -1);
}

/** Forwarding headers are authoritative only through explicitly trusted socket peers. */
export function clientAddress(event: BetterPortalEvent, trust: ProxyTrust): string | undefined {
  const peer = normalizeIp(getEventPeerIp(event));
  const trusted = new Set((trust.trustedProxyIps ?? []).map(normalizeIp).filter(Boolean));
  if (!peer || !trusted.has(peer)) return peer;
  if (trust.cfProxy) {
    const cloudflare = normalizeIp(event.req.headers.get("cf-connecting-ip")?.trim());
    if (cloudflare) return cloudflare;
  }
  if (!trust.trustedProxyHeaders) return peer;
  const forwarded = event.req.headers.get("x-forwarded-for");
  if (!forwarded || forwarded.length > 4096) return peer;
  const hops = forwarded.split(",").map(value => normalizeIp(value.trim()));
  if (hops.length > 32 || hops.some(hop => !hop)) return peer;
  // Stop at the nearest untrusted hop: addresses to its left can be supplied by that client.
  let address = peer;
  for (let i = hops.length - 1; i >= 0 && trusted.has(address); i--) address = hops[i]!;
  return address;
}
