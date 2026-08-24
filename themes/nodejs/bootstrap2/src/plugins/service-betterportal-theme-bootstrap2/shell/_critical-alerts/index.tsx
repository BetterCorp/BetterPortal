import type { HtmlRenderable, ShellFragmentRenderContext } from "@betterportal/framework";

export const title = "Critical alerts";
export const description = "Ordered service-rendered alerts shown directly below the top bar.";
export const defaultItems: string[] = [];

export function render(ctx: ShellFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
