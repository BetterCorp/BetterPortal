import type { JSX as BaseJSX } from "jsx-htmx/jsx-runtime";
import type { ResolvedRoute } from "./contracts/routing.js";
import type { raw } from "jsx-htmx";
import * as importedRuntime from "jsx-htmx/jsx-runtime";
const runtime = importedRuntime as unknown as {
  jsx(tag: unknown, attributes?: Record<string, unknown> | null): BaseJSX.Element;
  Fragment(props: { children?: unknown }): BaseJSX.Element;
};
const stateTags = new Set(["bp-ok", "bp-error", "bp-noauth", "bp-noperm", "bp-loading", "bp-status"]);
/** Preserve explicit false/null state overrides that ordinary HTML serialization omits. */
export function jsx(tag: unknown, attributes: Record<string, unknown> | null = {}): BaseJSX.Element {
  if (typeof tag === "string" && stateTags.has(tag)) {
    const flags = Object.fromEntries(Object.entries(attributes ?? {}).filter(([name, value]) => name !== "children" && name !== "key"
      && (typeof value === "boolean" || value == null)).map(([name, value]) => [name, value ?? null]));
    return runtime.jsx(tag, { ...attributes, "data-bp-state-props": JSON.stringify(flags) });
  }
  return runtime.jsx(tag, attributes);
}
export const jsxs = jsx;
export const Fragment = runtime.Fragment;

type UrlAttribute = "href" | "action" | "formAction" | "src" | "hx-get" | "hx-post" | "hx-put" | "hx-patch" | "hx-delete";
type RouteAttributes<T> = { [K in keyof T]: K extends UrlAttribute ? T[K] | ResolvedRoute | null : T[K] };

/** JSX-HTMX rendering with typed BP route destinations and valueless method markers. */
// eslint-disable-next-line @typescript-eslint/no-namespace -- TypeScript JSX factories require the exported JSX namespace.
export namespace JSX {
  export type Element = BaseJSX.Element | ReturnType<typeof raw>;
  export type IntrinsicElements = {
    [K in keyof BaseJSX.IntrinsicElements]: K extends `bp-${string}`
      ? Record<string, unknown> : RouteAttributes<BaseJSX.IntrinsicElements[K]>
  } & {
    "bp-ok": Record<string, unknown>;
    "bp-error": Record<string, unknown>;
    "bp-noauth": Record<string, unknown>;
    "bp-noperm": Record<string, unknown>;
    "bp-loading": Record<string, unknown>;
    "bp-status": Record<string, unknown>;
  };
  export interface ElementChildrenAttribute { children: unknown }
}
