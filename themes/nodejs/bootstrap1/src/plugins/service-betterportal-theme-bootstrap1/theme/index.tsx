/** @jsxImportSource jsx-htmx */
import { css } from "jsx-htmx";
import {
  createPluginManifest,
  type BetterPortalThemeConfig,
  type HtmlRenderable,
  type PluginManifest
} from "@betterportal/framework";

export interface Bootstrap1RouteLink {
  id: string;
  title: string;
  href: string;
  requestUrl: string;
  serviceId: string;
  active: boolean;
}

export interface Bootstrap1ShellContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  themeConfig: BetterPortalThemeConfig;
  assetBaseUrl: string;
  bodyHtml: HtmlRenderable;
}

export interface Bootstrap1HostPageContext {
  title: string;
  brandName: string;
  themeMode: "light" | "dark";
  themeConfig: BetterPortalThemeConfig;
  assetBaseUrl: string;
  currentPath: string;
  initialRouteUrl?: string;
  initialServiceId?: string;
  routeLinks: Bootstrap1RouteLink[];
  navItems?: Bootstrap1NavItem[];
  resolvedFragments: Record<string, Array<{
    fragmentId: string;
    serviceId: string;
    url: string;
    fragmentKey: string;
  }>>;
  loginUrl?: string;
  logoutUrl?: string;
}

export const Bootstrap1Manifest: PluginManifest = createPluginManifest({
  pluginId: "theme.betterportal.bootstrap1",
  title: "BetterPortal Bootstrap1 Theme",
  description: "Custom Bootstrap 5 plus HTMX shell for BetterPortal v10.",
  version: "1.0.0",
  category: "theme",
  deploymentModes: ["bp-hosted", "customer-hosted", "self-hosted"],
  capabilities: [
    "theme.shell",
    "theme.bootstrap5",
    "theme.htmx",
    "theme.light-dark",
    "theme.whitelabel"
  ],
  supportedThemes: ["bootstrap1"],
  supportedRenderModes: ["page", "fragment", "embed"],
  views: [],
  configSchemas: [],
  permissions: [],
  adminApis: [],
  cacheHints: {
    metadataTtlSeconds: 1800
  }
});

export interface Bootstrap1NavLeaf {
  kind: "route";
  route: Bootstrap1RouteLink;
  breadcrumb: string;
  label?: string;
}

export interface Bootstrap1NavGroup {
  kind: "group";
  id: string;
  title: string;
  items: Bootstrap1NavLeaf[];
  active: boolean;
}

export type Bootstrap1NavItem = Bootstrap1NavLeaf | Bootstrap1NavGroup;

function normalizeRoutePath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function routeSegments(path: string): string[] {
  return normalizeRoutePath(path).split("/").filter(Boolean);
}

