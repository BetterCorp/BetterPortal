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
    'export function handler(ctx: any) { ctx.route("users.index", {}); }',
    'import { resolveAppAuthRedirect } from "@betterportal/framework"; export function handler(ctx: any) { const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin"); return { nextUrl }; }',
    'export function handler(ctx: any) { return { destination: ctx.route() }; }',
    'export function handler(ctx: any) { const target = ctx.route(); return { endpoint: target.apiPath }; }',
    'export function handler(ctx: any) { const endpoint = ctx.route()?.absoluteViewPath; return { endpoint: endpoint }; }',
    'export function render() { return `<a href="{users.index}">Users</a>`; }',
    'export const handle = (ctx: any) => ({ anything: ctx.route()?.apiPath });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => storage.transaction(async tx => ({ endpoint: ctx.route()?.viewPath })));',
    'export function handle(ctx: any) { const next = ctx.route()?.viewPath; return { next }; }',
    'export const render = () => <a href="{users.index}">Users</a>;',
  ]) assert.ok(inspectRouteUrlSource("bp-routes/users/GET.tsx", source).length, source);
});

test("build permits renderer resolution, cursors and public domain links", () => {
  for (const source of [
    'export function handler(ctx: any) { return { publicLink: ctx.route({ viewId: "users.index" })?.absoluteUiPath }; }',
    'export default function linkProps(ctx: any) { return { href: ctx.route()?.uiPath }; }',
    'export function linkProps(ctx: any) { return { href: ctx.route()?.uiPath }; } export function render(data, ctx) { return <a {...linkProps(ctx)}>View</a>; }',
    'export function shell(context: any) { return { loginUrl: context.loginUrl, logoutUrl: context.logoutUrl }; }',
    'export function provider() { return { nextUrl: "https://external.test", loginUrl: "https://external.test/login" }; }',
    'export function handler(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); const user = lookup(ctx.query.next); return { name: user.name }; }',
    'export function render(ctx: any) { const endpoint = ctx.route()?.apiPath; return `<form action="${endpoint}"></form>`; } export function handle() { const endpoint = "domain"; return { endpoint }; }',
    'export function provider(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); return { authorizationUrl: getProviderUrl({ state: next }) }; }',
    'export function handler(ctx: any) { return { available: ctx.route({ viewId: "reports" }) !== null, same: ctx.route()?.apiPath === "/reports", ready: !!ctx.route(), status: ctx.route() ? "ready" : "missing" }; }',
    'const settings = { nextUrl: "https://provider.test" }; settings.nextUrl;',
    'export function handler() { return { nextCursor: "42", authorizationUrl: "https://provider.test" }; }',
    'export function render(data: any, ctx: any) { const endpoint = ctx.route({ method: "POST" })?.absoluteApiPath; return `<form action="${endpoint}"></form>`; }'
  ]) assert.deepEqual(inspectRouteUrlSource("fixture.tsx", source), [], source);
});


test("prebuild CLI exits with failure for legacy any-typed route calls", () => {
  const directory = mkdtempSync(join(tmpdir(), "bp-route-check-"));
  try {
    mkdirSync(join(directory, "src"));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "fixture" }));
    writeFileSync(join(directory, "src", "handler.ts"), 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, (ctx: any) => ctx.route("users.index"));');
    const result = spawnSync(process.execPath, [new URL("../lib/cli/bp.js", import.meta.url).pathname, "run", "check-routes"], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /route no longer accepts/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("renderer utilities can return route attributes while API callbacks reject internal payloads", () => {
  const source = 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ({ href: ctx.route()?.uiPath }));';
  assert.deepEqual(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", source), []);
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", source).length);
  const direct = 'const run = ctx => ({ endpoint: ctx.route()?.apiPath }); export default run;';
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", direct).length);
  assert.deepEqual(inspectRouteUrlSource("rendering/linkProps.ts", direct), []);
  assert.deepEqual(inspectRouteUrlSource("rendering/links.ts", 'export function handle(ctx) { return { href: ctx.route()?.uiPath }; }'), []);
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
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { const descriptors = items.map(() => ({ endpoint: ctx.route()?.absoluteApiPath })); await client(descriptors); return { count: items.length }; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { const descriptors = items.map(() => { return { endpoint: ctx.route()?.apiPath }; }); await client(descriptors); return { ok: true }; });',
    'export function handler(ctx) { const helper = () => ({ endpoint: ctx.route()?.viewPath }); client(helper()); return { ok: true }; }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client(items.map(() => ({ endpoint: ctx.route()?.absoluteApiPath }))));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => ({ endpoint: ctx.route()?.absoluteApiPath })));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, async ctx => { return storage.transaction(async tx => ({ endpoint: ctx.route()?.viewPath })); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => storage.transaction(tx => { return { endpoint: ctx.route()?.apiPath }; }));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("removed helpers and internal response spreads cannot bypass the authoring gate", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const { uiRouteUrl } = ctx; uiRouteUrl("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const { uiRouteUrl: link } = ctx; link("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { ctx["uiRouteUrl"]("users"); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ({ ...ctx.route({ viewId: "users" }) }));',
    'export function handler(ctx) { const links = ctx.route(); return { ...links }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  assert.deepEqual(inspectRouteUrlSource(file, 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const requests = [{ ...ctx.route() }]; client(requests); return { ok: true }; });'), []);
  assert.deepEqual(inspectRouteUrlSource("bp-routes/users/_renderer.bootstrap5/GET.tsx", 'export function linkProps(ctx) { return { ...ctx.route() }; }'), []);
});


test("direct and mapped handler responses reject internal destinations without rejecting client requests", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ctx.route());',
    'import { createHandler } from "@betterportal/framework"; export default createHandler.forContext<Extra>()({}, ctx => ctx.route());',
    'export function handler(ctx) { return ctx.route({ viewId: "users" }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => ctx.route()));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { const routes = items.map(() => ctx.route()); return routes; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { return [ctx.route()]; });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.flatMap(() => [ctx.route()?.apiPath]));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client(() => ctx.route()?.absoluteApiPath));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => items.map(() => { const endpoint = ctx.route()?.absoluteApiPath; return client(endpoint); }));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => { return { publicLink: ctx.route()?.absoluteUiPath }; });'
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
    'provider.route("invoice", options);',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => provider.route("invoice", options));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => items.map(provider => provider.route("invoice", options)));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => ({ publicApi: provider.apiPath }));',
    'provider.uiRouteUrl("invoice"); provider.url.route("invoice");'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const alias = request; return alias.route("users", options); });',
    'import { createHandler } from "@betterportal/framework"; export default createHandler.forContext<Extra>()({}, request => request.route("users"));',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, request => { const alias = request; return alias.uiRouteUrl("users"); });'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
});


