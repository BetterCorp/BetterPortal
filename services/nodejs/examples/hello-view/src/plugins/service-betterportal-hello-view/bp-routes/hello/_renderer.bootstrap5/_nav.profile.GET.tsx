/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function greetingName(greeting: string): string {
  return greeting.replace(/^Hello,\s*/, "").trim();
}

function greetingInitials(greeting: string): string {
  const name = greetingName(greeting);
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "BP";
}

export function render(data: ResponseData): HtmlRenderable {
  const name = greetingName(data.greeting);
  const initials = greetingInitials(data.greeting);

  return (
    <div class="dropdown">
      <button
        class="btn btn-light border shadow-sm dropdown-toggle d-inline-flex align-items-center gap-2 rounded-pill px-2 py-1 text-start"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <span
          class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
          style="width:2rem;height:2rem;font-size:0.78rem;"
        >
          {initials}
        </span>
        <span class="d-none d-sm-inline fw-semibold text-body">{name}</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow-sm">
        <li>
          <div class="dropdown-item-text">
            <div class="fw-semibold text-body">{name}</div>
          </div>
        </li>
        <li><hr class="dropdown-divider" /></li>
        <li><a class="dropdown-item" href="/config-admin">Settings</a></li>
      </ul>
    </div>
  );
}