function titleFromSegment(segment: string): string {
  const words = segment
    .split(/[-_]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "Section";
  }

  return words
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function routeIconText(title: string): string {
  const words = title.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = words.map((word) => word.slice(0, 1).toUpperCase()).join("");
  return initials || title.slice(0, 2).toUpperCase();
}

function routeBreadcrumb(groupTitle: string | null, route: Bootstrap1RouteLink): string {
  if (!groupTitle || groupTitle === route.title) {
    return "";
  }

  return `${groupTitle} / ${route.title}`;
}

function buildNavItems(routeLinks: Bootstrap1RouteLink[]): Bootstrap1NavItem[] {
  const nestedPrefixes = new Set<string>();
  const topLevelRoutes = new Map<string, Bootstrap1RouteLink>();

  routeLinks.forEach((route) => {
    const segments = routeSegments(route.href);
    if (segments.length > 1) {
      nestedPrefixes.add(segments[0] ?? "");
    }
    if (segments.length === 1) {
      topLevelRoutes.set(normalizeRoutePath(route.href), route);
    }
  });

  const consumed = new Set<string>();
  const items: Bootstrap1NavItem[] = [];

  for (const route of routeLinks) {
    const normalizedPath = normalizeRoutePath(route.href);
    if (consumed.has(normalizedPath)) {
      continue;
    }

    const segments = routeSegments(route.href);
    const prefix = segments[0];

    if (segments.length === 1 && prefix && nestedPrefixes.has(prefix)) {
      const groupTitle = route.title;
      const groupedRoutes = routeLinks.filter((candidate) => {
        const candidatePath = normalizeRoutePath(candidate.href);
        return !consumed.has(candidatePath) && routeSegments(candidate.href)[0] === prefix;
      });
      const childRoutes = groupedRoutes.filter((candidate) => normalizeRoutePath(candidate.href) !== normalizedPath);

      groupedRoutes.forEach((candidate) => consumed.add(normalizeRoutePath(candidate.href)));
      items.push({
        kind: "group",
        id: `group-${prefix}`,
        title: groupTitle,
        items: [
          {
            kind: "route",
            route,
            breadcrumb: "",
            label: "Overview"
          },
          ...childRoutes.map((candidate) => ({
            kind: "route" as const,
            route: candidate,
            breadcrumb: routeBreadcrumb(groupTitle, candidate)
          }))
        ],
        active: groupedRoutes.some((candidate) => candidate.active)
      });
      continue;
    }

    if (segments.length > 1 && prefix) {
      const baseRoute = topLevelRoutes.get(`/${prefix}`);
      const groupTitle = baseRoute?.title ?? titleFromSegment(prefix);
      const groupedRoutes = routeLinks.filter((candidate) => {
        const candidatePath = normalizeRoutePath(candidate.href);
        return !consumed.has(candidatePath) && routeSegments(candidate.href)[0] === prefix;
      });

      groupedRoutes.forEach((candidate) => consumed.add(normalizeRoutePath(candidate.href)));
      items.push({
        kind: "group",
        id: `group-${prefix}`,
        title: groupTitle,
        items: groupedRoutes.map((candidate) => ({
          kind: "route",
          route: candidate,
          breadcrumb: routeBreadcrumb(groupTitle, candidate)
        })),
        active: groupedRoutes.some((candidate) => candidate.active)
      });
      continue;
    }

    consumed.add(normalizedPath);
    items.push({
      kind: "route",
      route,
      breadcrumb: ""
    });
  }

  return items;
}

function activeBreadcrumb(navItems: Bootstrap1NavItem[]): string {
  for (const item of navItems) {
    if (item.kind === "route" && item.route.active) {
      return item.breadcrumb;
    }

    if (item.kind === "group") {
      const activeItem = item.items.find((child) => child.route.active);
      if (activeItem) {
        return activeItem.breadcrumb;
      }
    }
  }

  return "";
}

function renderRouteLink(item: Bootstrap1NavLeaf, dismissMobileMenu = false): HtmlRenderable {
  const route = item.route;
  const displayTitle = item.label ?? route.title;
  const isChild = Boolean(item.breadcrumb || item.label);

  return (
    <a
      class={`bp-admin__route${route.active ? " active" : ""}${isChild ? " bp-admin__route--child" : ""}`}
      href={route.href}
      data-bp-route-link=""
      data-bp-route-title={route.title}
      data-bp-route-breadcrumb={item.breadcrumb}
      data-bp-route-request={route.requestUrl}
      data-bp-service={route.serviceId}
      hx-get={route.requestUrl}
      hx-target="#bp-main"
      hx-swap="innerHTML"
      hx-push-url={route.href}
      data-bs-dismiss={dismissMobileMenu ? "offcanvas" : undefined}
    >
      {displayTitle}
    </a>
  );
}

export function renderNavItems(navItems: Bootstrap1NavItem[], dismissMobileMenu = false): HtmlRenderable {
  return navItems.map((item) => {
    if (item.kind === "route") {
      return renderRouteLink(item, dismissMobileMenu);
    }

    return (
      <details class="bp-admin__nav-group" data-bp-nav-group="" open={item.active ? true : undefined}>
        <summary class="bp-admin__nav-group-toggle">
          <span class="bp-admin__nav-group-title">{item.title}</span>
          <span class="bp-admin__nav-group-chevron">⌄</span>
        </summary>
        <div class="bp-admin__nav-group-items">
          {item.items.map((child) => renderRouteLink(child, dismissMobileMenu))}
        </div>
      </details>
    );
  });
}

export function shellStyles(mode: "light" | "dark", themeConfig: BetterPortalThemeConfig) {
  const surfaceConfig = mode === "dark" ? themeConfig.dark : themeConfig.light;
  /* ── Neumorphic shadow tokens ── */
  const neu = mode === "dark" ? {
    bg: "#2c2c2e",
    surface: "#2c2c2e",
    surfaceAlt: "#242426",
    shadowDark: "rgba(0,0,0,0.35)",
    shadowLight: "rgba(255,255,255,0.04)",
    raised: "6px 6px 14px rgba(0,0,0,0.35), -6px -6px 14px rgba(255,255,255,0.04)",
    raisedSoft: "4px 4px 10px rgba(0,0,0,0.30), -4px -4px 10px rgba(255,255,255,0.03)",
    inset: "inset 3px 3px 7px rgba(0,0,0,0.40), inset -3px -3px 7px rgba(255,255,255,0.05)",
    insetSoft: "inset 2px 2px 5px rgba(0,0,0,0.30), inset -2px -2px 5px rgba(255,255,255,0.04)"
  } : {
    bg: "#e3e7ed",
    surface: "#e3e7ed",
    surfaceAlt: "#d9dde3",
    shadowDark: "rgba(163,170,182,0.5)",
    shadowLight: "rgba(255,255,255,0.8)",
    raised: "6px 6px 14px rgba(163,170,182,0.5), -6px -6px 14px rgba(255,255,255,0.8)",
    raisedSoft: "4px 4px 10px rgba(163,170,182,0.4), -4px -4px 10px rgba(255,255,255,0.7)",
    inset: "inset 3px 3px 7px rgba(163,170,182,0.55), inset -3px -3px 7px rgba(255,255,255,0.85)",
    insetSoft: "inset 2px 2px 5px rgba(163,170,182,0.40), inset -2px -2px 5px rgba(255,255,255,0.75)"
  };

  return css({
    ":root": {
      colorScheme: mode === "dark" ? "dark" : "light",
      "--bp-bg": surfaceConfig.background ?? neu.bg,
      "--bp-surface": surfaceConfig.surface ?? neu.surface,
      "--bp-surface-alt": surfaceConfig.surfaceAlt ?? neu.surfaceAlt,
      "--bp-text": surfaceConfig.text ?? (mode === "dark" ? "#f5f5f7" : "#1d1d1f"),
      "--bp-text-soft": surfaceConfig.textSoft ?? (mode === "dark" ? "#86868b" : "#6e6e73"),
      "--bp-border": surfaceConfig.border ?? (mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
      "--bp-accent": themeConfig.bootstrap.primary ?? "#007aff",
      "--bp-accent-secondary": themeConfig.bootstrap.secondary ?? "#8e8e93",
      "--bp-accent-success": themeConfig.bootstrap.success ?? "#30d158",
      "--bp-accent-info": themeConfig.bootstrap.info ?? "#64d2ff",
      "--bp-accent-warning": themeConfig.bootstrap.warning ?? "#ffd60a",
      "--bp-accent-danger": themeConfig.bootstrap.danger ?? "#ff453a",
      "--bp-accent-soft": surfaceConfig.accentSoft ?? (mode === "dark" ? "rgba(0,122,255,0.15)" : "rgba(0,122,255,0.08)"),
      "--bp-shadow": neu.raised,
      "--bp-shadow-soft": neu.raisedSoft,
      "--bp-shadow-inset": neu.inset,
      "--bp-shadow-inset-soft": neu.insetSoft,
      "--bs-primary": themeConfig.bootstrap.primary ?? "#007aff",
      "--bs-secondary": themeConfig.bootstrap.secondary ?? "#8e8e93",
      "--bs-success": themeConfig.bootstrap.success ?? "#30d158",
      "--bs-info": themeConfig.bootstrap.info ?? "#64d2ff",
      "--bs-warning": themeConfig.bootstrap.warning ?? "#ffd60a",
      "--bs-danger": themeConfig.bootstrap.danger ?? "#ff453a",
      "--bs-light": themeConfig.bootstrap.light ?? "#f2f2f7",
      "--bs-dark": themeConfig.bootstrap.dark ?? "#1d1d1f"
    },
    "html, body": {
      margin: 0,
      minHeight: "100%",
      background: "radial-gradient(ellipse at 15% 10%, color-mix(in srgb, var(--bp-accent) 14%, transparent), transparent 50%), radial-gradient(ellipse at 85% 80%, color-mix(in srgb, var(--bp-accent-secondary) 10%, transparent), transparent 40%), radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--bp-accent) 5%, transparent), transparent 60%), var(--bp-bg)",
      backgroundAttachment: "fixed",
      color: "var(--bp-text)"
    },
    body: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", Roboto, sans-serif',
      "-webkit-font-smoothing": "antialiased",
      "-moz-osx-font-smoothing": "grayscale"
    },
    ".bp-shell": {
      minHeight: "100vh",
      padding: "0.85rem"
    },
    ".bp-admin": {
      maxWidth: 1540,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "272px minmax(0, 1fr)",
      gap: "1rem",
      alignItems: "start"
    },
    /* ── Sidebar: lives ON the background, no card ── */
    ".bp-admin__sidebar": {
      position: "sticky",
      top: "1rem",
      minHeight: "calc(100vh - 2rem)",
      borderRadius: 0,
      padding: "0.5rem 0.5rem 0.5rem 0.2rem",
      background: "transparent",
      border: "none",
      boxShadow: "none",
      display: "grid",
      gridTemplateRows: "auto 1fr",
      gap: "0.75rem",
      overflow: "visible"
    },

    /* ── Workspace: raised glass card (topbar + content) ── */
    ".bp-admin__workspace": {
      minHeight: "calc(100vh - 1.7rem)",
      borderRadius: "1.5rem",
      background: mode === "dark"
        ? "rgba(50,50,52,0.72)"
        : "rgba(255,255,255,0.65)",
      backdropFilter: "blur(24px)",
      "-webkit-backdrop-filter": "blur(24px)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(255,255,255,0.55)",
      boxShadow: "var(--bp-shadow)",
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "auto 1fr",
      gap: 0
    },

    /* ── Brand: text on background ── */
    ".bp-admin__brand-row": {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: "0.9rem",
      padding: "0.4rem 0.5rem",
      zIndex: 1
    },
    ".bp-admin__brand-name": {
      fontSize: "1.1rem",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      color: "var(--bp-text)"
    },
    ".bp-admin__sidebar-nav": {
      position: "relative",
      zIndex: 1
    },
    ".bp-admin__menu-button": {
      display: "none"
    },

    /* ── Nav: clean text on background ── */
    ".bp-admin__nav": {
      display: "grid",
      gap: "0.15rem"
    },
    ".bp-admin__nav-group": {
      display: "grid",
      gap: "0.1rem"
    },
    ".bp-admin__nav-group-toggle": {
      listStyle: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      padding: "0.65rem 0.55rem 0.25rem",
      color: "var(--bp-text)",
      cursor: "pointer",
      letterSpacing: "0.06em",
      fontSize: "0.68rem",
      fontWeight: 600,
      textTransform: "uppercase",
      opacity: 0.45
    },
    ".bp-admin__nav-group:hover .bp-admin__nav-group-toggle": {
      opacity: 0.7
    },
    ".bp-admin__nav-group-toggle::-webkit-details-marker": {
      display: "none"
    },
    ".bp-admin__nav-group-title": {
      minWidth: 0
    },
    ".bp-admin__nav-group-chevron": {
      fontSize: "0.65rem",
      opacity: 0.5,
      transition: "transform 180ms ease"
    },
    ".bp-admin__nav-group[open] .bp-admin__nav-group-chevron": {
      transform: "rotate(180deg)"
    },
    ".bp-admin__nav-group-items": {
      display: "grid",
      gap: "0.05rem",
      marginLeft: "0",
      paddingLeft: "0",
      borderLeft: "none"
    },

    /* ── Routes: uniform text, on background ── */
    ".bp-admin__route": {
      display: "block",
      borderRadius: "0.6rem",
      padding: "0.5rem 0.55rem",
      color: "var(--bp-text)",
      textDecoration: "none",
      border: "none",
      background: "transparent",
      transition: "all 160ms ease",
      fontSize: "0.88rem",
      fontWeight: 500,
      opacity: 0.7
    },
    ".bp-admin__route:hover": {
      opacity: 1,
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)"
    },
    ".bp-admin__route.active": {
      color: "var(--bp-accent)",
      background: "var(--bp-accent-soft)",
      boxShadow: "none",
      fontWeight: 600,
      opacity: 1
    },
    ".bp-admin__route--child": {
      paddingLeft: "0.55rem",
      fontSize: "0.86rem"
    },
    ".bp-admin__route--child:hover": {
      transform: "none"
    },
    ".bp-admin__route--child.active": {
      boxShadow: "none"
    },

    /* ── Topbar: inside glass card, no own card ── */
    ".bp-admin__topbar": {
      position: "relative",
      borderRadius: 0,
      border: "none",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      padding: "0.85rem 1.25rem",
      background: "transparent",
      boxShadow: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      flexWrap: "wrap"
    },
    ".bp-admin__topbar-main": {
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
      flexWrap: "wrap"
    },
    ".bp-admin__topbar-context": {
      display: "grid",
      gap: "0.1rem"
    },
    ".bp-admin__topbar-label": {
      color: "var(--bp-text-soft)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontSize: "0.68rem",
      fontWeight: 600
    },
    ".bp-admin__topbar-title": {
      fontSize: "1rem",
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    ".bp-admin__profile-shell": {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "0.75rem",
      minWidth: 180
    },
    ".bp-admin__profile-shell > [data-bp-fragment]": {
      display: "inline-flex",
      alignItems: "center"
    },
    ".bp-admin__title": {
      margin: 0,
      fontSize: "clamp(1.3rem, 2.4vw, 1.85rem)",
      lineHeight: 1.05,
      fontWeight: 700,
      letterSpacing: "-0.04em"
    },
    ".bp-admin__breadcrumb": {
      marginBottom: "0.3rem",
      color: "var(--bp-text-soft)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontSize: "0.68rem",
      fontWeight: 600
    },
    ".bp-admin__breadcrumb:empty": {
      display: "none"
    },

    /* ── Content: inside glass card, fills remaining height ── */
    ".bp-admin__content-frame": {
      position: "relative",
      overflow: "hidden",
      borderRadius: 0,
      border: "none",
      background: "transparent",
      boxShadow: "none",
      minHeight: 0
    },
    ".bp-admin__content-frame.is-loading .bp-admin__content-overlay": {
      opacity: 1,
      pointerEvents: "auto"
    },
    ".bp-admin__content-head": {
      position: "relative",
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      padding: "1.1rem 1.25rem 0"
    },
    ".bp-admin__content-status": {
      position: "relative",
      zIndex: 1,
      padding: "0.75rem 1.25rem 0"
    },
    ".bp-admin__error": {
      display: "none"
    },
    ".bp-admin__error.is-visible": {
      display: "block"
    },
    ".bp-admin__content-overlay": {
      position: "absolute",
      inset: 0,
      zIndex: 2,
      display: "grid",
      placeItems: "center",
      background: mode === "dark"
        ? "rgba(50,50,52,0.60)"
        : "rgba(255,255,255,0.55)",
      backdropFilter: "blur(16px)",
      "-webkit-backdrop-filter": "blur(16px)",
      opacity: 0,
      pointerEvents: "none",
      transition: "opacity 180ms ease"
    },
    ".bp-admin__content-overlay-card": {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.85rem 1.1rem",
      borderRadius: "1rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.80)"
        : "rgba(255,255,255,0.80)",
      backdropFilter: "blur(12px)",
      "-webkit-backdrop-filter": "blur(12px)",
      boxShadow: "var(--bp-shadow-soft)",
      color: "var(--bp-text-soft)",
      fontWeight: 600
    },
    ".bp-shell__main": {
      minHeight: 0,
      position: "relative",
      zIndex: 1,
      padding: "0.85rem 1.25rem 1.25rem"
    },
    ".bp-shell__loading": {
      minHeight: 320,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.75rem",
      color: "var(--bp-text-soft)"
    },
    ".bp-shell__empty-state": {
      minHeight: 320,
      display: "grid",
      placeItems: "center"
    },
    ".bp-shell__empty-card": {
      maxWidth: 420,
      padding: "1.5rem",
      borderRadius: "1.25rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.04)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.60)"
        : "rgba(255,255,255,0.60)",
      textAlign: "center",
      backdropFilter: "blur(12px)",
      "-webkit-backdrop-filter": "blur(12px)"
    },
    ".bp-shell__empty-title": {
      fontSize: "1.1rem",
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    ".bp-shell__empty-copy": {
      marginTop: "0.45rem",
      color: "var(--bp-text-soft)",
      lineHeight: 1.6
    },
    ".bp-shell__empty-actions": {
      marginTop: "1rem",
      display: "flex",
      justifyContent: "center"
    },

    /* ── Mobile menu ── */
    ".bp-admin__mobile-menu": {
      background: mode === "dark"
        ? "rgba(44,44,46,0.92)"
        : "rgba(255,255,255,0.88)",
      backdropFilter: "blur(20px)",
      "-webkit-backdrop-filter": "blur(20px)",
      color: "var(--bp-text)",
      boxShadow: "var(--bp-shadow)",
      border: "none"
    },
    ".bp-admin__mobile-menu .offcanvas-header": {
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.06)"
    },
    ".bp-admin__mobile-menu .offcanvas-body": {
      display: "grid",
      gap: "1rem",
      alignContent: "start"
    },

    /* ══════════════════════════════════════════════
       Bootstrap Component Defaults (glass neumorphic)
       Scoped to content area so services/plugins
       use vanilla Bootstrap and get styled automatically
       ══════════════════════════════════════════════ */

    /* ── Cards ── */
    ".bp-shell__main .card": {
      border: "none",
      borderRadius: "1rem",
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(255,255,255,0.55)",
      backdropFilter: "blur(8px)",
      "-webkit-backdrop-filter": "blur(8px)",
      boxShadow: mode === "dark"
        ? "0 2px 12px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
      color: "var(--bp-text)",
      transition: "box-shadow 180ms ease, transform 180ms ease"
    },
    ".bp-shell__main .card:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)"
        : "0 4px 20px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.7)"
    },
    ".bp-shell__main .card-header": {
      background: "transparent",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      fontWeight: 600
    },
    ".bp-shell__main .card-footer": {
      background: "transparent",
      borderTop: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)"
    },

    /* ── Buttons ── */
    /* Neumorphic feel: inner glow, soft shadow, no heavy transparency  */
    ".bp-shell__main .btn": {
      borderRadius: "0.6rem",
      fontWeight: 600,
      fontSize: "0.88rem",
      letterSpacing: "-0.01em",
      transition: "all 160ms ease",
      border: "none"
    },
    ".bp-shell__main .btn:active": {
      transform: "translateY(0.5px)",
      boxShadow: "var(--bp-shadow-inset-soft)"
    },
    ".bp-shell__main .btn:disabled, .bp-shell__main .btn.disabled": {
      opacity: 0.45,
      transform: "none",
      boxShadow: "none",
      pointerEvents: "none"
    },

    /* ── Primary: opaque accent + inner glow ── */
    ".bp-shell__main .btn-primary": {
      background: "var(--bp-accent)",
      color: "#ffffff",
      boxShadow: mode === "dark"
        ? "0 2px 10px color-mix(in srgb, var(--bp-accent) 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 2px 10px color-mix(in srgb, var(--bp-accent) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)"
    },
    ".bp-shell__main .btn-primary:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 18px color-mix(in srgb, var(--bp-accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.20)"
        : "0 4px 18px color-mix(in srgb, var(--bp-accent) 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.30)",
      transform: "translateY(-1px)"
    },

    /* ── Secondary: soft neutral surface ── */
    ".bp-shell__main .btn-secondary": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(0,0,0,0.06)",
      color: "var(--bp-text)",
      boxShadow: mode === "dark"
        ? "0 1px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 1px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-secondary:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.15)"
        : "rgba(0,0,0,0.09)",
      boxShadow: mode === "dark"
        ? "0 3px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 3px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)",
      transform: "translateY(-1px)"
    },

    /* ── Success ── */
    ".bp-shell__main .btn-success": {
      background: "var(--bp-accent-success)",
      color: "#ffffff",
      boxShadow: mode === "dark"
        ? "0 2px 10px rgba(48,209,88,0.22), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 2px 10px rgba(48,209,88,0.15), inset 0 1px 0 rgba(255,255,255,0.25)"
    },
    ".bp-shell__main .btn-success:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 18px rgba(48,209,88,0.32), inset 0 1px 0 rgba(255,255,255,0.20)"
        : "0 4px 18px rgba(48,209,88,0.22), inset 0 1px 0 rgba(255,255,255,0.30)",
      transform: "translateY(-1px)"
    },

    /* ── Danger ── */
    ".bp-shell__main .btn-danger": {
      background: "var(--bp-accent-danger)",
      color: "#ffffff",
      boxShadow: mode === "dark"
        ? "0 2px 10px rgba(255,69,58,0.22), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 2px 10px rgba(255,69,58,0.15), inset 0 1px 0 rgba(255,255,255,0.25)"
    },
    ".bp-shell__main .btn-danger:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 18px rgba(255,69,58,0.32), inset 0 1px 0 rgba(255,255,255,0.20)"
        : "0 4px 18px rgba(255,69,58,0.22), inset 0 1px 0 rgba(255,255,255,0.30)",
      transform: "translateY(-1px)"
    },

    /* ── Warning ── */
    ".bp-shell__main .btn-warning": {
      background: "var(--bp-accent-warning)",
      color: "#1a1a1c",
      boxShadow: mode === "dark"
        ? "0 2px 10px rgba(255,214,10,0.18), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 2px 10px rgba(255,214,10,0.12), inset 0 1px 0 rgba(255,255,255,0.30)"
    },
    ".bp-shell__main .btn-warning:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 18px rgba(255,214,10,0.28), inset 0 1px 0 rgba(255,255,255,0.20)"
        : "0 4px 18px rgba(255,214,10,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
      transform: "translateY(-1px)"
    },

    /* ── Info ── */
    ".bp-shell__main .btn-info": {
      background: "var(--bp-accent-info)",
      color: "#ffffff",
      boxShadow: mode === "dark"
        ? "0 2px 10px rgba(100,210,255,0.18), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 2px 10px rgba(100,210,255,0.12), inset 0 1px 0 rgba(255,255,255,0.25)"
    },
    ".bp-shell__main .btn-info:hover": {
      boxShadow: mode === "dark"
        ? "0 4px 18px rgba(100,210,255,0.28), inset 0 1px 0 rgba(255,255,255,0.20)"
        : "0 4px 18px rgba(100,210,255,0.18), inset 0 1px 0 rgba(255,255,255,0.30)",
      transform: "translateY(-1px)"
    },

    /* ── Light: soft raised surface ── */
    ".bp-shell__main .btn-light": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(255,255,255,0.75)",
      color: "var(--bp-text)",
      boxShadow: mode === "dark"
        ? "0 1px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 1px 6px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)"
    },
    ".bp-shell__main .btn-light:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.14)"
        : "rgba(255,255,255,0.90)",
      boxShadow: mode === "dark"
        ? "0 3px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 3px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
      transform: "translateY(-1px)"
    },

    /* ── Dark: high-contrast inverted ── */
    ".bp-shell__main .btn-dark": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.85)"
        : "rgba(0,0,0,0.82)",
      color: mode === "dark" ? "#1a1a1c" : "#ffffff",
      boxShadow: mode === "dark"
        ? "0 2px 10px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.10)"
        : "0 2px 10px rgba(0,0,0,0.12), inset 0 -1px 0 rgba(255,255,255,0.06)"
    },
    ".bp-shell__main .btn-dark:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.92)"
        : "rgba(0,0,0,0.90)",
      boxShadow: mode === "dark"
        ? "0 4px 18px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.15)"
        : "0 4px 18px rgba(0,0,0,0.18), inset 0 -1px 0 rgba(255,255,255,0.08)",
      transform: "translateY(-1px)"
    },

    /* ── Outline variants: frosted glass shell, color text ── */
    ".bp-shell__main .btn-outline-primary": {
      color: "var(--bp-accent)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-primary:hover": {
      background: mode === "dark"
        ? "color-mix(in srgb, var(--bp-accent) 20%, transparent)"
        : "color-mix(in srgb, var(--bp-accent) 12%, transparent)",
      borderColor: "color-mix(in srgb, var(--bp-accent) 40%, transparent)",
      color: "var(--bp-accent)",
      boxShadow: mode === "dark"
        ? "0 3px 14px color-mix(in srgb, var(--bp-accent) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 14px color-mix(in srgb, var(--bp-accent) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.5)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-secondary": {
      color: "var(--bp-text-soft)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-secondary:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.04)",
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.08)",
      color: "var(--bp-text)",
      boxShadow: mode === "dark"
        ? "0 3px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.55)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-success": {
      color: "var(--bp-accent-success)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-success:hover": {
      background: mode === "dark"
        ? "rgba(48,209,88,0.15)"
        : "rgba(48,209,88,0.08)",
      borderColor: mode === "dark"
        ? "rgba(48,209,88,0.30)"
        : "rgba(48,209,88,0.25)",
      color: "var(--bp-accent-success)",
      boxShadow: mode === "dark"
        ? "0 3px 14px rgba(48,209,88,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 14px rgba(48,209,88,0.10), inset 0 1px 0 rgba(255,255,255,0.5)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-danger": {
      color: "var(--bp-accent-danger)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-danger:hover": {
      background: mode === "dark"
        ? "rgba(255,69,58,0.15)"
        : "rgba(255,69,58,0.08)",
      borderColor: mode === "dark"
        ? "rgba(255,69,58,0.30)"
        : "rgba(255,69,58,0.25)",
      color: "var(--bp-accent-danger)",
      boxShadow: mode === "dark"
        ? "0 3px 14px rgba(255,69,58,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 14px rgba(255,69,58,0.10), inset 0 1px 0 rgba(255,255,255,0.5)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-warning": {
      color: mode === "dark" ? "var(--bp-accent-warning)" : "#7a6400",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-warning:hover": {
      background: mode === "dark"
        ? "rgba(255,214,10,0.15)"
        : "rgba(255,214,10,0.10)",
      borderColor: mode === "dark"
        ? "rgba(255,214,10,0.30)"
        : "rgba(255,214,10,0.25)",
      boxShadow: mode === "dark"
        ? "0 3px 14px rgba(255,214,10,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 14px rgba(255,214,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-info": {
      color: "var(--bp-accent-info)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-info:hover": {
      background: mode === "dark"
        ? "rgba(100,210,255,0.15)"
        : "rgba(100,210,255,0.08)",
      borderColor: mode === "dark"
        ? "rgba(100,210,255,0.30)"
        : "rgba(100,210,255,0.25)",
      color: "var(--bp-accent-info)",
      boxShadow: mode === "dark"
        ? "0 3px 14px rgba(100,210,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 14px rgba(100,210,255,0.10), inset 0 1px 0 rgba(255,255,255,0.5)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-dark": {
      color: "var(--bp-text)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.45)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(0,0,0,0.10)",
      boxShadow: mode === "dark"
        ? "0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-dark:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(0,0,0,0.06)",
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.18)"
        : "rgba(0,0,0,0.14)",
      boxShadow: mode === "dark"
        ? "0 3px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 3px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.55)",
      transform: "translateY(-1px)"
    },
    ".bp-shell__main .btn-outline-light": {
      color: "var(--bp-text)",
      background: "transparent",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      boxShadow: mode === "dark"
        ? "inset 0 1px 0 rgba(255,255,255,0.04)"
        : "inset 0 1px 0 rgba(255,255,255,0.5)"
    },
    ".bp-shell__main .btn-outline-light:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(255,255,255,0.55)",
      boxShadow: mode === "dark"
        ? "0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)",
      transform: "translateY(-1px)"
    },

    /* ── Tables ── */
    ".bp-shell__main .table": {
      "--bs-table-bg": "transparent",
      "--bs-table-hover-bg": mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.015)",
      color: "var(--bp-text)",
      fontSize: "0.88rem"
    },
    ".bp-shell__main .table th": {
      fontWeight: 600,
      fontSize: "0.78rem",
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      color: "var(--bp-text-soft)",
      borderBottomWidth: "1px",
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.06)"
    },
    ".bp-shell__main .table td": {
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.04)",
      verticalAlign: "middle"
    },

    /* ── Badges ── */
    ".bp-shell__main .badge": {
      fontWeight: 600,
      fontSize: "0.74rem",
      letterSpacing: "0.01em",
      borderRadius: "0.45rem",
      padding: "0.35em 0.65em"
    },
    ".bp-shell__main .badge.text-bg-light": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08) !important"
        : "rgba(0,0,0,0.04) !important",
      color: "var(--bp-text) !important"
    },
    ".bp-shell__main .badge.rounded-pill": {
      borderRadius: "999px"
    },
    ".bp-shell__main .badge.text-bg-primary": {
      background: "var(--bp-accent) !important",
      color: "#ffffff !important"
    },
    ".bp-shell__main .badge.text-bg-secondary": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.10) !important"
        : "rgba(0,0,0,0.06) !important",
      color: "var(--bp-text) !important"
    },
    ".bp-shell__main .badge.text-bg-success": {
      background: mode === "dark"
        ? "rgba(48,209,88,0.20) !important"
        : "rgba(48,209,88,0.12) !important",
      color: "var(--bp-accent-success) !important"
    },
    ".bp-shell__main .badge.text-bg-danger": {
      background: mode === "dark"
        ? "rgba(255,69,58,0.20) !important"
        : "rgba(255,69,58,0.12) !important",
      color: "var(--bp-accent-danger) !important"
    },
    ".bp-shell__main .badge.text-bg-warning": {
      background: mode === "dark"
        ? "rgba(255,214,10,0.20) !important"
        : "rgba(255,214,10,0.15) !important",
      color: mode === "dark" ? "#ffd60a !important" : "#7a6400 !important"
    },
    ".bp-shell__main .badge.text-bg-info": {
      background: mode === "dark"
        ? "rgba(100,210,255,0.18) !important"
        : "rgba(100,210,255,0.12) !important",
      color: mode === "dark" ? "#64d2ff !important" : "#0077b6 !important"
    },
    ".bp-shell__main .badge.text-bg-dark": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.80) !important"
        : "rgba(0,0,0,0.80) !important",
      color: mode === "dark" ? "#1a1a1c !important" : "#ffffff !important"
    },

    /* ── Form controls ── */
    ".bp-shell__main .form-control, .bp-shell__main .form-select": {
      borderRadius: "0.6rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(0,0,0,0.08)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(255,255,255,0.6)",
      color: "var(--bp-text)",
      fontSize: "0.9rem",
      transition: "border-color 160ms ease, box-shadow 160ms ease"
    },
    ".bp-shell__main .form-control:focus, .bp-shell__main .form-select:focus": {
      borderColor: "var(--bp-accent)",
      boxShadow: "0 0 0 3px var(--bp-accent-soft)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(255,255,255,0.85)"
    },
    ".bp-shell__main .form-control::placeholder": {
      color: "var(--bp-text-soft)",
      opacity: 0.6
    },
    ".bp-shell__main .form-label": {
      fontWeight: 600,
      fontSize: "0.84rem",
      marginBottom: "0.35rem",
      color: "var(--bp-text)"
    },
    ".bp-shell__main .form-text": {
      color: "var(--bp-text-soft)",
      fontSize: "0.78rem"
    },
    ".bp-shell__main .form-check-input": {
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.15)"
        : "rgba(0,0,0,0.12)"
    },
    ".bp-shell__main .form-check-input:checked": {
      backgroundColor: "var(--bp-accent)",
      borderColor: "var(--bp-accent)"
    },

    /* ── Alerts ── */
    ".bp-shell__main .alert": {
      borderRadius: "0.8rem",
      border: "none",
      backdropFilter: "blur(6px)",
      "-webkit-backdrop-filter": "blur(6px)",
      fontSize: "0.88rem"
    },
    ".bp-shell__main .alert-primary": {
      background: "color-mix(in srgb, var(--bp-accent) 12%, transparent)",
      color: "var(--bp-accent)"
    },
    ".bp-shell__main .alert-danger": {
      background: mode === "dark"
        ? "rgba(255,69,58,0.15)"
        : "rgba(255,69,58,0.08)",
      color: "var(--bp-accent-danger)"
    },
    ".bp-shell__main .alert-success": {
      background: mode === "dark"
        ? "rgba(48,209,88,0.15)"
        : "rgba(48,209,88,0.08)",
      color: "var(--bp-accent-success)"
    },
    ".bp-shell__main .alert-warning": {
      background: mode === "dark"
        ? "rgba(255,214,10,0.15)"
        : "rgba(255,214,10,0.10)",
      color: mode === "dark" ? "#ffd60a" : "#7a6400"
    },
    ".bp-shell__main .alert-info": {
      background: mode === "dark"
        ? "rgba(100,210,255,0.12)"
        : "rgba(100,210,255,0.08)",
      color: mode === "dark" ? "#64d2ff" : "#0077b6"
    },

    /* ── Dropdowns ── */
    ".bp-shell__main .dropdown-menu": {
      borderRadius: "0.8rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.88)"
        : "rgba(255,255,255,0.88)",
      backdropFilter: "blur(20px)",
      "-webkit-backdrop-filter": "blur(20px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      padding: "0.4rem",
      fontSize: "0.88rem"
    },
    ".bp-shell__main .dropdown-item": {
      borderRadius: "0.45rem",
      padding: "0.45rem 0.75rem",
      color: "var(--bp-text)",
      transition: "background 120ms ease"
    },
    ".bp-shell__main .dropdown-item:hover, .bp-shell__main .dropdown-item:focus": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.04)",
      color: "var(--bp-text)"
    },
    ".bp-shell__main .dropdown-item.active, .bp-shell__main .dropdown-item:active": {
      background: "var(--bp-accent)",
      color: "#ffffff"
    },
    ".bp-shell__main .dropdown-divider": {
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.05)",
      margin: "0.3rem 0"
    },

    /* ── List groups ── */
    ".bp-shell__main .list-group": {
      borderRadius: "0.8rem",
      overflow: "hidden"
    },
    ".bp-shell__main .list-group-item": {
      border: "none",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.04)"
        : "1px solid rgba(0,0,0,0.04)",
      background: "transparent",
      color: "var(--bp-text)",
      padding: "0.7rem 1rem",
      transition: "background 120ms ease"
    },
    ".bp-shell__main .list-group-item:last-child": {
      borderBottom: "none"
    },
    ".bp-shell__main .list-group-item-action:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)"
    },
    ".bp-shell__main .list-group-item.active": {
      background: "var(--bp-accent-soft)",
      color: "var(--bp-accent)",
      fontWeight: 600
    },

    /* ── Navs & tabs ── */
    ".bp-shell__main .nav-tabs": {
      borderBottomColor: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.06)"
    },
    ".bp-shell__main .nav-tabs .nav-link": {
      borderRadius: "0.5rem 0.5rem 0 0",
      color: "var(--bp-text-soft)",
      fontWeight: 600,
      fontSize: "0.88rem",
      border: "none",
      borderBottom: "2px solid transparent",
      transition: "all 160ms ease"
    },
    ".bp-shell__main .nav-tabs .nav-link:hover": {
      color: "var(--bp-text)",
      borderBottomColor: "var(--bp-border)"
    },
    ".bp-shell__main .nav-tabs .nav-link.active": {
      color: "var(--bp-accent)",
      background: "transparent",
      borderBottomColor: "var(--bp-accent)"
    },
    ".bp-shell__main .nav-pills .nav-link": {
      borderRadius: "0.6rem",
      color: "var(--bp-text-soft)",
      fontWeight: 600,
      fontSize: "0.88rem"
    },
    ".bp-shell__main .nav-pills .nav-link.active": {
      background: "var(--bp-accent)",
      color: "#ffffff"
    },

    /* ── Pagination ── */
    ".bp-shell__main .pagination": {
      gap: "0.2rem"
    },
    ".bp-shell__main .page-link": {
      borderRadius: "0.5rem",
      border: "none",
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
      color: "var(--bp-text-soft)",
      fontSize: "0.85rem",
      fontWeight: 600,
      padding: "0.4rem 0.7rem",
      transition: "all 140ms ease"
    },
    ".bp-shell__main .page-link:hover": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
      color: "var(--bp-text)"
    },
    ".bp-shell__main .page-item.active .page-link": {
      background: "var(--bp-accent)",
      color: "#ffffff"
    },

    /* ── Progress bars ── */
    ".bp-shell__main .progress": {
      borderRadius: "999px",
      background: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
      height: "0.5rem",
      overflow: "hidden"
    },
    ".bp-shell__main .progress-bar": {
      borderRadius: "999px",
      background: "var(--bp-accent)"
    },

    /* ── Modals ── */
    ".modal-content": {
      borderRadius: "1.2rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.92)"
        : "rgba(255,255,255,0.92)",
      backdropFilter: "blur(24px)",
      "-webkit-backdrop-filter": "blur(24px)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.16)"
    },
    ".modal-header": {
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      padding: "1rem 1.25rem",
      color: "var(--bp-text)"
    },
    ".modal-header .btn-close": {
      filter: mode === "dark" ? "invert(1) grayscale(100%) brightness(200%)" : "none",
      opacity: 0.5
    },
    ".modal-header .btn-close:hover": {
      opacity: 1
    },
    ".modal-title": {
      fontWeight: 600,
      fontSize: "1rem",
      letterSpacing: "-0.01em"
    },
    ".modal-body": {
      color: "var(--bp-text)",
      fontSize: "0.9rem",
      padding: "1.25rem"
    },
    ".modal-footer": {
      borderTop: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      padding: "1rem 1.25rem"
    },
    ".modal-backdrop": {
      backdropFilter: "blur(4px)",
      "-webkit-backdrop-filter": "blur(4px)"
    },

    /* ── Toasts ── */
    ".toast": {
      borderRadius: "0.8rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.04)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.90)"
        : "rgba(255,255,255,0.90)",
      backdropFilter: "blur(16px)",
      "-webkit-backdrop-filter": "blur(16px)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      color: "var(--bp-text)",
      fontSize: "0.88rem"
    },
    ".toast-header": {
      background: "transparent",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      color: "var(--bp-text)",
      fontWeight: 600,
      fontSize: "0.85rem",
      padding: "0.6rem 0.85rem"
    },
    ".toast-header .btn-close": {
      filter: mode === "dark" ? "invert(1) grayscale(100%) brightness(200%)" : "none",
      opacity: 0.5
    },
    ".toast-header .btn-close:hover": {
      opacity: 1
    },
    ".toast-header small, .toast-header .text-body-secondary": {
      color: "var(--bp-text-soft) !important"
    },
    ".toast-body": {
      padding: "0.6rem 0.85rem",
      color: "var(--bp-text-soft)"
    },

    /* ── Accordion ── */
    ".bp-shell__main .accordion": {
      "--bs-accordion-bg": "transparent",
      "--bs-accordion-border-color": mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.05)",
      "--bs-accordion-btn-bg": "transparent",
      "--bs-accordion-active-bg": mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.015)",
      "--bs-accordion-active-color": "var(--bp-text)",
      borderRadius: "0.8rem",
      overflow: "hidden"
    },
    ".bp-shell__main .accordion-button": {
      fontWeight: 600,
      fontSize: "0.9rem"
    },
    ".bp-shell__main .accordion-button:focus": {
      boxShadow: "none",
      borderColor: "var(--bp-accent)"
    },

    /* ── Offcanvas (content area) ── */
    ".bp-shell__main .offcanvas, .offcanvas": {
      background: mode === "dark"
        ? "rgba(44,44,46,0.92)"
        : "rgba(255,255,255,0.92)",
      backdropFilter: "blur(24px)",
      "-webkit-backdrop-filter": "blur(24px)",
      border: "none",
      boxShadow: "0 0 48px rgba(0,0,0,0.12)",
      display: "flex",
      flexDirection: "column"
    },
    ".offcanvas-header": {
      flexShrink: 0
    },
    ".offcanvas-body": {
      overflowY: "auto",
      flex: "1 1 auto",
      minHeight: 0
    },

    /* ── bp-sidebar (HTML-first sidebar wrapper) ── */
    "[data-bp-sidebar]": {
      display: "none"
    },
    "[data-bp-sidebar][data-bp-fallback]": {
      display: "block"
    },

    /* ── Tooltips ── */
    ".tooltip-inner": {
      borderRadius: "0.45rem",
      fontSize: "0.78rem",
      fontWeight: 500,
      padding: "0.35rem 0.65rem"
    },

    /* ── Popovers ── */
    ".popover": {
      borderRadius: "0.8rem",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: mode === "dark"
        ? "rgba(50,50,52,0.92)"
        : "rgba(255,255,255,0.92)",
      backdropFilter: "blur(20px)",
      "-webkit-backdrop-filter": "blur(20px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      fontSize: "0.88rem"
    },
    ".popover-header": {
      background: "transparent",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.05)",
      fontWeight: 600,
      fontSize: "0.88rem"
    },
    ".popover-body": {
      color: "var(--bp-text-soft)"
    },

    /* ── Input groups ── */
    ".bp-shell__main .input-group-text": {
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(0,0,0,0.08)",
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)",
      color: "var(--bp-text-soft)",
      fontSize: "0.88rem",
      borderRadius: "0.6rem"
    },

    /* ── Breadcrumbs ── */
    ".bp-shell__main .breadcrumb": {
      fontSize: "0.85rem",
      marginBottom: 0
    },
    ".bp-shell__main .breadcrumb-item a": {
      color: "var(--bp-accent)",
      textDecoration: "none"
    },
    ".bp-shell__main .breadcrumb-item a:hover": {
      textDecoration: "underline"
    },
    ".bp-shell__main .breadcrumb-item.active": {
      color: "var(--bp-text-soft)"
    },

    /* ── Kbd ── */
    ".bp-shell__main kbd": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.04)",
      color: "var(--bp-text)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(0,0,0,0.08)",
      borderRadius: "0.35rem",
      padding: "0.15rem 0.45rem",
      fontSize: "0.78rem",
      fontWeight: 600,
      boxShadow: mode === "dark"
        ? "0 1px 2px rgba(0,0,0,0.3)"
        : "0 1px 2px rgba(0,0,0,0.06)"
    },

    /* ── Split-pane detail panel ── */
    ".bp-split-pane": {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "1rem",
      transition: "grid-template-columns 280ms ease",
      minHeight: 0
    },
    ".bp-split-pane[data-bp-detail-open='true']": {
      gridTemplateColumns: "1fr 380px"
    },
    ".bp-split-pane__content": {
      minWidth: 0,
      overflow: "hidden"
    },
    ".bp-split-pane__detail": {
      display: "none",
      overflow: "auto",
      borderRadius: "1rem",
      background: mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(255,255,255,0.55)",
      border: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.04)",
      padding: "1rem",
      backdropFilter: "blur(8px)",
      "-webkit-backdrop-filter": "blur(8px)"
    },
    ".bp-split-pane[data-bp-detail-open='true'] .bp-split-pane__detail": {
      display: "block"
    },

    /* ── Misc utilities ── */
    ".bp-shell__main .text-body-secondary": {
      color: "var(--bp-text-soft) !important"
    },
    ".bp-shell__main .border": {
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.08) !important"
        : "rgba(0,0,0,0.06) !important"
    },
    ".bp-shell__main hr, .bp-shell__main .dropdown-divider": {
      borderColor: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.05)"
    },
    ".bp-shell__main .shadow-sm": {
      boxShadow: mode === "dark"
        ? "0 2px 8px rgba(0,0,0,0.18) !important"
        : "0 2px 8px rgba(0,0,0,0.04) !important"
    },

    /* ── Close buttons ── */
    ".bp-shell__main .btn-close": {
      filter: mode === "dark" ? "invert(1) grayscale(100%) brightness(200%)" : "none",
      opacity: 0.5,
      transition: "opacity 140ms ease"
    },
    ".bp-shell__main .btn-close:hover": {
      opacity: 1
    },

    /* ── Form range ── */
    ".bp-shell__main .form-range::-webkit-slider-thumb": {
      background: "var(--bp-accent)",
      border: "none",
      boxShadow: "0 1px 4px color-mix(in srgb, var(--bp-accent) 30%, transparent)"
    },
    ".bp-shell__main .form-range::-moz-range-thumb": {
      background: "var(--bp-accent)",
      border: "none",
      boxShadow: "0 1px 4px color-mix(in srgb, var(--bp-accent) 30%, transparent)"
    },
    ".bp-shell__main .form-range::-webkit-slider-runnable-track": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
      borderRadius: "999px"
    },
    ".bp-shell__main .form-range::-moz-range-track": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
      borderRadius: "999px"
    },

    /* ── Placeholders / Skeletons ── */
    ".bp-shell__main .placeholder": {
      background: mode === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
      borderRadius: "0.35rem"
    },

    /* ── Spinner colors ── */
    ".bp-shell__main .spinner-border.text-primary, .bp-shell__main .spinner-grow.text-primary": {
      color: "var(--bp-accent) !important"
    },

    /* ── Mark / highlight ── */
    ".bp-shell__main mark": {
      background: mode === "dark"
        ? "rgba(255,214,10,0.20)"
        : "rgba(255,214,10,0.25)",
      color: "var(--bp-text)",
      borderRadius: "0.15rem",
      padding: "0.05em 0.25em"
    },

    /* ── Fragment loading overlay ── */
    ".bp-fragment-loading": {
      position: "relative",
      pointerEvents: "none"
    },
    ".bp-fragment-loading::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      zIndex: 10,
      borderRadius: "inherit",
      background: mode === "dark"
        ? "rgba(44,44,46,0.55)"
        : "rgba(255,255,255,0.50)",
      backdropFilter: "blur(6px)",
      "-webkit-backdrop-filter": "blur(6px)",
      animation: "bp-skeleton-pulse 1.8s ease infinite"
    },
    ".bp-fragment-loading::before": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "1.25rem",
      height: "1.25rem",
      margin: "-0.625rem 0 0 -0.625rem",
      border: "2px solid var(--bp-accent)",
      borderTopColor: "transparent",
      borderRadius: "50%",
      zIndex: 11,
      animation: "bp-spinner 0.65s linear infinite"
    },

    /* ── Keyframes ── */
    "@keyframes bp-shimmer": {
      "0%": { transform: "translateX(-100%)" },
      "100%": { transform: "translateX(100%)" }
    },
    "@keyframes bp-progress-slide": {
      "0%": { transform: "translateX(-100%)", opacity: "0.6" },
      "50%": { opacity: "1" },
      "100%": { transform: "translateX(100%)", opacity: "0.6" }
    },
    "@keyframes bp-skeleton-pulse": {
      "0%, 100%": { opacity: "0.3" },
      "50%": { opacity: "0.7" }
    },
    "@keyframes bp-spinner": {
      "to": { transform: "rotate(360deg)" }
    },

    /* ── Nav loading: shimmer on clicked route ── */
    ".bp-admin__route.htmx-request": {
      position: "relative",
      overflow: "hidden",
      pointerEvents: "none"
    },
    ".bp-admin__route.htmx-request::after": {
      content: "\"\"",
      position: "absolute",
      inset: 0,
      background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--bp-accent) 15%, transparent) 50%, transparent 100%)",
      animation: "bp-shimmer 1.4s ease infinite",
      borderRadius: "inherit",
      pointerEvents: "none"
    },
    ".bp-admin__route.active.htmx-request::after": {
      background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--bp-accent) 12%, transparent) 50%, transparent 100%)"
    },

    /* ── Topbar progress bar ── */
    ".bp-admin__topbar-progress": {
      position: "absolute",
      bottom: 0,
      left: "1.5rem",
      right: "1.5rem",
      height: "2px",
      borderRadius: "2px",
      overflow: "hidden",
      opacity: 0,
      transition: "opacity 200ms ease"
    },
    ".bp-admin__topbar-progress.is-active": {
      opacity: 1
    },
    ".bp-admin__topbar-progress::after": {
      content: "\"\"",
      position: "absolute",
      inset: 0,
      background: "linear-gradient(90deg, transparent, var(--bp-accent), color-mix(in srgb, var(--bp-accent) 60%, var(--bp-accent-secondary)), transparent)",
      transform: "translateX(-100%)",
      borderRadius: "inherit"
    },
    ".bp-admin__topbar-progress.is-active::after": {
      animation: "bp-progress-slide 1.6s ease infinite"
    },

    /* ── Content skeleton loader ── */
    ".bp-shell__loading-skeleton": {
      display: "grid",
      gap: "0.75rem",
      padding: "0.5rem 0",
      maxWidth: 640
    },
    ".bp-shell__skeleton-heading": {
      height: "1.2rem",
      width: "45%",
      borderRadius: "0.5rem",
      background: mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.06)",
      animation: "bp-skeleton-pulse 2s ease infinite"
    },
    ".bp-shell__skeleton-row": {
      height: "0.65rem",
      borderRadius: "0.4rem",
      background: mode === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.05)",
      animation: "bp-skeleton-pulse 2s ease infinite"
    },
    ".bp-shell__skeleton-row:nth-child(2)": {
      width: "92%",
      animationDelay: "0.08s"
    },
    ".bp-shell__skeleton-row:nth-child(3)": {
      width: "78%",
      animationDelay: "0.16s"
    },
    ".bp-shell__skeleton-row:nth-child(4)": {
      width: "88%",
      animationDelay: "0.24s"
    },
    ".bp-shell__skeleton-row:nth-child(5)": {
      width: "64%",
      animationDelay: "0.32s"
    },
    ".bp-shell__skeleton-row:nth-child(6)": {
      width: "70%",
      animationDelay: "0.40s"
    },
    ".bp-shell__skeleton-spacer": {
      height: "0.5rem"
    },

    /* ── Content overlay: top progress bar ── */
    ".bp-admin__content-overlay-bar": {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "2px",
      overflow: "hidden"
    },
    ".bp-admin__content-overlay-bar::after": {
      content: "\"\"",
      position: "absolute",
      inset: 0,
      background: "linear-gradient(90deg, transparent, var(--bp-accent), color-mix(in srgb, var(--bp-accent) 60%, var(--bp-accent-secondary)), transparent)",
      animation: "bp-progress-slide 1.4s ease infinite",
      borderRadius: "inherit"
    },

    /* ── Profile mirror (mobile offcanvas) ── */
    ".bp-admin__profile-mirror": {
      display: "none"
    },
    ".bp-admin__profile-mirror:not(:empty)": {
      padding: "0.5rem 0",
      borderBottom: mode === "dark"
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(0,0,0,0.06)"
    },
    ".bp-admin__profile-mirror .dropdown-menu": {
      position: "absolute"
    },
    ".bp-admin__profile-mirror .d-none": {
      display: "flex !important"
    },

    "@media (max-width: 992px)": {
      ".bp-shell": {
        padding: "0.5rem"
      },
      ".bp-admin__menu-button": {
        display: "inline-flex"
      },
      ".bp-admin__profile-shell": {
        display: "none"
      },
      ".bp-admin__profile-mirror": {
        display: "block"
      },
      ".bp-admin": {
        gridTemplateColumns: "1fr"
      },
      ".bp-admin__sidebar": {
        display: "none"
      },
      ".bp-admin__workspace": {
        borderRadius: "1.2rem"
      },
      ".bp-admin__topbar-main": {
        width: "100%"
      },
      ".bp-split-pane[data-bp-detail-open='true']": {
        gridTemplateColumns: "1fr"
      },
      ".bp-split-pane__detail": {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(85vw, 380px)",
        zIndex: 1055,
        borderRadius: 0,
        transform: "translateX(100%)",
        transition: "transform 280ms ease",
        background: mode === "dark"
          ? "rgba(44,44,46,0.95)"
          : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(24px)",
        "-webkit-backdrop-filter": "blur(24px)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)"
      },
      ".bp-split-pane[data-bp-detail-open='true'] .bp-split-pane__detail": {
        display: "block",
        transform: "translateX(0)"
      }
    },
    "@media (max-width: 768px)": {
      ".bp-admin__topbar": {
        padding: "0.75rem 0.9rem"
      },
      ".bp-admin__workspace": {
        borderRadius: "1rem"
      }
    }
  });
}

