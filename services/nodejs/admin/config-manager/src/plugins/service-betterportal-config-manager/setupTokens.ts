import { randomBytes } from "node:crypto";
import { jsonResponse, type BetterPortalEvent, type BetterPortalH3App } from "@betterportal/framework/lib/runtime/h3.js";
import { uuidv7 } from "@betterportal/framework/lib/runtime/uuid.js";
import type { AppAuthConfig, BetterPortalConfig, PlatformConfigStore, PlatformService, TenantServiceRegistration } from "@betterportal/framework";
import { signSetupToken } from "@betterportal/framework";
import type { CpBootstrapState } from "./cpBootstrap.js";

interface PendingSetup {
  setupToken: string;
  serviceUrl: string;
  instanceId: string;
  sharedServiceId?: string;
  tenantScope?: { tenantId: string; appId?: string };
  expiresAt: number;
  redeemed: boolean;
}

const SETUP_TTL_SECONDS = 5 * 60;

/**
 * Register the two CM endpoints that drive the browser-mediated install:
 *   1. POST /.well-known/bp/admin/services/begin-install
 *      -> admin UI requests a setup token bound to (serviceUrl, scope?)
 *      -> returns { setupToken, cpUrl, cpJwksUri }
 *   2. POST /.well-known/bp/services/redeem
 *      -> service exchanges single-use setupToken for the real apiKey
 *      -> returns { apiKey, cpId, cpJwksUri }
 */
export function registerSetupEndpoints(input: {
  app: BetterPortalH3App;
  storage: PlatformConfigStore;
  cpState: CpBootstrapState;
}): void {
  const pending = new Map<string, PendingSetup>();

  function sweep(): void {
    const now = Date.now();
    for (const [jti, entry] of pending.entries()) {
      if (entry.expiresAt < now) pending.delete(jti);
    }
  }

  // (1) Admin asks CP to mint a setup token for a target serviceUrl.
  // Optional instanceId - if the caller pre-assigned a UUIDv7 (e.g. bootstrap
  // commit allocates ids to embed in routes/fragments before install), use it;
  // otherwise mint one here.
  input.app.post("/.well-known/bp/admin/services/begin-install", async (event) => {
    sweep();
    const body = await event.req.json().catch(() => null) as {
      serviceUrl?: string;
      tenantId?: string;
      appId?: string;
      sharedServiceId?: string;
      instanceId?: string;
    } | null;
    if (!body || typeof body.serviceUrl !== "string" || body.serviceUrl.length === 0) {
      return jsonResponse({ error: "Missing serviceUrl" }, 400);
    }
    const serviceUrl = body.serviceUrl.replace(/\/+$/, "");
    const tenantScope = body.tenantId ? { tenantId: body.tenantId, appId: body.appId } : undefined;
    const sharedServiceId = typeof body.sharedServiceId === "string" && body.sharedServiceId.length > 0
      ? body.sharedServiceId
      : undefined;
    const instanceId = (typeof body.instanceId === "string" && body.instanceId.length > 0)
      ? body.instanceId : uuidv7();

    const setupToken = signSetupToken({
      privateKeyPem: input.cpState.keyPair.privateKeyPem,
      kid: input.cpState.keyPair.kid,
      claims: {
        iss: input.cpState.issuer,
        tokenType: "setup",
        instanceId,
        serviceUrl,
        cpUrl: input.cpState.issuer,
        cpJwksUri: input.cpState.jwksUri,
        scope: tenantScope,
        expiresInSeconds: SETUP_TTL_SECONDS
      }
    });

    // Track for redeem deduplication. We use the JTI from the issued token.
    const jti = readJti(setupToken);
    if (jti) {
      pending.set(jti, {
        setupToken,
        serviceUrl,
        instanceId,
        sharedServiceId,
        tenantScope,
        expiresAt: Date.now() + SETUP_TTL_SECONDS * 1000,
        redeemed: false
      });
    }

    return jsonResponse({
      setupToken,
      instanceId,
      cpUrl: input.cpState.issuer,
      cpJwksUri: input.cpState.jwksUri,
      expiresInSeconds: SETUP_TTL_SECONDS
    } as Record<string, unknown> as never, 200);
  });

  // (2) Service redeems setup token for real apiKey.
  input.app.post("/.well-known/bp/services/redeem", async (event) => {
    sweep();
    const body = await event.req.json().catch(() => null) as {
      setupToken?: string;
      pluginId?: string;
      serviceUrl?: string;
      publicKeyPem?: string;
      keyId?: string;
      jwks?: { keys: ReadonlyArray<Record<string, unknown>> };
    } | null;
    if (!body || typeof body.setupToken !== "string" || typeof body.pluginId !== "string") {
      return jsonResponse({ error: "Missing setupToken or pluginId" }, 400);
    }

    const jti = readJti(body.setupToken);
    if (!jti) return jsonResponse({ error: "Setup token malformed" }, 400);
    const entry = pending.get(jti);
    if (!entry) return jsonResponse({ error: "Setup token not recognized or expired" }, 400);
    if (entry.redeemed) return jsonResponse({ error: "Setup token already redeemed" }, 409);
    if (entry.expiresAt < Date.now()) {
      pending.delete(jti);
      return jsonResponse({ error: "Setup token expired" }, 400);
    }

    // Mint the real per-service API key. Stored in platform config as a tenant or platform service.
    const apiKey = `bp_sk_t_${randomBytes(32).toString("base64url")}`;
    entry.redeemed = true;
    pending.delete(jti);

    // Persist registration on the CP side. id = instanceId from setup token
    // (pre-assigned UUIDv7) so routes/fragments referencing it resolve.
    // jwks (when provided) lets CM verify tokens issued by this service WITHOUT
    // reaching out to it for JWKS.
    try {
      await registerServiceInPlatformConfig({
        storage: input.storage,
        instanceId: entry.instanceId,
        pluginId: body.pluginId,
        serviceUrl: entry.serviceUrl,
        apiKey,
        publicKeyPem: typeof body.publicKeyPem === "string" ? body.publicKeyPem : undefined,
        keyId: typeof body.keyId === "string" ? body.keyId : undefined,
        jwks: body.jwks,
        sharedServiceId: entry.sharedServiceId,
        tenantScope: entry.tenantScope
      });
    } catch (err) {
      return jsonResponse({ error: "Failed to register service", detail: (err as Error).message }, 500);
    }

    return jsonResponse({
      apiKey,
      cpId: input.cpState.cpId,
      cpJwksUri: input.cpState.jwksUri
    } as Record<string, unknown> as never, 200);
  });
}

