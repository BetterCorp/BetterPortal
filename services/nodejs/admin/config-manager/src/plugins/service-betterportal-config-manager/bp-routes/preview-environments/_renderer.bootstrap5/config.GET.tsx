/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../../../previewEnvironmentManagement.js";
import { configEditor, configEditorScript } from "./GET.js";

export function render(data: ResponseData): HtmlRenderable {
  const group = data.groups[0];
  return group
    ? <div>{configEditor(group, data.previewPath, data.configTicketUrl)}<script>{configEditorScript()}</script></div>
    : <div class="alert alert-warning mt-3">Preview group was not found.</div>;
}