function Bootstrap1Document(context: Bootstrap1ShellContext): HtmlRenderable {
  return (
    <html lang="en" data-bs-theme={context.themeMode}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="htmx-config" content='{"selfRequestsOnly":false,"historyCacheSize":25,"mode":"cors","extensions":"bp-shell, sse"}' />
        <title>{context.title}</title>
        <link href={`${context.assetBaseUrl}/bootstrap.min.css`} rel="stylesheet" />
        <script src={`${context.assetBaseUrl}/htmx.min.js`} defer></script>
        <script src={`${context.assetBaseUrl}/hx-sse.min.js`} defer></script>
        <script src={`${context.assetBaseUrl}/bootstrap.bundle.min.js`} defer></script>
        <script src={`${context.assetBaseUrl}/bootstrap1-shell.js`} defer></script>
        <style
          id="bp-theme-style"
          hx-get="/.well-known/bp/theme/style"
          hx-trigger="bp:theme-changed from:body"
          hx-swap="outerHTML"
          data-bp-no-route=""
        >{shellStyles(context.themeMode, context.themeConfig)}</style>
      </head>
      <body>{context.bodyHtml}</body>
    </html>
  );
}

function buildServiceMap(routeLinks: Bootstrap1RouteLink[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const route of routeLinks) {
    if (route.serviceId && !map[route.serviceId]) {
      try {
        const parsed = new URL(route.requestUrl);
        map[route.serviceId] = parsed.origin;
      } catch { /* skip invalid URLs */ }
    }
  }
  return map;
}