test("destructured internal fields and aliased resolvers retain lexical provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const { absoluteApiPath: endpoint } = ctx.route()!; return { endpoint }; }',
    'export function handler(ctx) { const route = ctx.route(); const { viewPath } = route; return viewPath; }',
    'export function handler(ctx) { const { route } = ctx; return route("users.index"); }',
    'export function handler(ctx) { return ctx.route({ "absolute": true }); }',
    'export function handler(ctx) { const { route: link } = ctx; return link("users.index", {}); }',
    'export function handler(ctx) { const link = ctx.route; const alias = link; return alias("users.index"); }',
    'export function handler(ctx) { const { route: link } = ctx; return link(); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const { absoluteUiPath: publicLink } = ctx.route()!; return { publicLink }; }',
    'export function handler(ctx) { return ctx.route()["absoluteUiPath"]; }',
    'export function handler(ctx) { const { absoluteApiPath: endpoint } = providerConfig; return { endpoint }; }',
    'export function handler(ctx) { const { route: link } = provider; return link("invoice", options); }',
    'export function handler(ctx) { const { route } = ctx; function provider(route) { return route("invoice", options); } return provider(externalLink); }',
    'export function handler(ctx) { const { route } = ctx; const { absoluteApiPath } = route()!; return client(absoluteApiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("known JSON response constructors and promise wrappers preserve payload provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Response.json({ endpoint: ctx.route()?.absoluteApiPath }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => Promise.resolve(Response.json({ endpoint: ctx.route()?.viewPath })));',
    'export function handler(ctx) { return new Response(JSON.stringify({ endpoint: ctx.route()?.apiPath })); }',
    'import { jsonResponse as json } from "@betterportal/framework"; export function handler(ctx) { return json({ endpoint: ctx.route()?.apiPath }); }',
    'export function handler(ctx) { return Promise.all(items.map(() => ctx.route())); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Response.json({ publicLink: ctx.route()?.absoluteUiPath }); }',
    'export function handler(ctx) { return new Response(null, { headers: { "HX-Location": ctx.route()?.uiPath } }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => client({ endpoint: ctx.route()?.absoluteApiPath }));',
    'export function handler(ctx) { const Response = provider; return Response.json({ endpoint: ctx.route()?.apiPath }); }',
    'import { jsonResponse as json } from "@betterportal/framework"; export function handler(ctx) { const json = client; return json({ endpoint: ctx.route()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("response constructor recognition respects imported and declared domain types", () => {
  for (const source of [
    'import { Response } from "provider"; export function handler(ctx) { return Response.json({ endpoint: ctx.route()?.apiPath }); }',
    'import * as Promise from "provider"; export function handler(ctx) { return Promise.resolve({ endpoint: ctx.route()?.apiPath }); }',
    'export function handler(ctx) { class Response { static json(input) { return client(input); } } return Response.json({ endpoint: ctx.route()?.apiPath }); }',
    'export function handler(ctx) { function JSON() {} return JSON.stringify({ endpoint: ctx.route()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource("bp-routes/users/GET.ts", source), [], source);
  assert.ok(inspectRouteUrlSource("bp-routes/users/GET.ts", 'import type { Response } from "provider"; export function handler(ctx) { return Response.json({ endpoint: ctx.route()?.apiPath }); }').length);
});


test("transparent object construction retains internal destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Object.assign({}, { endpoint: ctx.route()?.absoluteApiPath }); }',
    'export function handler(ctx) { return Object.fromEntries([["endpoint", ctx.route()?.viewPath]]); }',
    'export function handler(ctx) { return Promise.resolve(Object.assign({}, ctx.route())); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Object.assign({}, { publicLink: ctx.route()?.absoluteUiPath }); }',
    'export function handler(ctx) { const Object = client; return Object.assign({}, { endpoint: ctx.route()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("context names alone do not turn provider helpers into BP contexts", () => {
  for (const source of [
    'function adapt(ctx: Provider) { return ctx.route("invoice"); }',
    'const ctx = provider; ctx.route("invoice"); ctx.uiRouteUrl("invoice");',
    'const context: Provider = provider; context.url.route("invoice");',
    'function adapt(context) { const { route } = context; return route("invoice"); }'
  ]) assert.deepEqual(inspectRouteUrlSource("providers/adapter.ts", source), [], source);
  assert.ok(inspectRouteUrlSource("providers/adapter.ts", 'function adapt(request: RouteHandlerContext) { return request.route("invoice"); }').length);
});


