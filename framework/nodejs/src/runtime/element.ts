import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";
import { createElement, raw, type Attributes } from "jsx-htmx";
import type { HttpMethod } from "../contracts/common.js";
import type { RouteOptions } from "../contracts/routing.js";
import type { BPRouteArgs, ViewRenderContext } from "../contracts/registry.js";
import { routeDetails } from "./routeResult.js";

/**
 * Prefer BPRoute for service-view links, actions, forms and embedded HTML.
 * States choose their rendered root: state `as` overrides the outer default.
 * Component/fragment success contains fetched HTML, never a navigation control.
 */
export interface BPRouteProps extends RouteOptions {
  readonly ctx: ViewRenderContext;
  /** BPRoute actions support GET, POST, PUT, PATCH and DELETE; OPTIONS remains a resolver-only method. */
  readonly method?: Exclude<HttpMethod, "OPTIONS">;
  readonly viewId?: string;
  readonly path?: string;
  /** Dependency alias or `shell`; `serviceId` remains available for ordinary targets. */
  readonly service?: string;
  /** Legacy fragment argument shape is retained as a BPRoute input, not a BPElement alias. */
  readonly args?: BPRouteArgs;
  readonly as?: string;
  readonly target?: string;
  readonly swap?: string;
  readonly children?: unknown;
  readonly [attribute: string]: unknown;
}

const stateNames = new Set(["bp-ok", "bp-error", "bp-noauth", "bp-noperm", "bp-loading", "bp-status"]);
const methods = ["hx-get", "hx-post", "hx-put", "hx-patch", "hx-delete"];
const consumed = new Set(["ctx", "viewId", "path", "service", "serviceId", "args", "params", "query", "method", "component", "fragment", "mountId", "sse", "target", "swap", "as", "children"]);
const childrenHtml = (value: unknown): string => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(childrenHtml).join("") : String(value);
const escape = (value: string): string => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function stateAttributes(state: DefaultTreeAdapterTypes.Element | undefined): Record<string, unknown> {
  const attrs: Record<string, unknown> = Object.fromEntries(state?.attrs.map(attr => [attr.name, attr.value]) ?? []);
  const encoded = attrs["data-bp-state-props"];
  delete attrs["data-bp-state-props"];
  if (typeof encoded !== "string") return attrs;
  try {
    const values: unknown = JSON.parse(encoded);
    return values && typeof values === "object" && !Array.isArray(values)
      ? { ...attrs, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value === null || typeof value === "boolean")) } : attrs;
  } catch { return attrs; }
}

