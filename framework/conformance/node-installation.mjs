// Run the existing BSB-owned installer/sync methods with local configuration and
// real Node stores. The fixture supplies hosting/configuration, not BP policy.
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createBetterPortalApp } from "../nodejs/lib/runtime/h3.js";
import { publicKeyToJwk } from "../nodejs/lib/runtime/auth/keypair.js";
import { registryRequest } from "./node-registry.mjs";
import { clearJwksCache } from "../nodejs/lib/runtime/auth/jwks.js";
import { BPService } from "../../plugins/nodejs/betterportal-bsb/lib/service.js";
import { BootstrapStateStore } from "../../plugins/nodejs/betterportal-bsb/lib/bootstrapState.js";
import { ScopedConfigCache } from "../../plugins/nodejs/betterportal-bsb/lib/scopedConfigCache.js";

export async function installationRequest(body) {
  const directory = await mkdtemp(join(tmpdir(), "bp-node-install-"));
  try {
    // The existing Node sync API does not expose its stream task. A process owner
    // guarantees every legacy writer has stopped before the fixture removes files.
    const stdout = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--worker", directory], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const chunks = []; let size = 0;
      const deadline = setTimeout(() => child.kill(), 9000);
      child.on("error", error => { clearTimeout(deadline); reject(error); });
      child.stdout.on("data", chunk => { size += chunk.length; if (size > 16 * 1024 * 1024) child.kill(); else chunks.push(chunk); });
      child.stderr.resume();
      child.on("close", code => { clearTimeout(deadline); code === 0 ? resolve(Buffer.concat(chunks).toString("utf8")) : reject(new Error("Node installation fixture failed")); });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(body));
    });
    const marker = "\nBP_INSTALLATION_RESULT="; const offset = stdout.lastIndexOf(marker);
    if (offset < 0) throw new Error("Node installation fixture did not return a result");
    const result = JSON.parse(stdout.slice(offset + marker.length));
    result.loggedCredential = (result.outcomes ?? []).some(row => {
      try { const key = JSON.parse(row.body).apiKey; return typeof key === "string" && stdout.slice(0, offset).includes(key); }
      catch { return false; }
    });
    return result;
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error("Invalid temporary directory");
    await rm(directory, { recursive: true });
  }
}

async function run(body, directory) {
  clearJwksCache();
  const filePath = join(directory, "bootstrap.json");
  const publicUrl = new URL(body.serviceUrl ?? "https://service.test");
  const obs = { log: Object.fromEntries(["info", "warn", "error", "debug"].map(level => [level, () => {}])) };
  let runtime;
  const stop = () => { runtime?.sseAbortController?.abort(); clearTimeout(runtime?.syncReconnectTimer); };
  async function start() {
    const schema = registryRequest(body);
    if (schema.status !== 200) throw new Error("Invalid fixture manifest");
    const cache = new ScopedConfigCache({ filePath: join(directory, "snapshot.json") });
    const bootstrapState = new BootstrapStateStore({ filePath });
    const stored = bootstrapState.read();
    runtime = Object.assign(Object.create(BPService.prototype), {
      app: createBetterPortalApp(), manifest: schema.schema.manifest, bootstrapState,
      requireBetterPortalConfigSource: true, configProvider: null,
      scopedConfig: cache.read(), scopedConfigCache: cache, seoProbeCache: new Map(),
      inSetupMode: !stored.apiKey, resolvedCpUrl: stored.cpUrl, resolvedApiKey: stored.apiKey,
      s2sKeyPair: null, s2sIdentityReady: false, manifestSync: { state: "pending" }, sseAbortController: null
    });
    // This is the BSB configuration boundary read by BPService.service/bp getters.
    Object.defineProperty(runtime, "config", { value: { host: publicUrl.hostname, port: Number(publicUrl.port || 443), betterportal: { bootstrapStatePath: filePath } } });
    runtime.registerInstallEndpoint(obs);
    runtime.app.get("/.well-known/bp/health", () => runtime.renderHealth(false));
    if (stored.apiKey) { runtime.initializeS2SIdentity(obs); await runtime.connectToControlPlane(obs); }
  }
  try {
    await writeFile(filePath + ".key", body.key, { mode: 0o600 });
    if (body.stored !== undefined) await writeFile(filePath, body.stored, { mode: 0o600 });
    await start();
    const outcomes = [];
    for (const step of body.steps) {
      let result = { status: 200 };
      if (step.kind === "restart") { stop(); await start(); }
      else if (step.kind !== "state") {
        const method = step.method ?? "GET";
        const response = await runtime.app.fetch(new Request(new URL(step.path ?? "/.well-known/bp/health", publicUrl), {
          method, headers: { host: publicUrl.host, "x-forwarded-proto": publicUrl.protocol.slice(0, -1),
            ...(step.body ? { "content-type": "application/json" } : {}), ...step.headers },
          ...(method === "GET" || method === "HEAD" ? {} : { body: step.raw ?? JSON.stringify(step.body) })
        }));
        result = { status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) };
      }
      const value = runtime.bootstrapState.read();
      const hash = name => createHash("sha256").update(value[name] ?? "").digest("hex");
      outcomes.push({ ...result, ready: runtime.renderHealth(false).status === 200, snapshot: runtime.scopedConfig,
        manifestSync: { ...runtime.manifestSync }, apiKeyHash: hash("apiKey"), configKeyHash: hash("configEncryptionKey"),
        jwk: runtime.s2sKeyPair ? publicKeyToJwk(runtime.s2sKeyPair.publicKeyPem, runtime.s2sKeyPair.kid) : null,
        stored: await readFile(filePath, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; }) });
    }
    return { valid: true, outcomes };
  } catch (error) { return { valid: false, error: error.message }; }
  finally { stop(); }
}

if (process.argv[2] === "--worker") {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const result = await run(JSON.parse(Buffer.concat(chunks).toString()), process.argv[3]);
  process.stdout.write("\nBP_INSTALLATION_RESULT=" + JSON.stringify(result), () => process.exit(0));
}
