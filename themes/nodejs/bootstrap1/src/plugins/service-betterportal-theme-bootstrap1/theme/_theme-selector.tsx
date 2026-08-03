/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable, ThemeFragmentRenderContext } from "@betterportal/framework";

export const title = "Theme selector";
export const description = "Lets the user choose light, dark, or system color mode.";

export function render(_ctx: ThemeFragmentRenderContext): HtmlRenderable {
  return (
    <div class="btn-group btn-group-sm" role="group" aria-label="Color mode">
      <button type="button" class="btn btn-outline-secondary" data-bp-theme-mode="light">Light</button>
      <button type="button" class="btn btn-outline-secondary" data-bp-theme-mode="dark">Dark</button>
      <button type="button" class="btn btn-outline-secondary" data-bp-theme-mode="system">System</button>
    </div>
  );
}