test("standard cloning preserves response provenance without rejecting domain clients", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return structuredClone({ endpoint: ctx.route()?.absoluteApiPath }); }',
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => structuredClone(ctx.route()));',
    'export function handler(ctx) { const payload = structuredClone({ endpoint: ctx.route()?.viewPath }); return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return structuredClone({ publicLink: ctx.route()?.absoluteUiPath }); }',
    'import { structuredClone } from "provider"; export function handler(ctx) { return structuredClone({ endpoint: ctx.route()?.apiPath }); }',
    'export function handler(ctx) { const structuredClone = client; return structuredClone({ endpoint: ctx.route()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array operations preserve returned values without tainting predicate-only URL use", () => {
  const file = "bp-routes/users/GET.ts";
  for (const operation of ['filter(Boolean)', 'slice(0)', 'sort()', 'reverse()', 'toSorted()', 'toReversed()', 'flat()', 'concat([])', 'with(0, "replacement")', 'toSpliced(0, 1)']) {
    const source = `export function handler(ctx) { const endpoints = [ctx.route()?.apiPath]; return endpoints.${operation}; }`;
    assert.ok(inspectRouteUrlSource(file, source).length, source);
  }
  for (const source of [
    'export function handler(ctx) { return [ctx.route()?.viewPath].filter(Boolean); }',
    'export function handler(ctx) { return [].concat(ctx.route()?.absoluteApiPath); }',
    'export function handler(ctx) { return [].with(0, ctx.route()?.viewPath); }',
    'export function handler(ctx) { return [].toSpliced(0, 0, ctx.route()?.viewPath); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return [ctx.route()?.absoluteUiPath].filter(Boolean); }',
    'export function handler(ctx) { return items.filter(() => ctx.route()?.apiPath !== null); }',
    'export function handler(ctx) { return items.sort(() => ctx.route() ? 1 : -1); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("incremental response mutations follow aliases and keep request-only objects separate", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const payload = {}; payload.endpoint = ctx.route()?.apiPath; return payload; }',
    'export function handler(ctx) { const payload = {}; payload["endpoint"] = ctx.route()?.viewPath; return payload; }',
    'export function handler(ctx) { const payload = {}; const alias = payload; alias.endpoint = ctx.route()?.absoluteApiPath; return payload; }',
    'export function handler(ctx) { const payload = { items: [] }; const alias = payload.items; alias.push(ctx.route()?.apiPath); return payload; }',
    'export function handler(ctx) { let endpoint; endpoint = ctx.route()?.viewPath; return { endpoint }; }',
    'export function handler(ctx) { const payload = {}; if (ctx.query.enabled) { payload.endpoint = ctx.route()?.viewPath; } return payload; }',
    'export function handler(ctx) { const payload = {}; Object.assign(payload, { endpoint: ctx.route()?.viewPath }); return payload; }',
    'export function handler(ctx) { const payload = []; payload.push(ctx.route()?.apiPath); return payload; }',
    'export function handler(ctx) { const payload = []; payload.splice(0, 0, ctx.route()?.apiPath); return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const payload = {}; payload.publicLink = ctx.route()?.absoluteUiPath; return payload; }',
    'export function handler(ctx) { const requests = []; requests.push(ctx.route()?.absoluteApiPath); client(requests); return { ok: true }; }',
    'export function handler(ctx) { const payload = {}; const alias = payload; alias.endpoint = ctx.route()?.apiPath; return client(payload); }',
    'export function handler(ctx) { const payload = {}; function helper(payload) { payload.endpoint = ctx.route()?.apiPath; client(payload); } helper({}); return payload; }',
    'export function handler(ctx) { const payload = {}; { const payload = {}; payload.endpoint = ctx.route()?.apiPath; client(payload); } return payload; }',
    'export function handler(ctx) { const payload = {}; const Object = client; Object.assign(payload, { endpoint: ctx.route()?.apiPath }); return payload; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("standard array factories preserve URLs while mapped domain results remain valid", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return Array.from([ctx.route()?.apiPath]); }',
    'export function handler(ctx) { return Array.of(ctx.route()?.viewPath); }',
    'export function handler(ctx) { return new Array(ctx.route()?.apiPath); }',
    'export function handler(ctx) { return Array.from([ctx.route()?.apiPath], value => value); }',
    'export function handler(ctx) { return Array.from([ctx.route()], value => value.apiPath); }',
    'export function handler(ctx) { return Array.from(items, () => { return ctx.route()?.viewPath; }); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return Array.from([ctx.route()?.absoluteUiPath]); }',
    'export function handler(ctx) { return Array.from([ctx.route()], value => value.absoluteUiPath); }',
    'export function handler(ctx) { return Array.from([ctx.route()?.apiPath], value => client(value)); }',
    'export function handler(ctx) { return Array.from([ctx.route()?.apiPath], () => "ready"); }',
    'import { Array } from "provider"; export function handler(ctx) { return Array.from([ctx.route()?.apiPath]); }',
    'export function handler(ctx) { const Array = provider; return Array.of(ctx.route()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("handler factories resolve only framework and generated-runtime imports", () => {
  for (const source of [
    'import { createHandler } from "provider"; export default createHandler({}, ctx => ctx.route("invoice"));',
    'import { createRawHandler as route } from "provider"; route(ctx => ctx.route("invoice"));',
    'provider.createStreamHandler(ctx => ctx.uiRouteUrl("invoice"));',
    'import { createHandler } from "@betterportal/framework"; function helper(createHandler) { return createHandler({}, ctx => ctx.route("invoice")); }',
    'import * as bp from "@betterportal/framework"; function helper(bp) { return bp.createHandler({}, ctx => ctx.route("invoice")); }',
    'const createSse = provider; createSse({}, ctx => ctx.route("invoice"));'
  ]) assert.deepEqual(inspectRouteUrlSource("providers/sdk.ts", source), [], source);
  for (const source of [
    'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ctx.route("users"));',
    'import { createHandler as route } from "./.bp-generated/route-runtime.js"; route({}, ctx => ctx.route("users"));',
    'import * as bp from "@betterportal/framework"; bp.createHandler({}, ctx => ctx.route("users"));',
    'import { createHandler as route } from "@betterportal/framework"; const handler = route; handler({}, ctx => ctx.route("users"));',
    'import { createHandler } from "@betterportal/framework"; createHandler.forContext<Extra>()({}, ctx => ctx.route("users"));'
  ]) assert.ok(inspectRouteUrlSource("helpers/routes.ts", source).length, source);
});


