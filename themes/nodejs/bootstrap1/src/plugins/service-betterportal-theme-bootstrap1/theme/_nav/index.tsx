import type { HtmlRenderable, ThemeFragmentRenderContext } from "@betterportal/framework";

export const title = "Topbar fragments";
export const description = "Ordered fragments shown on the right side of the topbar.";
export const defaultItems: string[] = [];

export function render(ctx: ThemeFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
