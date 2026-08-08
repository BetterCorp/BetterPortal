import type {
  BetterPortalResolvedApp,
  BetterPortalRouteMount,
  RouteSitemapEntry,
  SitemapChangeFrequency
} from "@betterportal/framework";

export interface RuntimeSitemapRoute {
  routeId: string;
  entries: RouteSitemapEntry[];
}

export interface SitemapUrl {
  loc: string;
  lastModified?: string;
  changeFrequency?: SitemapChangeFrequency;
  priority?: number;
}

export interface SeoDocuments {
  sitemap: SitemapUrl[];
  robots: string;
}

interface RobotsRule {
  userAgent: string;
  path: string;
  access: "allow" | "disallow";
  crawlDelaySeconds?: number;
}

const MAX_SITEMAP_URLS = 50_000;
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pathParamNames(path: string): string[] {
  return path.split("/").flatMap((segment) => {
    const match = segment.match(/^:([A-Za-z_][A-Za-z0-9_]*)$/);
    return match ? [match[1]] : [];
  });
}

export function resolveSeoPath(
  path: string,
  params: Readonly<Record<string, string | number | boolean>> = {}
): string | null {
  let unresolved = false;
  const resolved = path.split("/").map((segment) => {
    const match = segment.match(/^:([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!match) return segment;
    const value = params[match[1]];
    const normalized = value === undefined || value === null ? "" : String(value);
    if (!normalized || normalized.length > 100) {
      unresolved = true;
      return "";
    }
    return encodeURIComponent(normalized);
  }).join("/");
  return unresolved ? null : resolved || "/";
}

function safeRobotsPrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const dynamicAt = segments.findIndex((segment) => segment.startsWith(":"));
  const safe = dynamicAt < 0 ? segments : segments.slice(0, dynamicAt);
  return safe.length ? `/${safe.join("/")}${dynamicAt >= 0 ? "/" : ""}` : "/";
}

function routeIsPublic(app: BetterPortalResolvedApp, route: BetterPortalRouteMount): boolean {
  if (route.enabled === false || (route.kind ?? "page") !== "page" || !route.methods.includes("GET")) return false;
  if (route.authRequired !== false) return false;
  if ((app.seo?.visibility ?? "auto") === "private") return false;
  return true;
}

function routeMetadata(route: BetterPortalRouteMount, entry?: RouteSitemapEntry): Omit<SitemapUrl, "loc"> {
  return {
    ...(entry?.lastModified ? {
      lastModified: entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified
    } : route.sitemap?.lastModified ? { lastModified: route.sitemap.lastModified } : {}),
    ...(entry?.changeFrequency
      ? { changeFrequency: entry.changeFrequency }
      : route.sitemap?.changeFrequency ? { changeFrequency: route.sitemap.changeFrequency } : {}),
    ...(entry?.priority !== undefined
      ? { priority: entry.priority }
      : route.sitemap?.priority !== undefined ? { priority: route.sitemap.priority } : {})
  };
}

export function buildSeoDocuments(
  app: BetterPortalResolvedApp,
  canonicalOrigin: string,
  runtimeRoutes: ReadonlyArray<RuntimeSitemapRoute>,
  failedServices: ReadonlySet<string> = new Set()
): SeoDocuments {
  const origin = canonicalOrigin.replace(/\/+$/, "");
  const runtimeByRoute = new Map<string, RouteSitemapEntry[]>();
  for (const route of runtimeRoutes) {
    runtimeByRoute.set(route.routeId, [...(runtimeByRoute.get(route.routeId) ?? []), ...route.entries]);
  }
  const urls = new Map<string, SitemapUrl>();
  const robotRules = new Map<string, RobotsRule>();
  const failureMode = app.seo?.serviceFailure ?? "omit-service";

  const addRobotRule = (
    userAgent: string,
    path: string,
    access: "allow" | "disallow",
    crawlDelaySeconds?: number
  ) => {
    const key = `${userAgent}\0${path}`;
    const existing = robotRules.get(key);
    robotRules.set(key, {
      userAgent,
      path,
      access: existing?.access === "disallow" || access === "disallow" ? "disallow" : "allow",
      ...(Math.max(existing?.crawlDelaySeconds ?? 0, crawlDelaySeconds ?? 0) > 0
        ? { crawlDelaySeconds: Math.max(existing?.crawlDelaySeconds ?? 0, crawlDelaySeconds ?? 0) }
        : {})
    });
  };

  if ((app.seo?.visibility ?? "auto") === "private") {
    addRobotRule("*", "/", "disallow");
  } else {
    for (const route of app.appRoutes ?? app.routes) {
      const serviceFailed = failedServices.has(route.serviceId);
      const omitted = serviceFailed && failureMode === "omit-service";
      const isPublic = routeIsPublic(app, route) && !omitted;
      const robotsPath = safeRobotsPrefix(route.path);

      if (!isPublic) {
        if (route.enabled !== false && (route.kind ?? "page") === "page") {
          addRobotRule("*", robotsPath, "disallow");
        }
        continue;
      }

      if (route.robots?.length) {
        for (const rule of route.robots) {
          addRobotRule(rule.userAgent, robotsPath, rule.access, rule.crawlDelaySeconds);
        }
      } else {
        addRobotRule("*", robotsPath, "allow");
      }

      if (route.sitemap?.kind === "exclude") continue;
      const dynamic = pathParamNames(route.path).length > 0;
      const runtime = runtimeByRoute.get(route.id) ?? [];
      if (!dynamic) {
        const path = resolveSeoPath(route.path);
        if (path) urls.set(`${origin}${path}`, { loc: `${origin}${path}`, ...routeMetadata(route) });
      }
      for (const entry of runtime) {
        const path = resolveSeoPath(route.path, entry.params);
        if (!path) continue;
        const loc = `${origin}${path}`;
        urls.set(loc, { loc, ...routeMetadata(route, entry) });
      }
    }
  }

  const grouped = new Map<string, RobotsRule[]>();
  for (const rule of robotRules.values()) {
    const rules = grouped.get(rule.userAgent) ?? [];
    rules.push(rule);
    grouped.set(rule.userAgent, rules);
  }
  const robots: string[] = [];
  for (const [agent, rules] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    robots.push(`User-agent: ${agent}`);
    for (const rule of rules.sort((a, b) => a.path.localeCompare(b.path))) {
      robots.push(`${rule.access === "allow" ? "Allow" : "Disallow"}: ${rule.path}`);
    }
    const delay = Math.max(0, ...rules.map((rule) => rule.crawlDelaySeconds ?? 0));
    if (delay > 0) robots.push(`Crawl-delay: ${delay}`);
    robots.push("");
  }
  if ((app.seo?.visibility ?? "auto") !== "private") {
    robots.push(`Sitemap: ${origin}/sitemap.xml`, "");
  }

  return {
    sitemap: [...urls.values()].sort((a, b) => a.loc.localeCompare(b.loc)),
    robots: robots.join("\n")
  };
}

function sitemapUrlXml(entry: SitemapUrl): string {
  const lines = ["  <url>", `    <loc>${xmlEscape(entry.loc)}</loc>`];
  if (entry.lastModified) lines.push(`    <lastmod>${xmlEscape(entry.lastModified)}</lastmod>`);
  if (entry.changeFrequency) lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
  if (entry.priority !== undefined) lines.push(`    <priority>${entry.priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

export function buildSitemapChunks(entries: ReadonlyArray<SitemapUrl>): string[] {
  const header = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const footer = "\n</urlset>\n";
  const chunks: string[] = [];
  let parts: string[] = [];
  let bytes = Buffer.byteLength(header + footer);
  for (const entry of entries) {
    const part = sitemapUrlXml(entry);
    const partBytes = Buffer.byteLength(part + "\n");
    if (parts.length > 0 && (parts.length >= MAX_SITEMAP_URLS || bytes + partBytes > MAX_SITEMAP_BYTES)) {
      chunks.push(header + parts.join("\n") + footer);
      parts = [];
      bytes = Buffer.byteLength(header + footer);
    }
    parts.push(part);
    bytes += partBytes;
  }
  chunks.push(header + parts.join("\n") + footer);
  return chunks;
}

export function buildSitemapIndex(canonicalOrigin: string, chunkCount: number): string {
  const origin = canonicalOrigin.replace(/\/+$/, "");
  const entries = Array.from({ length: chunkCount }, (_, index) =>
    `  <sitemap><loc>${xmlEscape(`${origin}/sitemaps/${index + 1}.xml`)}</loc></sitemap>`
  );
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.join("\n")
    + "\n</sitemapindex>\n";
}
