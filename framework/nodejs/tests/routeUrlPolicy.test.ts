import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectRouteUrlSource, checkProjectRouteUrls } from "../src/codegen/routeUrlPolicy.js";

test("build rejects old helpers and URL payloads even with any-typed contexts", () => {
  for (const source of [
    'export function handler(ctx: any) { ctx.uiRouteUrl("users.index"); }',
    'export function handler(ctx: any) { ctx.url.route("users.index"); }',
    'export function handler(ctx: any) { ctx.routeUrl("users.index", {}); }',
    'import { resolveAppAuthRedirect } from "@betterportal/framework"; export function handler(ctx: any) { const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin"); return { nextUrl }; }',
    'export function handler(ctx: any) { return { destination: ctx.routeUrl() }; }',
    'export function handler(ctx: any) { const target = ctx.routeUrl(); return { endpoint: target.apiPath }; }',
    'export function handler(ctx: any) { const endpoint = ctx.routeUrl()?.absoluteViewPath; return { endpoint: endpoint }; }',
    'export function render() { return `<a href="{users.index}">Users</a>`; }',
    'export const handle = (ctx: any) => ({ anything: ctx.routeUrl()?.apiPath });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => storage.transaction(async tx => ({ endpoint: ctx.routeUrl()?.viewPath })));',
    'export function handle(ctx: any) { const next = ctx.routeUrl()?.viewPath; return { next }; }',
    'export const render = () => <a href="{users.index}">Users</a>;',
  ]) assert.ok(inspectRouteUrlSource("bp-routes/users/GET.tsx", source).length, source);
});

test("build permits renderer resolution, cursors and public domain links", () => {
  for (const source of [
    'export function handler(ctx: any) { return { publicLink: ctx.routeUrl({ viewId: "users.index" })?.absoluteUiPath }; }',
    'export default function linkProps(ctx: any) { return { href: ctx.routeUrl()?.uiPath }; }',
    'export function linkProps(ctx: any) { return { href: ctx.routeUrl()?.uiPath }; } export function render(data, ctx) { return <a {...linkProps(ctx)}>View</a>; }',
    'export function shell(context: any) { return { loginUrl: context.loginUrl, logoutUrl: context.logoutUrl }; }',
    'export function provider() { return { nextUrl: "https://external.test", loginUrl: "https://external.test/login" }; }',
    'export function handler(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); const user = lookup(ctx.query.next); return { name: user.name }; }',
    'export function render(ctx: any) { const endpoint = ctx.routeUrl()?.apiPath; return `<form action="${endpoint}"></form>`; } export function handle() { const endpoint = "domain"; return { endpoint }; }',
    'export function provider(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); return { authorizationUrl: getProviderUrl({ state: next }) }; }',
    'export function handler(ctx: any) { return { available: ctx.routeUrl({ viewId: "reports" }) !== null, same: ctx.routeUrl()?.apiPath === "/reports", ready: !!ctx.routeUrl(), status: ctx.routeUrl() ? "ready" : "missing" }; }',
    'const settings = { nextUrl: "https://provider.test" }; settings.nextUrl;',
    'export function handler() { return { nextCursor: "42", authorizationUrl: "https://provider.test" }; }',
    'export function render(data: any, ctx: any) { const endpoint = ctx.routeUrl({ method: "POST" })?.absoluteApiPath; return `<form action="${endpoint}"></form>`; }'
  ]) assert.deepEqual(inspectRouteUrlSource("fixture.tsx", source), [], source);
});


