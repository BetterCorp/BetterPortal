import type { BetterPortalResolvedApp, BetterPortalTenant } from "./platformConfig.js";

export const RobotsAgent = {
  All: "*",
  Googlebot: "Googlebot",
  Bingbot: "bingbot",
  DuckDuckBot: "DuckDuckBot",
  OaiSearchBot: "OAI-SearchBot",
  OaiAdsBot: "OAI-AdsBot",
  GPTBot: "GPTBot",
  ChatGPTUser: "ChatGPT-User",
  ClaudeBot: "ClaudeBot",
  ClaudeUser: "Claude-User",
  ClaudeSearchBot: "Claude-SearchBot",
  PerplexityBot: "PerplexityBot",
  PerplexityUser: "Perplexity-User"
} as const;

export type KnownRobotsAgent = typeof RobotsAgent[keyof typeof RobotsAgent];
export type RobotsAgentToken = KnownRobotsAgent | (string & {});

export interface RouteRobotsRule {
  readonly userAgent: RobotsAgentToken;
  readonly access: "allow" | "disallow";
  readonly crawlDelaySeconds?: number;
}

export type RouteRobotsPolicy = ReadonlyArray<RouteRobotsRule>;

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface RouteSitemapEntry {
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly lastModified?: string | Date;
  readonly changeFrequency?: SitemapChangeFrequency;
  readonly priority?: number;
}

export interface RouteSitemapContext<TPlugin = unknown, TServiceConfig = Record<string, unknown>> {
  readonly plugin: TPlugin;
  readonly tenant: BetterPortalTenant;
  readonly app: BetterPortalResolvedApp;
  readonly config?: TServiceConfig;
  readonly route: { readonly viewId: string; readonly path: string };
  readonly signal: AbortSignal;
}

export type RouteSitemapProvider<TPlugin = unknown, TServiceConfig = Record<string, unknown>> = (
  context: RouteSitemapContext<TPlugin, TServiceConfig>
) => ReadonlyArray<RouteSitemapEntry> | Promise<ReadonlyArray<RouteSitemapEntry>>;

export type RouteSitemapDeclaration<TPlugin = unknown, TServiceConfig = Record<string, unknown>> =
  | boolean
  | RouteSitemapEntry
  | RouteSitemapProvider<TPlugin, TServiceConfig>;

export interface RouteSitemapMetadata {
  readonly kind: "default" | "exclude" | "metadata" | "provider";
  readonly lastModified?: string;
  readonly changeFrequency?: SitemapChangeFrequency;
  readonly priority?: number;
}

export function sitemapMetadata(value: RouteSitemapDeclaration | undefined): RouteSitemapMetadata {
  if (value === false) return { kind: "exclude" };
  if (typeof value === "function") return { kind: "provider" };
  if (value && typeof value === "object") {
    let lastModified: string | undefined;
    if (value.lastModified) {
      const date = value.lastModified instanceof Date ? value.lastModified : new Date(value.lastModified);
      if (Number.isNaN(date.getTime())) throw new TypeError("sitemap.lastModified must be a valid date");
      lastModified = date.toISOString();
    }
    if (value.priority !== undefined
      && (!Number.isFinite(value.priority) || value.priority < 0 || value.priority > 1)) {
      throw new TypeError("sitemap.priority must be between 0 and 1");
    }
    return {
      kind: "metadata",
      ...(lastModified ? { lastModified } : {}),
      ...(value.changeFrequency ? { changeFrequency: value.changeFrequency } : {}),
      ...(value.priority !== undefined ? { priority: value.priority } : {})
    };
  }
  return { kind: "default" };
}
