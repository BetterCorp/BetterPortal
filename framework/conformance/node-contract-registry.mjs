// Disposable real Node registry plus explicitly separated hostile-response fixtures.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { Plugin } from "../../services/nodejs/registry/lib/plugins/service-betterportal-registry/index.js";
import { ContractRegistryStore } from "../../services/nodejs/registry/lib/plugins/service-betterportal-registry/store.js";

const [port, directory, fixture] = process.argv.slice(2);
const contract = JSON.parse(readFileSync(fixture, "utf8"));
const plugin = Object.create(Plugin.prototype);
Object.defineProperty(plugin, "config", { value: {
  publishers: { example: { token: "fixture-publisher-token", pluginIdPrefixes: ["com.example."] }, other: { token: "fixture-publisher-token", pluginIdPrefixes: ["com.other."] } },
  maxBodyBytes: 10 * 1024 * 1024
} });
plugin.store = new ContractRegistryStore(directory);
const requests = [];
const server = createServer((request, response) => {
  if (request.url === "/__requests") {
    response.writeHead(200, { "content-type": "application/json", "x-content-type-options": "nosniff" });
    response.end(JSON.stringify(requests)); return;
  }
  requests.push({ method: request.method, url: request.url, authorization: !!request.headers.authorization, cookie: !!request.headers.cookie });
  if (!request.url.startsWith("/fault/")) { void plugin.handle(request, response); return; }
  const kind = request.url.split("/")[2];
  if (kind === "catalog" && !request.url.includes("/v1/packages?")) {
    request.url = request.url.slice("/fault/catalog".length);
    void plugin.handle(request, response); return;
  }
  const value = structuredClone(contract);
  let body = JSON.stringify(value), status = 200;
  const headers = { "content-type": "application/json", "bp-registry-ref": "example/service", "set-cookie": "fixture-cookie=private" };
  if (kind === "redirect") { status = 302; headers.location = "/__sink"; }
  if (kind === "denied") { status = 403; body = JSON.stringify({ message: "fixture-publisher-token" }); }
  if (kind === "media") headers["content-type"] = "text/html";
  if (kind === "compressed") headers["content-encoding"] = "gzip";
  if (kind === "missing-ref") delete headers["bp-registry-ref"];
  if (kind === "wrong-ref") headers["bp-registry-ref"] = "other/service";
  if (kind === "wrong-plugin") { value.manifest.pluginId = "com.other.service"; body = JSON.stringify(value); }
  if (kind === "wrong-version") { value.manifest.version = "9.0.0"; body = JSON.stringify(value); }
  if (kind === "invalid-schema") body = "{}";
  if (kind === "duplicate") body = '{"manifest":null,' + body.slice(1);
  if (kind === "utf8") body = Buffer.from([0xff]);
  if (kind === "large") body = " ".repeat(16 * 1024 * 1024 + 1);
  if (kind === "catalog") body = JSON.stringify([{ registryRef: "example/service", contract: value, versions: ["1.0.0"] }]);
  if (kind === "publish-identity") body = JSON.stringify({ registryRef: "other/service", pluginId: value.manifest.pluginId, version: value.manifest.version, digest: "sha256:" + "a".repeat(64), unchanged: false });
  response.writeHead(status, headers);
  if (kind === "slow") {
    response.write(" ");
    const timer = setInterval(() => response.write(" "), 200);
    response.on("close", () => clearInterval(timer));
  } else response.end(body);
});
server.listen(Number(port), "127.0.0.1");
