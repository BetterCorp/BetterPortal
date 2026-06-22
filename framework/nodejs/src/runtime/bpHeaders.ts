import type { BpHeadersApi, BpHeaderSetOptions } from "../contracts/route.js";

const BP_HEADER_PREFIX_PATTERN = /^[A-Za-z0-9_-]+$/;

interface PendingHeader {
  value: string;
  locked: boolean;
  scoped: boolean;
  expires?: number;
  refreshPath?: string;
  refreshBeforeSeconds?: number;
}

export interface BpHeadersCollector extends BpHeadersApi {
  /** Render directives as a list of HTTP response headers. */
  emit(): { setHeaders: string[]; removeHeaders: string[] };
}

export function createBpHeadersCollector(): BpHeadersCollector {
  const pending = new Map<string, PendingHeader>();
  const removed = new Set<string>();

  return {
    set(name: string, value: string, options: BpHeaderSetOptions = {}): void {
      validateHeaderName(name);
      pending.set(name, {
        value,
        locked: options.locked ?? false,
        scoped: options.scopeToOwner ?? Boolean(options.scopeServiceId),
        expires: options.expiresInSeconds
          ? Math.floor(Date.now() / 1000) + options.expiresInSeconds
          : undefined,
        refreshPath: options.refreshPath,
        refreshBeforeSeconds: options.refreshBeforeSeconds
      });
      removed.delete(name);
    },

    remove(name: string): void {
      validateHeaderName(name);
      pending.delete(name);
      removed.add(name);
    },

    emit() {
      const setHeaders: string[] = [];
      for (const [name, entry] of pending.entries()) {
        const parts = [`${name}=${entry.value}`];
        if (entry.locked) parts.push("locked=true");
        if (entry.scoped) parts.push("scope=true");
        if (entry.expires) parts.push(`expires=${entry.expires}`);
        if (entry.refreshPath) parts.push(`refresh=${entry.refreshPath}`);
        if (entry.refreshBeforeSeconds) parts.push(`refreshBefore=${entry.refreshBeforeSeconds}`);
        setHeaders.push(parts.join("; "));
      }
      return {
        setHeaders,
        removeHeaders: Array.from(removed)
      };
    }
  };
}

function validateHeaderName(name: string): void {
  if (!BP_HEADER_PREFIX_PATTERN.test(name) || name.length === 0 || name.length > 128) {
    throw new Error(`Invalid BP header name: ${name}`);
  }
}