test("standard object/JSON/scalar wrappers retain response URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const expression of [
    'JSON.parse(JSON.stringify({ endpoint: ctx.route()?.apiPath }))',
    'Object.values({ endpoint: ctx.route()?.viewPath })',
    'Object.entries({ endpoint: ctx.route()?.apiPath })',
    'Object.freeze({ endpoint: ctx.route()?.viewPath })',
    'Object.seal({ endpoint: ctx.route()?.viewPath })',
    'Object.preventExtensions({ endpoint: ctx.route()?.viewPath })',
    'String(ctx.route()?.apiPath)',
    'Object(ctx.route())',
    'new URL(ctx.route()?.absoluteApiPath)',
    'new String(ctx.route()?.apiPath)',
    '[ctx.route()?.apiPath].join(",")',
    'ctx.route()?.absoluteApiPath.toString()'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return ${expression}; }`).length, expression);
  for (const source of [
    'export function handler(ctx) { return JSON.parse(JSON.stringify({ publicLink: ctx.route()?.absoluteUiPath })); }',
    'export function handler(ctx) { return Object.values({ publicLink: ctx.route()?.absoluteUiPath }); }',
    'import { JSON } from "provider"; export function handler(ctx) { return JSON.parse(ctx.route()?.apiPath); }',
    'import { String } from "provider"; export function handler(ctx) { return String(ctx.route()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("provider constructors can consume service destinations and return domain models", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { Response } from "provider"; export function handler(ctx) { return new Response(ctx.route()?.absoluteApiPath); }',
    'import { Array } from "provider"; export function handler(ctx) { return new Array(ctx.route()?.absoluteApiPath); }',
    'export function handler(ctx) { const URL = ProviderModel; return new URL(ctx.route()?.absoluteApiPath); }',
    'export function handler(ctx) { return new ProviderModel(ctx.route()?.absoluteApiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return new Response(JSON.stringify({ endpoint: ctx.route()?.apiPath })); }').length);
});


test("standard entry collections retain mutated URLs when serialized", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const fields = new Map(); fields.set("endpoint", ctx.route()?.apiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { const fields = new Map(); const alias = fields; alias.set("endpoint", ctx.route()?.apiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { return Object.fromEntries(new Map([["endpoint", ctx.route()?.apiPath]])); }',
    'export function handler(ctx) { const values = new Set(); values.add(ctx.route()?.apiPath); return Array.from(values); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const fields = new Map(); fields.set("publicLink", ctx.route()?.absoluteUiPath); return Object.fromEntries(fields); }',
    'export function handler(ctx) { const requests = new Map(); requests.set("endpoint", ctx.route()?.apiPath); return client(requests); }',
    'export function handler(ctx) { const model = new ProviderModel(); model.set("endpoint", ctx.route()?.apiPath); return model; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("returned promise continuations retain response URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return clientCall.then(() => ({ endpoint: ctx.route()?.apiPath })); }',
    'export function handler(ctx) { const result = clientCall.then(() => ({ endpoint: ctx.route()?.apiPath })); return result; }',
    'export function handler(ctx) { return clientCall.catch(() => ({ endpoint: ctx.route()?.apiPath })); }',
    'export function handler(ctx) { return clientCall.then(() => { return { endpoint: ctx.route()?.apiPath }; }); }',
    'export function handler(ctx) { return Promise.resolve(ctx.route()?.apiPath).finally(() => log("done")); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return clientCall.then(() => ({ publicLink: ctx.route()?.absoluteUiPath })); }',
    'export function handler(ctx) { clientCall.then(() => client(ctx.route()?.apiPath)); return { ok: true }; }',
    'export function handler(ctx) { return clientCall.finally(() => client(ctx.route()?.apiPath)); }'
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
    'export function handler({ route }) { return { endpoint: route()?.apiPath }; }',
    'export function handler({ route: resolve }) { return { endpoint: resolve()?.viewPath }; }',
    'export function handler({ uiRouteUrl: resolve }) { return { endpoint: resolve("users") }; }',
    'export function handler({ ...ctx }) { return { endpoint: ctx.route()?.apiPath }; }',
    'import { createHandler } from "@betterportal/framework"; createHandler({}, ({ route }) => ({ endpoint: route()?.apiPath }));'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'function helper({ route }) { return { endpoint: route("provider") }; }',
    'export function handler({ route }) { return { publicLink: route()?.absoluteUiPath }; }',
    'export function handler(ctx) { return client({ endpoint: ctx.route()?.apiPath }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("reductions inspect returned accumulators and initial response values", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return items.reduce(payload => ({ ...payload, endpoint: ctx.route()?.apiPath }), {}); }',
    'export function handler(ctx) { return items.reduceRight(payload => ({ ...payload, endpoint: ctx.route()?.apiPath }), {}); }',
    'export function handler(ctx) { const payload = items.reduce(value => { return { endpoint: ctx.route()?.apiPath }; }, {}); return payload; }',
    'export function handler(ctx) { return items.reduce(() => ({ ok: true }), { endpoint: ctx.route()?.apiPath }); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return items.reduce(payload => ({ ...payload, publicLink: ctx.route()?.absoluteUiPath }), {}); }',
    'export function handler(ctx) { const requests = items.reduce(payload => ({ ...payload, endpoint: ctx.route()?.apiPath }), {}); return client(requests); }',
    'export function handler(ctx) { return items.reduce(payload => ({ count: payload.count + Number(Boolean(ctx.route()?.apiPath)) }), { count: 0 }); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("named and aliased response callbacks are inspected", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); return task.then(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); const alias = build; return task.then(alias); }',
    'export function handler(ctx) { function build() { return { endpoint: ctx.route()?.apiPath }; } return task.catch(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); return items.map(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); return items.reduce(build, {}); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const build = () => ({ publicLink: ctx.route()?.absoluteUiPath }); return task.then(build); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); function helper(build) { return task.then(build); } return helper(providerBuild); }',
    'export function handler(ctx) { const build = () => ({ endpoint: ctx.route()?.apiPath }); return client(task.then(build)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("transparent iterable constructors retain URL provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const expression of [
    'Object.fromEntries(new URLSearchParams({ endpoint: ctx.route()?.apiPath ?? "" }))',
    'Object.fromEntries(new Headers({ endpoint: ctx.route()?.apiPath ?? "" }))'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return Response.json(${expression}); }`).length, expression);
  for (const source of [
    'export function handler(ctx) { return Object.fromEntries(new URLSearchParams({ publicLink: ctx.route()?.absoluteUiPath ?? "" })); }',
    'import { URLSearchParams } from "provider"; export function handler(ctx) { return new URLSearchParams(ctx.route()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("source checks include nested lib and dist helper folders", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-nested-route-check-"));
  try {
    for (const directory of ["src/lib", "src/plugins/example/lib", "src/dist"]) {
      mkdirSync(join(root, directory), { recursive: true });
      writeFileSync(join(root, directory, "helper.ts"), 'import { createHandler } from "@betterportal/framework"; export const handle = createHandler({}, ctx => ctx.route("legacy"));');
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
    'export function handler(ctx) { function payload() { return { endpoint: ctx.route()?.apiPath }; } return payload(); }',
    'export function handler(ctx) { const payload = () => ({ endpoint: ctx.route()?.apiPath }); const alias = payload; return alias(); }',
    'export function handler(ctx) { return (() => ({ endpoint: ctx.route()?.apiPath }))(); }',
    'export function handler(ctx) { return (async function() { return { endpoint: ctx.route()?.apiPath }; })(); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { function payload() { return { publicLink: ctx.route()?.absoluteUiPath }; } return payload(); }',
    'export function handler(ctx) { function payload() { return client(ctx.route()?.apiPath); } return payload(); }',
    'export function handler(ctx) { function recurse() { return recurse(); } return recurse(); }',
    'export function handler(ctx) { const payload = () => ({ endpoint: ctx.route()?.apiPath }); function helper(payload) { return payload(); } return helper(providerPayload); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("scalar string and collection properties remain domain state", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { pathLength: ctx.route()?.apiPath.length }; }',
    'export function handler(ctx) { const value = ctx.route()?.apiPath; return { pathLength: value["length"] }; }',
    'export function handler(ctx) { const paths = [ctx.route()?.apiPath]; return { count: paths.length }; }',
    'export function handler(ctx) { const paths = new Set([ctx.route()?.apiPath]); return { count: paths.size }; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return { endpoint: ctx.route()?.apiPath }; }').length);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { const payload = { length: ctx.route()?.apiPath }; return { endpoint: payload.length }; }').length);
});


