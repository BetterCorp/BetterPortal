import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { js } from "jsx-htmx";
import {
  BETTERPORTAL_HTMX_EXTENSIONS,
  betterPortalChromeAttributes,
  betterPortalShellRuntimeSource,
  buildBetterPortalShellRuntimeAsset
} from "../src/index.js";

test("backend assembles HTMX, shell adapter, shell, and SSE in order", async () => {
  const adapterSource = js(() => {
    (globalThis as typeof globalThis & { __bpShellAdapterLoaded?: boolean }).__bpShellAdapterLoaded = true;
  });
  const marker = "__bpShellAdapterLoaded";
  const asset = await buildBetterPortalShellRuntimeAsset({
    adapterSource
  });
  const source = asset.body;

  assert.ok(source.indexOf("4.0.0-beta6") < source.indexOf(marker));
  assert.ok(source.indexOf(marker) < source.indexOf('registerExtension("bp-shell"'));
  assert.ok(source.indexOf('registerExtension("bp-shell"') < source.lastIndexOf('registerExtension("sse"'));
  assert.doesNotMatch(source, /theme=/);
});

test("shell owns header-aware preload and native API allowlist rewriting", () => {
  const source = betterPortalShellRuntimeSource();

  assert.match(source, /attachBpHeaders\(headers,action\)/);
  assert.match(source, /detail\.ctx\.fetch=.*?preload\.prefetch\.then/);
  assert.match(source, /applyPreloadConfig\(el,bpCfg\).*?bindBpPreload\(el\).*?data-bp-shell-route/s);
  assert.match(source, /matchServiceRoute\(elServiceId,pathOnly,"api"\)/);
  assert.match(source, /configuredMatch=matchTenantRoute\(pathOnly\)/);
  assert.match(source, /match\.route\.servicePath\+match\.suffix/);
  assert.match(source, /el\.setAttribute\("href",tenantUrl\)/);
  assert.match(source, /data-bp-shell-route","api"/);
  assert.doesNotMatch(source, /setAttribute\("hx-push-url",resolvePath\)/);
  assert.equal(BETTERPORTAL_HTMX_EXTENSIONS, "bp-shell, sse");
});

test("shared HTMX requests declare page or partial response mode", () => {
  const source = betterPortalShellRuntimeSource();

  assert.match(source, /acceptValue\.trim\(\)\.toLowerCase\(\)==="text\/html"/);
  assert.match(source, /isSseConnect\|\|!isMainTarget\(ctx\.target\)\?"fragment":"page"/);
  assert.match(source, /isSseConnect\)ctx\.request\.headers\["HX-Request-Type"\]="partial"/);
});

test("service fragment SSE URLs are rewritten before bp-element injection", () => {
  const source = betterPortalShellRuntimeSource();
  assert.ok(source.indexOf("ctx.text=text.replace") < source.indexOf("renderBpElementState(bpElement,detail.ctx.response.status"));
  assert.match(source, /hx-sse:connect\|sse-connect/);
  assert.match(source, /\(\?!\\\/\)/);
});

test("shared shell upgrades native internal navigation with an inherited opt-out", () => {
  const source = betterPortalShellRuntimeSource();

  assert.match(source, /a\[href\], form/);
  assert.match(source, /nativeMethod==="post"\?"hx-post":nativeMethod==="get"\?"hx-get":null/);
  assert.match(source, /isThisReference\(nativeAction\)\|\|isRelativeServicePath\(nativeAction\)/);
  assert.match(source, /\[data-bp-no-route\],\[data-bp-no-override\],\[bp-no-override\]/);
  assert.match(source, /el\.closest\(NO_ROUTE_SELECTOR\)/);
});

test("shell correlates runtime requests with per-document W3C baggage", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /betterportal:session-id/);
  assert.match(source, /data-bp-session-id/);
  assert.match(source, /bp\.session_id=/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /X-BP-Trace-Id/i);
});

