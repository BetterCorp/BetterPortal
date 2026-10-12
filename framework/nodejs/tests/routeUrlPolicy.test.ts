import assert from "node:assert/strict";
import test from "node:test";
import { inspectRouteUrlSource } from "../src/codegen/routeUrlPolicy.js";

test("build rejects old helpers and URL payloads even with any-typed contexts", () => {
  for (const source of [
    'const ctx: any = {}; ctx.uiRouteUrl("users.index");',
    'const ctx: any = {}; ctx.url.route("users.index");',
    'const ctx: any = {}; ctx.routeUrl("users.index", {});',
    'const data: any = {}; data.accountUrl;',
    'const data: any = {}; data["nextUrl"];',
    'const { loginUrl } = data;',
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
    'export function handler() { return { nextCursor: "42", authorizationUrl: "https://provider.test" }; }',
    'export function render(data: any, ctx: any) { const endpoint = ctx.routeUrl({ method: "POST" })?.absoluteApiPath; return `<form action="${endpoint}"></form>`; }'
  ]) assert.deepEqual(inspectRouteUrlSource("fixture.tsx", source), [], source);
});