test("prebuild CLI exits with failure for legacy any-typed route calls", () => {
  const directory = mkdtempSync(join(tmpdir(), "bp-route-check-"));
  try {
    mkdirSync(join(directory, "src"));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "fixture" }));
    writeFileSync(join(directory, "src", "handler.ts"), 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, (ctx: any) => ctx.routeUrl("users.index"));');
    const result = spawnSync(process.execPath, [new URL("../lib/cli/bp.js", import.meta.url).pathname, "run", "check-routes"], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /routeUrl no longer accepts/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("renderer utilities can return route attributes while API callbacks reject internal payloads", () => {
  const source = 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ({ href: ctx.routeUrl()?.uiPath }));';
  assert.deepEqual(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", source), []);
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", source).length);
  const direct = 'const run = ctx => ({ endpoint: ctx.routeUrl()?.apiPath }); export default run;';
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", direct).length);
  assert.deepEqual(inspectRouteUrlSource("rendering/linkProps.ts", direct), []);
  assert.deepEqual(inspectRouteUrlSource("rendering/links.ts", 'export function handle(ctx) { return { href: ctx.routeUrl()?.uiPath }; }'), []);
});


test("legacy field diagnostics follow renderer inputs and aliases with lexical scope", () => {
  const file = "bp-routes/users/_renderer.bootstrap5/GET.tsx";
  for (const source of [
    'export function render(payload: any, ctx: any) { return payload.accountUrl; }',
    'export const render = (payload: any, ctx: any) => payload["nextUrl"];',
    'export function render(payload: any) { const response = payload; const { loginUrl } = response; return loginUrl; }',
    'export function render({ sessionNextUrl }: any) { return sessionNextUrl; }',
    'export function render({ loginUrl: signIn }: any) { return signIn; }',
    'export function render(data: any) { const payload = data as any; const { nextUrl: next } = payload; return next; }',
    'export function render(data: any) { return (data as any).accountUrl; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  const unrelated = 'function follow(data: any) { return data.nextUrl; } function use(result: any) { return result.loginUrl; } function external(response: any) { const { nextUrl } = response; return nextUrl; }';
  assert.deepEqual(inspectRouteUrlSource("providers/oauth.ts", unrelated), []);
  assert.deepEqual(inspectRouteUrlSource(file, unrelated), []);
  assert.deepEqual(inspectRouteUrlSource(file, 'export function render(data: any) { function follow(data: any) { return data.nextUrl; } return follow(provider()); }'), []);
});


test("handler request-building callbacks are separate from response-producing callbacks", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { const descriptors = items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath })); await client(descriptors); return { count: items.length }; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { const descriptors = items.map(() => { return { endpoint: ctx.routeUrl()?.apiPath }; }); await client(descriptors); return { ok: true }; });',
    'export function handler(ctx) { const helper = () => ({ endpoint: ctx.routeUrl()?.viewPath }); client(helper()); return { ok: true }; }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client(items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath }))));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath })));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { return storage.transaction(async tx => ({ endpoint: ctx.routeUrl()?.viewPath })); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => storage.transaction(tx => { return { endpoint: ctx.routeUrl()?.apiPath }; }));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("removed helpers and internal response spreads cannot bypass the authoring gate", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const { uiRouteUrl } = ctx; uiRouteUrl("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const { uiRouteUrl: link } = ctx; link("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { ctx["uiRouteUrl"]("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ({ ...ctx.routeUrl({ viewId: "users" }) }));',
    'export function handler(ctx) { const links = ctx.routeUrl(); return { ...links }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  assert.deepEqual(inspectRouteUrlSource(file, 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const requests = [{ ...ctx.routeUrl() }]; client(requests); return { ok: true }; });'), []);
  assert.deepEqual(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", 'export function linkProps(ctx) { return { ...ctx.routeUrl() }; }'), []);
});


test("direct and mapped handler responses reject internal destinations without rejecting client requests", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ctx.routeUrl());',
    'import { createHandler } from "@betterportal/framework"; export default createHandler.forContext<Extra>()({}, ctx => ctx.routeUrl());',
    'export function handler(ctx) { return ctx.routeUrl({ viewId: "users" }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => ctx.routeUrl()));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const routes = items.map(() => ctx.routeUrl()); return routes; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { return [ctx.routeUrl()]; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.flatMap(() => [ctx.routeUrl()?.apiPath]));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client(() => ctx.routeUrl()?.absoluteApiPath));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => { const endpoint = ctx.routeUrl()?.absoluteApiPath; return client(endpoint); }));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { return { publicLink: ctx.routeUrl()?.absoluteUiPath }; });'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("destructured removed helpers trace handler/render contexts and leave provider models alone", () => {
  for (const source of [
    'const { uiRouteUrl } = providerConfig;',
    'const { uiRouteUrl: providerLink } = providerConfig;',
    'const model = providerConfig; const { uiRouteUrl } = model;',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const model = providerConfig; const { uiRouteUrl } = model; return { value: uiRouteUrl }; });',
    'function provider(ctx) { const { uiRouteUrl } = ctx; return uiRouteUrl; }'
  ]) assert.deepEqual(inspectRouteUrlSource("bp-routes/users/GET.ts", source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const { uiRouteUrl } = request; return uiRouteUrl("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const alias = request as any; const { uiRouteUrl: link } = alias; return link("users"); });',
    'export function handler(request) { const { uiRouteUrl } = request; return uiRouteUrl("users"); }'
  ]) assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", source).length, source);
  assert.ok(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", 'export function render(data, view) { const alias = view; const { uiRouteUrl } = alias; return uiRouteUrl("users"); }').length);
});


