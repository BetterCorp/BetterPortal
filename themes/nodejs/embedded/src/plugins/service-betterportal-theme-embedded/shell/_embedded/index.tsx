import type { HtmlRenderable, ShellFragmentRenderContext } from "@betterportal/framework";

export const title = "Embedded fragments";
export const description = "Ordered fragments explicitly included by the embedded theme.";
export const defaultItems: string[] = [];

export function render(ctx: ShellFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
