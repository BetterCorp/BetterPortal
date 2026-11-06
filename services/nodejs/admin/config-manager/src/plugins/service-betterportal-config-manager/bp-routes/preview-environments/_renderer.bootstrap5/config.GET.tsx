/* @jsxImportSource @betterportal/framework */
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";
import type { ResponseData } from "../../../previewEnvironmentManagement.js";
import { configEditor, configEditorScript } from "./GET.js";

export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  const group = data.groups[0];
  const target = group ? ctx.route({ path: "/preview-environments", method: "POST" })?.absoluteViewPath : null;
  if (group && !target) throw new Error("Preview config action route is unavailable");
  return group
    ? <div>{configEditor(group, target!, data.configTicketUrl)}<script>{configEditorScript()}</script></div>
    : <div class="alert alert-warning mt-3">Preview group was not found.</div>;
}
