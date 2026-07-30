import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  betterPortalShellRuntimeSource,
  buildBetterPortalThemeRuntimeAsset,
  loadThemeRuntimeVendorAsset
} from "@betterportal/theme-runtime";
import { Bootstrap1AdapterSource } from "./adapter.js";

export interface ThemeAssetResponse {
  body: BodyInit;
  contentType: string;
}

const require = createRequire(import.meta.url);
const BootstrapCssPath = require.resolve("bootstrap/dist/css/bootstrap.min.css");
const BootstrapBundlePath = require.resolve("bootstrap/dist/js/bootstrap.bundle.min.js");
const AssetCache = new Map<string, Promise<ThemeAssetResponse>>();

function readTextAsset(filePath: string, contentType: string): Promise<ThemeAssetResponse> {
  return readFile(filePath, "utf8").then((body) => ({ body, contentType }));
}

function readBinaryAsset(filePath: string, contentType: string): Promise<ThemeAssetResponse> {
  return readFile(filePath).then((body) => ({ body, contentType }));
}

function readLocalPluginAsset(assetName: string, contentType: string): Promise<ThemeAssetResponse> {
  return readBinaryAsset(fileURLToPath(new URL(`./${assetName}`, import.meta.url)), contentType);
}

function cachedAsset(key: string, load: () => Promise<ThemeAssetResponse>): Promise<ThemeAssetResponse> {
  if (!AssetCache.has(key)) AssetCache.set(key, load());
  return AssetCache.get(key)!;
}

export async function loadBootstrap1Asset(assetPath: string): Promise<ThemeAssetResponse | null> {
  const normalized = assetPath.replace(/^\/+/, "");
  if (normalized === "bootstrap.min.css") {
    return cachedAsset(normalized, () => readTextAsset(BootstrapCssPath, "text/css; charset=utf-8"));
  }
  if (normalized === "bootstrap.bundle.min.js") {
    return cachedAsset(normalized, () => readTextAsset(BootstrapBundlePath, "application/javascript; charset=utf-8"));
  }

  const vendor = await loadThemeRuntimeVendorAsset(normalized);
  if (vendor) return vendor;

  if (normalized === "betterportal-logo.png") {
    return cachedAsset(normalized, () => readLocalPluginAsset("betterportal-logo.png", "image/png"));
  }
  if (normalized === "betterportal-favicon-32.png") {
    return cachedAsset(normalized, () => readLocalPluginAsset("betterportal-favicon-32.png", "image/png"));
  }
  if (normalized === "betterportal-favicon-16.png") {
    return cachedAsset(normalized, () => readLocalPluginAsset("betterportal-favicon-16.png", "image/png"));
  }
  if (normalized === "bootstrap1-shell.js") {
    return {
      body: [Bootstrap1AdapterSource, betterPortalShellRuntimeSource("bootstrap1")].join("\n;\n"),
      contentType: "application/javascript; charset=utf-8"
    };
  }
  if (normalized === "bootstrap1-core.js") {
    return cachedAsset(normalized, () => buildBetterPortalThemeRuntimeAsset({
      themeId: "bootstrap1",
      adapterSource: Bootstrap1AdapterSource
    }));
  }
  return null;
}
