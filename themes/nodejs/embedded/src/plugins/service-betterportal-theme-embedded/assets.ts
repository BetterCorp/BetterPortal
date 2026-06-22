import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { js } from "jsx-htmx";

export interface ThemeAssetResponse {
  body: string;
  contentType: string;
}

const require = createRequire(import.meta.url);
const HtmxPath = require.resolve("htmx.org/dist/htmx.min.js");

const AssetCache = new Map<string, Promise<ThemeAssetResponse>>();

function readTextAsset(filePath: string, contentType: string): Promise<ThemeAssetResponse> {
  return readFile(filePath, "utf8").then((body) => ({ body, contentType }));
}

function embeddedRuntimeSource(): string {
  return String(js(() => {
    (() => {
      const htmx = (window as any).htmx;
      if (!htmx) return;

      const HX_METHODS = ["hx-get", "hx-post", "hx-put", "hx-delete", "hx-patch"] as const;
      const DOWNLOAD_ATTR = "hx-download";

      const closestEmbed = (element: Element | null): Element | null =>
        element?.closest?.("[data-bp-embedded-root]") ?? null;

      const parseServices = (root: Element | null): Record<string, string> => {
        if (!root) return {};
        try {
          return JSON.parse(root.getAttribute("data-bp-services") || "{}");
        } catch {
          return {};
        }
      };

      const parseBackgroundServices = (root: Element | null): Array<{ serviceId: string; origin: string }> => {
        if (!root) return [];
        try {
          const entries = JSON.parse(root.getAttribute("data-bp-background-services") || "[]");
          return Array.isArray(entries) ? entries.filter((entry) => entry?.serviceId && entry?.origin) : [];
        } catch {
          return [];
        }
      };

      const serviceContextFor = (element: Element | null): { serviceId: string; origin: string } => {
        const owner = element?.closest?.("[data-bp-service]") ?? element;
        const root = closestEmbed(owner);
        const serviceId = owner?.getAttribute?.("data-bp-service")
          || root?.getAttribute("data-bp-initial-service")
          || "";
        const origin = serviceId ? parseServices(root)[serviceId] || "" : "";
        return { serviceId, origin };
      };

      const isRelativeServicePath = (value: string | null): boolean =>
        !!value && value.startsWith("/") && !value.startsWith("//");

      const resolveRelativeUrls = (root: Element): void => {
        const targets = [root, ...Array.from(root.querySelectorAll("a[href],form[action],[src],[href],sse-connect,hx-sse\\:connect,[hx-download],[hx-get],[hx-post],[hx-put],[hx-delete],[hx-patch]"))];
        for (const target of targets) {
          if (!(target instanceof Element)) continue;
          const { origin } = serviceContextFor(target);

          if (target.hasAttribute(DOWNLOAD_ATTR)) {
            const rawDownload = (target.getAttribute(DOWNLOAD_ATTR) || "").trim();
            const rawHref = target.tagName === "A" ? (target.getAttribute("href") || "") : "";
            const raw = rawDownload || rawHref;
            if (isRelativeServicePath(raw)) target.setAttribute(DOWNLOAD_ATTR, origin + raw);
            bindDownload(target);
            continue;
          }

          if (!origin) continue;

          if (target.tagName === "A") {
            const href = target.getAttribute("href");
            if (isRelativeServicePath(href)) {
              target.setAttribute("hx-get", origin + href);
              target.setAttribute("hx-target", "closest [data-bp-main-outlet]");
              target.setAttribute("hx-swap", "innerHTML");
              target.setAttribute("hx-push-url", "false");
            }
          }

          for (const attr of HX_METHODS) {
            const value = target.getAttribute(attr);
            if (isRelativeServicePath(value)) target.setAttribute(attr, origin + value);
          }

          const action = target.getAttribute("action");
          if (target.tagName === "FORM" && isRelativeServicePath(action)) {
            target.setAttribute("hx-post", origin + action);
            target.setAttribute("hx-target", "closest [data-bp-main-outlet]");
            target.setAttribute("hx-swap", "innerHTML");
          }

          for (const attr of ["src", "href", "sse-connect", "hx-sse:connect"]) {
            const value = target.getAttribute(attr);
            if (isRelativeServicePath(value)) target.setAttribute(attr, origin + value);
          }
        }
      };

      const loadBackgroundFragments = async (root: Element): Promise<void> => {
        const outlet = root.querySelector("[data-bp-background-fragments]");
        if (!(outlet instanceof HTMLElement) || outlet.dataset.bpLoaded === "1") return;
        outlet.dataset.bpLoaded = "1";
        const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        const nodes: string[] = [];
        await Promise.all(parseBackgroundServices(root).map(async (service) => {
          try {
            const base = service.origin.replace(/\/+$/, "");
            const response = await fetch(base + "/.well-known/bp/schema.json", { headers: { Accept: "application/json" }, cache: "default", mode: "cors" });
            if (!response.ok) return;
            const schema = await response.json();
            for (const route of schema.routes || []) {
              for (const fragment of route.fragments || []) {
                if (fragment.fragmentLocation !== "background" || !fragment.fragmentId) continue;
                const key = "background." + fragment.fragmentId;
                const url = base + route.path + (route.path.includes("?") ? "&" : "?") + "_f=" + encodeURIComponent(key);
                nodes.push('<div data-bp-fragment="' + escapeAttr(fragment.fragmentId) + '" data-bp-fragment-location="background" data-bp-service="' + escapeAttr(service.serviceId) + '" hx-get="' + escapeAttr(url) + '" hx-trigger="load" hx-target="this" hx-swap="innerHTML"></div>');
              }
            }
          } catch { /* service unavailable; skip background fragments */ }
        }));
        outlet.innerHTML = nodes.join("");
        htmx.process(outlet);
      };

      const readBpHeaders = (): Record<string, { value?: unknown; owner?: unknown; locked?: unknown; expires?: unknown; scope?: unknown; refresh?: unknown; refreshBefore?: unknown }> => {
        try { return JSON.parse(window.localStorage.getItem("bp.headers") || "{}"); }
        catch { return {}; }
      };

      const writeBpHeaders = (headers: Record<string, unknown>): void => {
        window.localStorage.setItem("bp.headers", JSON.stringify(headers));
      };

      const serviceIdForUrl = (url: string): string => {
        try {
          const actionOrigin = new URL(url, window.location.origin).origin;
          for (const root of Array.from(document.querySelectorAll("[data-bp-embedded-root]"))) {
            for (const [serviceId, origin] of Object.entries(parseServices(root))) {
              if (new URL(String(origin)).origin === actionOrigin) return serviceId;
            }
          }
        } catch { /* fall back to legacy auth header */ }
        return "";
      };

      const attachBpHeaders = (headers: Record<string, string>, action: string): void => {
        try {
          const actionOrigin = new URL(action, window.location.origin).origin;
          const targetServiceId = serviceIdForUrl(action);
          const now = Math.floor(Date.now() / 1000);
          for (const [name, entry] of Object.entries(readBpHeaders())) {
            if (!entry || typeof entry.value !== "string") continue;
            if (typeof entry.expires === "number" && entry.expires <= now) continue;
            if (typeof entry.scope === "string" && entry.scope && entry.scope !== targetServiceId) continue;
            if (headers[name] === undefined) headers[name] = entry.value;
          }
          const auth = window.localStorage.getItem("bp:Authorization");
          if (auth && actionOrigin !== window.location.origin) headers.Authorization = auth;
        } catch {
          return;
        }
      };

      const applyBpHeaderDirectives = (response: Response | undefined, requestUrl: string): void => {
        if (!response) return;
        const setRaw = response.headers.get("BP-SetHeader");
        const removeRaw = response.headers.get("BP-RemoveHeader");
        if (!setRaw && !removeRaw) return;

        const responderOrigin = (() => {
          try { return new URL(requestUrl, window.location.origin).origin; } catch { return ""; }
        })();
        const responderId = serviceIdForUrl(requestUrl);
        const responder = responderId || responderOrigin;
        const ownerMatches = (owner: unknown): boolean =>
          typeof owner === "string" && ((!!responderId && owner === responderId) || (!!responderOrigin && owner === responderOrigin));
        const stored = readBpHeaders();
        let changed = false;

        if (setRaw) {
          for (const directive of setRaw.split(/,(?=\s*[^;,=]+=)/)) {
            const [pair, ...attrParts] = directive.split(";");
            const eq = (pair || "").indexOf("=");
            if (eq <= 0) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (!name) continue;

            const existing = stored[name];
            if (existing && existing.locked === true && !ownerMatches(existing.owner)) continue;

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
            if (existing.locked === true && !ownerMatches(existing.owner)) continue;
            delete stored[name];
            changed = true;
          }
        }

        if (changed) writeBpHeaders(stored);
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
        const { origin } = serviceContextFor(el);
        const rawAttr = el.getAttribute(DOWNLOAD_ATTR);
        const rawHref = el.tagName === "A" ? (el.getAttribute("href") || "") : "";
        const raw = ((rawAttr ?? "").trim() || rawHref).trim();
        if (!raw) return "";
        if (isRelativeServicePath(raw)) return origin ? origin + raw : raw;
        try { return new URL(raw, window.location.origin).href; } catch { return ""; }
      };

      const showDownloadError = (el: Element, message: string): void => {
        const outlet = el.closest("[data-bp-main-outlet]");
        if (outlet instanceof HTMLElement) outlet.innerHTML = `<div class="bp-embedded__error">${message}</div>`;
      };

      const downloadBlob = async (el: Element): Promise<void> => {
        if (el.getAttribute("data-bp-download-loading") === "true") return;
        const url = resolveDownloadUrl(el);
        if (!url) return;
        el.setAttribute("data-bp-download-loading", "true");
        const headers: Record<string, string> = {
          Accept: el.getAttribute("hx-accept") || "application/octet-stream"
        };
        attachBpHeaders(headers, url);
        try {
          const response = await fetch(url, { method: "GET", mode: "cors", cache: "no-store", headers });
          applyBpHeaderDirectives(response, url);
          if (!response.ok) {
            showDownloadError(el, `Download failed (${response.status}).`);
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
          showDownloadError(el, "Unable to download file.");
        } finally {
          el.removeAttribute("data-bp-download-loading");
        }
      };

      const bindDownload = (el: Element): void => {
        if (!el.hasAttribute(DOWNLOAD_ATTR) || el.getAttribute("data-bp-download-bound") === "true") return;
        el.setAttribute("data-bp-download-bound", "true");
        el.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void downloadBlob(el);
        });
        const trigger = (el.getAttribute("hx-trigger") || "").toLowerCase();
        if (trigger.split(/[,\s]+/).includes("load")) window.setTimeout(() => void downloadBlob(el), 0);
      };

      document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-bp-embedded-root]").forEach((root) => {
          if (root instanceof Element) {
            resolveRelativeUrls(root);
            void loadBackgroundFragments(root);
          }
        });
      });

      htmx.registerExtension("bp-embedded", {
        htmx_before_init(elt: unknown) {
          if (elt instanceof Element) resolveRelativeUrls(elt);
        },
        htmx_after_process(elt: unknown) {
          if (elt instanceof Element) resolveRelativeUrls(elt);
        },
        htmx_config_request(elt: unknown, detail: any) {
          const ctx = detail.ctx;
          if (!ctx?.request) return;
          const source = ctx.sourceElement instanceof Element
            ? ctx.sourceElement
            : elt instanceof Element
              ? elt
              : null;
          const target = ctx.target;
          const mode = target instanceof Element && target.hasAttribute("data-bp-main-outlet") ? "page" : "fragment";
          const hasAcceptHeader = Object.keys(ctx.request.headers).some((key) => key.toLowerCase() === "accept");
          if (!hasAcceptHeader) {
            ctx.request.headers.Accept = "text/html; theme=embedded; mode=" + mode;
          }
          try {
            const action = ctx.request.action || "";
            const url = new URL(action, window.location.origin);
            if (url.origin === window.location.origin) {
              const { origin } = serviceContextFor(source);
              if (origin) ctx.request.action = origin + url.pathname + url.search;
            }
            attachBpHeaders(ctx.request.headers, ctx.request.action || action);
          } catch {
            return;
          }
        },
        htmx_before_request(_elt: unknown, detail: any) {
          const target = detail.ctx?.target;
          if (target instanceof Element) target.classList.add("bp-embedded__loading");
        },
        htmx_before_swap(_elt: unknown, detail: any) {
          const status = detail.ctx?.response?.status;
          const target = detail.ctx?.target;
          if (status && status >= 400 && target instanceof Element) {
            target.innerHTML = `<div class="bp-embedded__error">Request failed (${status}).</div>`;
            return false;
          }
        },
        htmx_after_request(_elt: unknown, detail: any) {
          applyBpHeaderDirectives(detail.ctx?.response, detail.ctx?.request?.action || "");
        },
        htmx_after_swap(_elt: unknown, detail: any) {
          const target = detail.ctx?.target;
          if (target instanceof Element) {
            target.classList.remove("bp-embedded__loading");
            resolveRelativeUrls(target);
          }
        },
        htmx_error(_elt: unknown, detail: any) {
          const target = detail.ctx?.target;
          if (target instanceof Element) {
            target.classList.remove("bp-embedded__loading");
            target.innerHTML = `<div class="bp-embedded__error">Unable to load embedded content.</div>`;
          }
        }
      });
    })();
  }));
}

export async function loadEmbeddedAsset(assetPath: string): Promise<ThemeAssetResponse | null> {
  const normalized = assetPath.replace(/^\/+/, "");

  if (normalized === "embedded-core.js") {
    if (!AssetCache.has(normalized)) {
      AssetCache.set(
        normalized,
        readTextAsset(HtmxPath, "application/javascript; charset=utf-8").then((asset) => ({
          body: `${asset.body}\n;\n${embeddedRuntimeSource()}`,
          contentType: "application/javascript; charset=utf-8"
        }))
      );
    }
    return AssetCache.get(normalized) ?? null;
  }

  return null;
}
