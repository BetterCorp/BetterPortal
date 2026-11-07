// Deployment-side conversion only. Services read the result through config-vault.
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safe(value, depth = 0) {
  if (depth > 64) throw new Error("bsb-provisioning-json is too deeply nested");
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("bsb-provisioning-json contains a forbidden key");
      safe(item, depth + 1);
    }
  }
}

/** Validate the BSB subset and each independently deployed Vault override before any API mutation. */
export function parseBsbProvisioning(raw, services) {
  if (!raw) return null;
  if (Buffer.byteLength(raw) > 1024 * 1024) throw new Error("bsb-provisioning-json exceeds 1 MiB");
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("bsb-provisioning-json must be valid JSON"); }
  safe(parsed);
  if (!object(parsed)) throw new Error("bsb-provisioning-json must be an object keyed by BP plugin ID");
  for (const [id, entry] of Object.entries(parsed)) {
    if (!Object.hasOwn(services, id) || !object(entry) || Object.keys(entry).some(k => !["alias", "overrides"].includes(k))
      || typeof entry.alias !== "string" || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,254}$/.test(entry.alias)
      || ["__proto__", "prototype", "constructor"].includes(entry.alias)
      || !object(entry.overrides)) throw new Error("Each BSB provisioning entry requires a requested BP plugin ID, configured BSB alias and existing overrides object");
    if (Buffer.byteLength(JSON.stringify(entry.overrides)) > 128 * 1024) throw new Error("Saved BSB overrides exceed config-vault's 128 KiB limit");
    if (Object.keys(entry.overrides).some(k => !["services", "events", "observable"].includes(k))) throw new Error("BSB overrides contain an unknown section");
    for (const section of Object.values(entry.overrides)) {
      if (!object(section) || Object.values(section).some(v => !object(v))) throw new Error("BSB override sections must contain plugin objects");
    }
    const bp = entry.overrides.services?.[entry.alias]?.betterportal;
    if (bp !== undefined && !object(bp)) throw new Error("Existing betterportal override must be an object");
    if (bp?.previewConfigKey !== undefined) previewConfigKey(bp.previewConfigKey);
  }
  return parsed;
}

/** Validate the caller-held AES key without transmitting or including its value in diagnostics. */
export function previewConfigKey(raw) {
  if (!raw) return undefined;
  if (typeof raw !== "string" || !/^bp_pck_[A-Za-z0-9_-]{43}$/.test(raw) || Buffer.from(raw.slice(7), "base64url").toString("base64url") !== raw.slice(7)) {
    throw new Error("preview-config-key must be a canonical 32-byte bp_pck_ key");
  }
  return raw;
}

/** Merge only selected BSB services; leave other runtime credentials in the original API output. */
export function bsbOverrides(provisioning, credentials, key, baseUrl) {
  if (!provisioning) return {};
  const issued = new Map();
  for (const credential of credentials) {
    if (!object(credential)) throw new Error("Preview credential response has an invalid shape");
    if (!Object.hasOwn(provisioning, credential.serviceId)) continue;
    if (issued.has(credential.serviceId)
      || typeof credential.environment?.BP_CONTROL_PLANE_URL !== "string" || credential.environment.BP_CONTROL_PLANE_URL.replace(/\/+$/, "") !== baseUrl
      || typeof credential.environment?.BP_SERVICE_API_KEY !== "string" || !credential.environment.BP_SERVICE_API_KEY) {
      throw new Error("Preview credential response does not match the requested BSB provisioning");
    }
    issued.set(credential.serviceId, credential.environment);
  }
  const result = {};
  for (const [id, { alias, overrides }] of Object.entries(provisioning)) {
    const next = structuredClone(overrides);
    next.services ??= {};
    if (!Object.hasOwn(next.services, alias)) next.services[alias] = {};
    const plugin = next.services[alias];
    if (plugin.betterportal !== undefined && !object(plugin.betterportal)) throw new Error("Existing betterportal override must be an object");
    plugin.betterportal ??= {};
    const bp = plugin.betterportal;
    const credential = issued.get(id);
    if (credential) {
      bp.controlPlaneUrl = credential.BP_CONTROL_PLANE_URL;
      bp.serviceApiKey = credential.BP_SERVICE_API_KEY;
    }
    if (key) bp.previewConfigKey = key;
    if (typeof bp.controlPlaneUrl !== "string" || bp.controlPlaneUrl.replace(/\/+$/, "") !== baseUrl || typeof bp.serviceApiKey !== "string" || !bp.serviceApiKey) {
      throw new Error("Existing preview credentials are missing; load the saved per-preview overrides before refresh. Legacy BP_* injection must migrate to BSB/Vault. Unchanged service keys are not reissued.");
    }
    if (bp.previewConfigKey !== undefined) previewConfigKey(bp.previewConfigKey);
    const serialized = JSON.stringify(next);
    if (Buffer.byteLength(serialized) > 128 * 1024) throw new Error("Merged BSB overrides exceed config-vault's 128 KiB limit");
    result[id] = next;
  }
  return result;
}

/** Check unchanged bindings and projected output sizes before a POST can issue or rotate keys. */
export function preflightBsbProvisioning(provisioning, services, deployment, key, baseUrl) {
  if (deployment !== null && (!object(deployment) || !Array.isArray(deployment.services))) {
    throw new Error("Preview deployment lookup has an unexpected shape");
  }
  const current = new Map();
  for (const binding of deployment?.services ?? []) {
    if (!object(binding) || typeof binding.serviceId !== "string" || typeof binding.url !== "string" || current.has(binding.serviceId)) {
      throw new Error("Preview deployment lookup contains an invalid service binding");
    }
    current.set(binding.serviceId, new URL(binding.url).origin);
  }
  const projected = Object.keys(provisioning).filter(id => current.get(id) !== services[id]).map(serviceId => ({
    serviceId, environment: { BP_CONTROL_PLANE_URL: baseUrl,
      // The deployment API generates bp_sk_ plus 32 random bytes encoded as hex.
      BP_SERVICE_API_KEY: `bp_sk_${"0".repeat(64)}` }
  }));
  bsbOverrides(provisioning, projected, key, baseUrl);
}
