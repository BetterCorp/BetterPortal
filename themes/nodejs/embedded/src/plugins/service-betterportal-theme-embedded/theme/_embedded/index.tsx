import type { HtmlRenderable, ThemeFragmentRenderContext } from "@betterportal/framework";

export const title = "Embedded fragments";
export const description = "Ordered fragments explicitly included by the embedded theme.";
export const defaultItems: string[] = [];

export function render(ctx: ThemeFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
