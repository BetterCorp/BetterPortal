// Test-only loopback instances of the existing config-manager, including its
// real file storage, credential checks, manifest commits and scoped projections.
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toNodeHandler } from "h3/node";
import { createBetterPortalApp } from "../nodejs/lib/runtime/h3.js";
import { BetterPortalConfigSchema } from "../nodejs/lib/contracts/platformConfig.js";
import { FileStorage } from "../../services/nodejs/admin/config-manager/lib/plugins/service-betterportal-config-manager/storage/file.js";
import { hashApiKey } from "../../services/nodejs/admin/config-manager/lib/plugins/service-betterportal-config-manager/storage/core.js";
import { registerSyncEndpoint } from "../../services/nodejs/admin/config-manager/lib/plugins/service-betterportal-config-manager/syncApi.js";
import { registerSetupEndpoints } from "../../services/nodejs/admin/config-manager/lib/plugins/service-betterportal-config-manager/setupTokens.js";
import { generateKeyPair, publicKeyToJwk } from "../nodejs/lib/runtime/auth/keypair.js";

const peers = new Map();
let sequence = 0;
export async function syncPeer(body) {
  if (body.command === "start") {
    const directory = await mkdtemp(join(tmpdir(), "bp-node-sync-"));
    const store = new FileStorage(join(directory, "config.yaml"));
    try {
      const config = BetterPortalConfigSchema.parse(body.config);
      config.tenants[0].services[0].apiKeyHash = hashApiKey("bp-test-key");
      await store.saveConfig(config);
      const app = createBetterPortalApp();
      registerSyncEndpoint(app, store);
      const calls = [];
      const handler = toNodeHandler(app);
      const server = createServer((request, response) => {
        calls.push({ method: request.method, path: request.url });
        handler(request, response);
      });
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const url = `http://127.0.0.1:${server.address().port}`;
      if (body.setup) {
        const keyPair = generateKeyPair();
        const jwk = publicKeyToJwk(keyPair.publicKeyPem, keyPair.kid);
        const cpState = { keyPair, jwk, issuer: url, audience: "betterportal-control-plane", cpId: "conformance-cp", jwksUri: url + "/.well-known/jwks.json" };
        app.get("/.well-known/jwks.json", () => new Response(JSON.stringify({ keys: [jwk, ...(body.jwks ?? [])] }), { headers: { "content-type": "application/json" } }));
        registerSetupEndpoints({ app, storage: store, cpState });
      }
      const id = String(++sequence);
      peers.set(id, { server, store, directory, calls });
      return { id, url };
    } catch (error) { store.dispose(); await rm(directory, { recursive: true }); throw error; }
  }
  const peer = peers.get(body.id);
  if (!peer) throw new Error("Unknown test peer");
  if (body.command === "state") return { config: await peer.store.loadConfig(), calls: peer.calls };
  if (body.command === "update") {
    const config = await peer.store.loadConfig();
    if (body.title) config.tenants[0].title = body.title;
    if (body.operations) config.apps[0].routes[0].operations = body.operations;
    if (body.revoke) config.tenants[0].services[0].apiKeyHash = hashApiKey("revoked-key");
    await peer.store.saveConfig(config);
    return { ok: true };
  }
  if (body.command === "stop") {
    peer.server.closeAllConnections();
    await new Promise(resolve => peer.server.close(resolve));
    peer.store.dispose();
    await rm(peer.directory, { recursive: true });
    peers.delete(body.id);
    return { ok: true };
  }
  throw new Error("Unknown peer command");
}
