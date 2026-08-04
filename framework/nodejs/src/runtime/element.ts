import type { BPElementArgs, ViewRenderContext } from "../contracts/registry.js";

export interface BPElementProps {
  readonly ctx: ViewRenderContext;
  readonly service: string;
  readonly path?: string;
  readonly fragment: string;
  readonly args?: BPElementArgs;
  readonly children?: unknown;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function renderChildren(value: unknown): string {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (Array.isArray(value)) return value.map(renderChildren).join("");
  return String(value);
}

function validateOkTemplate(children: string): void {
  for (const match of children.matchAll(/<bp-ok(?:\s[^>]*)?>([\s\S]*?)<\/bp-ok>/gi)) {
    const count = [...match[1].matchAll(/<template(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/template>)/gi)].length;
    if (count !== 1) throw new Error("BPElement bp-ok must contain exactly one <template /> placeholder");
  }
}

/** Typed JSX helper. `ctx` resolves the request server-side and is never serialized. */
export function BPElement(props: BPElementProps): string {
  const children = renderChildren(props.children);
  validateOkTemplate(children);
  const resolved = props.ctx.element({ service: props.service, path: props.path, fragment: props.fragment, args: props.args });
  const ready = Boolean(resolved.url);
  const attributes: Record<string, string> = {
    "data-bp-element": "",
    "data-bp-state": ready ? "loading" : "nok",
    "aria-busy": ready ? "true" : "false",
    ...(resolved.serviceId ? { "data-bp-service": resolved.serviceId } : {}),
    ...(resolved.unavailable ? { "data-bp-unavailable": resolved.unavailable } : {}),
    ...(resolved.url ? { "hx-get": resolved.url, "hx-trigger": "load, bp:element-retry", "hx-target": "this", "hx-swap": "none" } : {})
  };
  const htmlAttributes = Object.entries(attributes)
    .map(([name, value]) => value === "" ? name : `${name}="${escapeAttribute(value)}"`)
    .join(" ");
  return `<bp-element ${htmlAttributes}>${children}</bp-element>`;
}