test("route call diagnostics and returned destinations trace BP contexts rather than provider method names", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'provider.routeUrl("invoice", options);',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => provider.routeUrl("invoice", options));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => items.map(provider => provider.routeUrl("invoice", options)));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => ({ publicApi: provider.apiPath }));',
    'provider.uiRouteUrl("invoice"); provider.url.route("invoice");'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const alias = request; return alias.routeUrl("users", options); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler.forContext<Extra>()({}, request => request.routeUrl("users"));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const alias = request; return alias.uiRouteUrl("users"); });'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("destructured internal fields and aliased resolvers retain lexical provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const { absoluteApiPath: endpoint } = ctx.routeUrl()!; return { endpoint }; }',
    'export function handler(ctx) { const route = ctx.routeUrl(); const { viewPath } = route; return viewPath; }',
    'export function handler(ctx) { const { routeUrl } = ctx; return routeUrl("users.index"); }',
    'export function handler(ctx) { return ctx.routeUrl({ "absolute": true }); }',
    'export function handler(ctx) { const { routeUrl: link } = ctx; return link("users.index", {}); }',
    'export function handler(ctx) { const link = ctx.routeUrl; const alias = link; return alias("users.index"); }',
    'export function handler(ctx) { const { routeUrl: link } = ctx; return link(); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const { absoluteUiPath: publicLink } = ctx.routeUrl()!; return { publicLink }; }',
    'export function handler(ctx) { return ctx.routeUrl()["absoluteUiPath"]; }',
    'export function handler(ctx) { const { absoluteApiPath: endpoint } = providerConfig; return { endpoint }; }',
    'export function handler(ctx) { const { routeUrl: link } = provider; return link("invoice", options); }',
    'export function handler(ctx) { const { routeUrl } = ctx; function provider(routeUrl) { return routeUrl("invoice", options); } return provider(externalLink); }',
    'export function handler(ctx) { const { routeUrl } = ctx; const { absoluteApiPath } = routeUrl()!; return client(absoluteApiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("known JSON response constructors and promise wrappers preserve payload provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Response.json({ endpoint: ctx.routeUrl()?.absoluteApiPath }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => Promise.resolve(Response.json({ endpoint: ctx.routeUrl()?.viewPath })));',
    'export function handler(ctx) { return new Response(JSON.stringify({ endpoint: ctx.routeUrl()?.apiPath })); }',
    'import { jsonResponse as json } from "@betterportal/framework"; export function handler(ctx) { return json({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'export function handler(ctx) { return Promise.all(items.map(() => ctx.routeUrl())); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Response.json({ publicLink: ctx.routeUrl()?.absoluteUiPath }); }',
    'export function handler(ctx) { return new Response(null, { headers: { "HX-Location": ctx.routeUrl()?.uiPath } }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client({ endpoint: ctx.routeUrl()?.absoluteApiPath }));',
    'export function handler(ctx) { const Response = provider; return Response.json({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'import { jsonResponse as json } from "@betterportal/framework"; export function handler(ctx) { const json = client; return json({ endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("response constructor recognition respects imported and declared domain types", () => {
  for (const source of [
    'import { Response } from "provider"; export function handler(ctx) { return Response.json({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'import * as Promise from "provider"; export function handler(ctx) { return Promise.resolve({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'export function handler(ctx) { class Response { static json(input) { return client(input); } } return Response.json({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'export function handler(ctx) { function JSON() {} return JSON.stringify({ endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource("bp-routes/users/GET.ts", source), [], source);
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", 'import type { Response } from "provider"; export function handler(ctx) { return Response.json({ endpoint: ctx.routeUrl()?.apiPath }); }').length);
});


test("transparent object construction retains internal destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Object.assign({}, { endpoint: ctx.routeUrl()?.absoluteApiPath }); }',
    'export function handler(ctx) { return Object.fromEntries([["endpoint", ctx.routeUrl()?.viewPath]]); }',
    'export function handler(ctx) { return Promise.resolve(Object.assign({}, ctx.routeUrl())); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Object.assign({}, { publicLink: ctx.routeUrl()?.absoluteUiPath }); }',
    'export function handler(ctx) { const Object = client; return Object.assign({}, { endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("context names alone do not turn provider helpers into BP contexts", () => {
  for (const source of [
    'function adapt(ctx: Provider) { return ctx.routeUrl("invoice"); }',
    'const ctx = provider; ctx.routeUrl("invoice"); ctx.uiRouteUrl("invoice");',
    'const context: Provider = provider; context.url.route("invoice");',
    'function adapt(context) { const { routeUrl } = context; return routeUrl("invoice"); }'
  ]) assert.deepEqual(inspectRouteUrlSource("providers/adapter.ts", source), [], source);
  assert.ok(inspectRouteUrlSource("providers/adapter.ts", 'function adapt(request: RouteHandlerContext) { return request.routeUrl("invoice"); }').length);
});


test("standard cloning preserves response provenance without rejecting domain clients", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return structuredClone({ endpoint: ctx.routeUrl()?.absoluteApiPath }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => structuredClone(ctx.routeUrl()));',
    'export function handler(ctx) { const payload = structuredClone({ endpoint: ctx.routeUrl()?.viewPath }); return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return structuredClone({ publicLink: ctx.routeUrl()?.absoluteUiPath }); }',
    'import { structuredClone } from "provider"; export function handler(ctx) { return structuredClone({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'export function handler(ctx) { const structuredClone = client; return structuredClone({ endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array operations preserve returned values without tainting predicate-only URL use", () => {
  const file = "bp-routes/users/GET.ts";
  for (const operation of ['filter(Boolean)', 'slice(0)', 'sort()', 'reverse()', 'toSorted()', 'toReversed()', 'flat()', 'concat([])', 'with(0, "replacement")', 'toSpliced(0, 1)']) {
    const source = `export function handler(ctx) { const endpoints = [ctx.routeUrl()?.apiPath]; return endpoints.${operation}; }`;
    assert.ok(inspectRouteUrlSource(file, source).length, source);
  }
  for (const source of [
    'export function handler(ctx) { return [ctx.routeUrl()?.viewPath].filter(Boolean); }',
    'export function handler(ctx) { return [].concat(ctx.routeUrl()?.absoluteApiPath); }',
    'export function handler(ctx) { return [].with(0, ctx.routeUrl()?.viewPath); }',
    'export function handler(ctx) { return [].toSpliced(0, 0, ctx.routeUrl()?.viewPath); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return [ctx.routeUrl()?.absoluteUiPath].filter(Boolean); }',
    'export function handler(ctx) { return items.filter(() => ctx.routeUrl()?.apiPath !== null); }',
    'export function handler(ctx) { return items.sort(() => ctx.routeUrl() ? 1 : -1); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("incremental response mutations follow aliases and keep request-only objects separate", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const payload = {}; payload.endpoint = ctx.routeUrl()?.apiPath; return payload; }',
    'export function handler(ctx) { const payload = {}; payload["endpoint"] = ctx.routeUrl()?.viewPath; return payload; }',
    'export function handler(ctx) { const payload = {}; const alias = payload; alias.endpoint = ctx.routeUrl()?.absoluteApiPath; return payload; }',
    'export function handler(ctx) { const payload = { items: [] }; const alias = payload.items; alias.push(ctx.routeUrl()?.apiPath); return payload; }',
    'export function handler(ctx) { let endpoint; endpoint = ctx.routeUrl()?.viewPath; return { endpoint }; }',
    'export function handler(ctx) { const payload = {}; if (ctx.query.enabled) { payload.endpoint = ctx.routeUrl()?.viewPath; } return payload; }',
    'export function handler(ctx) { const payload = {}; Object.assign(payload, { endpoint: ctx.routeUrl()?.viewPath }); return payload; }',
    'export function handler(ctx) { const payload = []; payload.push(ctx.routeUrl()?.apiPath); return payload; }',
    'export function handler(ctx) { const payload = []; payload.splice(0, 0, ctx.routeUrl()?.apiPath); return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const payload = {}; payload.publicLink = ctx.routeUrl()?.absoluteUiPath; return payload; }',
    'export function handler(ctx) { const requests = []; requests.push(ctx.routeUrl()?.absoluteApiPath); client(requests); return { ok: true }; }',
    'export function handler(ctx) { const payload = {}; const alias = payload; alias.endpoint = ctx.routeUrl()?.apiPath; return client(payload); }',
    'export function handler(ctx) { const payload = {}; function helper(payload) { payload.endpoint = ctx.routeUrl()?.apiPath; client(payload); } helper({}); return payload; }',
    'export function handler(ctx) { const payload = {}; { const payload = {}; payload.endpoint = ctx.routeUrl()?.apiPath; client(payload); } return payload; }',
    'export function handler(ctx) { const payload = {}; const Object = client; Object.assign(payload, { endpoint: ctx.routeUrl()?.apiPath }); return payload; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("standard array factories preserve URLs while mapped domain results remain valid", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Array.from([ctx.routeUrl()?.apiPath]); }',
    'export function handler(ctx) { return Array.of(ctx.routeUrl()?.viewPath); }',
    'export function handler(ctx) { return new Array(ctx.routeUrl()?.apiPath); }',
    'export function handler(ctx) { return Array.from([ctx.routeUrl()?.apiPath], value => value); }',
    'export function handler(ctx) { return Array.from([ctx.routeUrl()], value => value.apiPath); }',
    'export function handler(ctx) { return Array.from(items, () => { return ctx.routeUrl()?.viewPath; }); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Array.from([ctx.routeUrl()?.absoluteUiPath]); }',
    'export function handler(ctx) { return Array.from([ctx.routeUrl()], value => value.absoluteUiPath); }',
    'export function handler(ctx) { return Array.from([ctx.routeUrl()?.apiPath], value => client(value)); }',
    'export function handler(ctx) { return Array.from([ctx.routeUrl()?.apiPath], () => "ready"); }',
    'import { Array } from "provider"; export function handler(ctx) { return Array.from([ctx.routeUrl()?.apiPath]); }',
    'export function handler(ctx) { const Array = provider; return Array.of(ctx.routeUrl()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("handler factories resolve only framework and generated-runtime imports", () => {
  for (const source of [
    'import { createHandler } from "provider"; export default createHandler({}, ctx => ctx.routeUrl("invoice"));',
    'import { createRawHandler as route } from "provider"; route(ctx => ctx.routeUrl("invoice"));',
    'provider.createStreamHandler(ctx => ctx.uiRouteUrl("invoice"));',
    'import { createHandler } from "@betterportal/framework"; function helper(createHandler) { return createHandler({}, ctx => ctx.routeUrl("invoice")); }',
    'import * as bp from "@betterportal/framework"; function helper(bp) { return bp.createHandler({}, ctx => ctx.routeUrl("invoice")); }',
    'const createSse = provider; createSse({}, ctx => ctx.routeUrl("invoice"));'
  ]) assert.deepEqual(inspectRouteUrlSource("providers/sdk.ts", source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ctx.routeUrl("users"));',
    'import { createHandler as route } from "./.bp-generated/route-runtime.js"; route({}, ctx => ctx.routeUrl("users"));',
    'import * as bp from "@betterportal/framework"; bp.createHandler({}, ctx => ctx.routeUrl("users"));',
    'import { createHandler as route } from "@betterportal/framework"; const handler = route; handler({}, ctx => ctx.routeUrl("users"));',
    'import { createHandler } from "@betterportal/framework"; createHandler.forContext<Extra>()({}, ctx => ctx.routeUrl("users"));'
  ]) assert.ok(inspectRouteUrlSource("helpers/routes.ts", source).length, source);
});


test("standard object/JSON/scalar wrappers retain response URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const expression of [
    'JSON.parse(JSON.stringify({ endpoint: ctx.routeUrl()?.apiPath }))',
    'Object.values({ endpoint: ctx.routeUrl()?.viewPath })',
    'Object.entries({ endpoint: ctx.routeUrl()?.apiPath })',
    'Object.freeze({ endpoint: ctx.routeUrl()?.viewPath })',
    'Object.seal({ endpoint: ctx.routeUrl()?.viewPath })',
    'Object.preventExtensions({ endpoint: ctx.routeUrl()?.viewPath })',
    'String(ctx.routeUrl()?.apiPath)',
    'Object(ctx.routeUrl())',
    'new URL(ctx.routeUrl()?.absoluteApiPath)',
    'new String(ctx.routeUrl()?.apiPath)',
    '[ctx.routeUrl()?.apiPath].join(",")',
    'ctx.routeUrl()?.absoluteApiPath.toString()'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return ${expression}; }`).length, expression);
  for (const source of [
    'export function handler(ctx) { return JSON.parse(JSON.stringify({ publicLink: ctx.routeUrl()?.absoluteUiPath })); }',
    'export function handler(ctx) { return Object.values({ publicLink: ctx.routeUrl()?.absoluteUiPath }); }',
    'import { JSON } from "provider"; export function handler(ctx) { return JSON.parse(ctx.routeUrl()?.apiPath); }',
    'import { String } from "provider"; export function handler(ctx) { return String(ctx.routeUrl()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("provider constructors can consume service destinations and return domain models", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { Response } from "provider"; export function handler(ctx) { return new Response(ctx.routeUrl()?.absoluteApiPath); }',
    'import { Array } from "provider"; export function handler(ctx) { return new Array(ctx.routeUrl()?.absoluteApiPath); }',
    'export function handler(ctx) { const URL = ProviderModel; return new URL(ctx.routeUrl()?.absoluteApiPath); }',
    'export function handler(ctx) { return new ProviderModel(ctx.routeUrl()?.absoluteApiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return new Response(JSON.stringify({ endpoint: ctx.routeUrl()?.apiPath })); }').length);
});


test("standard entry collections retain mutated URLs when serialized", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const fields = new Map(); fields.set("endpoint", ctx.routeUrl()?.apiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { const fields = new Map(); const alias = fields; alias.set("endpoint", ctx.routeUrl()?.apiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { return Object.fromEntries(new Map([["endpoint", ctx.routeUrl()?.apiPath]])); }',
    'export function handler(ctx) { const values = new Set(); values.add(ctx.routeUrl()?.apiPath); return Array.from(values); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const fields = new Map(); fields.set("publicLink", ctx.routeUrl()?.absoluteUiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { const requests = new Map(); requests.set("endpoint", ctx.routeUrl()?.apiPath); return client(requests); }',
    'export function handler(ctx) { const model = new ProviderModel(); model.set("endpoint", ctx.routeUrl()?.apiPath); return model; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("returned promise continuations retain response URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return clientCall.then(() => ({ endpoint: ctx.routeUrl()?.apiPath })); }',
    'export function handler(ctx) { const result = clientCall.then(() => ({ endpoint: ctx.routeUrl()?.apiPath })); return result; }',
    'export function handler(ctx) { return clientCall.catch(() => ({ endpoint: ctx.routeUrl()?.apiPath })); }',
    'export function handler(ctx) { return clientCall.then(() => { return { endpoint: ctx.routeUrl()?.apiPath }; }); }',
    'export function handler(ctx) { return Promise.resolve(ctx.routeUrl()?.apiPath).finally(() => log("done")); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return clientCall.then(() => ({ publicLink: ctx.routeUrl()?.absoluteUiPath })); }',
    'export function handler(ctx) { clientCall.then(() => client(ctx.routeUrl()?.apiPath)); return { ok: true }; }',
    'export function handler(ctx) { return clientCall.finally(() => client(ctx.routeUrl()?.apiPath)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("auth redirects follow framework imports and aliases instead of identifier names", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { resolveAppAuthRedirect } from "provider"; export function handler(ctx) { return resolveAppAuthRedirect(ctx); }',
    'function resolveAppAuthRedirect(ctx) { return "domain"; } export function handler(ctx) { return resolveAppAuthRedirect(ctx); }',
    'import { resolveAppAuthRedirect } from "@betterportal/framework"; export function handler(ctx, resolveAppAuthRedirect) { return resolveAppAuthRedirect(ctx); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'import { resolveAppAuthRedirect as redirect } from "@betterportal/framework"; export function handler(ctx) { return { endpoint: redirect(ctx, "afterLogin") }; }',
    'import * as bp from "@betterportal/framework"; export function handler(ctx) { return bp.resolveAppAuthRedirect(ctx, "afterLogin"); }',
    'import { resolveAppAuthRedirect as redirect } from "@betterportal/framework"; const alias = redirect; export function handler(ctx) { return alias(ctx, "afterLogin"); }',
    'import * as bp from "@betterportal/framework"; const { resolveAppAuthRedirect: redirect } = bp; export function handler(ctx) { return redirect(ctx, "afterLogin"); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("destructured context parameters preserve resolver ownership", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler({ routeUrl }) { return { endpoint: routeUrl()?.apiPath }; }',
    'export function handler({ routeUrl: resolve }) { return { endpoint: resolve()?.viewPath }; }',
    'export function handler({ uiRouteUrl: resolve }) { return { endpoint: resolve("users") }; }',
    'export function handler({ ...ctx }) { return { endpoint: ctx.routeUrl()?.apiPath }; }',
    'import { createHandler } from "@betterportal/framework"; createHandler({}, ({ routeUrl }) => ({ endpoint: routeUrl()?.apiPath }));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'function helper({ routeUrl }) { return { endpoint: routeUrl("provider") }; }',
    'export function handler({ routeUrl }) { return { publicLink: routeUrl()?.absoluteUiPath }; }',
    'export function handler(ctx) { return client({ endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("reductions inspect returned accumulators and initial response values", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return items.reduce(payload => ({ ...payload, endpoint: ctx.routeUrl()?.apiPath }), {}); }',
    'export function handler(ctx) { return items.reduceRight(payload => ({ ...payload, endpoint: ctx.routeUrl()?.apiPath }), {}); }',
    'export function handler(ctx) { const payload = items.reduce(value => { return { endpoint: ctx.routeUrl()?.apiPath }; }, {}); return payload; }',
    'export function handler(ctx) { return items.reduce(() => ({ ok: true }), { endpoint: ctx.routeUrl()?.apiPath }); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return items.reduce(payload => ({ ...payload, publicLink: ctx.routeUrl()?.absoluteUiPath }), {}); }',
    'export function handler(ctx) { const requests = items.reduce(payload => ({ ...payload, endpoint: ctx.routeUrl()?.apiPath }), {}); return client(requests); }',
    'export function handler(ctx) { return items.reduce(payload => ({ count: payload.count + Number(Boolean(ctx.routeUrl()?.apiPath)) }), { count: 0 }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("named and aliased response callbacks are inspected", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); return task.then(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); const alias = build; return task.then(alias); }',
    'export function handler(ctx) { function build() { return { endpoint: ctx.routeUrl()?.apiPath }; } return task.catch(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); return items.map(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); return items.reduce(build, {}); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const build = () => ({ publicLink: ctx.routeUrl()?.absoluteUiPath }); return task.then(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); function helper(build) { return task.then(build); } return helper(providerBuild); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.routeUrl()?.apiPath }); return client(task.then(build)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("transparent iterable constructors retain URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const expression of [
    'Object.fromEntries(new URLSearchParams({ endpoint: ctx.routeUrl()?.apiPath ?? "" }))',
    'Object.fromEntries(new Headers({ endpoint: ctx.routeUrl()?.apiPath ?? "" }))'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return Response.json(${expression}); }`).length, expression);
  for (const source of [
    'export function handler(ctx) { return Object.fromEntries(new URLSearchParams({ publicLink: ctx.routeUrl()?.absoluteUiPath ?? "" })); }',
    'import { URLSearchParams } from "provider"; export function handler(ctx) { return new URLSearchParams(ctx.routeUrl()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("source checks include nested lib and dist helper folders", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-nested-route-check-"));
  try {
    for (const directory of ["src/lib", "src/plugins/example/lib", "src/dist"]) {
      mkdirSync(join(root, directory), { recursive: true });
      writeFileSync(join(root, directory, "helper.ts"), 'import { createHandler } from "@betterportal/framework"; export const handle = createHandler({}, ctx => ctx.routeUrl("legacy"));');
    }
    const issues = checkProjectRouteUrls(join(root, "src"));
    for (const directory of ["src/lib", "src/plugins/example/lib", "src/dist"])
      assert.ok(issues.some(issue => issue.file.startsWith(join(root, directory, "helper.ts"))));
    assert.ok(issues.every(issue => issue.severity === "error"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("returned local response factories and IIFEs retain URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { function payload() { return { endpoint: ctx.routeUrl()?.apiPath }; } return payload(); }',
    'export function handler(ctx) { const payload = () => ({ endpoint: ctx.routeUrl()?.apiPath }); const alias = payload; return alias(); }',
    'export function handler(ctx) { return (() => ({ endpoint: ctx.routeUrl()?.apiPath }))(); }',
    'export function handler(ctx) { return (async function() { return { endpoint: ctx.routeUrl()?.apiPath }; })(); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { function payload() { return { publicLink: ctx.routeUrl()?.absoluteUiPath }; } return payload(); }',
    'export function handler(ctx) { function payload() { return client(ctx.routeUrl()?.apiPath); } return payload(); }',
    'export function handler(ctx) { function recurse() { return recurse(); } return recurse(); }',
    'export function handler(ctx) { const payload = () => ({ endpoint: ctx.routeUrl()?.apiPath }); function helper(payload) { return payload(); } return helper(providerPayload); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("scalar string and collection properties remain domain state", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { pathLength: ctx.routeUrl()?.apiPath.length }; }',
    'export function handler(ctx) { const value = ctx.routeUrl()?.apiPath; return { pathLength: value["length"] }; }',
    'export function handler(ctx) { const paths = [ctx.routeUrl()?.apiPath]; return { count: paths.length }; }',
    'export function handler(ctx) { const paths = new Set([ctx.routeUrl()?.apiPath]); return { count: paths.size }; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return { endpoint: ctx.routeUrl()?.apiPath }; }').length);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { const payload = { length: ctx.routeUrl()?.apiPath }; return { endpoint: payload.length }; }').length);
});


test("named callback parameters retain their caller input provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const asEntry = value => ({ endpoint: value }); return Array.from([ctx.routeUrl()?.apiPath], asEntry); }',
    'export function handler(ctx) { function asEntry(value) { return { endpoint: value }; } const alias = asEntry; return Array.from([ctx.routeUrl()?.apiPath], alias); }',
    'export function handler(ctx) { const asEntry = value => ({ endpoint: value }); return [ctx.routeUrl()?.apiPath].map(asEntry); }',
    'export function handler(ctx) { return Promise.resolve(ctx.routeUrl()?.apiPath).then(value => ({ endpoint: value })); }',
    'export function handler(ctx) { function payload(context) { return { endpoint: context.routeUrl()?.apiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function payload({ routeUrl }) { return { endpoint: routeUrl()?.apiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function payload({ apiPath }) { return { endpoint: apiPath }; } return payload(ctx.routeUrl()); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const asEntry = value => ({ publicLink: value }); return Array.from([ctx.routeUrl()?.absoluteUiPath], asEntry); }',
    'export function handler(ctx) { function length(value) { return { count: value.length }; } return Array.from([ctx.routeUrl()?.apiPath], length); }',
    'export function handler(ctx) { return Promise.resolve(ctx.routeUrl()?.apiPath).then(value => ({ count: value.length })); }',
    'export function handler(ctx) { function payload(context) { return { publicLink: context.routeUrl()?.absoluteUiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function domain(value) { return client(value); } return domain(ctx.routeUrl()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("string transformations preserve response route destinations", () => {
  const file = "bp-routes/users/GET.ts";
  for (const suffix of ['trim()', 'replace("/", "")', 'replaceAll("/", "")', 'toLowerCase()', 'toUpperCase()', 'normalize()', 'substring(1)', 'padEnd(30)', 'split("/")'])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return { endpoint: ctx.routeUrl()?.apiPath.${suffix} }; }`).length, suffix);
  for (const source of [
    'export function handler(ctx) { return { publicLink: ctx.routeUrl()?.absoluteUiPath.trim() }; }',
    'export function handler(ctx) { return { available: ctx.routeUrl()?.apiPath.startsWith("/") }; }',
    'export function handler(ctx) { return { count: ctx.routeUrl()?.apiPath.trim().length }; }',
    'export function handler(ctx) { return client(ctx.routeUrl()?.apiPath.trim()); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("source checks include NodeNext mts and cts modules", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-nodenext-route-check-"));
  try {
    mkdirSync(join(root, "src"));
    for (const extension of ["mts", "cts"])
      writeFileSync(join(root, "src", "helper." + extension), 'import { createHandler } from "@betterportal/framework"; export const handle = createHandler({}, ctx => ctx.routeUrl("legacy"));');
    const issues = checkProjectRouteUrls(join(root, "src"));
    for (const extension of ["mts", "cts"]) assert.ok(issues.some(issue => issue.file.startsWith(join(root, "src", "helper." + extension))));
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("Promise.any retains fulfilled response destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return Promise.any([Promise.resolve({ endpoint: ctx.routeUrl()?.apiPath })]); }').length);
  for (const source of [
    'export function handler(ctx) { return Promise.any([Promise.resolve({ publicLink: ctx.routeUrl()?.absoluteUiPath })]); }',
    'import { Promise } from "provider"; export function handler(ctx) { return Promise.any([ctx.routeUrl()?.apiPath]); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("string replacement values retain their destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { endpoint: "placeholder".replace("placeholder", ctx.routeUrl()?.apiPath ?? "") }; }',
    'export function handler(ctx) { return { endpoint: "placeholder".replaceAll("placeholder", ctx.routeUrl()?.apiPath ?? "") }; }',
    'export function handler(ctx) { const replacement = () => ctx.routeUrl()?.apiPath; return { endpoint: "placeholder".replace("placeholder", replacement) }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return { publicLink: "placeholder".replace("placeholder", ctx.routeUrl()?.absoluteUiPath ?? "") }; }',
    'export function handler(ctx) { return provider.replace("id", ctx.routeUrl()?.apiPath); }',
    'export function handler(ctx) { return "placeholder".replace("placeholder", () => client(ctx.routeUrl()?.apiPath)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array element selection retains destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const operation of ["find(Boolean)", "findLast(Boolean)", "pop()", "shift()"])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return { endpoint: [ctx.routeUrl()?.apiPath].${operation} }; }`).length, operation);
  for (const source of [
    'export function handler(ctx) { return { publicLink: [ctx.routeUrl()?.absoluteUiPath].find(Boolean) }; }',
    'export function handler(ctx) { return ids.find(() => Boolean(ctx.routeUrl()?.apiPath)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("dynamic string-typed replacement receivers are inspected", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const template: string = getPlaceholder(); return { endpoint: template.replace("placeholder", ctx.routeUrl()?.apiPath ?? "") }; }',
    'export function handler(ctx) { const template: string = getPlaceholder(); const alias = template; return { endpoint: alias.replaceAll("placeholder", ctx.routeUrl()?.apiPath ?? "") }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const template: string = getPlaceholder(); return { publicLink: template.replace("placeholder", ctx.routeUrl()?.absoluteUiPath ?? "") }; }',
    'export function handler(ctx) { const template: string = getPlaceholder(); function helper(template: Provider) { return template.replace("id", ctx.routeUrl()?.apiPath); } return helper(provider); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array binding patterns retain selected destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const [endpoint] = [ctx.routeUrl()?.apiPath]; return { endpoint }; }',
    'export function handler(ctx) { const values = [ctx.routeUrl()?.apiPath]; const [endpoint] = values; return { endpoint }; }',
    'export function handler(ctx) { const [, endpoint] = ["domain", ctx.routeUrl()?.apiPath]; return { endpoint }; }',
    'export function handler(ctx) { const [...endpoints] = [ctx.routeUrl()?.apiPath]; return { endpoints }; }',
    'export function handler(ctx) { const [resolve] = [ctx.routeUrl]; return resolve("legacy"); }',
    'export function handler(ctx) { const [context] = [ctx]; return { endpoint: context.routeUrl()?.apiPath }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const [publicLink] = [ctx.routeUrl()?.absoluteUiPath, ctx.routeUrl()?.apiPath]; return { publicLink }; }',
    'export function handler(ctx) { const [endpoint, ...ids] = [ctx.routeUrl()?.apiPath, "domain"]; return { ids }; }',
    'export function handler(ctx) { const [endpoint] = [ctx.routeUrl()?.apiPath]; return client(endpoint); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("string character selection remains scalar state while array selection retains URLs", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { leading: ctx.routeUrl()?.apiPath.charAt(0) }; }',
    'export function handler(ctx) { return { leading: ctx.routeUrl()?.apiPath.at(0) }; }',
    'export function handler(ctx) { const value = ctx.routeUrl()?.apiPath; return { leading: value.at(0) }; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return { endpoint: [ctx.routeUrl()?.apiPath].at(0) }; }').length);
});
