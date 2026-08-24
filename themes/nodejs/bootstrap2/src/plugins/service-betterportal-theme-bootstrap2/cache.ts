import packageJson from "../../../package.json" with { type: "json" };

export const BOOTSTRAP2_VERSION = packageJson.version;
export const BOOTSTRAP2_ASSET_BASE_URL = "/_themes/bootstrap2/assets";
export const BOOTSTRAP2_CACHE_PREFIX = "betterportal-bootstrap2-";

export function bootstrap2AssetUrl(name: string): string {
  return `${BOOTSTRAP2_ASSET_BASE_URL}/${name}?v=${encodeURIComponent(BOOTSTRAP2_VERSION)}`;
}

const PRECACHE_ASSETS = [
  "bootstrap.min.css",
  "bootstrap.bundle.min.js",
  "bootstrap2-core.js",
  "bootstrap2-register.js",
  "betterportal-logo.png",
  "betterportal-favicon-16.png",
  "betterportal-favicon-32.png",
  "offline.html"
].map(bootstrap2AssetUrl);

export function bootstrap2RegisterSource(): string {
  const workerUrl = bootstrap2AssetUrl("bootstrap2-sw.js");
  return `if("serviceWorker" in navigator){navigator.serviceWorker.register(${JSON.stringify(workerUrl)},{scope:"/",updateViaCache:"none"}).catch(()=>{});}`;
}

export function bootstrap2ServiceWorkerSource(): string {
  const cacheName = `${BOOTSTRAP2_CACHE_PREFIX}${BOOTSTRAP2_VERSION}`;
  const offlineUrl = bootstrap2AssetUrl("offline.html");
  return `const CACHE=${JSON.stringify(cacheName)};
const CACHE_PREFIX=${JSON.stringify(BOOTSTRAP2_CACHE_PREFIX)};
const VERSION=${JSON.stringify(BOOTSTRAP2_VERSION)};
const OFFLINE=${JSON.stringify(offlineUrl)};
const PRECACHE=${JSON.stringify(PRECACHE_ASSETS)};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  const isThemeAsset=url.origin===self.location.origin&&url.pathname.startsWith(${JSON.stringify(`${BOOTSTRAP2_ASSET_BASE_URL}/`)})&&url.searchParams.get("v")===VERSION;
  if(isThemeAsset){event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));return;}
  if(request.mode==="navigate"){event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE)));}
});`;
}
