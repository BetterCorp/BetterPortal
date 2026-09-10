import type { HtmlRenderable, ShellFragmentRenderContext } from "@betterportal/framework";

export const title = "Topbar fragments";
export const description = "Ordered fragments shown on the right side of the topbar.";
export const defaultItems: string[] = ["theme-selector"];

export function render(ctx: ShellFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
