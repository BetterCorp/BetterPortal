import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const API_PATH = "/api/preview-groups";

function input(env, name, required = false) {
  const value = (env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? "").trim();
  if (required && !value) throw new Error(`${name} is required`);
  return value;
}

function parseServices(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("services-json must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error("services-json must be a non-empty object keyed by service plugin ID");
  }
  for (const [serviceId, url] of Object.entries(value)) {
    if (!serviceId || typeof url !== "string" || !url.trim()) {
      throw new Error("services-json keys and URLs must be non-empty strings");
    }
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error(`Service URL for ${serviceId} must be an HTTPS origin without credentials, path, query, or fragment`);
    }
    value[serviceId] = parsed.origin;
  }
  return value;
}

function parseExpiry(raw) {
  if (raw === "never") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error("expires-in-days must be a positive whole number or never");
  return value;
}

function controlPlaneUrl(raw) {
  const value = new URL(raw);
  const loopback = value.hostname === "localhost" || value.hostname === "127.0.0.1" || value.hostname === "[::1]";
  if (value.protocol !== "https:" && !(value.protocol === "http:" && loopback)) {
    throw new Error("control-plane-url must use HTTPS");
  }
  if (value.username || value.password || value.search || value.hash) {
    throw new Error("control-plane-url cannot contain credentials, a query, or a fragment");
  }
  return value.toString().replace(/\/$/, "");
}

async function oidcToken(env, audience, fetchImpl) {
  const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error("GitHub OIDC is unavailable; grant the job permissions.id-token: write");
  }
  const url = new URL(requestUrl);
  if (url.protocol !== "https:") throw new Error("GitHub OIDC request URL must use HTTPS");
  url.searchParams.set("audience", audience);
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${requestToken}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`GitHub OIDC token request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || typeof payload.value !== "string" || !payload.value) {
    throw new Error("GitHub OIDC token response did not contain a token");
  }
  return payload.value;
}

async function callPreviewApi(fetchImpl, endpoint, method, token, body) {
  const response = await fetchImpl(endpoint, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let payload;
  if (text) {
    try { payload = JSON.parse(text); } catch { throw new Error(`BetterPortal returned invalid JSON (HTTP ${response.status})`); }
  }
  if (!response.ok) {
    const detail = payload && typeof payload.error === "string" ? `: ${payload.error}` : "";
    throw new Error(`BetterPortal preview request failed with HTTP ${response.status}${detail}`);
  }
  return payload;
}

function defaultCommand(name, value) {
  const escaped = String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  process.stdout.write(`::${name}::${escaped}\n`);
}

function defaultOutput(env, name, value) {
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is unavailable");
  const delimiter = `bp_${randomUUID()}`;
  appendFileSync(env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}

export async function execute(env = process.env, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const command = dependencies.command ?? defaultCommand;
  const setOutput = dependencies.setOutput ?? ((name, value) => defaultOutput(env, name, value));
  const operation = input(env, "operation") || "upsert";
  if (operation !== "upsert" && operation !== "delete") throw new Error("operation must be upsert or delete");

  const baseUrl = controlPlaneUrl(input(env, "control-plane-url", true));
  const groupId = input(env, "group-id", true);
  const key = input(env, "key", true);
  const audience = input(env, "audience", true);
  const endpoint = `${baseUrl}${API_PATH}/${encodeURIComponent(groupId)}/deployments/${encodeURIComponent(key)}`;

  if (operation === "delete") {
    const token = await oidcToken(env, audience, fetchImpl);
    await callPreviewApi(fetchImpl, endpoint, "DELETE", token);
    setOutput("created", "false");
    setOutput("preview-json", "");
    setOutput("credentials-json", "[]");
    command("notice", `Deleted BetterPortal preview ${key}`);
    return;
  }

  const hostname = input(env, "hostname", true);
  const body = {
    hostname,
    setupMode: "pull",
    expiresInDays: parseExpiry(input(env, "expires-in-days") || "7"),
    services: parseServices(input(env, "services-json", true))
  };
  const name = input(env, "name");
  if (name) body.name = name;
  const token = await oidcToken(env, audience, fetchImpl);
  const result = await callPreviewApi(fetchImpl, endpoint, "POST", token, body);
  if (!result || typeof result.created !== "boolean" || !result.preview || !Array.isArray(result.credentials)) {
    throw new Error("BetterPortal preview response has an unexpected shape");
  }
  for (const credential of result.credentials) {
    const apiKey = credential?.environment?.BP_SERVICE_API_KEY;
    if (typeof apiKey === "string" && apiKey) command("add-mask", apiKey);
  }
  setOutput("created", String(result.created));
  setOutput("preview-json", JSON.stringify(result.preview));
  setOutput("credentials-json", JSON.stringify(result.credentials));
  command("notice", `${result.created ? "Created" : "Refreshed"} BetterPortal preview ${key}`);
}

async function main() {
  try {
    await execute();
  } catch (error) {
    defaultCommand("error", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
