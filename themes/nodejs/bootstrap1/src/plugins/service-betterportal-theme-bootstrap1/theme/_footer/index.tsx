import type { HtmlRenderable, ThemeFragmentRenderContext } from "@betterportal/framework";

export const title = "Footer fragments";
export const description = "Ordered fragments shown in the page footer.";
export const defaultItems: string[] = [];

export function render(ctx: ThemeFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