function Bootstrap1LandingBody(context: Bootstrap1HostPageContext): HtmlRenderable {
  const navItems = context.navItems ?? buildNavItems(context.routeLinks);
  const activeRoute = context.routeLinks.find((route) => route.active);
  const currentBreadcrumb = activeBreadcrumb(navItems);
  const serviceMap = buildServiceMap(context.routeLinks);
  return (
    <div
      class="bp-shell"
      data-bp-shell-root=""
      data-bp-services={JSON.stringify(serviceMap)}
      data-bp-login-url={context.loginUrl}
      data-bp-logout-url={context.logoutUrl}
    >
      <div class="offcanvas offcanvas-start bp-admin__mobile-menu" tabindex={-1} id="bp-mobile-menu" aria-labelledby="bp-mobile-menu-title">
        <div class="offcanvas-header">
          <div>
            <div
              class="bp-admin__brand-name"
              id="bp-mobile-menu-title"
              hx-get="/.well-known/bp/theme/brand"
              hx-trigger="bp:theme-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >{context.brandName}</div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <div data-bp-profile-mirror="" class="bp-admin__profile-mirror"></div>
          <div class="bp-admin__sidebar-nav">
            <nav
              class="bp-admin__nav"
              id="bp-nav-mobile"
              hx-get="/.well-known/bp/theme/nav?mobile=1"
              hx-trigger="bp:menu-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >{renderNavItems(navItems, true)}</nav>
          </div>
        </div>
      </div>
      <div class="bp-admin">
        <aside class="bp-admin__sidebar">
          <div class="bp-admin__brand-row">
            <div
              class="bp-admin__brand-name"
              hx-get="/.well-known/bp/theme/brand"
              hx-trigger="bp:theme-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >{context.brandName}</div>
          </div>
          <section class="bp-admin__sidebar-nav">
            <nav
              class="bp-admin__nav"
              id="bp-nav-desktop"
              hx-get="/.well-known/bp/theme/nav"
              hx-trigger="bp:menu-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >{renderNavItems(navItems)}</nav>
          </section>
        </aside>
        <section class="bp-admin__workspace">
          <header class="bp-admin__topbar">
            <div class="bp-admin__topbar-main">
              <button
                class="btn btn-outline-secondary bp-admin__menu-button"
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#bp-mobile-menu"
                aria-controls="bp-mobile-menu"
              >
                Menu
              </button>
              <div class="bp-admin__topbar-context">
                <div class="bp-admin__topbar-label">Workspace</div>
                <div
                  class="bp-admin__topbar-title"
                  hx-get="/.well-known/bp/theme/brand"
                  hx-trigger="bp:theme-changed from:body"
                  hx-swap="innerHTML"
                  data-bp-no-route=""
                >{context.brandName}</div>
              </div>
            </div>
            <div
              class="bp-admin__profile-shell"
              id="bp-frag-nav"
              hx-get="/.well-known/bp/theme/fragments?location=nav"
              hx-trigger="bp:fragments-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >
              {(context.resolvedFragments["nav"] ?? []).map((frag) => (
                <div
                  data-bp-fragment={frag.fragmentId}
                  data-bp-fragment-location="nav"
                  data-bp-service={frag.serviceId}
                  hx-get={`${frag.url}?_f=${frag.fragmentKey}`}
                  hx-trigger="load"
                  hx-target="this"
                  hx-swap="innerHTML"
                >
                  <span class="placeholder-glow"><span class="placeholder col-12 rounded-pill"></span></span>
                </div>
              ))}
            </div>
            <div class="bp-admin__topbar-progress" id="bp-topbar-progress"></div>
          </header>
          <section class="bp-admin__content-frame">
            <div class="bp-admin__content-head">
              <div>
                <div class="bp-admin__breadcrumb" data-bp-current-breadcrumb="">{currentBreadcrumb}</div>
                <h1 class="bp-admin__title" data-bp-current-title="">
                  {activeRoute?.title ?? context.title}
                </h1>
              </div>
            </div>
            <div class="bp-admin__content-status">
              <div id="bp-content-error" class="alert alert-danger bp-admin__error mb-0" role="alert"></div>
            </div>
            <div class="bp-admin__content-overlay" aria-hidden="true">
              <div class="bp-admin__content-overlay-bar"></div>
              <div class="bp-admin__content-overlay-card">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>Loading</span>
              </div>
            </div>
            <main class="bp-shell__main">
              <div
                id="bp-main"
                data-bp-main-outlet=""
                data-bp-service={context.initialServiceId}
                hx-get={context.initialRouteUrl ?? ""}
                hx-trigger={context.initialRouteUrl ? "load" : undefined}
                hx-target="#bp-main"
                hx-swap="innerHTML"
              >
                <div class="bp-shell__loading">
                  <div class="bp-shell__loading-skeleton">
                    <div class="bp-shell__skeleton-heading"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-spacer"></div>
                    <div class="bp-shell__skeleton-heading" style="width: 35%"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                    <div class="bp-shell__skeleton-row"></div>
                  </div>
                </div>
              </div>
            </main>
            <footer
              class="bp-admin__footer"
              id="bp-frag-footer"
              hx-get="/.well-known/bp/theme/fragments?location=footer"
              hx-trigger="bp:fragments-changed from:body"
              hx-swap="innerHTML"
              data-bp-no-route=""
            >
              {(context.resolvedFragments["footer"] ?? []).map((frag) => (
                <div
                  data-bp-fragment={frag.fragmentId}
                  data-bp-fragment-location="footer"
                  data-bp-service={frag.serviceId}
                  hx-get={`${frag.url}?_f=${frag.fragmentKey}`}
                  hx-trigger="load"
                  hx-target="this"
                  hx-swap="innerHTML"
                >
                  <span class="placeholder-glow"><span class="placeholder col-12 rounded-pill"></span></span>
                </div>
              ))}
            </footer>
          </section>
        </section>
      </div>
    </div>
  );
}

export function renderBootstrap1Shell(context: Bootstrap1ShellContext): string {
  return `<!DOCTYPE html>${Bootstrap1Document(context)}`;
}

export function renderBootstrap1HostPage(context: Bootstrap1HostPageContext): string {
  return renderBootstrap1Shell({
    title: context.title,
    brandName: context.brandName,
    themeMode: context.themeMode,
    themeConfig: context.themeConfig,
    assetBaseUrl: context.assetBaseUrl,
    bodyHtml: Bootstrap1LandingBody(context)
  });
}
