import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { js, type RawText } from "jsx-htmx";

export interface ShellRuntimeAsset {
  body: string;
  contentType: string;
}

export type BetterPortalShellChromeValue = string | number | boolean;
export type BetterPortalShellChrome = Readonly<Record<string, BetterPortalShellChromeValue>>;

export interface BetterPortalShellAdapter {
  syncProfileMirror?(): void;
  cleanupTransientUi?(): void;
  syncOverlays?(): void;
  closeContainingOverlay?(source: Element | null | undefined): void;
  prepareContent?(root: Element): void;
  initComponents?(root: Element | null): void;
  disposeComponents?(root: Element | null): void;
  scrollToTop?(): void;
  setLoading?(loading: boolean, outlet: Element | null): void;
  clearError?(): void;
  showRequestError?(status: number, content: string, context: { serviceId?: string }): void;
  replaceMainWithError?(
    title: string,
    message: string,
    action: unknown,
    context: string | undefined,
    outlet: Element | null
  ): void;
  applyChrome?(
    chrome: BetterPortalShellChrome,
    previousChrome: BetterPortalShellChrome,
    root: Element
  ): void;
}

declare global {
  interface Window {
    BetterPortalShellAdapter?: BetterPortalShellAdapter;
  }
}

export type BetterPortalShellRuntimeSource = string | RawText;
export const BETTERPORTAL_BROWSER_SOURCE_PREAMBLE = "var __name=function(f){return f};";

function chromeDataKey(rawKey: string): string | null {
  const key = rawKey
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
  return /^[a-z][a-z0-9-]*$/.test(key) ? key : null;
}

export function betterPortalChromeAttributes(
  chrome?: BetterPortalShellChrome
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(chrome ?? {})) {
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    const key = chromeDataKey(rawKey);
    if (key) attributes[`data-bp-chrome-${key}`] = String(value);
  }
  return attributes;
}

const require = createRequire(import.meta.url);
const resolveRuntimeAsset = (path: string, label: string): string => {
  try {
    return require.resolve(path);
  } catch (cause) {
    throw new Error(`BetterPortal theme runtime requires ${label} at ${path}`, { cause });
  }
};
const HtmxPath = resolveRuntimeAsset("htmx.org/dist/htmx.min.js", "HTMX core");
const HtmxSsePath = resolveRuntimeAsset("htmx.org/dist/ext/hx-sse.min.js", "the HTMX SSE extension");
const VendorAssetCache = new Map<string, Promise<ShellRuntimeAsset>>();

function readTextAsset(filePath: string): Promise<ShellRuntimeAsset> {
  return readFile(filePath, "utf8").then((body) => ({
    body,
    contentType: "application/javascript; charset=utf-8"
  }));
}

export const BETTERPORTAL_HTMX_EXTENSIONS = "bp-shell, sse";

