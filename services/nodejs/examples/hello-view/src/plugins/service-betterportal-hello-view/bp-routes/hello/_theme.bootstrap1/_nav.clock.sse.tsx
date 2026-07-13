/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { Tick } from "../sse.js";

export function renderTick(data: Tick): HtmlRenderable {
  //throw new Error('test');
  return <span title={data.iso}>{data.time}</span>;
}