test("history restoration uses the shell fragment route pipeline", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /htmx:before:history:restore/);
  assert.match(source, /hx-sync","#bp-main:replace"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /triggerShellLink\(detail\.path,serviceUrl,true\)/);
});

test("history keeps configured tenant routes before reverse-mapping service paths", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /url\.origin===window\.location\.origin\?matchTenantRoute\(url\.pathname\):null/);
});

test("missing root skips auth and identity handlers in menus and page fallbacks", () => {
  const source = betterPortalShellRuntimeSource();
  const code = source.slice(source.indexOf("const redirectMissingRoot"), source.indexOf("const applyConfigToken"));
  const login = { href: "/session/start", requestUrl: "https://shared.test/session/start", serviceId: "provider-123", kind: "page" };
  const logout = { ...login, href: "/session/end", requestUrl: "https://shared.test/session/end" };
  const dashboard = { href: "/dashboard", requestUrl: "https://shared.test/dashboard", serviceId: "app", kind: "page" };
  const api = { ...dashboard, href: "/api", kind: "api" };
  const specialRoutes = [
    { ...login, serviceId: "org.example.auth-default" },
    { ...login, serviceId: "org.example.Identity" },
    { ...login, requestUrl: "https://auth.example.test/session/start" },
    { ...login, requestUrl: "https://identity.example.test/session/start" },
    { ...login, href: "/org.example.auth/profile" },
    { ...login, href: "/login" },
    { ...login, requestUrl: "https://shared.test/logout" },
    { ...login, href: "/sign-in" },
    { ...login, href: "/sign_out" }
  ];
  const ordinary = { ...dashboard, href: "/authors?next=/login", requestUrl: "https://shared.test/authors?next=/identity", serviceId: "authoring" };
  for (const scenario of [
    { name: "menu order", menu: [login, logout, dashboard], routes: [dashboard, login], expected: dashboard },
    { name: "auth-only menu", menu: [login], routes: [login, logout, api, dashboard], expected: dashboard },
    { name: "no menu", menu: [], routes: [login, logout, api, dashboard], expected: dashboard },
    { name: "only auth routes", menu: [login], routes: [login, logout] },
    { name: "no routes", menu: [], routes: [] },
    { name: "no auth configured", menu: [login, dashboard], routes: [login, dashboard], auth: "", expected: login },
    { name: "custom theme login URL", menu: [login, logout, dashboard], routes: [login, logout, dashboard], auth: "", loginUrl: login.requestUrl, expected: dashboard },
    { name: "custom theme page fallback", menu: [], routes: [login, logout, dashboard], auth: "", loginUrl: login.requestUrl, expected: dashboard },
    { name: "custom theme only auth routes", menu: [login], routes: [login, logout], auth: "", loginUrl: login.requestUrl },
    { name: "tenant login URL", menu: [logout, dashboard], routes: [login, logout, dashboard], auth: "", loginUrl: login.href, expected: dashboard },
    { name: "login handler without service metadata", menu: [login, dashboard], routes: [], auth: "", loginUrl: login.requestUrl, expected: dashboard },
    { name: "explicit and inferred auth services", menu: [login, dashboard], routes: [login, dashboard], loginUrl: dashboard.requestUrl },
    { name: "special service and path markers", menu: [...specialRoutes, dashboard], routes: [], auth: "", expected: dashboard },
    { name: "special page fallback markers", menu: [], routes: [...specialRoutes, dashboard], auth: "", expected: dashboard },
    { name: "only special routes", menu: specialRoutes, routes: specialRoutes, auth: "" },
    { name: "query strings and substrings are not markers", menu: [ordinary, dashboard], routes: [], auth: "", expected: ordinary },
    { name: "invalid and self-referencing menu routes", menu: [{ ...dashboard, requestUrl: "http://[" }, { ...dashboard, href: "/" }, dashboard], routes: [], expected: dashboard },
    { name: "explicit root", menu: [login, dashboard], routes: [{ ...login, href: "/" }, dashboard] },
    { name: "non-root navigation", menu: [login, dashboard], routes: [login, dashboard], path: "/sign-in" }
  ]) {
    const redirects: unknown[][] = [];
    runInNewContext(`var __name = f => f; ${code} redirectMissingRoot();`, {
      URL,
      window: { location: { pathname: scenario.path ?? "/", origin: "https://portal.test" } },
      normalizePath: (path: string) => path.replace(/\/+$/, "") || "/",
      configuredRouteFor: (path: string) => scenario.routes.find(route => route.href === path),
      configuredRoutes: () => scenario.routes,
      shellRoot: () => ({ getAttribute: (name: string) => name === "data-bp-auth-service" ? scenario.auth ?? "provider-123" : scenario.loginUrl ?? null }),
      routeLinks: () => scenario.menu.map(route => ({
        closest: () => null,
        hasAttribute: (name: string) => name === "data-bp-route-request",
        getAttribute: (name: string) => ({ href: route.href, "data-bp-route-request": route.requestUrl, "data-bp-service": route.serviceId })[name]
      })),
      triggerShellLink: (...args: unknown[]) => redirects.push(args)
    });
    assert.deepEqual(redirects, scenario.expected ? [[scenario.expected.href, scenario.expected.requestUrl, true]] : [], scenario.name);
  }
});

