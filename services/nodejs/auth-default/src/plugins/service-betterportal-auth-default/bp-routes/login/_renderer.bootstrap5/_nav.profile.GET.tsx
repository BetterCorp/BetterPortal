/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

export function render(data: ResponseData): HtmlRenderable {
  if (!data.alreadyLoggedIn || !data.user) {
    return (
      <a class="btn btn-sm btn-primary" href="/login">
        Sign in
      </a>
    );
  }

  const displayName = data.user.name || data.user.username || data.user.email || "Account";
  const detail = data.user.email || data.user.username || displayName;

  return (
    <div class="dropdown">
      <button class="btn btn-sm btn-light dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        {displayName}
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><h6 class="dropdown-header">{detail}</h6></li>
        <li><hr class="dropdown-divider" /></li>
        <li>
            <a class="dropdown-item" href="/login?action=logout">
              Logout
            </a>
        </li>
      </ul>
    </div>
  );
}
