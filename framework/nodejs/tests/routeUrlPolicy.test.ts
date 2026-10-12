import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectRouteUrlSource } from "../src/codegen/routeUrlPolicy.js";

test("build rejects old helpers and URL payloads even with any-typed contexts", () => {
  for (const source of [
    'const ctx: any = {}; ctx.uiRouteUrl("users.index");',
    'const ctx: any = {}; ctx.url.route("users.index");',
    'const ctx: any = {}; ctx.routeUrl("users.index", {});',
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
    writeFileSync(join(directory, "src", "handler.ts"), 'const ctx: any = {}; ctx.routeUrl("users.index");');
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
