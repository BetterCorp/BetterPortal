import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectRouteUrlSource } from "../src/codegen/routeUrlPolicy.js";

test("build rejects old helpers and URL payloads even with any-typed contexts", () => {
  for (const source of [
    'export function handler(ctx: any) { ctx.uiRouteUrl("users.index"); }',
    'export function handler(ctx: any) { ctx.url.route("users.index"); }',
    'export function handler(ctx: any) { ctx.routeUrl("users.index", {}); }',
    'export function handler(ctx: any) { const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin"); return { nextUrl }; }',
    'export function handler(ctx: any) { return { destination: ctx.routeUrl() }; }',
    'export function handler(ctx: any) { const target = ctx.routeUrl(); return { endpoint: target.apiPath }; }',
    'export function handler(ctx: any) { const endpoint = ctx.routeUrl()?.absoluteViewPath; return { endpoint: endpoint }; }',
    'export function render() { return `<a href="{users.index}">Users</a>`; }',
    'export const handle = (ctx: any) => ({ anything: ctx.routeUrl()?.apiPath });',
    'export default createHandler({}, async ctx => storage.transaction(async tx => ({ endpoint: ctx.routeUrl()?.viewPath })));',
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
    writeFileSync(join(directory, "src", "handler.ts"), 'export default createHandler({}, (ctx: any) => ctx.routeUrl("users.index"));');
    const result = spawnSync(process.execPath, [new URL("../lib/cli/bp.js", import.meta.url).pathname, "run", "check-routes"], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /routeUrl no longer accepts/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("renderer utilities can return route attributes while API callbacks reject internal payloads", () => {
  const source = 'export default createHandler({}, ctx => ({ href: ctx.routeUrl()?.uiPath }));';
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
    'export default createHandler({}, async ctx => { const descriptors = items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath })); await client(descriptors); return { count: items.length }; });',
    'export default createHandler({}, async ctx => { const descriptors = items.map(() => { return { endpoint: ctx.routeUrl()?.apiPath }; }); await client(descriptors); return { ok: true }; });',
    'export function handler(ctx) { const helper = () => ({ endpoint: ctx.routeUrl()?.viewPath }); client(helper()); return { ok: true }; }',
    'export default createHandler({}, ctx => client(items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath }))));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'export default createHandler({}, ctx => items.map(() => ({ endpoint: ctx.routeUrl()?.absoluteApiPath })));',
    'export default createHandler({}, async ctx => { return storage.transaction(async tx => ({ endpoint: ctx.routeUrl()?.viewPath })); });',
    'export default createHandler({}, ctx => storage.transaction(tx => { return { endpoint: ctx.routeUrl()?.apiPath }; }));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("removed helpers and internal response spreads cannot bypass the authoring gate", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'const { uiRouteUrl } = ctx; uiRouteUrl("users");',
    'const { uiRouteUrl: link } = ctx; link("users");',
    'ctx["uiRouteUrl"]("users");',
    'export default createHandler({}, ctx => ({ ...ctx.routeUrl({ viewId: "users" }) }));',
    'export function handler(ctx) { const links = ctx.routeUrl(); return { ...links }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  assert.deepEqual(inspectRouteUrlSource(file, 'export default createHandler({}, ctx => { const requests = [{ ...ctx.routeUrl() }]; client(requests); return { ok: true }; });'), []);
  assert.deepEqual(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", 'export function linkProps(ctx) { return { ...ctx.routeUrl() }; }'), []);
});


test("direct and mapped handler responses reject internal destinations without rejecting client requests", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export default createHandler({}, ctx => ctx.routeUrl());',
    'export default createHandler.forContext<Extra>()({}, ctx => ctx.routeUrl());',
    'export function handler(ctx) { return ctx.routeUrl({ viewId: "users" }); }',
    'export default createHandler({}, ctx => items.map(() => ctx.routeUrl()));',
    'export default createHandler({}, ctx => { const routes = items.map(() => ctx.routeUrl()); return routes; });',
    'export default createHandler({}, ctx => { return [ctx.routeUrl()]; });',
    'export default createHandler({}, ctx => items.flatMap(() => [ctx.routeUrl()?.apiPath]));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export default createHandler({}, ctx => client(() => ctx.routeUrl()?.absoluteApiPath));',
    'export default createHandler({}, ctx => items.map(() => { const endpoint = ctx.routeUrl()?.absoluteApiPath; return client(endpoint); }));',
    'export default createHandler({}, ctx => { return { publicLink: ctx.routeUrl()?.absoluteUiPath }; });'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("destructured removed helpers trace handler/render contexts and leave provider models alone", () => {
  for (const source of [
    'const { uiRouteUrl } = providerConfig;',
    'const { uiRouteUrl: providerLink } = providerConfig;',
    'const model = providerConfig; const { uiRouteUrl } = model;',
    'export default createHandler({}, ctx => { const model = providerConfig; const { uiRouteUrl } = model; return { value: uiRouteUrl }; });',
    'function provider(ctx) { const { uiRouteUrl } = ctx; return uiRouteUrl; }'
  ]) assert.deepEqual(inspectRouteUrlSource("bp-routes/users/GET.ts", source), [], source);
  for (const source of [
    'export default createHandler({}, request => { const { uiRouteUrl } = request; return uiRouteUrl("users"); });',
    'export default createHandler({}, request => { const alias = request as any; const { uiRouteUrl: link } = alias; return link("users"); });',
    'export function handler(request) { const { uiRouteUrl } = request; return uiRouteUrl("users"); }'
  ]) assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", source).length, source);
  assert.ok(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", 'export function render(data, view) { const alias = view; const { uiRouteUrl } = alias; return uiRouteUrl("users"); }').length);
});


test("route call diagnostics and returned destinations trace BP contexts rather than provider method names", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'provider.routeUrl("invoice", options);',
    'export default createHandler({}, request => provider.routeUrl("invoice", options));',
    'export default createHandler({}, request => items.map(provider => provider.routeUrl("invoice", options)));',
    'export default createHandler({}, request => ({ publicApi: provider.apiPath }));',
    'provider.uiRouteUrl("invoice"); provider.url.route("invoice");'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'export default createHandler({}, request => { const alias = request; return alias.routeUrl("users", options); });',
    'export default createHandler.forContext<Extra>()({}, request => request.routeUrl("users"));',
    'export default createHandler({}, request => { const alias = request; return alias.uiRouteUrl("users"); });'
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
    'export default createHandler({}, ctx => Promise.resolve(Response.json({ endpoint: ctx.routeUrl()?.viewPath })));',
    'export function handler(ctx) { return new Response(JSON.stringify({ endpoint: ctx.routeUrl()?.apiPath })); }',
    'import { jsonResponse as json } from "@betterportal/framework"; export function handler(ctx) { return json({ endpoint: ctx.routeUrl()?.apiPath }); }',
    'export function handler(ctx) { return Promise.all(items.map(() => ctx.routeUrl())); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Response.json({ publicLink: ctx.routeUrl()?.absoluteUiPath }); }',
    'export function handler(ctx) { return new Response(null, { headers: { "HX-Location": ctx.routeUrl()?.uiPath } }); }',
    'export default createHandler({}, ctx => client({ endpoint: ctx.routeUrl()?.absoluteApiPath }));',
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
