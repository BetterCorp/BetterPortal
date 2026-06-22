/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function dragScript(): HtmlRenderable {
  return js(`if (document.body.dataset.bpMenuDragBound !== "1") {
    document.body.dataset.bpMenuDragBound = "1";

    const PADDING_BASE = 16;
    const DEPTH_PX = 24;
    const SCROLL_ZONE = 80;
    const SCROLL_SPEED = 14;

    let draggingId = null;
    let draggingIsGroup = false;
    let anchorId = null;
    let targetDepth = 0;
    let scrollTimer = null;

    let indicator = null;
    let label = null;
    const ensureIndicator = () => {
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.style.cssText = "position:fixed; height:4px; background:var(--bs-primary); pointer-events:none; z-index:9999; border-radius:2px; box-shadow:0 0 6px var(--bs-primary); display:none;";
        document.body.appendChild(indicator);
        label = document.createElement("div");
        label.style.cssText = "position:fixed; pointer-events:none; z-index:9999; background:var(--bs-primary); color:white; font-size:11px; font-weight:600; padding:2px 6px; border-radius:3px; display:none;";
        document.body.appendChild(label);
      }
      return indicator;
    };

    const clearAll = () => {
      document.querySelectorAll("[data-bp-drag-item]").forEach((el) => {
        el.classList.remove("opacity-50");
      });
      if (indicator) indicator.style.display = "none";
      if (label) label.style.display = "none";
      stopAutoScroll();
    };

    const stopAutoScroll = () => {
      if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
    };

    const startAutoScroll = (dy) => {
      stopAutoScroll();
      scrollTimer = setInterval(() => {
        // Try scrolling main outlet, fall back to window
        const outlet = document.querySelector(".bp-admin__workspace, main, body");
        const scroller = (document.scrollingElement || document.documentElement);
        scroller.scrollTop += dy;
      }, 16);
    };

    document.body.addEventListener("dragstart", (e) => {
      const li = e.target.closest && e.target.closest("[data-bp-drag-item]");
      if (!li) return;
      draggingId = li.dataset.bpDragItem;
      draggingIsGroup = li.dataset.bpDragType === "group";
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingId);
      li.classList.add("opacity-50");
    });

    document.body.addEventListener("dragend", () => {
      clearAll();
      draggingId = null;
      draggingIsGroup = false;
      anchorId = null;
      targetDepth = 0;
    });

    document.body.addEventListener("dragover", (e) => {
      if (!draggingId) return;
      const list = document.querySelector("#bp-menu-editor .list-group");
      if (!list) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Auto-scroll near viewport edges
      if (e.clientY < SCROLL_ZONE) startAutoScroll(-SCROLL_SPEED);
      else if (window.innerHeight - e.clientY < SCROLL_ZONE) startAutoScroll(SCROLL_SPEED);
      else stopAutoScroll();

      const allRows = Array.from(list.querySelectorAll("[data-bp-drag-item]"));
      const y = e.clientY;
      let anchor = null;
      for (const r of allRows) {
        if (r.dataset.bpDragItem === draggingId) continue;
        const rect = r.getBoundingClientRect();
        if (y >= rect.top + rect.height / 2) anchor = r;
      }

      const ind = ensureIndicator();
      const listRect = list.getBoundingClientRect();

      if (!anchor) {
        anchorId = "";
        targetDepth = 0;
        const firstRow = allRows.find((r) => r.dataset.bpDragItem !== draggingId);
        const topY = firstRow ? firstRow.getBoundingClientRect().top : listRect.top;
        ind.style.left = (listRect.left + PADDING_BASE) + "px";
        ind.style.width = Math.max(40, (listRect.width - PADDING_BASE * 2)) + "px";
        ind.style.top = (topY - 2) + "px";
        ind.style.display = "block";
        label.textContent = "depth 0";
        label.style.left = (listRect.left + PADDING_BASE) + "px";
        label.style.top = (topY - 22) + "px";
        label.style.display = "block";
        return;
      }

      const anchorDepth = parseInt(anchor.dataset.bpDragDepth || "0", 10);
      const anchorIsGroup = anchor.dataset.bpDragType === "group";
      const maxDepth = draggingIsGroup ? 0 : (anchorDepth + (anchorIsGroup ? 1 : 0));

      // Depth = anchor.depth + (cursor offset from anchor's content X, in DEPTH_PX steps)
      const xRel = e.clientX - listRect.left;
      const anchorContentX = PADDING_BASE + anchorDepth * DEPTH_PX;
      const depthDelta = Math.floor((xRel - anchorContentX) / DEPTH_PX);
      const requestedDepth = anchorDepth + depthDelta;
      const clampedDepth = Math.max(0, Math.min(requestedDepth, maxDepth));

      anchorId = anchor.dataset.bpDragItem;
      targetDepth = clampedDepth;

      const anchorRect = anchor.getBoundingClientRect();
      const indentPx = PADDING_BASE + clampedDepth * DEPTH_PX;
      ind.style.left = (listRect.left + indentPx) + "px";
      ind.style.width = Math.max(40, (listRect.width - indentPx - 8)) + "px";
      ind.style.top = (anchorRect.bottom - 2) + "px";
      ind.style.display = "block";
      label.textContent = "depth " + clampedDepth + (draggingIsGroup ? " (group)" : "");
      label.style.left = (listRect.left + indentPx) + "px";
      label.style.top = (anchorRect.bottom - 22) + "px";
      label.style.display = "block";
    });

    document.body.addEventListener("drop", (e) => {
      if (!draggingId) return;
      e.preventDefault();
      const src = draggingId;
      const aId = anchorId;
      const depth = targetDepth;
      clearAll();
      draggingId = null;
      draggingIsGroup = false;
      anchorId = null;
      targetDepth = 0;
      const form = document.getElementById("bp-drag-move-form");
      if (!form) return;
      form.querySelector("[name=itemId]").value = src;
      form.querySelector("[name=anchorId]").value = aId ?? "";
      form.querySelector("[name=targetDepth]").value = String(depth);
      form.requestSubmit();
    });
  }`);
}

export function render(data: ResponseData): HtmlRenderable {
  const editorBase = "/.well-known/bp/admin/menu-editor";
  const initialUrl = data.selectedAppId ? `${editorBase}?appId=${encodeURIComponent(data.selectedAppId)}` : "";

  return (
    <div class="container-fluid px-0">
      <div class="mb-4">
        <h2 class="mb-1">{data.title}</h2>
        <p class="text-secondary mb-0">Drag rows to reorder. Drag right to nest, left to unnest. Click title to rename. Live nav refresh on save.</p>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold">App</label>
        <select class="form-select" name="appId"
          hx-get={editorBase}
          hx-target="#bp-menu-editor"
          hx-swap="outerHTML"
          hx-trigger="change"
          hx-include="this">
          <option value="">Choose an app...</option>
          {data.apps.map((app) => (
            <option value={app.id} selected={app.id === data.selectedAppId}>
              {app.title} ({app.tenantId})
            </option>
          ))}
        </select>
      </div>

      <div id="bp-menu-editor"
        {...(data.selectedAppId
          ? { "hx-get": initialUrl, "hx-trigger": "load", "hx-swap": "outerHTML" }
          : {})}>
        {data.selectedAppId
          ? <div class="text-secondary">Loading editor...</div>
          : <div class="alert alert-secondary">Select an app to design its menu</div>}
      </div>

      <script>{dragScript()}</script>
    </div>
  );
}
