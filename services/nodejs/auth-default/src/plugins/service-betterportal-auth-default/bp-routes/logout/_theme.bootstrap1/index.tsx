/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

export function render(_data: ResponseData): HtmlRenderable {
  // Transient view: the response's BP-RemoveHeader directives clear the stored
  // tokens and HX-Location immediately soft-navigates to the login view.
  return (
    <div class="d-flex justify-content-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Signing out...</span>
      </div>
    </div>
  );
}