function readJti(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { jti?: string };
    return typeof payload.jti === "string" ? payload.jti : undefined;
  } catch {
    return undefined;
  }
}

async function registerServiceInPlatformConfig(input: {
  storage: PlatformConfigStore;
  instanceId: string;
  pluginId: string;
  serviceUrl: string;
  apiKey: string;
  publicKeyPem?: string;
  keyId?: string;
  jwks?: { keys: ReadonlyArray<Record<string, unknown>> };
  sharedServiceId?: string;
  tenantScope?: { tenantId: string; appId?: string };
}): Promise<void> {
  const config = await input.storage.loadConfig();
  const apiKeyHash = await hashApiKey(input.apiKey);
  const now = new Date().toISOString();
  const id = input.instanceId;

  if (input.sharedServiceId) {
    const existing = config.sharedServiceCatalog.find((s) => s.id === input.sharedServiceId);
    if (!existing) throw new Error(`Shared service ${input.sharedServiceId} not found`);
    if (existing.serviceId && existing.serviceId !== input.pluginId) {
      throw new Error(`Shared service ${existing.id} is linked to plugin ${existing.serviceId}, not installed plugin ${input.pluginId}`);
    }
    existing.serviceId = input.pluginId;
    existing.baseUrl = input.serviceUrl;
    existing.apiKeyHash = apiKeyHash;
    existing.title = existing.title || input.pluginId;
    existing.tags = [...new Set([...(existing.tags ?? []), ...defaultCapabilities(input.pluginId)])];
    existing.enabled = true;
    if (input.jwks && isAuthPlugin(input.pluginId)) {
      attachSharedAuthJwks(config, input.sharedServiceId, input.jwks);
    }
  } else if (input.tenantScope?.tenantId) {
    const tenant = config.tenants.find((t) => t.id === input.tenantScope!.tenantId);
    if (!tenant) throw new Error(`Tenant ${input.tenantScope.tenantId} not found`);

    // If this service is the auth provider for one of the tenant's apps,
    // store the JWKS on app.auth.publicKeys so the verifier uses static keys.
    if (input.jwks && input.tenantScope.appId) {
      const app = config.apps.find((a) => a.id === input.tenantScope!.appId);
      const appAuth = (app as { auth?: { serviceId?: string; publicKeys?: unknown } } | undefined)?.auth;
      if (app && appAuth && appAuth.serviceId === id) {
        appAuth.publicKeys = input.jwks;
      }
    }

    // Update existing registration (bootstrap pre-creates the entry) or insert.
    const existing = tenant.services.find((s) => s.id === id);
    if (existing) {
      existing.hostname = input.serviceUrl;
      existing.apiKeyHash = apiKeyHash;
      existing.publicKeyPem = input.publicKeyPem;
      existing.keyId = input.keyId;
      existing.serviceId = input.pluginId;
      existing.capabilities = existing.capabilities?.length ? existing.capabilities : defaultCapabilities(input.pluginId);
      existing.lastSeenAt = now;
      existing.enabled = true;
    } else {
      const service: TenantServiceRegistration = {
        id,
        hostname: input.serviceUrl,
        apiKeyHash,
        publicKeyPem: input.publicKeyPem,
        keyId: input.keyId,
        serviceId: input.pluginId,
        capabilities: defaultCapabilities(input.pluginId),
        title: input.pluginId,
        description: undefined,
        deploymentMode: "self-hosted",
        createdAt: now,
        lastSeenAt: undefined,
        enabled: true
      };
      tenant.services.push(service);
    }
  } else {
    const existing = config.platformServices.find((s) => s.id === id);
    if (existing) {
      existing.hostname = input.serviceUrl;
      existing.apiKeyHash = apiKeyHash;
      existing.publicKeyPem = input.publicKeyPem;
      existing.keyId = input.keyId;
      existing.serviceId = input.pluginId;
      existing.capabilities = existing.capabilities?.length ? existing.capabilities : defaultCapabilities(input.pluginId);
      existing.enabled = true;
    } else {
      const service: PlatformService = {
        id,
        hostname: input.serviceUrl,
        apiKeyHash,
        publicKeyPem: input.publicKeyPem,
        keyId: input.keyId,
        serviceId: input.pluginId,
        capabilities: defaultCapabilities(input.pluginId),
        title: input.pluginId,
        description: undefined,
        category: undefined,
        createdAt: now,
        enabled: true
      };
      config.platformServices.push(service);
    }
  }
  await input.storage.saveConfig(config);
}