export function betterPortalShellRuntimeSource(): string {
  // esbuild/tsx wraps functions with __name() for .name preservation;
  // shim it for the browser where that helper doesn't exist
  const body = js(() => {
    (() => {
      htmx.config.sse = {
        reconnect: true,              // Auto-reconnect on stream end (default: true for hx-sse:connect, false for hx-get)
        reconnectDelay: 500,          // Initial reconnect delay in ms (default: 500)
        reconnectMaxDelay: 60000,     // Maximum reconnect delay in ms (default: 60000)
        reconnectMaxAttempts: Infinity,// Maximum reconnection attempts (default: Infinity)
        reconnectJitter: 0.3,         // Jitter factor 0-1 for delay randomization (default: 0.3)
        pauseOnBackground: true       // Disconnect when tab is backgrounded (default: true for hx-sse:connect, false for hx-get)
      };

      const HX_METHODS = ["hx-get", "hx-post", "hx-put", "hx-delete", "hx-patch"] as const;
      const DOWNLOAD_ATTR = "hx-download";
      const NO_ROUTE_SELECTOR = "[data-bp-no-route],[data-bp-no-override],[bp-no-override]";
      const shellAdapter = window.BetterPortalShellAdapter ?? {};
      const createSessionId = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        let timestamp = Date.now();
        for (let index = 5; index >= 0; index -= 1) {
          bytes[index] = timestamp % 256;
          timestamp = Math.floor(timestamp / 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x70;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      };
      const configuredSessionId = document.querySelector('meta[name="betterportal:session-id"]')?.getAttribute("content") || "";
      const sessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configuredSessionId)
        ? configuredSessionId.toLowerCase()
        : createSessionId();
      document.documentElement.setAttribute("data-bp-session-id", sessionId);

      // -- DOM helpers --

      const shellRoot = () => document.querySelector("[data-bp-shell-root]");
      const routeLinks = () => Array.from(document.querySelectorAll("[data-bp-route-link]"));
      const titleNode = () => document.querySelector("[data-bp-current-title]");
      const breadcrumbNode = () => document.querySelector("[data-bp-current-breadcrumb]");
      const navGroups = () => Array.from(document.querySelectorAll("[data-bp-nav-group]")) as HTMLDetailsElement[];
      const mainOutlet = () => document.querySelector("#bp-main, [data-bp-main-outlet]");
      const contentFrame = () => document.querySelector(".bp-admin__content-frame");
      const topbarProgress = () => document.querySelector("#bp-topbar-progress");
      const errorNode = () => document.querySelector("#bp-content-error");

      type SplitPaneState = {
        key: string;
        open: string | null;
        scrollTop: number;
        selected?: string;
        focus?: string;
      };

      const splitPanesIn = (target: Element) => Array.from(new Set([
        target.closest(".bp-split-pane"),
        ...Array.from(target.querySelectorAll(".bp-split-pane"))
      ].filter((pane): pane is HTMLElement => pane instanceof HTMLElement)));

      const captureSplitPaneState = (target: Element): SplitPaneState[] => splitPanesIn(target).map((pane, index) => {
        const selected = pane.querySelector('[data-bp-row-key][aria-selected="true"], [data-bp-row-key][data-bp-selected="true"]');
        const active = pane.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
        return {
          key: pane.getAttribute("data-bp-split-pane-key") || String(index),
          open: pane.getAttribute("data-bp-detail-open"),
          scrollTop: pane.querySelector<HTMLElement>(".bp-split-pane__content")?.scrollTop ?? 0,
          ...(selected?.getAttribute("data-bp-row-key") ? { selected: selected.getAttribute("data-bp-row-key")! } : {}),
          ...(active ? { focus: active.getAttribute("data-bp-focus-key") || active.id || active.getAttribute("name") || undefined } : {})
        };
      });

      const restoreSplitPaneState = (target: Element, states?: SplitPaneState[]) => {
        if (!states?.length) return;
        for (const [index, pane] of splitPanesIn(target).entries()) {
          const state = states.find((candidate) => candidate.key === (pane.getAttribute("data-bp-split-pane-key") || String(index)));
          if (!state) continue;
          if (state.open !== null) pane.setAttribute("data-bp-detail-open", state.open);
          const content = pane.querySelector<HTMLElement>(".bp-split-pane__content");
          if (content) content.scrollTop = state.scrollTop;
          if (state.selected) {
            const row = Array.from(pane.querySelectorAll<HTMLElement>("[data-bp-row-key]")).find((candidate) => candidate.getAttribute("data-bp-row-key") === state.selected);
            row?.setAttribute("aria-selected", "true");
            row?.setAttribute("data-bp-selected", "true");
          }
          if (state.focus) {
            const focus = Array.from(pane.querySelectorAll<HTMLElement>("[data-bp-focus-key], [id], [name]")).find((candidate) =>
              candidate.getAttribute("data-bp-focus-key") === state.focus || candidate.id === state.focus || candidate.getAttribute("name") === state.focus
            );
            focus?.focus({ preventScroll: true });
          }
        }
      };

      const mutationErrorOutlet = (source: Element | null) => {
        const scope = source?.closest?.("[data-bp-mutation-scope]") ?? source?.closest?.("form");
        return scope?.querySelector<HTMLElement>("[data-bp-mutation-error]") ?? null;
      };

      const profileSlot = () => document.querySelector("[data-bp-slot='nav-profile']");
      const profileMirror = () => document.querySelector("[data-bp-profile-mirror]");

      const syncProfileMirror = () => {
        if (shellAdapter.syncProfileMirror) { shellAdapter.syncProfileMirror(); return; }
        const slot = profileSlot();
        const mirror = profileMirror();
        if (!slot || !mirror) return;
        // Clone content, strip data-bp-shell-route to avoid double-processing
        mirror.innerHTML = slot.innerHTML;
        // Re-init bootstrap components on cloned content (dropdowns etc.)
        initBootstrapComponents(mirror);
      };

      const isMainTarget = (target: any) =>
        !!target && (
          target === "#bp-main" // htmx.ajax target selectors stay strings in ctx
          || target.id === "bp-main"
          || target?.hasAttribute?.("data-bp-main-outlet")
          || target === mainOutlet()
        );

      const normalizePath = (path: string) => {
        const normalized = (path || "/").replace(/\/+$/, "");
        return normalized === "" ? "/" : normalized;
      };

      type ConfiguredRoute = {
        href?: string;
        requestUrl?: string;
        serviceId?: string;
        title?: string;
        kind?: "page" | "api";
      };

      const configuredRoutes = (): ConfiguredRoute[] => {
        try {
          const routes = JSON.parse(shellRoot()?.getAttribute("data-bp-routes") || "[]");
          return Array.isArray(routes) ? routes : [];
        } catch {
          return [];
        }
      };

      const configuredRouteFor = (path: string) => {
        const normalized = normalizePath(path);
        return configuredRoutes().find((route) => normalizePath(route.href || "/") === normalized) ?? null;
      };

      const syncDocumentTitle = (pageTitle?: string) => {
        const configuredTitle = shellRoot()?.getAttribute("data-bp-document-title")?.trim();
        if (!configuredTitle) return;
        const title = pageTitle?.trim();
        document.title = title && title !== configuredTitle ? `${title} · ${configuredTitle}` : configuredTitle;
      };

      const requestTargetsMain = (detail: any) => {
        const ctx = detail && (detail.ctx || detail);
        if (!ctx) return false;
        if (isMainTarget(ctx.target) || isMainTarget(detail?.target)) return true;
        const source = ctx.sourceElement || detail?.elt;
        const sel = source && source.getAttribute ? source.getAttribute("hx-target") : null;
        return sel === "#bp-main";
      };

      const camelChromeKey = (key: string) =>
        key.replace(/-([a-z0-9])/g, (_m, ch) => String(ch).toUpperCase());

      const parseChromeFromContentType = (contentType: string): Record<string, string | number | boolean> | null => {
        const chrome: Record<string, string | number | boolean> = {};
        const re = /(?:^|;)\s*bp-chrome-([a-z][a-z0-9-]*)=([^;]*)/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(contentType)) !== null) {
          const key = camelChromeKey(match[1]);
          const raw = decodeURIComponent((match[2] || "").trim().replace(/^"|"$/g, ""));
          chrome[key] =
            raw === "true" ? true :
            raw === "false" ? false :
            raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) :
            raw;
        }
        return Object.keys(chrome).length ? chrome : null;
      };

      const kebabChromeKey = (key: string) =>
        key
          .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
          .replace(/[_\s]+/g, "-")
          .toLowerCase();

      const readChromeFromRoot = (): Record<string, string | number | boolean> => {
        const root = shellRoot();
        const chrome: Record<string, string | number | boolean> = {};
        if (!root) return chrome;
        for (const attribute of Array.from(root.attributes)) {
          if (!attribute.name.startsWith("data-bp-chrome-")) continue;
          const key = camelChromeKey(attribute.name.slice("data-bp-chrome-".length));
          const raw = attribute.value;
          chrome[key] =
            raw === "true" ? true :
            raw === "false" ? false :
            raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) :
            raw;
        }
        return chrome;
      };

      let activeChrome = readChromeFromRoot();

      const applyChrome = (chrome: Record<string, string | number | boolean> | null) => {
        const root = shellRoot();
        if (!root) return;
        const nextChrome = chrome ?? {};
        for (const key of Object.keys(activeChrome)) {
          if (!(key in nextChrome)) root.removeAttribute(`data-bp-chrome-${kebabChromeKey(key)}`);
        }
        for (const [key, value] of Object.entries(nextChrome)) {
          root.setAttribute(`data-bp-chrome-${kebabChromeKey(key)}`, String(value));
        }
        const previousChrome = activeChrome;
        activeChrome = { ...nextChrome };
        shellAdapter.applyChrome?.(activeChrome, previousChrome, root);
      };

      const applyChromeFromResponse = (detail: any) => {
        if (!requestTargetsMain(detail)) return;
        const response = detail?.ctx?.response;
        const contentType = response?.headers?.get?.("content-type") || "";
        if (!contentType.includes("text/html")) return;
        applyChrome(parseChromeFromContentType(contentType));
      };

      // -- Theme presentation lifecycle --

      const cleanupTeleportedModals = () => { shellAdapter.cleanupTransientUi?.(); };
      const cleanupTeleportedOffcanvas = () => {};
      const scheduleBootstrapOverlaySync = () => { shellAdapter.syncOverlays?.(); };
      const closeContainingOffcanvas = (source: Element | null | undefined) => { shellAdapter.closeContainingOverlay?.(source); };
      const teleportModals = (root: Element) => { shellAdapter.prepareContent?.(root); };
      const teleportOffcanvas = (_root: Element) => {};
      const initBootstrapComponents = (root: Element | null) => { shellAdapter.initComponents?.(root); };
      const disposeBootstrapComponents = (root: Element | null) => { shellAdapter.disposeComponents?.(root); };
      const scrollPageToTop = () => {
        if (shellAdapter.scrollToTop) shellAdapter.scrollToTop();
        else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      };
      const shouldScrollMainSwap = (detail: any): boolean => {
        const request = detail?.ctx?.request;
        if (!request) return false;
        const method = String(request.method || "GET").toUpperCase();
        const action = String(request.action || "");
        if (!action) return false;
        const current = window.location.pathname + window.location.search;
        const tenantUrl = tenantUrlForServiceUrl(action);
        try {
          const resolved = new URL(tenantUrl, window.location.origin);
          const next = resolved.pathname + resolved.search;
          if (next !== current) return true;
        } catch { /* fall through */ }
        const hxLocation = detail?.ctx?.hx?.location;
        if (typeof hxLocation === "string" && hxLocation) return true;
        return method === "GET" && Boolean(detail?.ctx?.sourceElement?.getAttribute?.("hx-push-url"));
      };

      // -- Loading / error UI --

      const markLoaded = () => { mainOutlet()?.setAttribute("data-bp-loaded", "yes"); };
      const hasLoaded = () => mainOutlet()?.getAttribute("data-bp-loaded") === "yes";
      const disableInitialMainLoad = () => {
        const outlet = mainOutlet();
        if (!outlet) return;
        if ((outlet.getAttribute("hx-trigger") || "").trim() === "load") {
          outlet.removeAttribute("hx-trigger");
        }
      };

      const setLoading = (loading: boolean) => {
        if (shellAdapter.setLoading) { shellAdapter.setLoading(loading, mainOutlet()); return; }
        mainOutlet()?.toggleAttribute("data-bp-loading", loading);
      };

      const clearError = () => {
        if (shellAdapter.clearError) { shellAdapter.clearError(); return; }
        const node = errorNode();
        if (!node) return;
        node.innerHTML = "";
        node.classList.remove("is-visible");
      };

      const showRequestErrorModal = (status: number, content: string, source?: Element | null) => {
        const serviceId = serviceContextFor(source).id || undefined;
        if (shellAdapter.showRequestError) {
          shellAdapter.showRequestError(status, content, { serviceId });
          return;
        }
        const text = document.createElement("div");
        text.innerHTML = content;
        window.alert(text.textContent || errorMessage(status));
      };
      const renderErrorAction = (action: any) => {
        if (!action) return "";
        return `<button type="button" data-bp-error-action="${action.kind}">${action.label}</button>`;
      };

      const bannerActionForStatus = (status: number) => {
        if (status === 401) {
          const loginUrl = shellRoot()?.getAttribute("data-bp-login-url");
          if (loginUrl) return { kind: "login", label: "Sign in" };
          return { kind: "reload", label: "Reload" };
        }
        return { kind: "reload", label: "Reload" };
      };

      const replaceMainWithError = (title: string, message: string, action: any, context?: string) => {
        if (shellAdapter.replaceMainWithError) { shellAdapter.replaceMainWithError(title, message, action, context, mainOutlet()); return; }
        const outlet = mainOutlet();
        if (!outlet) return;
        outlet.innerHTML =
          `<div class="bp-shell__empty-state">` +
          `<div class="bp-shell__empty-card">` +
          `<div class="bp-shell__empty-title">${title}</div>` +
          (context ? `<div class="bp-shell__empty-copy"><code>${context}</code></div>` : "") +
          `<div class="bp-shell__empty-copy">${message}</div>` +
          `<div class="bp-shell__empty-actions">${renderErrorAction(action)}</div>` +
          `</div>` +
          `</div>`;
      };

      const errorMessage = (status: number) => {
        switch (status) {
          case 401: return "Session expired. Sign in again to continue.";
          case 403: return "Access denied for this view.";
          case 404: return "View not found.";
          case 500: return "The service could not complete this request.";
          case 502:
          case 503:
          case 504: return "Service unavailable. Try again shortly.";
          default: return "Request failed. Try again.";
        }
      };

      const errorTitle = (status: number) => {
        switch (status) {
          case 403: return "Access Denied";
          case 404: return "View Not Found";
          case 500: return "Internal Server Error";
          case 502:
          case 503:
          case 504: return "Service Unavailable";
          default: return "Request Failed";
        }
      };

      const isThemedStatusResponse = (ctx: any) => {
        const contentType = ctx?.response?.headers?.get?.("content-type") || "";
        return contentType.includes("text/html") && /(?:^|;)\s*mode=status(?:;|$)/i.test(contentType);
      };

      const isThemeOriginUrl = (url: string) => {
        try {
          return new URL(url, window.location.origin).host === window.location.host;
        } catch {
          return false;
        }
      };

      // -- Service route map (reverse: service path -> tenant path) --

      interface ServiceRoute {
        tenantPath: string;
        servicePath: string;
        serviceOrigin: string;
        serviceId: string;
        kind?: "page" | "api";
      }

      const serviceOrigins: Record<string, string> = (() => {
        try { return JSON.parse(shellRoot()?.getAttribute("data-bp-services") || "{}"); }
        catch { return {}; }
      })();
      const unresolvedServiceOrigin = "https://betterportal.invalid";

      interface BPElementStates {
        loading?: string;
        ok?: string;
        nok?: string;
        statuses: Array<{ code: string; content: string }>;
      }

      const bpElementStates = new WeakMap<Element, BPElementStates>();
      const bpElementAuthRetried = new WeakSet<Element>();
      const bpElementStateSwaps = new WeakSet<Element>();
      const directStateChildren = (element: Element) => Array.from(element.children)
        .filter((child) => ["BP-LOADING", "BP-OK", "BP-NOK", "BP-STATUS"].includes(child.tagName));

      const initializeBpElement = (element: Element) => {
        if (bpElementStates.has(element)) return;
        const states: BPElementStates = { statuses: [] };
        for (const child of directStateChildren(element)) {
          if (child.tagName === "BP-LOADING") states.loading = child.innerHTML;
          else if (child.tagName === "BP-OK") states.ok = child.innerHTML;
          else if (child.tagName === "BP-NOK") states.nok = child.innerHTML;
          else states.statuses.push({ code: child.getAttribute("code") || "", content: child.innerHTML });
        }
        bpElementStates.set(element, states);
        const initial = element.getAttribute("data-bp-state") === "nok" ? states.nok : states.loading;
        element.innerHTML = initial ?? "";
      };

      const initializeBpElements = (root: ParentNode) => {
        if (root instanceof Element && root.matches("bp-element[data-bp-element]")) initializeBpElement(root);
        root.querySelectorAll?.("bp-element[data-bp-element]").forEach(initializeBpElement);
      };

      const statusSpecificity = (pattern: string, status: number): number => {
        const value = String(status);
        if (pattern === value) return 3;
        if (/^[1-5][0-9]x$/i.test(pattern) && pattern.slice(0, 2) === value.slice(0, 2)) return 2;
        if (/^[1-5]xx$/i.test(pattern) && pattern[0] === value[0]) return 1;
        return 0;
      };

      const injectElementResponse = (templateHtml: string, responseHtml: string): string => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = templateHtml;
        const template = wrapper.querySelector("template");
        if (template) {
          const response = document.createElement("template");
          response.innerHTML = responseHtml;
          template.replaceWith(response.content);
        }
        return wrapper.innerHTML;
      };

      const swapBpElementContent = (element: Element, html: string) => {
        if (typeof htmx.swap === "function") {
          bpElementStateSwaps.add(element);
          try {
            void Promise.resolve(htmx.swap({ text: html, sourceElement: element, target: element, swap: "innerHTML" }))
              .finally(() => bpElementStateSwaps.delete(element));
          } catch (error) {
            bpElementStateSwaps.delete(element);
            throw error;
          }
        } else {
          element.innerHTML = html;
          initializeBpElements(element);
        }
      };

      const renderBpElementState = (element: Element, status: number, responseHtml = "") => {
        if (bpElementStateSwaps.has(element)) return;
        initializeBpElement(element);
        const states = bpElementStates.get(element)!;
        element.setAttribute("aria-busy", "false");
        element.toggleAttribute("data-bp-status", status > 0);
        if (status > 0) element.setAttribute("data-bp-status", String(status));

        if (status === 204) {
          element.setAttribute("data-bp-state", "empty");
          swapBpElementContent(element, "");
          return;
        }
        if (status >= 200 && status < 300) {
          bpElementAuthRetried.delete(element);
          element.setAttribute("data-bp-state", "ok");
          swapBpElementContent(element, states.ok === undefined ? responseHtml : injectElementResponse(states.ok, responseHtml));
          return;
        }
        const matched = states.statuses
          .map((state) => ({ ...state, specificity: statusSpecificity(state.code, status) }))
          .filter((state) => state.specificity > 0)
          .sort((a, b) => b.specificity - a.specificity)[0];
        element.setAttribute("data-bp-state", matched ? "status" : "nok");
        swapBpElementContent(element, injectElementResponse(matched?.content ?? states.nok ?? "", responseHtml));
      };

      const showBpElementLoading = (element: Element) => {
        initializeBpElement(element);
        element.setAttribute("data-bp-state", "loading");
        element.setAttribute("aria-busy", "true");
        element.removeAttribute("data-bp-status");
        element.innerHTML = bpElementStates.get(element)?.loading ?? "";
      };

      const requestBpElement = (source: unknown): Element | null =>
        source instanceof Element ? source.closest("bp-element[data-bp-element]") : null;

      const themeModeKey = "bp.theme.mode:" + window.location.host;
      const applyThemeMode = (mode: string) => {
        const selected = ["light", "dark", "system"].includes(mode) ? mode : "system";
        const concrete = selected === "system"
          ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : selected;
        document.documentElement.setAttribute("data-bs-theme", concrete);
        document.querySelectorAll("[data-bp-theme-mode]").forEach((button) =>
          button.setAttribute("aria-pressed", String(button.getAttribute("data-bp-theme-mode") === selected))
        );
        triggerBodyEvent("bp:theme-mode-changed", { mode: selected, concrete });
      };

      const serviceIdByOrigin: Record<string, string> = (() => {
        const map: Record<string, string> = {};
        for (const [id, origin] of Object.entries(serviceOrigins)) {
          try { map[new URL(origin).origin] = id; } catch { /* skip invalid */ }
        }
        return map;
      })();

      // -- BP header store (spec: docs/platform/auth-flow.md section0.4) --
      // Services set client-managed headers via BP-SetHeader / BP-RemoveHeader
      // response headers (e.g. Authorization after login). The shell stores them
      // in localStorage and attaches them to every subsequent BP request,
      // honouring expiry, lock ownership, and per-service scope.

      interface BpStoredHeader {
        value: string;
        owner: string;
        locked: boolean;
        expires: number | null;
        scope: string | null;
        refresh: string | null;
        refreshBefore: number | null;
      }

      const BP_HEADERS_KEY = "bp.headers";
      const DEFAULT_HEADER_REFRESH_BEFORE_SECONDS = 60;
      const HEADER_REFRESH_RETRY_MS = 30_000;
      const headerRefreshTimers = new Map<string, number>();
      const headerRefreshRetryAt = new Map<string, number>();
      let headerRefreshInFlight: Promise<boolean> | null = null;

      const readBpHeaders = (): Record<string, BpStoredHeader> => {
        try { return JSON.parse(localStorage.getItem(BP_HEADERS_KEY) || "{}"); }
        catch { return {}; }
      };

      const writeBpHeaders = (headers: Record<string, BpStoredHeader>) => {
        try { localStorage.setItem(BP_HEADERS_KEY, JSON.stringify(headers)); }
        catch { /* storage unavailable - headers just won't persist */ }
      };

      const triggerBodyEvent = (name: string, detail?: unknown) => {
        if (typeof htmx.trigger === "function") htmx.trigger(document.body, name, detail);
      };

      /** Drop expired entries; returns the live set. */
      const liveBpHeaders = (): Record<string, BpStoredHeader> => {
        const stored = readBpHeaders();
        const now = Math.floor(Date.now() / 1000);
        let changed = false;
        for (const [name, entry] of Object.entries(stored)) {
          if (entry && typeof entry.expires === "number" && entry.expires <= now) {
            delete stored[name];
            changed = true;
          }
        }
        if (changed) writeBpHeaders(stored);
        return stored;
      };

      const serviceIdForUrl = (url: string): string => {
        try { return serviceIdByOrigin[new URL(url, window.location.origin).origin] || ""; }
        catch { return ""; }
      };

      const originForServiceId = (id: string): string =>
        id ? (serviceOrigins[id] || unresolvedServiceOrigin) : "";

      const originFromAbsoluteUrl = (value: string | null | undefined): string => {
        try { return value ? new URL(value).origin : ""; }
        catch { return ""; }
      };

      const refreshUrlForHeader = (entry: BpStoredHeader): string => {
        if (!entry.refresh) return "";
        const base =
          serviceOrigins[entry.owner]
          || originFromAbsoluteUrl(entry.owner)
          || (entry.scope ? serviceOrigins[entry.scope] : "")
          || window.location.origin;
        try { return new URL(entry.refresh, base).href; }
        catch { return ""; }
      };

      const headerRefreshDue = (entry: BpStoredHeader, force: boolean): boolean => {
        if (!entry.refresh) return false;
        if (force) return true;
        if (typeof entry.expires !== "number") return false;
        const before = typeof entry.refreshBefore === "number"
          ? entry.refreshBefore
          : DEFAULT_HEADER_REFRESH_BEFORE_SECONDS;
        return entry.expires - Math.floor(Date.now() / 1000) <= before;
      };

      const refreshStoredHeader = async (name: string, entry: BpStoredHeader): Promise<boolean> => {
        const refreshUrl = refreshUrlForHeader(entry);
        if (!refreshUrl) return false;
        const previous = liveBpHeaders()[name] ?? entry;

        const headers: Record<string, string> = {
          "accept": "application/json",
          "content-type": "application/json"
        };
        attachBpHeaders(headers, refreshUrl, entry.owner);

        let response: Response;
        try {
          response = await fetch(refreshUrl, {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers,
            body: "{}"
          });
        } catch {
          return false;
        }

        applyBpHeaderDirectives(response, refreshUrl);
        const current = liveBpHeaders()[name];
        return response.ok
          && !!current
          && (current.value !== previous.value || current.expires !== previous.expires);
      };

      const refreshStoredHeaders = async (force = false): Promise<boolean> => {
        const entries = Object.entries(liveBpHeaders()).filter(([, entry]) => headerRefreshDue(entry, force));
        if (entries.length === 0) return false;

        let refreshed = false;
        for (const [name, entry] of entries) {
          refreshed = await refreshStoredHeader(name, entry) || refreshed;
        }
        return refreshed;
      };

      const refreshStoredHeadersOnce = (force = false): Promise<boolean> => {
        if (!headerRefreshInFlight) {
          headerRefreshInFlight = refreshStoredHeaders(force).finally(() => {
            headerRefreshInFlight = null;
          });
        }
        return headerRefreshInFlight;
      };

      const scheduleHeaderRefreshes = () => {
        headerRefreshTimers.forEach((timer) => window.clearTimeout(timer));
        headerRefreshTimers.clear();

        const nowMs = Date.now();
        for (const [name, entry] of Object.entries(readBpHeaders())) {
          if (!entry?.refresh || typeof entry.expires !== "number") continue;
          const before = typeof entry.refreshBefore === "number"
            ? entry.refreshBefore
            : DEFAULT_HEADER_REFRESH_BEFORE_SECONDS;
          const dueMs = (entry.expires - before) * 1000;
          const delay = Math.max(0, dueMs - nowMs, (headerRefreshRetryAt.get(name) ?? 0) - nowMs);
          headerRefreshTimers.set(name, window.setTimeout(() => {
            void refreshStoredHeader(name, entry)
              .then((refreshed) => {
                if (refreshed) headerRefreshRetryAt.delete(name);
                else headerRefreshRetryAt.set(name, Date.now() + HEADER_REFRESH_RETRY_MS);
              })
              .finally(scheduleHeaderRefreshes);
          }, delay));
        }
      };

      /** Attach stored headers to an outgoing request's header map. */
      const attachBpHeaders = (requestHeaders: Record<string, string>, requestUrl: string, explicitServiceId = "") => {
        const targetServiceId = explicitServiceId || serviceIdForUrl(requestUrl);
        for (const [name, entry] of Object.entries(liveBpHeaders())) {
          if (!entry || typeof entry.value !== "string") continue;
          if (entry.scope && entry.scope !== targetServiceId) continue;
          if (requestHeaders[name] !== undefined) continue; // explicit wins
          requestHeaders[name] = entry.value;
        }
        const baggageName = Object.keys(requestHeaders).find((name) => name.toLowerCase() === "baggage") ?? "baggage";
        const members = (requestHeaders[baggageName] || "")
          .split(",")
          .map((member) => member.trim())
          .filter((member) => member && !member.startsWith("bp.session_id="));
        members.unshift(`bp.session_id=${sessionId}`);
        while (members.length > 64 || new TextEncoder().encode(members.join(",")).byteLength > 8192) members.pop();
        requestHeaders[baggageName] = members.join(",");
      };

      /**
       * Process BP-SetHeader / BP-RemoveHeader response headers.
       * Wire format: "Name=value; locked=true; expires=1735689600; scope=true"
       * Owner = the service that sent the response (locked headers can only be
       * overwritten or removed by their owner).
       */
      const applyBpHeaderDirectives = (response: Response | undefined, requestUrl: string) => {
        const setRaw = response?.headers?.get?.("bp-setheader");
        const removeRaw = response?.headers?.get?.("bp-removeheader");
        if (!setRaw && !removeRaw) return;

        // A responder is known by its service id AND its origin - owner checks
        // accept either, so entries stored before the service map knew this
        // service (owner = origin fallback) stay controllable by their owner.
        const responderOrigin = (() => {
          try { return new URL(requestUrl, window.location.origin).origin; } catch { return ""; }
        })();
        const responderId = serviceIdForUrl(requestUrl);
        const responder = responderId || responderOrigin;
        const ownerMatches = (owner: string) =>
          (!!responderId && owner === responderId) || (!!responderOrigin && owner === responderOrigin);
        const stored = liveBpHeaders();
        let changed = false;

        if (setRaw) {
          // Multiple BP-SetHeader values arrive comma-joined via Headers.get().
          // Values (JWTs, etc.) contain no commas, so a comma followed by a
          // token= prefix is a safe directive boundary.
          for (const directive of setRaw.split(/,(?=\s*[^;,=]+=)/)) {
            const [pair, ...attrParts] = directive.split(";");
            const eq = (pair || "").indexOf("=");
            if (eq <= 0) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (!name) continue;

            const existing = stored[name];
            if (existing && existing.locked && !ownerMatches(existing.owner)) continue;

            const attrs: Record<string, string> = {};
            for (const part of attrParts) {
              const aEq = part.indexOf("=");
              if (aEq <= 0) continue;
              attrs[part.slice(0, aEq).trim().toLowerCase()] = part.slice(aEq + 1).trim();
            }

            const rawScope = (attrs["scope"] || "").toLowerCase();
            const scope =
              rawScope === "true" ? responder
                : rawScope === "false" ? null
                  : attrs["scope"] || null;

            stored[name] = {
              value,
              owner: responder,
              locked: attrs["locked"] === "true",
              expires: attrs["expires"] ? Number(attrs["expires"]) || null : null,
              scope,
              refresh: attrs["refresh"] || null,
              refreshBefore: attrs["refreshbefore"] ? Number(attrs["refreshbefore"]) || null : null
            };
            changed = true;
          }
        }

        if (removeRaw) {
          for (const rawName of removeRaw.split(",")) {
            const name = rawName.trim();
            const existing = stored[name];
            if (!existing) continue;
            if (existing.locked && !ownerMatches(existing.owner)) continue;
            delete stored[name];
            changed = true;
          }
        }

        if (changed) {
          writeBpHeaders(stored);
          scheduleHeaderRefreshes();
          triggerBodyEvent("bp:fragments-changed");
        }
      };

      const contentDispositionFilename = (value: string | null): string => {
        if (!value) return "";
        const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(value);
        if (utf8?.[1]) {
          try { return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, "")); } catch { return utf8[1].trim(); }
        }
        const simple = /filename=([^;]+)/i.exec(value);
        return simple?.[1]?.trim().replace(/^"|"$/g, "") || "";
      };

      const fallbackDownloadName = (url: string): string => {
        try {
          const name = new URL(url, window.location.origin).pathname.split("/").filter(Boolean).pop();
          return name || "download";
        } catch {
          return "download";
        }
      };

      const resolveDownloadUrl = (el: Element): string => {
        const context = serviceContextFor(el);
        const rawAttr = el.getAttribute(DOWNLOAD_ATTR);
        const rawHref = el.tagName === "A" ? (el.getAttribute("href") || "") : "";
        const raw = ((rawAttr ?? "").trim() || rawHref).trim();
        if (!raw) return "";
        if (isThisReference(raw)) return resolveThisServiceUrl(el, context);
        if (isRelativeServicePath(raw)) return context.origin ? context.origin + raw : raw;
        try { return new URL(raw, window.location.origin).href; } catch { return ""; }
      };

      const downloadBlob = async (el: Element) => {
        if (el.getAttribute("data-bp-download-loading") === "true") return;
        const url = resolveDownloadUrl(el);
        if (!url) return;
        el.setAttribute("data-bp-download-loading", "true");
        const headers: Record<string, string> = {
          Accept: el.getAttribute("hx-accept") || "application/octet-stream"
        };
        attachBpHeaders(headers, url);
        try {
          const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            headers
          });
          applyBpHeaderDirectives(response, url);
          if (!response.ok) {
            renderRouteError(
              "Download Failed",
              `The download request failed with HTTP ${response.status}.`,
              { kind: "reload", label: "Reload" },
              el
            );
            return;
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download =
            contentDispositionFilename(response.headers.get("content-disposition"))
            || el.getAttribute("download")
            || fallbackDownloadName(url);
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch {
          renderRouteError(
            "Download Failed",
            "The download request could not be completed.",
            { kind: "reload", label: "Reload" },
            el
          );
        } finally {
          el.removeAttribute("data-bp-download-loading");
        }
      };

      const bindDownload = (el: Element) => {
        if (!el.hasAttribute(DOWNLOAD_ATTR) || el.getAttribute("data-bp-download-bound") === "true") return;
        el.setAttribute("data-bp-download-bound", "true");
        el.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void downloadBlob(el);
        });
        const trigger = (el.getAttribute("hx-trigger") || "").toLowerCase();
        if (trigger.split(/[,\s]+/).includes("load")) {
          window.setTimeout(() => void downloadBlob(el), 0);
        }
      };

      const clearAuthorizationHeader = () => {
        const stored = liveBpHeaders();
        if (!stored.Authorization) return;
        delete stored.Authorization;
        writeBpHeaders(stored);
        scheduleHeaderRefreshes();
        triggerBodyEvent("bp:fragments-changed");
      };

      scheduleHeaderRefreshes();

      const isLocalDevHost = () => {
        const host = window.location.hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
      };

      const devReloadEnabled = () => {
        const raw = (shellRoot()?.getAttribute("data-bp-dev-reload") || "auto").toLowerCase();
        if (["false", "0", "no", "off"].includes(raw)) return false;
        if (["true", "1", "yes", "on"].includes(raw)) return true;
        return isLocalDevHost();
      };

      const activeRouteLink = () => {
        const path = normalizePath(window.location.pathname);
        return routeLinks().find((link) => normalizePath(link.getAttribute("href") || "/") === path) || null;
      };

      const currentServiceId = () =>
        mainOutlet()?.getAttribute("data-bp-service") || activeRouteLink()?.getAttribute("data-bp-service") || "";

      const currentRouteRequestUrl = () =>
        activeRouteLink()?.getAttribute("data-bp-route-request") || mainOutlet()?.getAttribute("hx-get") || "";

      const reloadCurrentRoute = (requestUrl?: string, source?: Element | null) => {
        const action = requestUrl || currentRouteRequestUrl();
        const outlet = mainOutlet();
        if (!action || !outlet) return;
        clearError();
        setLoading(hasLoaded());
        const routePath = source?.closest?.("[data-bp-route-link]")?.getAttribute("href")
          || activeRouteLink()?.getAttribute("href")
          || window.location.pathname + window.location.search;
        triggerShellLink(routePath, action, true);
      };

      const serviceHealthUrl = (serviceId: string) => {
        const origin = serviceId ? serviceOrigins[serviceId] : "";
        return origin ? origin.replace(/\/+$/, "") + "/.well-known/bp/health" : "";
      };

      const checkServiceHealth = async (serviceId: string) => {
        const url = serviceHealthUrl(serviceId);
        if (!url) return false;
        const headers: Record<string, string> = { Accept: "application/json" };
        attachBpHeaders(headers, url, serviceId);
        try {
          const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers
          });
          return response.ok;
        } catch {
          return false;
        }
      };

      const devHealthState = new Map<string, { wasDown: boolean; polling: boolean }>();

      const scheduleDevServiceRecovery = (serviceId: string, requestUrl?: string, source?: Element | null, path = window.location.pathname) => {
        if (!devReloadEnabled() || !serviceId) return;
        const state = devHealthState.get(serviceId) || { wasDown: true, polling: false };
        state.wasDown = true;
        if (state.polling) {
          devHealthState.set(serviceId, state);
          return;
        }
        state.polling = true;
        devHealthState.set(serviceId, state);

        let attempts = 0;
        let sawUnhealthy = false;
        const poll = async () => {
          attempts += 1;
          const healthy = await checkServiceHealth(serviceId);
          if (healthy) {
            state.polling = false;
            state.wasDown = false;
            devHealthState.set(serviceId, state);
            if (sawUnhealthy && normalizePath(window.location.pathname) === normalizePath(path)) {
              reloadCurrentRoute(requestUrl, source);
            }
            return;
          }
          sawUnhealthy = true;
          if (attempts < 60) {
            window.setTimeout(poll, 750);
          } else {
            state.polling = false;
            devHealthState.set(serviceId, state);
          }
        };
        window.setTimeout(poll, 750);
      };

      const buildServiceRouteMap = (): ServiceRoute[] => {
        const routes: ServiceRoute[] = [];
        const addRoute = (tenantPathRaw: string, requestUrl: string, serviceId: string, kind?: "page" | "api") => {
          if (!requestUrl || !serviceId) return;
          const origin = serviceOrigins[serviceId];
          if (!origin) return;
          try {
            const tenantPath = normalizePath(tenantPathRaw || "/");
            const servicePath = normalizePath(new URL(requestUrl).pathname);
            routes.push({ tenantPath, servicePath, serviceOrigin: origin, serviceId, kind });
          } catch { /* skip invalid */ }
        };
        configuredRoutes().forEach((route) => addRoute(route.href || "/", route.requestUrl || "", route.serviceId || "", route.kind));
        routeLinks().forEach((link) => {
          addRoute(
            link.getAttribute("href") || "/",
            link.getAttribute("data-bp-route-request") || "",
            link.getAttribute("data-bp-service") || "",
            "page"
          );
        });
        // Sort by service path length descending for longest-prefix-first matching
        routes.sort((a, b) => b.servicePath.length - a.servicePath.length);
        return routes;
      };

      const matchServiceRoute = (serviceId: string, path: string, kind: "page" | "api" = "page"): { route: ServiceRoute; suffix: string } | null => {
        const routes = buildServiceRouteMap();
        const normalPath = normalizePath(path);
        const tryMatch = (filterServiceId: string | null) => {
          for (const route of routes) {
            if (filterServiceId && route.serviceId !== filterServiceId) continue;
            if ((route.kind ?? (route.tenantPath.startsWith("/_bp/") ? "api" : "page")) !== kind) continue;
            if (normalPath === route.servicePath) {
              return { route, suffix: "" };
            }
            if (normalPath.startsWith(route.servicePath + "/")) {
              return { route, suffix: normalPath.slice(route.servicePath.length) };
            }
          }
          return null;
        };
        // Try current service first, then fallback to any service (cross-service links)
        return tryMatch(serviceId) || tryMatch(null);
      };

      // Reverse of matchServiceRoute: resolve a TENANT path (what the URL bar /
      // an HX-Location shows) to its owning route. Authoritative across services,
      // so it works for programmatic navigations where the DOM has no owning
      // element context (e.g. post-login HX-Location to a tenant path).
      const matchTenantRoute = (path: string): { route: ServiceRoute; suffix: string } | null => {
        const routes = buildServiceRouteMap()
          .slice()
          .sort((a, b) => b.tenantPath.length - a.tenantPath.length);
        const normalPath = normalizePath(path);
        for (const route of routes) {
          if (normalPath === route.tenantPath) return { route, suffix: "" };
          if (normalPath.startsWith(route.tenantPath + "/")) {
            return { route, suffix: normalPath.slice(route.tenantPath.length) };
          }
        }
        return null;
      };

      const tenantUrlForServiceUrl = (value: string): string => {
        try {
          const url = new URL(value, window.location.origin);
          const serviceId = serviceIdByOrigin[url.origin] || "";
          const match = matchServiceRoute(serviceId, url.pathname) || matchServiceRoute(serviceId, url.pathname, "api");
          if (!match) return value;
          return normalizePath(match.route.tenantPath + match.suffix) + url.search + url.hash;
        } catch {
          return value;
        }
      };

      const serviceUrlForTenantUrl = (value: string): string => {
        try {
          const url = new URL(value, window.location.origin);
          const match = matchTenantRoute(url.pathname);
          if (!match) return value;
          return match.route.serviceOrigin + normalizePath(match.route.servicePath + match.suffix) + url.search + url.hash;
        } catch {
          return value;
        }
      };

      const triggerShellLink = (tenantUrl: string, serviceUrl = serviceUrlForTenantUrl(tenantUrl), replace = false) => {
        const link = document.createElement("a");
        link.href = tenantUrl;
        link.setAttribute("hx-get", serviceUrl);
        link.setAttribute("hx-trigger", "load");
        link.setAttribute("hx-target", "#bp-main");
        link.setAttribute("hx-swap", "innerHTML");
        link.setAttribute("hx-sync", "#bp-main:replace");
        link.setAttribute(replace ? "hx-replace-url" : "hx-push-url", tenantUrl);
        link.setAttribute("data-bp-no-route", "");
        link.hidden = true;
        const cleanup = () => link.remove();
        link.addEventListener("htmx:afterRequest", cleanup, { once: true });
        document.body.appendChild(link);
        htmx.process(link);
        window.setTimeout(cleanup, 30000);
      };

      interface BpElementConfig {
        ignore?: boolean;
        preload?: boolean;
        rewrite?: boolean;
        service?: string;
      }

      const applyConfigToken = (cfg: BpElementConfig, token: string) => {
        const trimmed = token.trim();
        if (!trimmed) return;

        const eqIdx = trimmed.indexOf("=");
        const rawKey = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx).trim();
        const rawValue = eqIdx === -1 ? "" : trimmed.slice(eqIdx + 1).trim();

        if (!rawKey) return;
        if (rawKey === "ignore") {
          cfg.ignore = true;
          return;
        }

        const negative = rawKey.startsWith("no-");
        const key = negative ? rawKey.slice(3) : rawKey;
        const value = negative
          ? false
          : eqIdx === -1
            ? true
            : !["false", "0", "no", "off"].includes(rawValue.toLowerCase());

        if (key === "preload") cfg.preload = Boolean(value);
        else if (key === "rewrite") cfg.rewrite = Boolean(value);
        else if (key === "service" && eqIdx !== -1 && rawValue) cfg.service = rawValue;
      };

      const parseConfigAttr = (cfg: BpElementConfig, raw: string | null) => {
        if (!raw) return;
        raw.split(";").forEach((token) => applyConfigToken(cfg, token));
      };

      const bpConfigFor = (el: Element): BpElementConfig => {
        const chain: Element[] = [];
        let current: Element | null = el;
        while (current) {
          chain.unshift(current);
          current = current.parentElement;
        }

        const cfg: BpElementConfig = {};
        for (const node of chain) {
          parseConfigAttr(cfg, node.getAttribute("data-bp-config"));
          parseConfigAttr(cfg, node.getAttribute("bp-config"));
        }
        return cfg;
      };

      const serviceIdAttr = (el: Element | null | undefined): string => {
        if (!el) return "";
        return (
          el.getAttribute("bp-service-id") ||
          el.getAttribute("data-bp-service-id") ||
          el.getAttribute("data-bp-service") ||
          ""
        );
      };

      const serviceContextFor = (
        el: Element | null | undefined,
        fallbackServiceId = ""
      ): { id: string; origin: string } => {
        const cfgServiceId = el ? bpConfigFor(el).service || "" : "";
        const ownerEl = el?.closest?.("[bp-service-id], [data-bp-service-id], [data-bp-service]") || null;
        const id = cfgServiceId || serviceIdAttr(ownerEl) || fallbackServiceId;
        return { id, origin: id ? originForServiceId(id) : "" };
      };

      const explicitServiceContextFor = (
        el: Element | null | undefined
      ): { id: string; origin: string } => {
        const cfgServiceId = el ? bpConfigFor(el).service || "" : "";
        const explicitEl = el?.closest?.("[bp-service-id], [data-bp-service-id]") || null;
        const id = cfgServiceId || serviceIdAttr(explicitEl);
        return { id, origin: id ? originForServiceId(id) : "" };
      };

      const isPreloadableAnchor = (el: Element) => {
        if (el.tagName !== "A") return false;
        const href = el.getAttribute("href") || "";
        if (!href || href.startsWith("#")) return false;
        if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return false;
        const target = el.getAttribute("target");
        if (target && target !== "_self") return false;
        return !el.hasAttribute("download");
      };

      const isRelativeServicePath = (value: string | null | undefined) => {
        const trimmed = (value || "").trim();
        return trimmed.startsWith("/") && !trimmed.startsWith("//");
      };

      const isThisReference = (value: string | null | undefined) =>
        (value || "").trim().toLowerCase() === "this";

      const resolveThisServiceUrl = (
        el: Element,
        context: { id: string; origin: string }
      ) => {
        const explicitContext = explicitServiceContextFor(el);
        if (explicitContext.origin) {
          return explicitContext.origin + window.location.pathname + window.location.search;
        }

        const routeMatch = matchTenantRoute(window.location.pathname);
        if (routeMatch) {
          return routeMatch.route.serviceOrigin + normalizePath(routeMatch.route.servicePath + routeMatch.suffix) + window.location.search;
        }

        const serviceOrigin = context.origin;
        if (serviceOrigin) {
          return serviceOrigin + window.location.pathname + window.location.search;
        }

        const requestUrl = currentRouteRequestUrl();
        if (requestUrl) {
          try {
            const resolved = new URL(requestUrl, serviceOrigin || window.location.origin);
            if (resolved.origin !== window.location.origin || !serviceOrigin) return resolved.href;
            return serviceOrigin + resolved.pathname + resolved.search;
          } catch {
            if (isRelativeServicePath(requestUrl) && serviceOrigin) return serviceOrigin + requestUrl.trim();
          }
        }
        return "";
      };

      (window as any).bpLoginSubmit = async (event: SubmitEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const form = event.currentTarget as HTMLFormElement | null;
        if (!form) return false;
        const errEl = document.getElementById("bp-login-error");
        if (errEl) errEl.classList.add("d-none");
        const fd = new FormData(form);
        const queryNext = new URLSearchParams(window.location.search).get("next");
        if (!fd.get("next") && queryNext) fd.set("next", queryNext);
        const context = serviceContextFor(form);
        const rawAction = form.getAttribute("hx-post") || form.getAttribute("action") || "this";
        const action = isThisReference(rawAction)
          ? resolveThisServiceUrl(form, context)
          : new URL(rawAction, context.origin || window.location.origin).href;
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        };
        attachBpHeaders(headers, action, context.id);
        try {
          const response = await fetch(action, {
            method: "POST",
            mode: "cors",
            credentials: "include",
            headers,
            body: new URLSearchParams(fd as any)
          });
          applyBpHeaderDirectives(response, action);
          const hxTrigger = response.headers.get("HX-Trigger");
          if (hxTrigger) {
            try {
              const parsed = JSON.parse(hxTrigger);
              for (const name of Object.keys(parsed)) htmx.trigger(document.body, name, parsed[name]);
            } catch {
              for (const name of hxTrigger.split(",").map((value) => value.trim()).filter(Boolean)) {
                htmx.trigger(document.body, name);
              }
            }
          }
          let body: any = null;
          try { body = await response.json(); } catch { /* non-JSON */ }
          if (!response.ok || !body || body.status !== "ok") {
            if (errEl) {
              errEl.textContent = (body && body.message) || ("Login failed (HTTP " + response.status + ")");
              errEl.classList.remove("d-none");
            }
            return false;
          }
          triggerShellLink(String(fd.get("next") || "/"), undefined, true);
        } catch {
          if (errEl) {
            errEl.textContent = "Login failed. Service unavailable.";
            errEl.classList.remove("d-none");
          }
        }
        return false;
      };

      const applyPreloadConfig = (el: Element, cfg: BpElementConfig) => {
        if (!isPreloadableAnchor(el)) return false;
        if (cfg.preload === false) {
          if (!el.hasAttribute("hx-preload")) return false;
          el.removeAttribute("hx-preload");
          return true;
        }
        if (!el.hasAttribute("hx-preload")) {
          el.setAttribute("hx-preload", "mouseover");
          return true;
        }
        return false;
      };

      const bindBpPreload = (el: Element) => {
        if (!isPreloadableAnchor(el)) return;
        if (!el.hasAttribute("hx-preload")) return;
        if (el.hasAttribute("data-bp-preload-bound")) return;

        const preload = () => {
          if (!el.hasAttribute("hx-preload")) return;
          const hxGet = el.getAttribute("hx-get");
          if (!hxGet) return;
          const action = hxGet.replace(/#.*$/, "");

          const state = (el as any)._htmx ?? ((el as any)._htmx = {});
          if (state.preload) return;

          const headers: Record<string, string> = { Accept: "text/html; mode=page" };
          attachBpHeaders(headers, action);
          const serviceId = serviceContextFor(el).id;
          state.preload = {
            prefetch: fetch(hxGet, {
              method: "GET",
              mode: "cors",
              cache: "no-store",
              headers
            }).then((response) => {
              if (response.ok && serviceId) {
                setMenuServiceAvailability(serviceId, true);
                syncMenuVisibility();
              }
              return response;
            }),
            action,
            expiresAt: Date.now() + 5000
          };

          state.preload.prefetch.catch(() => {
            if (state.preload?.action === action) delete state.preload;
          });
        };

        el.addEventListener("mouseover", preload, { passive: true });
        el.addEventListener("focusin", preload, { passive: true });
        el.setAttribute("data-bp-preload-bound", "");
      };

      // -- Service link resolution --

      // Keep service-rendered HTMX requests in their lane. Content may replace
      // #bp-main or content-owned overlays; fragments may only replace themselves
      // or descendants inside their own fragment container.
      const sourceLaneRoot = (el: Element | null): Element | null => {
        if (!el) return null;
        return el.closest("[data-bp-fragment]") || el.closest("#bp-main");
      };

      const isContentOwnedTarget = (target: Element) =>
        !!target.closest("[data-bp-content-owned='true']");

      const targetWithinLane = (source: Element | null, target: Element | null): boolean => {
        if (!source || !target) return false;
        const lane = sourceLaneRoot(source);
        if (!lane) return true;
        if (lane.hasAttribute("data-bp-fragment")) {
          return target === lane || lane.contains(target);
        }
        if (lane.id === "bp-main") {
          return target === lane || lane.contains(target) || isContentOwnedTarget(target);
        }
        return false;
      };

      const resolvePolicyTarget = (source: Element, targetSpec: string | null, ctxTarget?: any): Element | null => {
        if (ctxTarget instanceof Element) return ctxTarget;
        const spec = (targetSpec || "").trim();
        if (!spec || spec === "this") return source;
        if (spec === "#bp-main") return mainOutlet();
        if (spec === "body") return document.body;
        if (spec === "html") return document.documentElement;
        if (spec.startsWith("closest ")) return source.closest(spec.slice("closest ".length).trim());
        if (spec.startsWith("find ")) return source.querySelector(spec.slice("find ".length).trim());
        try { return document.querySelector(spec); } catch { return null; }
      };

      const sanitizeHtmxTarget = (el: Element) => {
        if (el.closest(NO_ROUTE_SELECTOR) || el.hasAttribute("data-bp-route-link")) return false;
        if (!el.hasAttribute("data-bp-explicit-target")) return false;
        const lane = sourceLaneRoot(el);
        if (!lane) return false;
        const targetSpec = el.getAttribute("hx-target");
        if (!targetSpec) return false;
        const target = resolvePolicyTarget(el, targetSpec);
        if (target && targetWithinLane(el, target)) return false;

        if (lane.hasAttribute("data-bp-fragment")) {
          el.setAttribute("hx-target", "closest [data-bp-fragment]");
          if (!el.hasAttribute("hx-swap")) el.setAttribute("hx-swap", "innerHTML");
        } else {
          el.setAttribute("hx-target", "#bp-main");
          if (!el.hasAttribute("hx-swap")) el.setAttribute("hx-swap", "innerHTML");
        }
        return true;
      };

      const requestTargetEscapesLane = (detail: any): boolean => {
        const source = detail?.ctx?.sourceElement instanceof Element
          ? detail.ctx.sourceElement
          : null;
        if (!source || source.closest(NO_ROUTE_SELECTOR) || source.hasAttribute("data-bp-route-link")) return false;
        const lane = sourceLaneRoot(source);
        if (!lane) return false;
        if (!source.hasAttribute("data-bp-explicit-target")) return false;
        const target = resolvePolicyTarget(source, source.getAttribute("hx-target"), detail?.ctx?.target);
        return !!target && !targetWithinLane(source, target);
      };

      const resolveServiceLinks = (root: Element, reprocess = true) => {
        if (!root) return;

        // Determine service context for this content
        const rootService = serviceContextFor(root);
        const serviceId = rootService.id;
        const serviceOrigin = rootService.origin;

        // Collect all elements. hx-sse:connect contains a colon which CSS
        // selectors can't express portably; query it with a separate pass.
        const selector = 'a[href], form, [hx-download], [hx-get], [hx-post], [hx-put], [hx-patch], [hx-delete], script[src], img[src], link[href][rel="stylesheet"], [sse-connect]';
        const elements: Element[] = root.matches?.(selector) ? [root] : [];
        root.querySelectorAll(selector).forEach((el) => elements.push(el));
        if ((root as Element).hasAttribute?.("hx-sse:connect")) elements.push(root);
        root.querySelectorAll("*").forEach((el) => {
          if (el.hasAttribute("hx-sse:connect") && !elements.includes(el)) elements.push(el);
        });

        let changed = false;
        const newlyHtmxedForms: Element[] = [];

        for (const el of elements) {
          const bpCfg = bpConfigFor(el);
          if (bpCfg.ignore) continue;
          if (el.closest(NO_ROUTE_SELECTOR)) continue;

          if (applyPreloadConfig(el, bpCfg)) changed = true;
          if (sanitizeHtmxTarget(el)) changed = true;

          // Skip already-processed or shell-owned route links after config/preload handling
          if (el.hasAttribute("data-bp-shell-route")) {
            bindBpPreload(el);
            continue;
          }
          if (el.hasAttribute("data-bp-route-link")) {
            bindBpPreload(el);
            continue;
          }
          if (bpCfg.rewrite === false) continue;

          const tag = el.tagName;

          if (el.hasAttribute(DOWNLOAD_ATTR)) {
            const elContext = serviceContextFor(el, serviceId);
            const rawDownload = (el.getAttribute(DOWNLOAD_ATTR) || "").trim();
            const rawHref = tag === "A" ? (el.getAttribute("href") || "") : "";
            const raw = rawDownload || rawHref;
            const resolved = isThisReference(raw)
              ? resolveThisServiceUrl(el, elContext)
              : isRelativeServicePath(raw) && elContext.origin
                ? elContext.origin + raw
                : raw;
            if (resolved) el.setAttribute(DOWNLOAD_ATTR, resolved);
            if (elContext.id) el.setAttribute("data-bp-service", elContext.id);
            el.setAttribute("data-bp-shell-route", "download");
            bindDownload(el);
            changed = true;
            continue;
          }

          // -- Static assets: just rewrite to absolute --
          if ((tag === "SCRIPT" || tag === "IMG") && el.hasAttribute("src")) {
            const src = el.getAttribute("src") || "";
            const assetContext = serviceContextFor(el, serviceId);
            const assetOrigin = assetContext.origin || serviceOrigin;
            if (isRelativeServicePath(src) && assetOrigin) {
              el.setAttribute("src", assetOrigin + src);
              el.setAttribute("data-bp-shell-route", "asset");
            }
            continue;
          }
          if (tag === "LINK" && el.hasAttribute("href")) {
            const href = el.getAttribute("href") || "";
            const assetContext = serviceContextFor(el, serviceId);
            const assetOrigin = assetContext.origin || serviceOrigin;
            if (isRelativeServicePath(href) && assetOrigin) {
              el.setAttribute("href", assetOrigin + href);
              el.setAttribute("data-bp-shell-route", "asset");
            }
            continue;
          }

          // -- SSE: rewrite hx-sse:connect / sse-connect to absolute service origin --
          const sseAttr = el.hasAttribute("hx-sse:connect")
            ? "hx-sse:connect"
            : el.hasAttribute("sse-connect")
              ? "sse-connect"
              : null;
          if (sseAttr) {
            const sseUrl = el.getAttribute(sseAttr) || "";
            if (isRelativeServicePath(sseUrl)) {
              const elContext = serviceContextFor(el, serviceId);
              const elServiceOrigin = elContext.origin || serviceOrigin;
              if (elServiceOrigin) {
                el.setAttribute(sseAttr, elServiceOrigin + sseUrl);
                el.setAttribute("data-bp-shell-route", "sse");
              }
            }
            continue;
          }

          // -- Determine what type of element --

          // Find hx-method attr if present
          let hxMethodAttr: string | null = null;
          let hxMethodVal: string | null = null;
          for (const attr of HX_METHODS) {
            const val = el.getAttribute(attr);
            if (val !== null) {
              hxMethodAttr = attr;
              hxMethodVal = val;
              break;
            }
          }

          // Upgrade ordinary internal forms to HTMX. A bare BP form keeps the
          // established POST-to-current-view default; explicit native GET/POST
          // semantics are preserved. External and unsupported forms stay native.
          if (tag === "FORM" && !hxMethodAttr) {
            const hasAction = el.hasAttribute("action");
            const nativeAction = (el.getAttribute("action") || "").trim() || "this";
            const nativeMethod = (el.getAttribute("method") || (hasAction ? "get" : "post")).trim().toLowerCase();
            const nativeHxMethod = nativeMethod === "post" ? "hx-post" : nativeMethod === "get" ? "hx-get" : null;
            if (nativeHxMethod && (isThisReference(nativeAction) || isRelativeServicePath(nativeAction))) {
              el.setAttribute(nativeHxMethod, nativeAction);
              hxMethodAttr = nativeHxMethod;
              hxMethodVal = nativeAction;
              newlyHtmxedForms.push(el);
              changed = true;
            }
          }

          // Anchor href
          const isAnchor = tag === "A";
          const rawHref = isAnchor ? (el.getAttribute("href") || "") : "";
          const hasHref = isAnchor && isRelativeServicePath(rawHref);

          // Skip anchors with target="_blank" etc. or non-navigable hrefs
          if (isAnchor) {
            const linkTarget = el.getAttribute("target");
            if (linkTarget && linkTarget !== "_self") continue;
            if (el.hasAttribute("download")) continue;
            if (!hasHref && !hxMethodAttr) continue;
            if (rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) continue;
          }

          // Nothing to resolve
          if (!hasHref && !hxMethodAttr) continue;

          const hadExplicitTarget = el.hasAttribute("hx-target");
          if (hadExplicitTarget) el.setAttribute("data-bp-explicit-target", "");

          // -- Shell default targeting --
          // Any hx-action element that doesn't declare its own target swaps the
          // main content panel with innerHTML. Applied at parse time for EVERY
          // method element (relative, absolute, or "this") so views never have
          // to hand-wire hx-target/hx-swap. Opt out with an explicit hx-target
          // (e.g. "this"), bp-no-override, or data-bp-config="rewrite:false".
          if (hxMethodAttr && !hadExplicitTarget) {
            el.setAttribute("hx-target", "#bp-main");
            if (!el.hasAttribute("hx-swap")) el.setAttribute("hx-swap", "innerHTML");
            changed = true;
          }

          // Element-level service override
          const elContext = serviceContextFor(el, serviceId);
          const elServiceId = elContext.id;
          const elServiceOrigin = elContext.origin || serviceOrigin || unresolvedServiceOrigin;

          // Path to resolve (prefer hx-method value, fallback to href)
          const hxThisUrl = hxMethodAttr && isThisReference(hxMethodVal)
            ? resolveThisServiceUrl(el, { id: elServiceId, origin: elServiceOrigin })
            : "";
          const hxMethodPath = isRelativeServicePath(hxMethodVal) ? (hxMethodVal || "").trim() : "";
          if (hxMethodAttr && !hxMethodPath && !hxThisUrl) continue;

          const resolvePath = hxMethodPath || rawHref;
          if (!hxThisUrl && !isRelativeServicePath(resolvePath)) continue;

          // Had an explicit hx-target BEFORE shell default targeting -> the
          // element knows its own context; don't apply page-nav semantics.
          if (hadExplicitTarget) {
            // -- Contextual request: just rewrite URL to absolute --
            if (hxMethodAttr && (hxThisUrl || hxMethodPath) && elServiceOrigin) {
              el.setAttribute(hxMethodAttr, hxThisUrl || (elServiceOrigin + hxMethodPath));
              el.setAttribute("data-bp-shell-route", "ctx");
            }
          } else {
            if (hxMethodAttr && hxThisUrl) {
              el.setAttribute(hxMethodAttr, hxThisUrl);
              el.setAttribute("data-bp-shell-route", "ctx");
              changed = true;
              continue;
            }

            // -- Full page navigation: resolve service path -> tenant path --
            const resolvedPath = new URL(resolvePath, window.location.origin);
            const pathOnly = normalizePath(resolvedPath.pathname);
            const query = resolvedPath.search + resolvedPath.hash;

            // A configured tenant/UI path is authoritative. Otherwise treat
            // the value as a service path and reverse-map it through config.
            const configuredMatch = matchTenantRoute(pathOnly);
            const configuredKind = configuredMatch?.route.kind
              ?? (configuredMatch?.route.tenantPath.startsWith("/_bp/") ? "api" : "page");
            const match = configuredMatch
              ? configuredKind === "page" ? configuredMatch : null
              : elServiceId ? matchServiceRoute(elServiceId, pathOnly) : null;
            const apiMatch = configuredMatch
              ? configuredKind === "api" ? configuredMatch : null
              : elServiceId ? matchServiceRoute(elServiceId, pathOnly, "api") : null;

            if (apiMatch && isAnchor && !hxMethodAttr) {
              const tenantUrl = normalizePath(apiMatch.route.tenantPath + apiMatch.suffix) + query;
              el.setAttribute("href", tenantUrl);
              el.removeAttribute("hx-preload");
              el.setAttribute("data-bp-shell-route", "api");
              changed = true;
              continue;
            }

            if (match) {
              // Known route - keep/use its configured tenant path and request
              // the corresponding service path.
              const tenantUrl = normalizePath(match.route.tenantPath + match.suffix) + query;
              const absoluteServiceUrl = match.route.serviceOrigin
                + normalizePath(match.route.servicePath + match.suffix)
                + query;

              if (isAnchor) el.setAttribute("href", tenantUrl);
              if (hxMethodAttr) {
                el.setAttribute(hxMethodAttr, absoluteServiceUrl);
              } else {
                el.setAttribute("hx-get", absoluteServiceUrl);
              }
              el.setAttribute("hx-target", "#bp-main");
              el.setAttribute("hx-swap", "innerHTML");
              if (!hxMethodAttr || hxMethodAttr === "hx-get") el.setAttribute("hx-push-url", tenantUrl);
              el.setAttribute("data-bp-shell-route", "page");
            } else if (elServiceOrigin && hxMethodAttr && hxMethodPath) {
              // Unknown route but has hx-method - at minimum make URL absolute
              // and treat as full-page since no target
              el.setAttribute(hxMethodAttr, elServiceOrigin + hxMethodPath);
              el.setAttribute("hx-target", "#bp-main");
              el.setAttribute("hx-swap", "innerHTML");
              el.setAttribute("data-bp-shell-route", "page");
            }
          }

          changed = true;
          bindBpPreload(el);
        }

        if (changed && reprocess && htmx && typeof htmx.process === "function") {
          htmx.process(root);
        } else if (newlyHtmxedForms.length > 0 && htmx && typeof htmx.process === "function") {
          // Forms that gained hx-post AFTER htmx processed the swap have no
          // submit binding yet. Process just those forms - never the whole
          // root, which would re-fire hx-trigger="load" requests.
          for (const form of newlyHtmxedForms) htmx.process(form);
        }
      };

      // -- Active route management --

      const setActiveRoute = (path: string) => {
        let activeLink: Element | null = null;
        const normalizedPath = normalizePath(path);

        routeLinks().forEach((link) => {
          const isActive = normalizePath(link.getAttribute("href") || "/") === normalizedPath;
          link.classList.toggle("active", isActive);
          link.setAttribute("aria-current", isActive ? "page" : "false");
          if (isActive) activeLink = link;
        });

        const routeLink = activeLink as Element | null;
        const configuredRoute = configuredRouteFor(path);
        const title = configuredRoute?.title
          || routeLink?.getAttribute("data-bp-route-title")
          || routeLink?.textContent?.trim()
          || path;
        const tn = titleNode();
        if (tn) tn.textContent = title;
        syncDocumentTitle(title);
        const serviceId = configuredRoute?.serviceId || routeLink?.getAttribute("data-bp-service");
        if (serviceId) mainOutlet()?.setAttribute("data-bp-service", serviceId);

        navGroups().forEach((group) => {
          if (group.querySelector("[data-bp-route-link].active")) group.open = true;
        });

        const bcNode = breadcrumbNode();
        if (bcNode) {
          const breadcrumb = activeLink ? ((activeLink as Element).getAttribute("data-bp-route-breadcrumb") || "") : "";
          bcNode.textContent = breadcrumb;
          bcNode.toggleAttribute("hidden", !breadcrumb);
        }
      };

      // -- Click handler: error actions --

      const routeContextFromSource = (source: Element | null | undefined, fallbackPath = window.location.pathname) => {
        const link = source?.closest?.("[data-bp-route-link]") || activeRouteLink();
        return {
          path: link?.getAttribute("href") || fallbackPath,
          title: link?.getAttribute("data-bp-route-title") || link?.textContent?.trim() || fallbackPath,
          breadcrumb: link?.getAttribute("data-bp-route-breadcrumb") || "",
          serviceId: link?.getAttribute("data-bp-service") || currentServiceId()
        };
      };

      const renderRouteError = (
        title: string,
        message: string,
        action: any,
        source: Element | null | undefined
      ) => {
        const route = routeContextFromSource(source);
        applyChrome(null);
        setActiveRoute(route.path);
        const tn = titleNode();
        if (tn) tn.textContent = route.title;
        const bcNode = breadcrumbNode();
        if (bcNode) {
          bcNode.textContent = route.breadcrumb;
          bcNode.toggleAttribute("hidden", !route.breadcrumb);
        }
        if (route.serviceId) mainOutlet()?.setAttribute("data-bp-service", route.serviceId);
        replaceMainWithError(title, message, action, route.path);
        markLoaded();
        setLoading(false);
        scrollPageToTop();
      };

      const handleErrorAction = (event: MouseEvent) => {
        const trigger = (event.target as Element)?.closest?.("[data-bp-error-action]");
        if (!trigger) return;
        const action = trigger.getAttribute("data-bp-error-action");
        if (action === "login") {
          const loginUrl = shellRoot()?.getAttribute("data-bp-login-url");
          if (loginUrl) loadLoginIntoShell(loginUrl);
          return;
        }
        if (action === "reload") triggerShellLink(window.location.pathname + window.location.search, undefined, true);
      };

      const loadLoginIntoShell = (loginUrl: string) => {
        if (!loginUrl) return;
        try {
          const u = new URL(loginUrl, window.location.origin);
          const current = window.location.pathname + window.location.search;
          const nextPath = window.location.pathname === u.pathname ? "/" : current;
          u.searchParams.set("next", nextPath);
          const serviceLoginUrl = u.href;
          const tenantLoginUrl = tenantUrlForServiceUrl(serviceLoginUrl);
          triggerShellLink(tenantLoginUrl, serviceLoginUrl);
        } catch { /* ignore */ }
      };

      let lastAuthRefreshRetryUrl = "";

      const retryMainRequest = (ctx: any): boolean => {
        const action = ctx?.request?.action;
        if (!action) return false;
        const method = String(ctx?.request?.verb || ctx?.request?.method || "GET").toUpperCase();
        if (method !== "GET") return false;
        triggerShellLink(window.location.pathname + window.location.search, action, true);
        return true;
      };

      const handleShellRouteClick = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = (event.target as Element)?.closest?.("a[href][hx-get]") as HTMLAnchorElement | null;
        if (!anchor) return;
        if (anchor.hasAttribute("download")) return;
        const targetAttr = anchor.getAttribute("target");
        if (targetAttr && targetAttr !== "_self") return;

        const hxGet = anchor.getAttribute("hx-get");
        const hxTarget = anchor.getAttribute("hx-target") || "#bp-main";
        if (!hxGet || hxTarget !== "#bp-main") return;

        closeContainingOffcanvas(anchor);
      };

      // -- DOM setup --

      document.addEventListener("DOMContentLoaded", () => {
        applyChrome(readChromeFromRoot());
        scheduleBootstrapOverlaySync();
        setActiveRoute(window.location.pathname);
        resolveServiceLinks(document.body);
        initBootstrapComponents(document.body);
        initializeBpElements(document.body);
        try { applyThemeMode(localStorage.getItem(themeModeKey) || document.documentElement.getAttribute("data-bs-theme") || "system"); }
        catch { applyThemeMode(document.documentElement.getAttribute("data-bs-theme") || "system"); }
        if (!hasLoaded()) setLoading(true);
        // P14: kick off menu service health checks for the admin shell only.
        if (shellRoot()?.getAttribute("data-bp-menu-health") !== "false") {
          runMenuHealthChecks();
          setInterval(runMenuHealthChecks, 60 * 60 * 1000);
          syncMenuVisibility();
        }
      });

      document.addEventListener("click", (event) => {
        const button = (event.target as Element)?.closest?.("[data-bp-theme-mode]");
        const mode = button?.getAttribute("data-bp-theme-mode");
        if (!mode) return;
        try { localStorage.setItem(themeModeKey, mode); } catch { /* preference remains session-only */ }
        applyThemeMode(mode);
      });

      const syncMenuVisibility = () => {
        const hasAuth = Object.keys(liveBpHeaders()).some((name) => name.toLowerCase() === "authorization");
        document.querySelectorAll("[data-bp-route-link][data-bp-service]").forEach((el) => {
          const policy = el.getAttribute("data-bp-auth-status");
          const authHidden = policy === "hide-unauthenticated"
            ? !hasAuth
            : policy === "hide-unauthorized" && el.hasAttribute("data-bp-auth-denied");
          const serviceHidden = el.classList.contains("bp-service-down") && el.getAttribute("data-bp-service-status") === "hide";
          el.toggleAttribute("hidden", authHidden || serviceHidden);
        });
        document.querySelectorAll("[data-bp-nav-group]").forEach((group) => {
          const visible = Array.from(group.querySelectorAll("[data-bp-route-link]")).some((link) => !(link as HTMLElement).hidden);
          group.toggleAttribute("hidden", !visible);
        });
      };

      const setMenuServiceAvailability = (serviceId: string, available: boolean) => {
        document.querySelectorAll("[data-bp-route-link][data-bp-service]").forEach((el) => {
          if (el.getAttribute("data-bp-service") !== serviceId) return;
          el.classList.toggle("bp-service-down", !available);
          el.toggleAttribute("aria-disabled", !available);
        });
      };

      // -- Menu health check (P14) --
      // Pings /.well-known/bp/health on each service in serviceOrigins.
      // Adds .bp-service-down to anchors whose service is unreachable.
      // Clicking a downed link triggers a force re-check and clears state on success.
      const runMenuHealthChecks = async () => {
        const origins = (() => { try { return JSON.parse(shellRoot()?.getAttribute("data-bp-services") || "{}"); } catch { return {}; } })() as Record<string, string>;
        const entries = Object.entries(origins);
        const results: Record<string, boolean> = {};
        await Promise.all(entries.map(async ([sid, origin]) => {
          try {
            const url = `${origin.replace(/\/+$/, "")}/.well-known/bp/health`;
            const headers: Record<string, string> = { Accept: "application/json" };
            attachBpHeaders(headers, url, sid);
            const r = await fetch(url, { method: "GET", mode: "cors", cache: "no-store", headers });
            results[sid] = r.ok;
          } catch { results[sid] = false; }
        }));
        Object.entries(results).forEach(([serviceId, available]) => {
          setMenuServiceAvailability(serviceId, available);
        });
        syncMenuVisibility();
      };

      // Force-recheck on click of disabled menu link; if back up, allow nav.
      document.body.addEventListener("click", async (event) => {
        const target = (event.target as Element)?.closest?.(".bp-service-down") as Element | null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        await runMenuHealthChecks();
        if (!target.classList.contains("bp-service-down")) {
          // Recovered - replay click as a normal navigation.
          (target as HTMLElement).click();
        }
      }, true);

      document.body.addEventListener("click", handleErrorAction);
      document.body.addEventListener("click", handleShellRouteClick);
      document.addEventListener("htmx:before:history:update", (event: Event) => {
        const detail = (event as CustomEvent<{ history?: { path?: string } }>).detail;
        if (detail?.history?.path) {
          detail.history.path = tenantUrlForServiceUrl(detail.history.path);
        }
      });
      document.addEventListener("htmx:before:history:restore", (event: Event) => {
        const detail = (event as CustomEvent<{ path?: string }>).detail;
        if (!detail?.path) return;
        const serviceUrl = serviceUrlForTenantUrl(detail.path);
        if (serviceUrl === detail.path) return;
        event.preventDefault();
        triggerShellLink(detail.path, serviceUrl, true);
      });

      document.body.addEventListener("click", (event) => {
        const el = event.target as Element;
        const toggleBtn = el?.closest?.("[data-bp-detail-toggle]");
        if (toggleBtn) {
          const pane = toggleBtn.closest(".bp-split-pane");
          if (pane) {
            const open = pane.getAttribute("data-bp-detail-open") === "true";
            pane.setAttribute("data-bp-detail-open", open ? "false" : "true");
          }
          return;
        }
        const closeBtn = el?.closest?.("[data-bp-detail-close]");
        if (closeBtn) {
          const pane = closeBtn.closest(".bp-split-pane");
          if (pane) pane.setAttribute("data-bp-detail-open", "false");
        }
      });

      // -- HTMX extension: bp-shell --

      htmx.registerExtension("bp-shell", {
        // Resolve relative service URLs before htmx processes the element.
        // This catches elements with existing hx-methods that resolveServiceLinks
        // already rewrote, PLUS any that were missed (dynamically added, etc.)
        htmx_before_init(elt: any) {
          if (!elt || !elt.getAttribute) return;
          if (elt instanceof Element && elt.closest(NO_ROUTE_SELECTOR)) return;
          if (elt instanceof Element) resolveServiceLinks(elt, false);
          if (elt instanceof Element) initializeBpElements(elt);
          if (elt instanceof Element && elt.hasAttribute(DOWNLOAD_ATTR)) bindDownload(elt);
          for (const attr of HX_METHODS) {
            const val = elt.getAttribute(attr);
            if (isThisReference(val)) {
              const context = elt instanceof Element ? serviceContextFor(elt) : { id: "", origin: "" };
              const action = elt instanceof Element ? resolveThisServiceUrl(elt, context) : "";
              if (action) elt.setAttribute(attr, action);
            } else if (isRelativeServicePath(val)) {
              const { origin } = elt instanceof Element ? serviceContextFor(elt) : { origin: "" };
              if (origin) elt.setAttribute(attr, origin + (val || "").trim());
            }
          }
          // Also rewrite SSE connect URL so hx-sse ext captures absolute URL
          // when it reads the attribute during htmx_after_process.
          if (elt.hasAttribute?.("hx-sse:connect")) {
            const sseVal = elt.getAttribute("hx-sse:connect");
            if (sseVal && sseVal.startsWith("/")) {
              const { origin } = elt instanceof Element ? serviceContextFor(elt) : { origin: "" };
              if (origin) elt.setAttribute("hx-sse:connect", origin + sseVal);
            }
          }
        },

        htmx_after_process(elt: any) {
          if (elt instanceof Element) {
            resolveServiceLinks(elt, false);
            initializeBpElements(elt);
          }
        },

        htmx_config_request(elt: any, detail: any) {
          const ctx = detail.ctx;
          if (!ctx || !ctx.request) return;
          const source = ctx.sourceElement instanceof Element
            ? ctx.sourceElement
            : elt instanceof Element
              ? elt
              : null;
          const isSseConnect = source?.hasAttribute?.("hx-sse:connect") || source?.hasAttribute?.("sse-connect");
          const mode = isSseConnect || !isMainTarget(ctx.target) ? "fragment" : "page";
          const acceptHeaderName = Object.keys(ctx.request.headers).find((key) => key.toLowerCase() === "accept") ?? "Accept";
          const acceptValue = ctx.request.headers[acceptHeaderName];
          if (!acceptValue || acceptValue.trim().toLowerCase() === "text/html") {
            ctx.request.headers[acceptHeaderName] = "text/html; mode=" + mode;
          }
          if (isSseConnect) ctx.request.headers["HX-Request-Type"] = "partial";

          // Attach stored BP headers (Authorization etc.) to every BP request -
          // this is what carries the login token to services after sign-in.
          // Rewrite same-origin action URLs (e.g. hx-post="" -> current path on theme origin)
          // to the owning service origin. Without this, a form rendered by a service-owned
          // route would POST back to the theme - which has no such route. Service inferred
          // from the element's nearest data-bp-service ancestor, falling back to bp-main's.
          try {
            const action = ctx.request?.action || "";
            if (!action) return;
            if (source?.closest?.(NO_ROUTE_SELECTOR)) {
              attachBpHeaders(ctx.request.headers, action);
              return;
            }
            const themeOrigin = window.location.origin;
            const url = new URL(action, themeOrigin);
            if (url.origin === themeOrigin) {
              const explicitContext = explicitServiceContextFor(source);
              if (explicitContext.origin) {
                ctx.request.action = explicitContext.origin + url.pathname + url.search;
              } else {
                // Authoritative fallback: if the path matches a known route's TENANT path,
                // rewrite to that route's service origin + service path. Correct even
                // for programmatic navigations (e.g. a post-login HX-Location to a
                // tenant path) where the DOM owning-element context belongs to a
                // different service (the auth service that rendered the login form).
                const routeMatch = matchTenantRoute(url.pathname);
                if (routeMatch) {
                  ctx.request.action =
                    routeMatch.route.serviceOrigin
                    + normalizePath(routeMatch.route.servicePath + routeMatch.suffix)
                    + url.search;
                } else {
                  // Fallback: infer the service from the element's data-bp-service
                  // ancestor (or #bp-main). Used for in-context requests like a form
                  // POSTing back to the service-owned route that rendered it.
                  const ownerContext = serviceContextFor(source || mainOutlet());
                  const origin = ownerContext.origin || unresolvedServiceOrigin;
                  ctx.request.action = origin + url.pathname + url.search;
                }
              }
            }
          } catch { /* non-fatal */ }

          // Scope checks must use the final action after any service-origin rewrite.
          attachBpHeaders(ctx.request.headers, ctx.request?.action || "");
        },

        // Show loading state: main panel gets glaze, fragments get overlay
        htmx_before_request(_elt: any, detail: any) {
          const source = detail.ctx?.sourceElement;
          const bpElement = requestBpElement(source);
          if (bpElement) showBpElementLoading(bpElement);
          const preload = (source as any)?._htmx?.preload;
          if (preload && preload.action === detail.ctx?.request?.action && Date.now() < preload.expiresAt) {
            detail.ctx.fetch = () => preload.prefetch;
            delete (source as any)._htmx.preload;
          }
          if (requestTargetEscapesLane(detail)) {
            if (source instanceof Element && sanitizeHtmxTarget(source)) {
              htmx.process(source);
            }
            return false;
          }
          const target = detail.ctx?.target;
          if (requestTargetsMain(detail)) {
            closeContainingOffcanvas(detail.ctx?.sourceElement);
            if (isMainTarget(detail.ctx?.sourceElement)) disableInitialMainLoad();
            const action = detail.ctx?.request?.action || "";
            if (action && isThemeOriginUrl(action)) {
              const message = "Invalid BetterPortal route: content service resolves to the theme origin.";
              disableInitialMainLoad();
              renderRouteError("Route Configuration Error", message, { kind: "reload", label: "Reload" }, detail.ctx?.sourceElement);
              return false;
            }
            clearError();
            if (hasLoaded()) setLoading(true);
          } else if (target instanceof Element) {
            target.classList.add("bp-fragment-loading");
          }
        },

        // Only explicit themed status HTML may replace the main outlet on an
        // HTTP error. All other error bodies are data, not trusted shell UI.
        htmx_before_swap(_elt: any, detail: any) {
          const ctx = detail.ctx;
          const status = ctx?.response?.status;
          const target = ctx?.target;
          const source = ctx?.sourceElement;
          if (source instanceof Element && (status === 401 || status === 403)) {
            const policy = source.getAttribute("data-bp-auth-status");
            if ((status === 401 && policy === "hide-unauthenticated") || (status === 403 && policy === "hide-unauthorized")) {
              (source as HTMLElement).hidden = true;
              syncMenuVisibility();
            }
          }
          applyChromeFromResponse(detail);

          const localError = source instanceof Element ? mutationErrorOutlet(source) : null;
          if (status && status >= 400 && localError && !isMainTarget(target)) {
            const contentType = ctx?.response?.headers?.get?.("content-type") || "";
            if (contentType.includes("text/html") && ctx?.text) localError.innerHTML = ctx.text;
            else localError.textContent = errorMessage(status);
            localError.hidden = false;
            localError.setAttribute("tabindex", "-1");
            htmx.process(localError);
            localError.focus({ preventScroll: true });
            if (target instanceof Element) target.classList.remove("bp-fragment-loading");
            return false;
          }
          if (localError && (!status || status < 400)) {
            localError.replaceChildren();
            localError.hidden = true;
          }
          if (target instanceof Element && !isMainTarget(target) && (!status || status < 400)) {
            ctx.__bpSplitPaneState = captureSplitPaneState(target);
          }

          const bpElement = requestBpElement(source);
          if (bpElement && !isMainTarget(target) && !bpElementStateSwaps.has(bpElement)) {
            const responseText = ctx?.text || "";
            if (status === 401 && !bpElementAuthRetried.has(bpElement)) {
              bpElementAuthRetried.add(bpElement);
              void refreshStoredHeadersOnce(true).then((refreshed) => {
                if (refreshed) htmx.trigger(bpElement, "bp:element-retry");
                else renderBpElementState(bpElement, status, responseText);
              });
            } else {
              renderBpElementState(bpElement, status || 0, responseText);
            }
            return false;
          }

          // JSON is data, never markup - block it from swapping into ANY target
          // regardless of status. Scripts that want the body (login) read it via
          // htmx:afterRequest; error states surface via htmx:error / 401 flow.
          const swapContentType = ctx?.response?.headers?.get?.("content-type") || "";
          const isJson = swapContentType.includes("application/json");
          if (status && status >= 400 && source instanceof Element && source.closest("[data-bp-error-modal]") && !isMainTarget(target)) {
            if (target instanceof Element) target.classList.remove("bp-fragment-loading");
            showRequestErrorModal(status, isJson ? "" : (ctx?.text || ""), source);
            return false;
          }
          if (isJson) {
            if (status && status >= 400 && isMainTarget(target)) {
              // fall through to the error handling below (401->login etc.)
            } else {
              return false;
            }
          }

          if (status && status >= 400 && isMainTarget(target)) {
            if (status === 403 && ctx?.sourceElement instanceof Element) {
              const menuLink = ctx.sourceElement.closest("[data-bp-route-link]");
              if (menuLink) {
                menuLink.setAttribute("data-bp-auth-denied", "");
                syncMenuVisibility();
              }
            }
            const source = ctx?.sourceElement;
            if (status === 401 && source instanceof Element && source.closest("#bp-login-form")) {
              return false;
            }
            // On 401, load the login view INTO the shell (#bp-main) - the user
            // never leaves the theme origin. Services render in-shell via HTMX;
            // a full-page navigation to the auth service origin is wrong (and
            // such services may only be reachable from a browser with the shell
            // open). We use the login URL the THEME resolved from app.auth config,
            // never a service-supplied HX-Location (a content service has no
            // reliable knowledge of where the auth provider lives).
            setLoading(false);
            if (status === 401) {
              const loginUrl = shellRoot()?.getAttribute("data-bp-login-url");
              const action = ctx?.request?.action || "";
              if (loginUrl && action !== lastAuthRefreshRetryUrl) {
                void refreshStoredHeadersOnce(true).then((refreshed) => {
                  if (refreshed) {
                    lastAuthRefreshRetryUrl = action;
                    if (retryMainRequest(ctx)) return;
                  }
                  lastAuthRefreshRetryUrl = "";
                  clearAuthorizationHeader();
                  loadLoginIntoShell(loginUrl);
                });
              } else if (loginUrl) {
                lastAuthRefreshRetryUrl = "";
                clearAuthorizationHeader();
                loadLoginIntoShell(loginUrl);
              } else {
                const source = ctx?.sourceElement instanceof Element ? ctx.sourceElement : activeRouteLink();
                renderRouteError("Session Expired", errorMessage(status), bannerActionForStatus(status), source);
              }
              return false;
            }
            if (isThemedStatusResponse(ctx)) {
              disposeBootstrapComponents(target);
              return;
            }
            return false;
          }
          if (isMainTarget(target)) {
            disposeBootstrapComponents(target);
          }
        },

        // Rewrite SSE connect URLs in the response body before the swap
        // pipeline builds task fragments, so hx-sse ext reads the absolute
        // service-origin URL once the new content is processed.
        htmx_after_request(_elt: any, detail: any) {
          try {
            const ctx = detail.ctx;
            const text: string | undefined = ctx?.text;
            const requestUrl: string | undefined = ctx?.request?.action;
            if (text && requestUrl && /(?:hx-sse:connect|sse-connect)\s*=\s*["']\/(?!\/)/.test(text)) {
              const origin = new URL(requestUrl, window.location.origin).origin;
              ctx.text = text.replace(/((?:hx-sse:connect|sse-connect)\s*=\s*["'])\/(?!\/)/g, "$1" + origin + "/");
            }
          } catch { /* non-fatal */ }

          scheduleBootstrapOverlaySync();
          applyChromeFromResponse(detail);
          const bpElement = requestBpElement(detail.ctx?.sourceElement);
          if (bpElement
            && bpElement.getAttribute("data-bp-state") === "loading"
            && detail.ctx?.response?.status
            && !(detail.ctx.response.status === 401 && bpElementAuthRetried.has(bpElement))) {
            renderBpElementState(bpElement, detail.ctx.response.status, detail.ctx?.text || "");
          }
          // Apply BP-SetHeader / BP-RemoveHeader directives from EVERY response
          // (success or error) before anything else - e.g. login's Authorization.
          try {
            applyBpHeaderDirectives(detail.ctx?.response, detail.ctx?.request?.action || "");
          } catch { /* non-fatal */ }

          // HX-Location with a bare path has no target in htmx4 - the follow-up
          // ajax would swap document.body and blow away the shell. Rewrite it
          // into a config object that swaps the main outlet and pushes the
          // tenant path (config_request later maps the path to its service).
          try {
            const loc = detail.ctx?.hx?.location;
            if (typeof loc === "string" && loc && loc[0] !== "{" && !/[\s,]/.test(loc)) {
              detail.ctx.hx.location = JSON.stringify({
                path: loc,
                target: "#bp-main",
                swap: "innerHTML",
                push: tenantUrlForServiceUrl(loc)
              });
            } else if (typeof loc === "string" && loc.trim().startsWith("{")) {
              const parsed = JSON.parse(loc);
              detail.ctx.hx.location = JSON.stringify({
                ...parsed,
                target: "#bp-main",
                swap: parsed.swap || "innerHTML",
                push: typeof parsed.push === "string"
                  ? tenantUrlForServiceUrl(parsed.push)
                  : typeof parsed.path === "string"
                    ? tenantUrlForServiceUrl(parsed.path)
                    : parsed.push
              });
            }
          } catch { /* non-fatal */ }

        },

        // After successful swap: clear loading, resolve service links, reload Bootstrap
        htmx_after_swap(_elt: any, detail: any) {
          let target = detail.ctx?.target;
          if (!target) return;
          if (target instanceof Element && !target.isConnected && target.id) {
            target = document.getElementById(target.id) || target;
          }

          if (isMainTarget(target)) {
            disableInitialMainLoad();
            markLoaded();
            setLoading(false);
            clearError();
            cleanupTeleportedModals();
            cleanupTeleportedOffcanvas();
            teleportModals(target);
            teleportOffcanvas(target);
            if (shouldScrollMainSwap(detail)) scrollPageToTop();
            scheduleBootstrapOverlaySync();
          } else if (target instanceof Element) {
            target.classList.remove("bp-fragment-loading");
            restoreSplitPaneState(target, detail.ctx?.__bpSplitPaneState);
          }

          if (target instanceof Element && (target.id === "bp-nav-mobile" || target.id === "bp-nav-desktop")) {
            void runMenuHealthChecks();
          }

          // Resolve links after swaps without re-processing the swap target.
          // Re-processing #bp-main can re-fire its hx-trigger="load" request.
          resolveServiceLinks(target, false);
          initializeBpElements(target);
          initBootstrapComponents(target);

          // Sync profile mirror for mobile offcanvas
          if (target === profileSlot()) syncProfileMirror();
        },

        // Belt-and-suspenders: clear loading after settle
        htmx_after_settle(elt: any) {
          if (isMainTarget(elt)) setLoading(false);
          else if (elt instanceof Element) elt.classList.remove("bp-fragment-loading");
          scheduleBootstrapOverlaySync();
        },

        // Update sidebar active state on history navigation
        htmx_after_history_push() { setActiveRoute(window.location.pathname); },
        htmx_after_history_replace() { setActiveRoute(window.location.pathname); },

        htmx_response_error(_elt: any, detail: any) {
          const ctx = detail?.ctx;
          const bpElement = requestBpElement(ctx?.sourceElement);
          if (bpElement && bpElement.getAttribute("data-bp-state") === "loading") {
            renderBpElementState(bpElement, ctx?.response?.status || 0, ctx?.text || "");
          }
          if (!requestTargetsMain(detail)) return;
          setLoading(false);

          const status = ctx?.response?.status || 0;
          if (status === 401 || isThemedStatusResponse(ctx)) return;
          const source = ctx?.sourceElement instanceof Element ? ctx.sourceElement : activeRouteLink();
          if ([502, 503, 504].includes(status)) {
            const serviceId =
              source?.getAttribute("data-bp-service") ||
              currentServiceId();
            scheduleDevServiceRecovery(serviceId, ctx.request?.action, source, window.location.pathname);
          }
          renderRouteError(
            errorTitle(status),
            errorMessage(status),
            bannerActionForStatus(status),
            source
          );
        },

        // htmx v4 reports network, timeout, target, and swap failures here.
        htmx_error(_elt: any, detail: any) {
          const ctx = detail?.ctx;
          const target = ctx?.target;
          const bpElement = requestBpElement(ctx?.sourceElement);
          if (bpElement) renderBpElementState(bpElement, 0);

          // Clear fragment loading on error
          if (target instanceof Element && !isMainTarget(target)) {
            target.classList.remove("bp-fragment-loading");
          }

          if (!requestTargetsMain(detail)) return;

          // Themed status views already swapped meaningful content - no banner.
          setLoading(false);
          const source = ctx?.sourceElement instanceof Element ? ctx.sourceElement : activeRouteLink();
          const serviceId =
            source?.getAttribute("data-bp-service") ||
            currentServiceId();
          scheduleDevServiceRecovery(serviceId, ctx?.request?.action, source, window.location.pathname);
          renderRouteError(
            "Connection Error",
            "Service unavailable or blocked by network policy.",
            { kind: "reload", label: "Reload" },
            source
          );
        },
      });
    })();
  });
  return `${BETTERPORTAL_BROWSER_SOURCE_PREAMBLE}${body}`;
}


export interface BuildBetterPortalShellRuntimeOptions {
  adapterSource?: BetterPortalShellRuntimeSource;
}

export async function buildBetterPortalShellRuntimeAsset(
  options: BuildBetterPortalShellRuntimeOptions
): Promise<ShellRuntimeAsset> {
  const [htmx, sse] = await Promise.all([readTextAsset(HtmxPath), readTextAsset(HtmxSsePath)]);
  return {
    body: [htmx.body, BETTERPORTAL_BROWSER_SOURCE_PREAMBLE, options.adapterSource, betterPortalShellRuntimeSource(), sse.body]
      .filter(Boolean)
      .join("\n;\n"),
    contentType: "application/javascript; charset=utf-8"
  };
}

export async function loadShellRuntimeVendorAsset(assetPath: string): Promise<ShellRuntimeAsset | null> {
  const normalized = assetPath.replace(/^\/+/, "");
  const path = normalized === "htmx.min.js"
    ? HtmxPath
    : normalized === "hx-sse.min.js"
      ? HtmxSsePath
      : null;
  if (!path) return null;
  if (!VendorAssetCache.has(path)) VendorAssetCache.set(path, readTextAsset(path));
  return VendorAssetCache.get(path) ?? null;
}
