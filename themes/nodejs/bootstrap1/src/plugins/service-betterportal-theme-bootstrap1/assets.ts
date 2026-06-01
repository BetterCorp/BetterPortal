import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { js } from "jsx-htmx";

export interface ThemeAssetResponse {
  body: string;
  contentType: string;
}

const require = createRequire(import.meta.url);
const BootstrapCssPath = require.resolve("bootstrap/dist/css/bootstrap.min.css");
const BootstrapBundlePath = require.resolve("bootstrap/dist/js/bootstrap.bundle.min.js");
const HtmxPath = require.resolve("htmx.org/dist/htmx.min.js");
const HtmxSsePath = require.resolve("htmx.org/dist/ext/hx-sse.min.js");

const AssetCache = new Map<string, Promise<ThemeAssetResponse>>();

function readTextAsset(filePath: string, contentType: string): Promise<ThemeAssetResponse> {
  return readFile(filePath, "utf8").then((body) => ({ body, contentType }));
}

function shellRuntimeSource(): string {
  // esbuild/tsx wraps functions with __name() for .name preservation;
  // shim it for the browser where that helper doesn't exist
  const body = js(() => {
    (() => {
      const htmx = (window as any).htmx;

      htmx.config.sse = {
        reconnect: true,              // Auto-reconnect on stream end (default: true for hx-sse:connect, false for hx-get)
        reconnectDelay: 500,          // Initial reconnect delay in ms (default: 500)
        reconnectMaxDelay: 60000,     // Maximum reconnect delay in ms (default: 60000)
        reconnectMaxAttempts: Infinity,// Maximum reconnection attempts (default: Infinity)
        reconnectJitter: 0.3,         // Jitter factor 0-1 for delay randomization (default: 0.3)
        pauseOnBackground: true       // Disconnect when tab is backgrounded (default: true for hx-sse:connect, false for hx-get)
      };

      const { bootstrap } = window;

      const HX_METHODS = ["hx-get", "hx-post", "hx-put", "hx-delete", "hx-patch"] as const;

      // ── DOM helpers ──

      const shellRoot = () => document.querySelector("[data-bp-shell-root]");
      const routeLinks = () => Array.from(document.querySelectorAll("[data-bp-route-link]"));
      const titleNode = () => document.querySelector("[data-bp-current-title]");
      const breadcrumbNode = () => document.querySelector("[data-bp-current-breadcrumb]");
      const navGroups = () => Array.from(document.querySelectorAll("[data-bp-nav-group]")) as HTMLDetailsElement[];
      const mainOutlet = () => document.querySelector("#bp-main");
      const contentFrame = () => document.querySelector(".bp-admin__content-frame");
      const topbarProgress = () => document.querySelector("#bp-topbar-progress");
      const errorNode = () => document.querySelector("#bp-content-error");

      const profileSlot = () => document.querySelector("[data-bp-slot='nav-profile']");
      const profileMirror = () => document.querySelector("[data-bp-profile-mirror]");

      const syncProfileMirror = () => {
        const slot = profileSlot();
        const mirror = profileMirror();
        if (!slot || !mirror) return;
        // Clone content, strip data-bp-shell-route to avoid double-processing
        mirror.innerHTML = slot.innerHTML;
        // Re-init bootstrap components on cloned content (dropdowns etc.)
        initBootstrapComponents(mirror);
      };

      const isMainTarget = (target: any) =>
        target && (target.id === "bp-main" || target === mainOutlet());

      const normalizePath = (path: string) => {
        const normalized = (path || "/").replace(/\/+$/, "");
        return normalized === "" ? "/" : normalized;
      };

      const requestTargetsMain = (detail: any) => {
        const ctx = detail && detail.ctx;
        if (!ctx) return false;
        if (isMainTarget(ctx.target)) return true;
        const source = ctx.sourceElement;
        const sel = source && source.getAttribute ? source.getAttribute("hx-target") : null;
        return sel === "#bp-main";
      };

      // ── Bootstrap component lifecycle ──

      const teleportedModals = new Set<Element>();

      const cleanupTeleportedModals = () => {
        teleportedModals.forEach((el) => {
          try {
            const inst = bootstrap && bootstrap.Modal.getInstance(el);
            if (inst) { inst.hide(); inst.dispose(); }
          } catch { /* already disposed */ }
          el.remove();
        });
        teleportedModals.clear();
      };

      const teleportModals = (root: Element) => {
        if (!root) return;
        root.querySelectorAll(".modal").forEach((modal) => {
          document.body.appendChild(modal);
          teleportedModals.add(modal);
        });
      };

      // Convert <div data-bp-sidebar="id"> wrappers into Bootstrap offcanvas markup.
      // Falls back gracefully if JS fails — content shows inline.
      const convertSidebars = (root: Element | null) => {
        if (!root) return;
        const scope = root.querySelectorAll
          ? root.querySelectorAll('[data-bp-sidebar]:not([data-bp-sidebar-ready])')
          : [];
        scope.forEach((el: any) => {
          if (el.hasAttribute('data-bp-sidebar-ready')) return;
          const id = el.getAttribute('data-bp-sidebar') || ('bp-sidebar-' + Math.random().toString(36).slice(2));
          const title = el.getAttribute('data-bp-sidebar-title') || '';
          const position = el.getAttribute('data-bp-sidebar-position') || 'end';
          const width = el.getAttribute('data-bp-sidebar-width');
          const innerHtml = el.innerHTML;

          el.setAttribute('id', id);
          el.setAttribute('data-bp-sidebar-ready', '');
          el.className = ('offcanvas offcanvas-' + position + ' ' + (el.className || '')).trim();
          el.setAttribute('tabindex', '-1');
          if (width) el.style.width = width;

          el.innerHTML =
            '<div class="offcanvas-header">' +
            (title ? '<h5 class="offcanvas-title">' + title + '</h5>' : '<span></span>') +
            '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>' +
            '</div>' +
            '<div class="offcanvas-body">' + innerHtml + '</div>';
        });

        // Wire up open triggers
        const triggers = root.querySelectorAll
          ? root.querySelectorAll('[data-bp-sidebar-open]:not([data-bp-trigger-ready])')
          : [];
        triggers.forEach((btn: any) => {
          btn.setAttribute('data-bp-trigger-ready', '');
          btn.setAttribute('data-bs-toggle', 'offcanvas');
          btn.setAttribute('data-bs-target', '#' + btn.getAttribute('data-bp-sidebar-open'));
        });
      };

      const initBootstrapComponents = (root: Element | null) => {
        if (!root || !bootstrap) return;
        convertSidebars(root);
        root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
          if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
        });
        root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
          if (!bootstrap.Popover.getInstance(el)) new bootstrap.Popover(el);
        });
      };

      const disposeBootstrapComponents = (root: Element | null) => {
        if (!root || !bootstrap) return;
        root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
          const inst = bootstrap.Tooltip.getInstance(el);
          if (inst) inst.dispose();
        });
        root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
          const inst = bootstrap.Popover.getInstance(el);
          if (inst) inst.dispose();
        });
      };

      // ── Loading / error UI ──

      const markLoaded = () => { mainOutlet()?.setAttribute("data-bp-loaded", "yes"); };
      const hasLoaded = () => mainOutlet()?.getAttribute("data-bp-loaded") === "yes";

      const setLoading = (loading: boolean) => {
        contentFrame()?.classList.toggle("is-loading", loading);
        topbarProgress()?.classList.toggle("is-active", loading);
      };

      const clearError = () => {
        const node = errorNode();
        if (!node) return;
        node.innerHTML = "";
        node.classList.remove("is-visible");
      };

      const renderErrorAction = (action: any) => {
        if (!action) return "";
        return `<button type="button" class="btn btn-sm btn-outline-danger" data-bp-error-action="${action.kind}">${action.label}</button>`;
      };

      const bannerActionForStatus = (status: number) => {
        if (status === 401) {
          const loginUrl = shellRoot()?.getAttribute("data-bp-login-url");
          if (loginUrl) return { kind: "login", label: "Sign in" };
          return { kind: "reload", label: "Reload" };
        }
        return { kind: "reload", label: "Reload" };
      };

      const showErrorBanner = (message: string, action: any) => {
        const node = errorNode();
        if (!node) return;
        node.innerHTML = `<div class="d-flex flex-wrap align-items-center justify-content-between gap-2"><span>${message}</span>${renderErrorAction(action)}</div>`;
        node.classList.add("is-visible");
      };

      const replaceMainWithError = (title: string, message: string, action: any) => {
        const outlet = mainOutlet();
        if (!outlet) return;
        outlet.innerHTML =
          `<div class="bp-shell__empty-state">` +
          `<div class="bp-shell__empty-card">` +
          `<div class="bp-shell__empty-title">${title}</div>` +
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
          case 502:
          case 503: return "Service unavailable. Try again shortly.";
          default: return "Request failed. Try again.";
        }
      };

      const isThemeOriginUrl = (url: string) => {
        try {
          return new URL(url, window.location.origin).host === window.location.host;
        } catch {
          return false;
        }
      };

      // ── Service route map (reverse: service path → tenant path) ──

      interface ServiceRoute {
        tenantPath: string;
        servicePath: string;
        serviceOrigin: string;
        serviceId: string;
      }

      const serviceOrigins: Record<string, string> = (() => {
        try { return JSON.parse(shellRoot()?.getAttribute("data-bp-services") || "{}"); }
        catch { return {}; }
      })();

      const buildServiceRouteMap = (): ServiceRoute[] => {
        const routes: ServiceRoute[] = [];
        routeLinks().forEach((link) => {
          const tenantPath = normalizePath(link.getAttribute("href") || "/");
          const requestUrl = link.getAttribute("data-bp-route-request") || "";
          const serviceId = link.getAttribute("data-bp-service") || "";
          if (!requestUrl || !serviceId) return;
          const origin = serviceOrigins[serviceId];
          if (!origin) return;
          try {
            const servicePath = normalizePath(new URL(requestUrl).pathname);
            routes.push({ tenantPath, servicePath, serviceOrigin: origin, serviceId });
          } catch { /* skip invalid */ }
        });
        // Sort by service path length descending for longest-prefix-first matching
        routes.sort((a, b) => b.servicePath.length - a.servicePath.length);
        return routes;
      };

      const matchServiceRoute = (serviceId: string, path: string): { route: ServiceRoute; suffix: string } | null => {
        const routes = buildServiceRouteMap();
        const normalPath = normalizePath(path);
        const tryMatch = (filterServiceId: string | null) => {
          for (const route of routes) {
            if (filterServiceId && route.serviceId !== filterServiceId) continue;
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

      // ── Service link resolution ──

      const resolveServiceLinks = (root: Element, reprocess = true) => {
        if (!root) return;

        // Determine service context for this content
        const serviceCtx = root.closest?.("[data-bp-service]") || root.querySelector?.("[data-bp-service]");
        const serviceId = serviceCtx?.getAttribute("data-bp-service") || "";
        const serviceOrigin = serviceId ? (serviceOrigins[serviceId] || "") : "";

        // Collect all elements. hx-sse:connect contains a colon which CSS
        // selectors can't express portably; query it with a separate pass.
        const selector = 'a[href], [hx-get], [hx-post], [hx-put], [hx-patch], [hx-delete], script[src], img[src], link[href][rel="stylesheet"], [sse-connect]';
        const elements: Element[] = root.matches?.(selector) ? [root] : [];
        root.querySelectorAll(selector).forEach((el) => elements.push(el));
        if ((root as Element).hasAttribute?.("hx-sse:connect")) elements.push(root);
        root.querySelectorAll("*").forEach((el) => {
          if (el.hasAttribute("hx-sse:connect") && !elements.includes(el)) elements.push(el);
        });

        let changed = false;

        for (const el of elements) {
          // Skip already-processed or explicitly ignored
          if (el.hasAttribute("data-bp-shell-route")) continue;
          if (el.hasAttribute("data-bp-route-link")) continue;
          if (el.hasAttribute("data-bp-no-route")) continue;

          const tag = el.tagName;

          // ── Static assets: just rewrite to absolute ──
          if ((tag === "SCRIPT" || tag === "IMG") && el.hasAttribute("src")) {
            const src = el.getAttribute("src") || "";
            if (src.startsWith("/") && serviceOrigin) {
              el.setAttribute("src", serviceOrigin + src);
              el.setAttribute("data-bp-shell-route", "asset");
            }
            continue;
          }
          if (tag === "LINK" && el.hasAttribute("href")) {
            const href = el.getAttribute("href") || "";
            if (href.startsWith("/") && serviceOrigin) {
              el.setAttribute("href", serviceOrigin + href);
              el.setAttribute("data-bp-shell-route", "asset");
            }
            continue;
          }

          // ── SSE: rewrite hx-sse:connect / sse-connect to absolute service origin ──
          const sseAttr = el.hasAttribute("hx-sse:connect")
            ? "hx-sse:connect"
            : el.hasAttribute("sse-connect")
              ? "sse-connect"
              : null;
          if (sseAttr) {
            const sseUrl = el.getAttribute(sseAttr) || "";
            if (sseUrl.startsWith("/")) {
              const elServiceId = el.closest?.("[data-bp-service]")?.getAttribute("data-bp-service") || serviceId;
              const elServiceOrigin = elServiceId ? (serviceOrigins[elServiceId] || serviceOrigin) : serviceOrigin;
              if (elServiceOrigin) {
                el.setAttribute(sseAttr, elServiceOrigin + sseUrl);
                el.setAttribute("data-bp-shell-route", "sse");
              }
            }
            continue;
          }

          // ── Determine what type of element ──

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

          // Anchor href
          const isAnchor = tag === "A";
          const rawHref = isAnchor ? (el.getAttribute("href") || "") : "";
          const hasHref = isAnchor && rawHref.startsWith("/");

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

          // Path to resolve (prefer hx-method value, fallback to href)
          const resolvePath = (hxMethodVal && hxMethodVal.startsWith("/")) ? hxMethodVal : rawHref;
          if (!resolvePath || !resolvePath.startsWith("/")) continue;

          // Element-level service override
          const elServiceId = el.closest?.("[data-bp-service]")?.getAttribute("data-bp-service") || serviceId;
          const elServiceOrigin = elServiceId ? (serviceOrigins[elServiceId] || serviceOrigin) : serviceOrigin;

          // Has explicit hx-target → element knows its context
          const hasTarget = el.hasAttribute("hx-target");

          if (hasTarget) {
            // ── Contextual request: just rewrite URL to absolute ──
            if (hxMethodAttr && hxMethodVal && hxMethodVal.startsWith("/") && elServiceOrigin) {
              el.setAttribute(hxMethodAttr, elServiceOrigin + hxMethodVal);
              el.setAttribute("data-bp-shell-route", "ctx");
            }
          } else {
            // ── Full page navigation: resolve service path → tenant path ──
            const pathParts = resolvePath.split("?");
            const pathOnly = normalizePath(pathParts[0] || "/");
            const query = pathParts[1] ? "?" + pathParts[1] : "";

            const match = elServiceId ? matchServiceRoute(elServiceId, pathOnly) : null;

            if (match) {
              // Known route — rewrite to tenant path and add htmx attrs
              const tenantUrl = normalizePath(match.route.tenantPath + match.suffix) + query;
              const absoluteServiceUrl = match.route.serviceOrigin + pathOnly + query;

              if (isAnchor) el.setAttribute("href", tenantUrl);
              el.setAttribute("hx-get", absoluteServiceUrl);
              el.setAttribute("hx-target", "#bp-main");
              el.setAttribute("hx-swap", "innerHTML");
              el.setAttribute("hx-push-url", tenantUrl);
              el.setAttribute("data-bp-shell-route", "page");
            } else if (elServiceOrigin && hxMethodAttr && hxMethodVal && hxMethodVal.startsWith("/")) {
              // Unknown route but has hx-method — at minimum make URL absolute
              // and treat as full-page since no target
              el.setAttribute(hxMethodAttr, elServiceOrigin + hxMethodVal);
              el.setAttribute("hx-target", "#bp-main");
              el.setAttribute("hx-swap", "innerHTML");
              el.setAttribute("data-bp-shell-route", "page");
            } else if (hasHref && elServiceOrigin) {
              // Anchor with unknown service path — still make absolute + page nav
              const absoluteUrl = elServiceOrigin + resolvePath;
              el.setAttribute("hx-get", absoluteUrl);
              el.setAttribute("hx-target", "#bp-main");
              el.setAttribute("hx-swap", "innerHTML");
              el.setAttribute("data-bp-shell-route", "page");
            }
          }

          changed = true;
        }

        if (changed && reprocess && htmx && typeof htmx.process === "function") {
          htmx.process(root);
        }
      };

      // ── Active route management ──

      const setActiveRoute = (path: string) => {
        let activeLink: Element | null = null;

        routeLinks().forEach((link) => {
          const isActive = link.getAttribute("href") === path;
          link.classList.toggle("active", isActive);
          link.setAttribute("aria-current", isActive ? "page" : "false");
          if (isActive) {
            activeLink = link;
            const title = link.getAttribute("data-bp-route-title") || link.textContent || path;
            const tn = titleNode();
            if (tn) tn.textContent = title;
            const svcId = link.getAttribute("data-bp-service");
            if (svcId) mainOutlet()?.setAttribute("data-bp-service", svcId);
          }
        });

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

      // ── Click handler: error actions ──

      const handleErrorAction = (event: MouseEvent) => {
        const trigger = (event.target as Element)?.closest?.("[data-bp-error-action]");
        if (!trigger) return;
        const action = trigger.getAttribute("data-bp-error-action");
        if (action === "login") {
          const loginUrl = shellRoot()?.getAttribute("data-bp-login-url");
          if (loginUrl) window.location.assign(loginUrl);
          return;
        }
        if (action === "reload") window.location.reload();
      };

      // ── DOM setup ──

      document.addEventListener("DOMContentLoaded", () => {
        setActiveRoute(window.location.pathname);
        resolveServiceLinks(document.body);
        initBootstrapComponents(document.body);
        if (!hasLoaded()) topbarProgress()?.classList.add("is-active");
      });

      document.body.addEventListener("click", handleErrorAction);

      document.body.addEventListener("click", (event) => {
        const el = event.target as Element;
        const toggleBtn = el?.closest?.("[data-bp-toggle-detail]");
        if (toggleBtn) {
          const pane = toggleBtn.closest(".bp-split-pane");
          if (pane) {
            const open = pane.getAttribute("data-bp-detail-open") === "true";
            pane.setAttribute("data-bp-detail-open", open ? "false" : "true");
          }
          return;
        }
        const closeBtn = el?.closest?.("[data-bp-close-detail]");
        if (closeBtn) {
          const pane = closeBtn.closest(".bp-split-pane");
          if (pane) pane.setAttribute("data-bp-detail-open", "false");
        }
      });

      // ── HTMX extension: bp-shell ──

      htmx.registerExtension("bp-shell", {
        // Resolve relative service URLs before htmx processes the element.
        // This catches elements with existing hx-methods that resolveServiceLinks
        // already rewrote, PLUS any that were missed (dynamically added, etc.)
        htmx_before_init(elt: any) {
          if (!elt || !elt.getAttribute) return;
          for (const attr of HX_METHODS) {
            const val = elt.getAttribute(attr);
            if (val && val.startsWith("/")) {
              const ctx = elt.closest?.("[data-bp-service]");
              const svcId = ctx?.getAttribute("data-bp-service");
              const origin = svcId ? (serviceOrigins[svcId] || "") : "";
              if (origin) elt.setAttribute(attr, origin + val);
            }
          }
          // Also rewrite SSE connect URL so hx-sse ext captures absolute URL
          // when it reads the attribute during htmx_after_process.
          if (elt.hasAttribute?.("hx-sse:connect")) {
            const sseVal = elt.getAttribute("hx-sse:connect");
            if (sseVal && sseVal.startsWith("/")) {
              const ctx = elt.closest?.("[data-bp-service]");
              const svcId = ctx?.getAttribute("data-bp-service");
              const origin = svcId ? (serviceOrigins[svcId] || "") : "";
              if (origin) elt.setAttribute("hx-sse:connect", origin + sseVal);
            }
          }
        },

        htmx_after_process(elt: any) {
          if (elt instanceof Element) resolveServiceLinks(elt, false);
        },

        htmx_config_request(elt: any, detail: any) {
          const ctx = detail.ctx;
          if (!ctx || !ctx.request) return;
          // Don't clobber Accept header for SSE-connect requests — hx-sse ext
          // sets it to "text/html, text/event-stream".
          if (elt?.hasAttribute?.("hx-sse:connect") || elt?.hasAttribute?.("sse-connect")) return;
          const mode = isMainTarget(ctx.target) ? "page" : "fragment";
          ctx.request.headers["Accept"] = "text/html; mode=" + mode;
        },

        // Show loading state: main panel gets glaze, fragments get overlay
        htmx_before_request(_elt: any, detail: any) {
          const target = detail.ctx?.target;
          if (requestTargetsMain(detail)) {
            const action = detail.ctx?.request?.action || "";
            if (action && isThemeOriginUrl(action)) {
              const message = "Invalid BetterPortal route: content service resolves to the theme origin.";
              setLoading(false);
              if (hasLoaded()) {
                showErrorBanner(message, { kind: "reload", label: "Reload" });
              } else {
                replaceMainWithError("Route Configuration Error", message, { kind: "reload", label: "Reload" });
                markLoaded();
              }
              return false;
            }
            clearError();
            if (hasLoaded()) setLoading(true);
          } else if (target instanceof Element) {
            target.classList.add("bp-fragment-loading");
          }
        },

        // Prevent swap for error responses (v4 swaps errors by default);
        // dispose Bootstrap components before main-panel swap
        htmx_before_swap(_elt: any, detail: any) {
          const ctx = detail.ctx;
          const status = ctx?.response?.status;
          const target = ctx?.target;

          if (status && status >= 400 && isMainTarget(target)) {
            return false; // cancel swap — htmx:error handles the UI
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
            if (!text || !requestUrl) return;
            if (!/hx-sse:connect="\/|sse-connect="\//.test(text)) return;
            const origin = new URL(requestUrl, window.location.origin).origin;
            ctx.text = text
              .replace(/(hx-sse:connect=")\//g, "$1" + origin + "/")
              .replace(/(sse-connect=")\//g, "$1" + origin + "/");
          } catch { /* non-fatal */ }
        },

        // After successful swap: clear loading, resolve service links, reload Bootstrap
        htmx_after_swap(_elt: any, detail: any) {
          const target = detail.ctx?.target;
          if (!target) return;

          if (isMainTarget(target)) {
            markLoaded();
            setLoading(false);
            clearError();
            cleanupTeleportedModals();
            teleportModals(target);
          } else if (target instanceof Element) {
            target.classList.remove("bp-fragment-loading");
          }

          // Resolve links and init bootstrap for ALL swaps
          resolveServiceLinks(target);
          initBootstrapComponents(target);

          // Sync profile mirror for mobile offcanvas
          if (target === profileSlot()) syncProfileMirror();
        },

        // Belt-and-suspenders: clear loading after settle
        htmx_after_settle(elt: any) {
          if (isMainTarget(elt)) setLoading(false);
          else if (elt instanceof Element) elt.classList.remove("bp-fragment-loading");
        },

        // Update sidebar active state on history navigation
        htmx_after_history_push() { setActiveRoute(window.location.pathname); },
        htmx_after_history_replace() { setActiveRoute(window.location.pathname); },

        // Unified error handler
        htmx_error(_elt: any, detail: any) {
          const ctx = detail?.ctx;
          const target = ctx?.target;

          // Clear fragment loading on error
          if (target instanceof Element && !isMainTarget(target)) {
            target.classList.remove("bp-fragment-loading");
          }

          if (!requestTargetsMain(detail)) return;

          const status = ctx.response?.status || 0;
          const message = status
            ? errorMessage(status)
            : "Connection error. Service unavailable or blocked by network policy.";
          const action = status
            ? bannerActionForStatus(status)
            : { kind: "reload", label: "Reload" };
          const title = !status
            ? "Connection Error"
            : status === 401 ? "Session Expired" : "Error " + status;

          setLoading(false);
          if (hasLoaded()) {
            showErrorBanner(message, action);
          } else {
            replaceMainWithError(title, message, action);
            markLoaded();
          }
          console.error("BetterPortal HTMX error", detail);
        },
      });
    })();
  }).toString();
  return `var __name=function(f){return f};${body}`;
}

export async function loadBootstrap1Asset(assetPath: string): Promise<ThemeAssetResponse | null> {
  const normalized = assetPath.replace(/^\/+/, "");
  if (normalized === "bootstrap.min.css") {
    const cacheKey = normalized;
    if (!AssetCache.has(cacheKey)) {
      AssetCache.set(cacheKey, readTextAsset(BootstrapCssPath, "text/css; charset=utf-8"));
    }
    return AssetCache.get(cacheKey) ?? null;
  }

  if (normalized === "bootstrap.bundle.min.js") {
    const cacheKey = normalized;
    if (!AssetCache.has(cacheKey)) {
      AssetCache.set(cacheKey, readTextAsset(BootstrapBundlePath, "application/javascript; charset=utf-8"));
    }
    return AssetCache.get(cacheKey) ?? null;
  }

  if (normalized === "htmx.min.js") {
    const cacheKey = normalized;
    if (!AssetCache.has(cacheKey)) {
      AssetCache.set(cacheKey, readTextAsset(HtmxPath, "application/javascript; charset=utf-8"));
    }
    return AssetCache.get(cacheKey) ?? null;
  }

  if (normalized === "hx-sse.min.js") {
    const cacheKey = normalized;
    if (!AssetCache.has(cacheKey)) {
      AssetCache.set(cacheKey, readTextAsset(HtmxSsePath, "application/javascript; charset=utf-8"));
    }
    return AssetCache.get(cacheKey) ?? null;
  }

  if (normalized === "bootstrap1-shell.js") {
    return {
      body: shellRuntimeSource(),
      contentType: "application/javascript; charset=utf-8"
    };
  }

  return null;
}
