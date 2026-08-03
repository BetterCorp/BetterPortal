import { js } from "jsx-htmx";
import {
  buildBetterPortalShellRuntimeAsset,
  type BetterPortalShellAdapter,
  type ShellRuntimeAsset
} from "@betterportal/theme-runtime";

const EmbeddedAdapterSource = js(() => {
  window.BetterPortalShellAdapter = {
    initComponents: function () {},
    disposeComponents: function () {},
    closeContainingOverlay: function () {},
    scrollToTop: function () {},
    setLoading: function (loading, outlet) {
      if (outlet) outlet.classList.toggle("bp-embedded__loading", loading);
    },
    showRequestError: function (_status, _content) {
      var outlet = document.querySelector("[data-bp-main-outlet]");
      if (outlet) outlet.innerHTML = '<div class="bp-embedded__error">Unable to load embedded content.</div>';
    },
    replaceMainWithError: function (_title, message, _action, _context, outlet) {
      if (!outlet) return;
      outlet.innerHTML = "";
      var error = document.createElement("div");
      error.className = "bp-embedded__error";
      error.textContent = message || "Unable to load embedded content.";
      outlet.appendChild(error);
    }
  } satisfies BetterPortalShellAdapter;
});

let RuntimeAsset: Promise<ShellRuntimeAsset> | undefined;

export async function loadEmbeddedAsset(assetPath: string): Promise<ShellRuntimeAsset | null> {
  const normalized = assetPath.replace(/^\/+/, "");
  if (normalized !== "embedded-core.js") return null;
  RuntimeAsset ??= buildBetterPortalShellRuntimeAsset({
    adapterSource: EmbeddedAdapterSource
  });
  return RuntimeAsset;
}
