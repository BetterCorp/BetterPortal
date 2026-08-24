import type { HtmlRenderable, ShellFragmentRenderContext } from "@betterportal/framework";

export const title = "Footer fragments";
export const description = "Ordered fragments shown in the page footer.";
export const defaultItems: string[] = [];

export function render(ctx: ShellFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
