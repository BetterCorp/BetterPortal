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
    'const data: any = {}; data.accountUrl;',
    'const data: any = {}; data["nextUrl"];',
    'const { loginUrl } = data;',
    'export function handler(ctx: any) { const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin"); return { nextUrl }; }',
    'export function handler(ctx: any) { return { destination: ctx.routeUrl() }; }',
    'export function handler(ctx: any) { const target = ctx.routeUrl(); return { endpoint: target.apiPath }; }',
    'export function handler(ctx: any) { const endpoint = ctx.routeUrl()?.absoluteViewPath; return { endpoint: endpoint }; }',
    'export function render() { return `<a href="{users.index}">Users</a>`; }',
    'export const handle = (ctx: any) => ({ anything: ctx.routeUrl()?.apiPath });',
    'export function handle(ctx: any) { const next = ctx.routeUrl()?.viewPath; return { next }; }',
    'export const render = () => <a href="{users.index}">Users</a>;',
  ]) assert.ok(inspectRouteUrlSource("fixture.tsx", source).length, source);
});

test("build permits renderer resolution, cursors and public domain links", () => {
  for (const source of [
    'export function handler(ctx: any) { return { publicLink: ctx.routeUrl({ viewId: "users.index" })?.absoluteUiPath }; }',
    'export function shell(context: any) { return { loginUrl: context.loginUrl, logoutUrl: context.logoutUrl }; }',
    'export function provider() { return { nextUrl: "https://external.test", loginUrl: "https://external.test/login" }; }',
    'export function handler(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); const user = lookup(ctx.query.next); return { name: user.name }; }',
    'export function render(ctx: any) { const endpoint = ctx.routeUrl()?.apiPath; return `<form action="${endpoint}"></form>`; } export function handle() { const endpoint = "domain"; return { endpoint }; }',
    'export function provider(ctx: any) { const next = resolveAppAuthRedirect(ctx, "afterLogin"); return { authorizationUrl: getProviderUrl({ state: next }) }; }',
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
