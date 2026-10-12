import { jsx } from "../src/jsx-runtime.js";
import assert from "node:assert/strict";
import test from "node:test";
import { BPRoute, type ViewRenderContext } from "../src/index.js";
import { createRouteResult, viewRouteResolver } from "../src/runtime/routeResult.js";
import type { RouteInput, RouteResolver } from "../src/contracts/routing.js";
import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";

const fixture = (access: "ok" | "noauth" | "noperm" = "ok", mounted = true) => {
  const calls: RouteInput[] = [];
  const resolve: RouteResolver = (input = {}) => {
    calls.push(input);
    const selector = input.component ? `?_c=${input.component}` : input.fragment ? `?_f=${input.fragment}` : "";
    return createRouteResult({ apiPath: "/batches/1", viewPath: "/batches/1" + selector, uiPath: mounted ? "/instance/batches/1" : null,
      absoluteApiPath: "https://service.test/batches/1", absoluteViewPath: "https://service.test/batches/1" + selector, absoluteUiPath: mounted ? "https://app.test/instance/batches/1" : null }, resolve, input, "apiPath", { serviceId: "instance", method: input.method ?? "GET", access });
  };
  return { calls, resolve, ctx: { secret: "must-not-leak", route: viewRouteResolver(resolve) } as unknown as ViewRenderContext };
};
function active(html: unknown): string {
  const root = parseFragment(String(html)).childNodes[0] as DefaultTreeAdapterTypes.Element;
  root.childNodes = root.childNodes.filter(node => !("tagName" in node && node.tagName === "template"));
  return serialize(root);
}

test("route string conversion is contextual and chaining immutable and portable", () => {
  const { resolve, ctx } = fixture();
  const api = resolve()!; const view = ctx.route()!;
  assert.equal(String(api.component("summary")), "/batches/1");
  assert.equal(String(view.component("summary")), "/batches/1?_c=summary");
  assert.equal(view.viewPath, "/batches/1");
  assert.equal(view.component("summary")?.fragment("body.live")?.viewPath, "/batches/1?_f=body.live");
  assert.deepEqual(Object.keys(api).sort(), ["apiPath", "viewPath", "uiPath", "absoluteApiPath", "absoluteViewPath", "absoluteUiPath"].sort());
});

test("ordinary success uses a service href; failed resolution renders plain content without throwing", () => {
  const { ctx } = fixture();
  const result = String(BPRoute({ ctx, viewId: "batch", children: "<bp-ok>Batch</bp-ok><bp-error>Unavailable</bp-error>" }));
  assert.match(active(result), /href="\/batches\/1"/);
  assert.doesNotMatch(result, /must-not-leak/);
  assert.equal(active(BPRoute({ ctx: { route: () => null } as unknown as ViewRenderContext, children: "<bp-error>Unavailable</bp-error>" })), "Unavailable");
  assert.equal(active(BPRoute({ ctx: fixture("ok", false).ctx, children: "<bp-ok>Batch</bp-ok><bp-error>Unmounted</bp-error>" })), "Unmounted");
});

test("valueless HTMX methods resolve the actual operation and generate no href", () => {
  const { ctx, calls } = fixture();
  const result = active(BPRoute({ ctx, children: '<bp-ok as="a" hx-delete hx-confirm="Sure?">Delete</bp-ok>' }));
  assert.equal(calls[0].method, "DELETE");
  assert.match(result, /hx-delete="https:\/\/service.test\/batches\/1"/);
  assert.match(result, /hx-confirm="Sure\?"/);
  assert.doesNotMatch(result, /href=/);
});

test("explicit overrides survive, conflicting methods select error, fallback roots replace controls", () => {
  const { ctx } = fixture();
  assert.match(active(BPRoute({ ctx, children: '<bp-ok as="a" hx-delete="/custom">Delete</bp-ok>' })), /hx-delete="\/custom"/);
  assert.equal(active(BPRoute({ ctx, children: '<bp-ok hx-get hx-delete>Bad</bp-ok><bp-error>Invalid</bp-error>' })), "Invalid");
  const denied = fixture("noperm").ctx;
  assert.equal(active(BPRoute({ ctx: denied, as: "button", children: '<bp-ok>Show</bp-ok><bp-noperm as="label" id="mysum">Unavailable</bp-noperm>' })), '<label id="mysum">Unavailable</label>');
  const disabled = active(BPRoute({ ctx: denied, as: "button", children: '<bp-ok>Show</bp-ok><bp-noperm disabled>Unavailable</bp-noperm>' }));
  assert.match(disabled, /^<button disabled(?:="")?>Unavailable<\/button>$/);
  assert.doesNotMatch(disabled, /hx-|href=/);
});

test("component success supplies wrapper only, ignores authored content and request URLs", () => {
  const { ctx } = fixture();
  const result = String(BPRoute({ ctx, component: "summary", children: '<bp-ok as="div" class="p-3" href="/wrong" hx-delete>Ignored</bp-ok><bp-error>Unavailable</bp-error>' }));
  assert.match(result, /hx-get="https:\/\/service.test\/batches\/1\?_c=summary"/);
  assert.match(result, /<div class="p-3"><template data-bp-route-insertion><\/template><\/div>/);
  assert.doesNotMatch(result, /Ignored|\/wrong|hx-delete/);
});

test("forms retain inputs and native method while resolver context stays server-side", () => {
  const { ctx, calls } = fixture();
  const result = active(BPRoute({ ctx, as: "form", method: "POST", children: '<bp-ok><input name="title" required><button type="submit">Save</button></bp-ok>' }));
  assert.equal(calls[0].method, "POST");
  assert.match(result, /<form action="https:\/\/service.test\/batches\/1" method="post" hx-post=/);
  assert.match(result, /<input name="title" required(?:="")?>/);
});


test("JSX state false attributes override outer defaults instead of disappearing", () => {
  const { ctx } = fixture();
  const result = String(jsx(BPRoute, { ctx, as: "button", disabled: true, children: jsx("bp-ok", { disabled: false, children: "Enabled" }) }));
  assert.doesNotMatch(active(result), /disabled|data-bp-state-props/);
  assert.match(active(result), /Enabled<\/button>/);
});