test("named callback parameters retain their caller input provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const asEntry = value => ({ endpoint: value }); return Array.from([ctx.route()?.apiPath], asEntry); }',
    'export function handler(ctx) { function asEntry(value) { return { endpoint: value }; } const alias = asEntry; return Array.from([ctx.route()?.apiPath], alias); }',
    'export function handler(ctx) { const asEntry = value => ({ endpoint: value }); return [ctx.route()?.apiPath].map(asEntry); }',
    'export function handler(ctx) { return Promise.resolve(ctx.route()?.apiPath).then(value => ({ endpoint: value })); }',
    'export function handler(ctx) { function payload(context) { return { endpoint: context.route()?.apiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function payload({ route }) { return { endpoint: route()?.apiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function payload({ apiPath }) { return { endpoint: apiPath }; } return payload(ctx.route()); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const asEntry = value => ({ publicLink: value }); return Array.from([ctx.route()?.absoluteUiPath], asEntry); }',
    'export function handler(ctx) { function length(value) { return { count: value.length }; } return Array.from([ctx.route()?.apiPath], length); }',
    'export function handler(ctx) { return Promise.resolve(ctx.route()?.apiPath).then(value => ({ count: value.length })); }',
    'export function handler(ctx) { function payload(context) { return { publicLink: context.route()?.absoluteUiPath }; } return payload(ctx); }',
    'export function handler(ctx) { function domain(value) { return client(value); } return domain(ctx.route()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("string transformations preserve response route destinations", () => {
  const file = "bp-routes/users/GET.ts";
  for (const suffix of ['trim()', 'replace("/", "")', 'replaceAll("/", "")', 'toLowerCase()', 'toUpperCase()', 'normalize()', 'substring(1)', 'padEnd(30)', 'split("/")'])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return { endpoint: ctx.route()?.apiPath.${suffix} }; }`).length, suffix);
  for (const source of [
    'export function handler(ctx) { return { publicLink: ctx.route()?.absoluteUiPath.trim() }; }',
    'export function handler(ctx) { return { available: ctx.route()?.apiPath.startsWith("/") }; }',
    'export function handler(ctx) { return { count: ctx.route()?.apiPath.trim().length }; }',
    'export function handler(ctx) { return client(ctx.route()?.apiPath.trim()); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("source checks include NodeNext mts and cts modules", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-nodenext-route-check-"));
  try {
    mkdirSync(join(root, "src"));
    for (const extension of ["mts", "cts"])
      writeFileSync(join(root, "src", "helper." + extension), 'import { createHandler } from "@betterportal/framework"; export const handle = createHandler({}, ctx => ctx.route("legacy"));');
    const issues = checkProjectRouteUrls(join(root, "src"));
    for (const extension of ["mts", "cts"]) assert.ok(issues.some(issue => issue.file.startsWith(join(root, "src", "helper." + extension))));
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("Promise.any retains fulfilled response destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return Promise.any([Promise.resolve({ endpoint: ctx.route()?.apiPath })]); }').length);
  for (const source of [
    'export function handler(ctx) { return Promise.any([Promise.resolve({ publicLink: ctx.route()?.absoluteUiPath })]); }',
    'import { Promise } from "provider"; export function handler(ctx) { return Promise.any([ctx.route()?.apiPath]); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("string replacement values retain their destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { endpoint: "placeholder".replace("placeholder", ctx.route()?.apiPath ?? "") }; }',
    'export function handler(ctx) { return { endpoint: "placeholder".replaceAll("placeholder", ctx.route()?.apiPath ?? "") }; }',
    'export function handler(ctx) { const replacement = () => ctx.route()?.apiPath; return { endpoint: "placeholder".replace("placeholder", replacement) }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return { publicLink: "placeholder".replace("placeholder", ctx.route()?.absoluteUiPath ?? "") }; }',
    'export function handler(ctx) { return provider.replace("id", ctx.route()?.apiPath); }',
    'export function handler(ctx) { return "placeholder".replace("placeholder", () => client(ctx.route()?.apiPath)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array element selection retains destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const operation of ["find(Boolean)", "findLast(Boolean)", "pop()", "shift()"])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return { endpoint: [ctx.route()?.apiPath].${operation} }; }`).length, operation);
  for (const source of [
    'export function handler(ctx) { return { publicLink: [ctx.route()?.absoluteUiPath].find(Boolean) }; }',
    'export function handler(ctx) { return ids.find(() => Boolean(ctx.route()?.apiPath)); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("dynamic string-typed replacement receivers are inspected", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const template: string = getPlaceholder(); return { endpoint: template.replace("placeholder", ctx.route()?.apiPath ?? "") }; }',
    'export function handler(ctx) { const template: string = getPlaceholder(); const alias = template; return { endpoint: alias.replaceAll("placeholder", ctx.route()?.apiPath ?? "") }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const template: string = getPlaceholder(); return { publicLink: template.replace("placeholder", ctx.route()?.absoluteUiPath ?? "") }; }',
    'export function handler(ctx) { const template: string = getPlaceholder(); function helper(template: Provider) { return template.replace("id", ctx.route()?.apiPath); } return helper(provider); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("array binding patterns retain selected destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const [endpoint] = [ctx.route()?.apiPath]; return { endpoint }; }',
    'export function handler(ctx) { const values = [ctx.route()?.apiPath]; const [endpoint] = values; return { endpoint }; }',
    'export function handler(ctx) { const [, endpoint] = ["domain", ctx.route()?.apiPath]; return { endpoint }; }',
    'export function handler(ctx) { const [...endpoints] = [ctx.route()?.apiPath]; return { endpoints }; }',
    'export function handler(ctx) { const [resolve] = [ctx.route]; return resolve("legacy"); }',
    'export function handler(ctx) { const [context] = [ctx]; return { endpoint: context.route()?.apiPath }; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const [publicLink] = [ctx.route()?.absoluteUiPath, ctx.route()?.apiPath]; return { publicLink }; }',
    'export function handler(ctx) { const [endpoint, ...ids] = [ctx.route()?.apiPath, "domain"]; return { ids }; }',
    'export function handler(ctx) { const [endpoint] = [ctx.route()?.apiPath]; return client(endpoint); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("string character selection remains scalar state while array selection retains URLs", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { leading: ctx.route()?.apiPath.charAt(0) }; }',
    'export function handler(ctx) { return { leading: ctx.route()?.apiPath.at(0) }; }',
    'export function handler(ctx) { const value = ctx.route()?.apiPath; return { leading: value.at(0) }; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return { endpoint: [ctx.route()?.apiPath].at(0) }; }').length);
});