test("main outlet HTTP errors only swap explicit themed status views", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /mode=status/);
  assert.match(source, /isThemedStatusResponse\(ctx\)/);
  assert.match(source, /htmx_response_error/);
  assert.match(source, /renderRouteError\(errorTitle\(status\),errorMessage\(status\)/);
  assert.match(source, /applyChrome\(null\)/);
});

test("request error overlays inherit the initiating service context", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /serviceContextFor\(source\)\.id/);
  assert.match(source, /showRequestError\(status,content,\{serviceId\}\)/);
});

test("component mutations keep split-pane state and use local error outlets", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /data-bp-split-pane-key/);
  assert.match(source, /target\.closest\("\.bp-split-pane"\)/);
  assert.match(source, /captureSplitPaneState/);
  assert.match(source, /restoreSplitPaneState/);
  assert.match(source, /data-bp-mutation-error/);
  assert.match(source, /localError\.focus/);
});

test("chrome attributes are normalized for initial shell rendering", () => {
  assert.deepEqual(betterPortalChromeAttributes({
    fullScreen: true,
    hide_menu: false,
    density: "compact",
    zoom: 1.25,
    invalid$key: "ignored",
    infinite: Number.POSITIVE_INFINITY
  }), {
    "data-bp-chrome-full-screen": "true",
    "data-bp-chrome-hide-menu": "false",
    "data-bp-chrome-density": "compact",
    "data-bp-chrome-zoom": "1.25"
  });
});

test("shared shell owns generic chrome lifecycle", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /data-bp-chrome-/);
  assert.match(source, /removeAttribute/);
  assert.match(source, /shellAdapter\.applyChrome/);
  assert.doesNotMatch(source, /setChromeFullScreen/);
});

test("shared shell owns bp-element states without browser schema discovery", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /bp-element\[data-bp-element\]/);
  assert.match(source, /statusSpecificity/);
  assert.match(source, /bp:element-retry/);
  assert.match(source, /bpElementStateSwaps\.has\(element\)/);
  assert.match(source, /bpElementStateSwaps\.has\(bpElement\)/);
  assert.match(source, /finally\(\(\)=>bpElementStateSwaps\.delete\(element\)\)/);
  assert.match(source, /states\.ok===void 0\?responseHtml/);
  assert.doesNotMatch(source, /loadBackgroundFragments/);
  assert.doesNotMatch(source, /\.well-known\/bp\/schema\.json/);
});