function defaultCapabilities(pluginId: string): string[] {
  if (pluginId.startsWith("service.betterportal.theme.")) return ["theme"];
  if (pluginId.includes(".auth.")) return ["auth"];
  if (pluginId.includes(".config-manager")) return ["config"];
  return [];
}

function isAuthPlugin(pluginId: string): boolean {
  return defaultCapabilities(pluginId).includes("auth");
}

function attachSharedAuthJwks(
  config: BetterPortalConfig,
  sharedServiceId: string,
  jwks: { keys: ReadonlyArray<Record<string, unknown>> }
): void {
  const publicKeys: NonNullable<AppAuthConfig["publicKeys"]> = {
    keys: jwks.keys.map((key) => ({ ...key }))
  };
  const activationIds = new Set(
    config.sharedServiceActivations
      .filter((activation) => activation.enabled && activation.sharedServiceId === sharedServiceId)
      .map((activation) => activation.id)
  );
  if (activationIds.size === 0) return;

  for (const app of config.apps) {
    if (app.auth && activationIds.has(app.auth.serviceId)) {
      app.auth.publicKeys = publicKeys;
    }
  }
}

async function hashApiKey(apiKey: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  // MUST match storage/core.ts hashApiKey - validator uses hex.
  return createHash("sha256").update(apiKey).digest("hex");
}