test("Promise constructors inspect fulfilled payloads and resolver aliases", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return new Promise(resolve => resolve({ endpoint: ctx.route()?.apiPath })); }',
    'export function handler(ctx) { return new Promise(resolve => { const finish = resolve; finish({ endpoint: ctx.route()?.apiPath }); }); }',
    'export function handler(ctx) { return new Promise(resolve => { function finish(value) { resolve(value); } finish({ endpoint: ctx.route()?.apiPath }); }); }',
    'export function handler(ctx) { return new Promise(resolve => setTimeout(() => resolve({ endpoint: ctx.route()?.apiPath }), 0)); }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { return new Promise(resolve => resolve({ publicLink: ctx.route()?.absoluteUiPath })); }',
    'export function handler(ctx) { return new Promise(resolve => { const unused = () => resolve({ endpoint: ctx.route()?.apiPath }); resolve({ ok: true }); }); }',
    'export function handler(ctx) { return new Promise(resolve => { client(ctx.route()?.apiPath); resolve({ ok: true }); }); }',
    'import { Promise } from "provider"; export function handler(ctx) { return new Promise(ctx.route()?.apiPath); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("prebuild and generation inspect configured roots outside src", () => {
  const root = mkdtempSync(join(tmpdir(), "bp-configured-route-check-"));
  try {
    mkdirSync(join(root, "routes", "bp-routes"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", betterportal: { routes: ["routes/bp-routes/"] } }));
    writeFileSync(join(root, "routes", "bp-routes", "GET.ts"), 'import { createHandler } from "@betterportal/framework"; export default createHandler({}, ctx => ctx.route("legacy"));');
    for (const command of ["check-routes", "gen"]) {
      const result = spawnSync(process.execPath, [new URL("../lib/cli/bp.js", import.meta.url).pathname, "run", command], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /route no longer accepts/);
    }
    rmSync(join(root, "routes"), { recursive: true });
    mkdirSync(join(root, "shells", "bp-shells"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", betterportal: { shells: ["shells/bp-shells/"] } }));
    writeFileSync(join(root, "shells", "bp-shells", "index.tsx"), 'export function render() { return <a href="{legacy}">Old</a>; }');
    for (const command of ["check-routes", "gen"]) {
      const result = spawnSync(process.execPath, [new URL("../lib/cli/bp.js", import.meta.url).pathname, "run", command], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Legacy route tokens were removed/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("standard reversible URI encoders retain destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const encoder of ["encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent", "escape", "unescape", "btoa", "atob"])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return { endpoint: ${encoder}(ctx.route()?.apiPath ?? "") }; }`).length, encoder);
  for (const source of [
    'export function handler(ctx) { return { publicLink: encodeURIComponent(ctx.route()?.absoluteUiPath ?? "") }; }',
    'import { encodeURIComponent } from "provider"; export function handler(ctx) { return encodeURIComponent(ctx.route()?.apiPath); }',
    'export function handler(ctx) { return client(encodeURIComponent(ctx.route()?.apiPath ?? "")); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});

test("numeric string indexing remains character state while array indexing retains URLs", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { return { leading: ctx.route()?.apiPath[0] }; }',
    'export function handler(ctx) { return { leading: ctx.route()?.apiPath["0"] }; }',
    'export function handler(ctx) { const path = ctx.route()?.apiPath; return { leading: path[0] }; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { return { endpoint: [ctx.route()?.apiPath][0] }; }').length);
});


test("streamed yield items retain API response destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'import { createStreamHandler } from "@betterportal/framework"; export default createStreamHandler({}, async function* (ctx) { yield { endpoint: ctx.route()?.apiPath }; });',
    'import { createStreamHandler } from "@betterportal/framework"; export default createStreamHandler({}, async function* (ctx) { const item = { endpoint: ctx.route()?.apiPath }; yield item; });',
    'import { createStreamHandler } from "@betterportal/framework"; export default createStreamHandler({}, async function* (ctx) { yield* [{ endpoint: ctx.route()?.apiPath }]; });'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'import { createStreamHandler } from "@betterportal/framework"; export default createStreamHandler({}, async function* (ctx) { yield { publicLink: ctx.route()?.absoluteUiPath }; });',
    'import { createStreamHandler } from "@betterportal/framework"; export default createStreamHandler({}, async function* (ctx) { yield await client(ctx.route()?.apiPath); });',
    'import { createStreamHandler } from "provider"; export default createStreamHandler({}, async function* (ctx) { yield { endpoint: ctx.route("provider") }; });'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("destructuring assignments retain response destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { let endpoint; [endpoint] = [ctx.route()?.apiPath]; return { endpoint }; }',
    'export function handler(ctx) { let endpoint; ({ endpoint } = { endpoint: ctx.route()?.apiPath }); return { endpoint }; }',
    'export function handler(ctx) { let endpoint; ({ apiPath: endpoint } = ctx.route()); return { endpoint }; }',
    'export function handler(ctx) { const payload = {}; [payload.endpoint] = [ctx.route()?.apiPath]; return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { let publicLink; [publicLink] = [ctx.route()?.absoluteUiPath]; return { publicLink }; }',
    'export function handler(ctx) { let publicLink; ({ absoluteUiPath: publicLink } = ctx.route()); return { publicLink }; }',
    'export function handler(ctx) { let endpoint; [endpoint] = [ctx.route()?.apiPath]; return client(endpoint); }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("standard property descriptors retain response destination mutations", () => {
  const file = "bp-routes/users/GET.ts";
  for (const source of [
    'export function handler(ctx) { const payload = {}; Object.defineProperty(payload, "endpoint", { enumerable: true, value: ctx.route()?.apiPath }); return payload; }',
    'export function handler(ctx) { const payload = {}; const alias = payload; Object.defineProperty(alias, "endpoint", { enumerable: true, value: ctx.route()?.apiPath }); return payload; }',
    'export function handler(ctx) { const payload = {}; Object.defineProperties(payload, { endpoint: { enumerable: true, value: ctx.route()?.apiPath } }); return payload; }'
  ]) assert.ok(inspectRouteUrlSource(file, source).length, source);
  for (const source of [
    'export function handler(ctx) { const payload = {}; Object.defineProperty(payload, "publicLink", { enumerable: true, value: ctx.route()?.absoluteUiPath }); return payload; }',
    'export function handler(ctx) { const request = {}; Object.defineProperty(request, "endpoint", { enumerable: true, value: ctx.route()?.apiPath }); return client(request); }',
    'import { Object } from "provider"; export function handler(ctx) { const payload = new Model(); Object.defineProperty(payload, "endpoint", { value: ctx.route()?.apiPath }); return payload; }'
  ]) assert.deepEqual(inspectRouteUrlSource(file, source), [], source);
});


test("computed assignment keys retain provenance and known objects select only the requested field", () => {
  const file = "bp-routes/users/GET.ts";
  for (const assignment of [
    '({ ["endpoint"]: endpoint } = { endpoint: ctx.route()?.apiPath });',
    '({ endpoint } = { ["endpoint"]: ctx.route()?.apiPath });',
    'const record = { ["endpoint"]: ctx.route()?.apiPath }; ({ ["endpoint"]: endpoint } = record);',
    'const record = { status: "ready", endpoint: ctx.route()?.apiPath }; const alias = record; ({ endpoint } = alias);'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { let endpoint; ${assignment} return { endpoint }; }`).length, assignment);
  for (const assignment of [
    '({ status } = record);',
    '({ ["status"]: status } = record);',
    'const alias = record; ({ status } = alias);'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { let status; const record = { status: "ready", endpoint: ctx.route()?.apiPath }; ${assignment} return { status }; }`), [], assignment);
});


test("local object response methods and removed splice values retain provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'const helpers = { payload: () => ({ endpoint: ctx.route()?.apiPath }) }; return helpers.payload();',
    'const helpers = { payload() { return { endpoint: ctx.route()?.apiPath }; } }; const alias = helpers; return alias["payload"]();',
    'const helpers = { ["payload"]: value => ({ endpoint: value }) }; return helpers.payload(ctx.route()?.apiPath);',
    'const values = [ctx.route()?.apiPath]; return values.splice(0, 1);',
    'const values = ["safe", ctx.route()?.apiPath]; return values.splice(-1);'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'const helpers = { payload() { return { publicLink: ctx.route()?.absoluteUiPath }; } }; return helpers.payload();',
    'return client.payload(ctx.route()?.apiPath);',
    'const values = ["safe", ctx.route()?.apiPath]; return values.splice(0, 1);',
    'const values = [ctx.route()?.apiPath]; return values.splice(0, 0);',
    'const values = [ctx.route()?.apiPath]; return values.splice();'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("returned object descriptors and fill arrays retain internal destinations", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return Object.create(null, { endpoint: { enumerable: true, value: ctx.route()?.apiPath } });',
    'return Object.defineProperty({}, "endpoint", { enumerable: true, value: ctx.route()?.apiPath });',
    'return Object.defineProperties({}, { endpoint: { value: ctx.route()?.apiPath } });',
    'return [""].fill(ctx.route()?.apiPath);',
    'const values = []; values.push(ctx.route()?.apiPath); return values.splice(0, 1);',
    'const values = [ctx.route()?.apiPath, "safe"]; return values.copyWithin(1, 0);',
    'const helpers = { map() { return { endpoint: ctx.route()?.apiPath }; } }; return helpers.map();'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'return Object.create(null, { publicLink: { enumerable: true, value: ctx.route()?.absoluteUiPath } });',
    'return [""].fill(ctx.route()?.absoluteUiPath);',
    'const helpers = { fill(value) { return { name: "ready" }; } }; return helpers.fill(ctx.route()?.apiPath);',
    'return Object.create({ endpoint: ctx.route()?.apiPath });',
    'const Object = client; return Object.create(null, { endpoint: { value: ctx.route()?.apiPath } });'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("BP context response bodies retain destination provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return ctx.response(ctx.route()?.apiPath);',
    'return ctx.response(JSON.stringify({ endpoint: ctx.route()?.viewPath }));',
    'const context = ctx; return context.response({ endpoint: context.route()?.uiPath });'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'return ctx.response({ publicLink: ctx.route()?.absoluteUiPath });',
    'return client.response(ctx.route()?.apiPath);',
    'return ctx.response({ status: "ready" });'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("rejected promise reasons reach recovery callback responses", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return Promise.reject(ctx.route()?.apiPath).catch(endpoint => ({ endpoint }));',
    'const failure = Promise.reject(ctx.route()?.viewPath); return failure.then(null, endpoint => ({ endpoint }));'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'return Promise.reject(ctx.route()?.apiPath).catch(() => ({ status: "failed" }));',
    'return Promise.reject(ctx.route()?.absoluteUiPath).catch(publicLink => ({ publicLink }));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});

test("call apply and bound local factories retain response and argument provenance", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'const payload = () => ({ endpoint: ctx.route()?.apiPath }); return payload.call(null);',
    'const payload = value => ({ endpoint: value }); return payload.apply(null, [ctx.route()?.apiPath]);',
    'const payload = value => ({ endpoint: value }); const bound = payload.bind(null, ctx.route()?.apiPath); return bound();',
    'const payload = value => ({ endpoint: value }); return payload.bind(null).call(null, ctx.route()?.apiPath);'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'const payload = value => ({ status: "ready" }); return payload.call(null, ctx.route()?.apiPath);',
    'const payload = value => ({ publicLink: value }); return payload.bind(null, ctx.route()?.absoluteUiPath)();',
    'return client.call(null, ctx.route()?.apiPath);'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("bound callback inputs precede promise and collection inputs", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return Promise.resolve(ctx.route()?.apiPath).then(((first, value) => ({ endpoint: value })).bind(null, "safe"));',
    'return [ctx.route()?.apiPath].map(((first, value) => ({ endpoint: value })).bind(null, "safe"));',
    'return Array.from([ctx.route()?.apiPath], ((first, value) => ({ endpoint: value })).bind(null, "safe"));',
    'return Promise.reject(ctx.route()?.apiPath).catch(((first, value) => ({ endpoint: value })).bind(null, "safe"));'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'const payload = endpoint => ({ endpoint }); return Promise.resolve(ctx.route()?.apiPath).then(payload.bind(null, "safe"));',
    'const payload = endpoint => ({ endpoint }); return [ctx.route()?.apiPath].map(payload.bind(null, "safe"));',
    'const payload = endpoint => ({ endpoint }); return Promise.reject(ctx.route()?.apiPath).catch(payload.bind(null, "safe"));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});

test("local recovery parameters preserve explicitly rejected reasons", () => {
  const file = "bp-routes/users/GET.ts";
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { const recover = failure => failure.catch(endpoint => ({ endpoint })); return recover(Promise.reject(ctx.route()?.apiPath)); }').length);
  assert.deepEqual(inspectRouteUrlSource(file, 'export function handler(ctx) { const recover = failure => failure.catch(() => ({ status: "failed" })); return recover(Promise.reject(ctx.route()?.apiPath)); }'), []);
});


test("static spreads expand before call apply and bound callback parameter mapping", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return Promise.resolve(ctx.route()?.apiPath).then(((a, b, value) => ({ endpoint: value })).bind(null, ...["x", "y"]));',
    'const payload = (first, value) => ({ endpoint: value }); return payload.apply(null, [...["safe"], ctx.route()?.apiPath]);',
    'const payload = (first, value) => ({ endpoint: value }); return payload.call(...[null, "safe", ctx.route()?.apiPath]);',
    'const helpers = { payload: ((first, value) => ({ endpoint: value })).bind(null, "safe") }; return Promise.resolve(ctx.route()?.apiPath).then(helpers.payload);'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'return Promise.resolve(ctx.route()?.apiPath).then(((first, value) => ({ endpoint: value })).bind(null, ...["x", "y"]));',
    'const payload = first => ({ endpoint: first }); return payload.apply(null, [...["safe"], ctx.route()?.apiPath]);',
    'const helpers = { payload: (value => ({ endpoint: value })).bind(null, "safe") }; return Promise.resolve(ctx.route()?.apiPath).then(helpers.payload);'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("pass-through then and finally retain rejection reasons until recovery", () => {
  const file = "bp-routes/users/GET.ts";
  for (const body of [
    'return Promise.reject(ctx.route()?.apiPath).then(() => ({ status: "ready" })).catch(endpoint => ({ endpoint }));',
    'return Promise.reject(ctx.route()?.apiPath).then(null, undefined).finally(() => {}).catch(endpoint => ({ endpoint }));'
  ]) assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`).length, body);
  for (const body of [
    'return Promise.reject(ctx.route()?.apiPath).then(null, () => ({ status: "ready" })).catch(endpoint => ({ endpoint }));',
    'return Promise.reject(ctx.route()?.apiPath).catch(() => ({ status: "ready" })).catch(endpoint => ({ endpoint }));'
  ]) assert.deepEqual(inspectRouteUrlSource(file, `export function handler(ctx) { ${body} }`), [], body);
});


test("rest parameters receive all remaining arguments with selected element provenance", () => {
  const file = "bp-routes/users/GET.ts";
  assert.ok(inspectRouteUrlSource(file, 'export function handler(ctx) { const payload = (...values) => ({ endpoint: values[1] }); return payload(...["safe", ctx.route()?.apiPath]); }').length);
  assert.deepEqual(inspectRouteUrlSource(file, 'export function handler(ctx) { const payload = (...values) => ({ status: values[0] }); return payload(...["safe", ctx.route()?.apiPath]); }'), []);
});

test("rethrow and explicit re-reject preserve reasons until recovery", () => {
  const file = "bp-routes/users/GET.ts";
  for (const recovery of ['endpoint => Promise.reject(endpoint)', 'endpoint => { throw endpoint; }', 'endpoint => { const alias = endpoint; return Promise.reject(alias); }'])
    assert.ok(inspectRouteUrlSource(file, `export function handler(ctx) { return Promise.reject(ctx.route()?.apiPath).catch(${recovery}).catch(endpoint => ({ endpoint })); }`).length, recovery);
  assert.deepEqual(inspectRouteUrlSource(file, 'export function handler(ctx) { return Promise.reject(ctx.route()?.apiPath).catch(() => Promise.reject("failed")).catch(status => ({ status })); }'), []);
});

test("native promise operations ignore unsupported extra callback arguments", () => {
  for (const body of [
    'const failure: any = Promise.reject(ctx.route()?.apiPath); return failure.catch(() => ({ status: "failed" }), endpoint => ({ endpoint }));',
    'const failure: any = Promise.reject(ctx.route()?.apiPath); return failure.then(null, () => ({ status: "failed" }), endpoint => ({ endpoint }));'
  ]) assert.deepEqual(inspectRouteUrlSource("bp-routes/users/GET.ts", `export function handler(ctx) { ${body} }`), [], body);
});


test("new routing contract rejects removed names, UI hrefs and conflicting BPRoute props", () => {
  for (const source of [
    'export function handler(ctx) { ctx.routeUrl({ viewId: "item" }); }',
    'export function handler(ctx) { const { routeUrl: resolve } = ctx; resolve(); }',
    'export function render(data, ctx) { return <a href={ctx.route()?.uiPath}>Item</a>; }',
    'export function render(data, ctx) { return <BPRoute ctx={ctx} component="summary" fragment="body.live" />; }',
    'export function render(data, ctx) { return <bp-ok hx-get hx-delete>Delete</bp-ok>; }',
    'import { BPElement as Element } from "@betterportal/framework"; export function render(data, ctx) { return <Element ctx={ctx} />; }',
    'export function handler(ctx) { return { internal: String(ctx.route()) }; }'
  ]) assert.ok(inspectRouteUrlSource(source.includes("function handler") ? "bp-routes/items/GET.ts" : "bp-routes/items/_renderer.bootstrap5/GET.tsx", source).length, source);
  const explicit = 'export function render(data, ctx) { return <a href={ctx.route()}>Item</a>; }';
  assert.deepEqual(inspectRouteUrlSource("bp-routes/items/_renderer.bootstrap5/GET.tsx", explicit), []);
});