/** Resolve once server-side; browser state transitions replace the active root. */
export function BPRoute(props: BPRouteProps): ReturnType<typeof raw> {
  const parsed = parseFragment(childrenHtml(props.children));
  const states = parsed.childNodes.filter((node): node is DefaultTreeAdapterTypes.Element => "tagName" in node && stateNames.has(node.tagName));
  const fallbackContent = states.length ? "" : serialize(parsed);
  const embedding = Boolean(props.component || props.fragment);
  const outerAttributes = Object.fromEntries(Object.entries(props).filter(([key]) => !consumed.has(key)));
  const ok = states.find(state => state.tagName === "bp-ok");
  const okAttributes = stateAttributes(ok);
  const effective = { ...outerAttributes, ...okAttributes };
  const marked = methods.filter(key => effective[key] != null && effective[key] !== false);
  const method = String(embedding ? "GET" : marked[0]?.slice(3) ?? effective.method ?? props.method ?? "GET").toUpperCase() as HttpMethod;
  const options = {
    ...(props.path !== undefined ? { path: props.path } : props.viewId !== undefined ? { viewId: props.viewId } : {}),
    serviceId: props.serviceId ?? props.service, method,
    params: props.params ?? props.args?.params, query: props.query ?? props.args?.query,
    mountId: props.mountId, component: props.component, fragment: props.fragment, sse: props.sse
  };
  const shellFragment = props.service === "shell" && props.fragment && !props.path && !props.viewId;
  const destination = shellFragment ? null : props.ctx.route(options);
  const element = shellFragment ? props.ctx.element({ service: "shell", fragment: props.fragment!, args: props.args ?? { params: props.params, query: props.query } }) : undefined;
  const serviceId = element?.serviceId ?? (destination ? routeDetails(destination).serviceId : undefined);
  const explicitOverride = !embedding && marked.length === 1 && typeof effective[marked[0]] === "string" && effective[marked[0]] !== "" ? String(effective[marked[0]]) : undefined;
  const request = explicitOverride ?? element?.url ?? destination?.absoluteViewPath ?? destination?.viewPath;
  const tag = String(okAttributes.as ?? props.as ?? (embedding ? "none" : "a"));
  const explicitAction = !embedding && (marked.length > 0 || tag === "form" || tag === "button");
  const hasOverride = marked.some(key => typeof effective[key] === "string" && effective[key] !== "");
  const access = !explicitOverride && destination ? routeDetails(destination).access : undefined;
  const configError = !methods.includes(`hx-${method.toLowerCase()}`) || marked.length > 1 && !embedding || Boolean(props.component && props.fragment) || Boolean(props.path !== undefined && props.viewId !== undefined);
  const available = Boolean(request) && !configError && (embedding || explicitAction || Boolean(destination?.uiPath) || hasOverride);
  const initial = !available ? "error" : access === "noauth" || access === "noperm" ? access : embedding ? "loading" : "ok";
  const templates: Record<string, string> = {};

  const renderState = (name: string, attributes: Record<string, unknown>, content: string): string => {
    const selectedTag = String(attributes.as ?? props.as ?? (name === "ok" && !embedding ? "a" : "none"));
    const html = { ...outerAttributes, ...attributes };
    delete html.as; delete html.code;
    // Routing attributes are generated only for actionable success, never fallbacks or embeds.
    if (name !== "ok" || embedding) {
      for (const key of Object.keys(html)) if (/^(?:href|action|method|formaction|hx-(?:get|post|put|patch|delete|target|swap|trigger|push-url|replace-url|include|vals|headers))$/i.test(key)) delete html[key];
    } else if (request && !configError) {
      if (props.target) html["hx-target"] ??= props.target;
      if (props.swap) html["hx-swap"] ??= props.swap;
      if (marked.length) {
        delete html.href;
        const attr = marked[0];
        if (html[attr] === true || html[attr] === "") html[attr] = request;
      } else if (selectedTag === "form") {
        html.action ??= request; html.method = method === "GET" ? "get" : "post"; html[`hx-${method.toLowerCase()}`] ??= request;
      } else if (selectedTag === "button" || method !== "GET") {
        html[`hx-${method.toLowerCase()}`] ??= request;
        if (selectedTag === "button") html.type ??= "button";
      } else {
        html.href ??= destination?.viewPath ?? request;
        if (props.target || props.swap || html["hx-target"] || html["hx-swap"]) html["hx-get"] ??= request;
      }
      html["data-bp-route-control"] = "";
      if (serviceId) html["data-bp-service"] = serviceId;
    }
    const body = embedding && name === "ok" ? '<template data-bp-route-insertion></template>' : content;
    if (selectedTag === "none") return body;
    if (!/^[a-z][a-z0-9-]*$/i.test(selectedTag)) return body;
    return String(createElement(selectedTag, html as Attributes, raw(body)));
  };
  for (const state of states) {
    const attrs = stateAttributes(state);
    const name = state.tagName.slice(3);
    const key = name === "status" ? `status:${attrs.code ?? ""}` : name;
    templates[key] = renderState(name, attrs, serialize(state));
  }
  templates.ok ??= renderState("ok", {}, fallbackContent);
  const templateHtml = Object.entries(templates).map(([state, content]) => `<template data-bp-route-state="${escape(state)}">${content}</template>`).join("");
  const active = templates[initial] ?? (initial === "noauth" || initial === "noperm" ? templates.error : "") ?? "";
  const attributes: Record<string, string> = {
    "data-bp-route": "", "data-bp-mode": embedding ? "embed" : "action", "data-bp-state": initial,
    ...(serviceId ? { "data-bp-service": serviceId } : {}),
    ...(!available ? { "data-bp-unavailable": configError ? "invalid_configuration" : element?.unavailable ?? "route_unavailable" } : {}),
    ...(embedding && available && initial === "loading" ? { "hx-get": request!, "hx-trigger": "load, bp:route-retry", "hx-target": "this", "hx-swap": "none", "aria-busy": "true" } : {})
  };
  const attrs = Object.entries(attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(" ");
  return raw(`<bp-route ${attrs} style="display:contents">${templateHtml}${active}</bp-route>`);
}
