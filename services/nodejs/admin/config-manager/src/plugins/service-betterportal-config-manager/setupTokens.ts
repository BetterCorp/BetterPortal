import { createHash, randomBytes } from "node:crypto";
import { jsonResponse, type BetterPortalEvent, type BetterPortalH3App } from "@betterportal/framework/lib/runtime/h3.js";
import { uuidv7 } from "@betterportal/framework/lib/runtime/uuid.js";
import type { AppAuthConfig, AuthProviderRuntimeMetadata, BetterPortalConfig, PlatformConfigStore, PlatformService, PublicJwks, SharedServiceDefinition, TenantServiceRegistration } from "@betterportal/framework";
import { AuthProviderRuntimeMetadataSchema, PublicJwksSchema, signSetupToken } from "@betterportal/framework";
import type { CpBootstrapState } from "./cpBootstrap.js";
import type { PostgresStorage } from "./storage/postgres.js";

interface PendingSetup {
  serviceUrl: string;
  instanceId: string;
  sharedServiceId?: string;
  tenantScope?: { tenantId: string; appId?: string };
  expectedPluginId?: string;
  expiresAt: number;
  redeemed: boolean;
}

interface PendingHostnameChange {
  instanceId: string;
  serviceUrl: string;
  expiresAt: number;
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
  postgres?: PostgresStorage;
  owner?: string;
}): void {
  const pending = new Map<string, PendingSetup>();
  const pendingHostnameChanges = new Map<string, PendingHostnameChange>();

  function sweep(): void {
    const now = Date.now();
    for (const [jti, entry] of pending.entries()) {
      if (entry.expiresAt < now) pending.delete(jti);
    }
    for (const [token, entry] of pendingHostnameChanges.entries()) {
      if (entry.expiresAt < now) pendingHostnameChanges.delete(token);
    }
  }

  input.app.post("/.well-known/bp/admin/services/begin-hostname-change", async (event) => {
    sweep();
    const body = await event.req.json().catch(() => null) as { instanceId?: string; serviceUrl?: string } | null;
    const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
    const serviceUrl = normalizeServiceOrigin(body?.serviceUrl);
    if (!instanceId || !serviceUrl) return jsonResponse({ error: "A service instance and valid URL origin are required" }, 400);

    const config = await input.storage.loadConfig();
    const service = findServiceInstance(config, instanceId);
    if (!service) return jsonResponse({ error: "Service instance not found" }, 404);
    if (!service.enabled || !service.apiKeyHash) return jsonResponse({ error: "Only an installed, enabled service can change URL" }, 409);

    const changeToken = `bp_hc_${randomBytes(32).toString("base64url")}`;
    const pendingChange = {
      instanceId,
      serviceUrl,
      expiresAt: Date.now() + SETUP_TTL_SECONDS * 1000
    };
    if (input.postgres) {
      await input.postgres.createPendingAction({
        kind: "hostname-change",
        key: hashSecret(changeToken),
        secretHash: hashSecret(changeToken),
        payload: pendingChange,
        expiresAt: new Date(pendingChange.expiresAt).toISOString()
      });
    } else pendingHostnameChanges.set(changeToken, pendingChange);
    return jsonResponse({ changeToken, expiresInSeconds: SETUP_TTL_SECONDS }, 200);
  });

  input.app.post("/.well-known/bp/services/confirm-hostname-change", async (event) => {
    const owner = uuidv7();
    sweep();
    const body = await event.req.json().catch(() => null) as { changeToken?: string; serviceUrl?: string } | null;
    const changeToken = typeof body?.changeToken === "string" ? body.changeToken : "";
    const serviceUrl = normalizeServiceOrigin(body?.serviceUrl);
    const actionKey = hashSecret(changeToken);
    const claim = input.postgres ? await input.postgres.claimPendingAction({
      kind: "hostname-change",
      key: actionKey,
      secretHash: actionKey,
      owner
    }) : undefined;
    if (claim?.state === "completed") return jsonResponse((claim.action.result ?? { ok: true }) as unknown as never, 200);
    if (claim?.state === "busy") return jsonResponse({ error: "Hostname change is already being processed" }, 409);
    const entry = claim?.state === "claimed"
      ? claim.action.payload as unknown as PendingHostnameChange
      : input.postgres ? undefined : pendingHostnameChanges.get(changeToken);
    if (!entry) return jsonResponse({ error: "Hostname change token not recognized or expired" }, 400);
    if (!serviceUrl || serviceUrl !== entry.serviceUrl) {
      if (input.postgres) await input.postgres.releasePendingAction("hostname-change", actionKey, owner);
      return jsonResponse({ error: "Service URL does not match the requested hostname" }, 403);
    }

    const authorization = event.req.headers.get("authorization") ?? "";
    const apiKey = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const validated = apiKey ? await input.storage.validateApiKey(apiKey) : null;
    if (!validated) {
      if (input.postgres) await input.postgres.releasePendingAction("hostname-change", actionKey, owner);
      return jsonResponse({ error: "Valid existing service API key required" }, 401);
    }
    const config = await input.storage.loadConfig();
    const service = findServiceInstance(config, entry.instanceId);
    if (!service) {
      if (input.postgres) await input.postgres.releasePendingAction("hostname-change", actionKey, owner);
      return jsonResponse({ error: "Service instance not found" }, 404);
    }
    if (!applyVerifiedServiceOrigin(service, entry.instanceId, validated.serviceId, entry.serviceUrl)) {
      if (input.postgres) await input.postgres.releasePendingAction("hostname-change", actionKey, owner);
      return jsonResponse({ error: "The hostname belongs to a different installed service instance" }, 403);
    }
    const result = { ok: true, serviceUrl: entry.serviceUrl };
    if (input.postgres) await input.postgres.completePendingAction({
      kind: "hostname-change", key: actionKey, owner, result
    }, config);
    else {
      await input.storage.saveConfig(config);
      pendingHostnameChanges.delete(changeToken);
    }
    return jsonResponse(result, 200);
  });

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
      reconfigure?: boolean;
    } | null;
    if (!body || typeof body.serviceUrl !== "string" || body.serviceUrl.length === 0) {
      return jsonResponse({ error: "Missing serviceUrl" }, 400);
    }
    let serviceUrl = body.serviceUrl.replace(/\/+$/, "");
    let tenantScope = body.tenantId ? { tenantId: body.tenantId, appId: body.appId } : undefined;
    const sharedServiceId = typeof body.sharedServiceId === "string" && body.sharedServiceId.length > 0
      ? body.sharedServiceId
      : undefined;
    const instanceId = (typeof body.instanceId === "string" && body.instanceId.length > 0)
      ? body.instanceId : uuidv7();
    let expectedPluginId: string | undefined;

    if (body.reconfigure === true) {
      const config = await input.storage.loadConfig();
      const tenant = config.tenants.find((candidate) => candidate.services.some((service) => service.id === instanceId));
      const existing = tenant?.services.find((service) => service.id === instanceId)
        ?? config.platformServices.find((service) => service.id === instanceId);
      if (!existing) return jsonResponse({ error: "Only an existing non-shared service can be reconfigured" }, 404);
      if (!existing.serviceId) return jsonResponse({ error: "The existing service has no plugin id to verify" }, 409);
      const requestedOrigin = normalizeServiceOrigin(serviceUrl);
      if (!requestedOrigin || requestedOrigin !== normalizeServiceOrigin(existing.hostname)) {
        return jsonResponse({ error: "Reconfiguration must use the service's registered URL" }, 409);
      }
      serviceUrl = requestedOrigin;
      tenantScope = tenant ? { tenantId: tenant.id, appId: undefined } : undefined;
      expectedPluginId = existing.serviceId;
    }

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
      const pendingSetup: PendingSetup = {
        serviceUrl,
        instanceId,
        sharedServiceId,
        tenantScope,
        expectedPluginId,
        expiresAt: Date.now() + SETUP_TTL_SECONDS * 1000,
        redeemed: false
      };
      if (input.postgres) {
        await input.postgres.createPendingAction({
          kind: "setup",
          key: jti,
          secretHash: hashSecret(setupToken),
          payload: pendingSetup as unknown as Record<string, unknown>,
          expiresAt: new Date(pendingSetup.expiresAt).toISOString()
        });
      } else pending.set(jti, pendingSetup);
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
    const owner = uuidv7();
    sweep();
    const body = await event.req.json().catch(() => null) as {
      setupToken?: string;
      pluginId?: string;
      serviceUrl?: string;
      authProvider?: AuthProviderRuntimeMetadata;
      publicKeyPem?: string;
      keyId?: string;
      jwks?: unknown;
    } | null;
    if (!body || typeof body.setupToken !== "string" || typeof body.pluginId !== "string") {
      return jsonResponse({ error: "Missing setupToken or pluginId" }, 400);
    }

    const jti = readJti(body.setupToken);
    if (!jti) return jsonResponse({ error: "Setup token malformed" }, 400);
    const claim = input.postgres ? await input.postgres.claimPendingAction({
      kind: "setup",
      key: jti,
      secretHash: hashSecret(body.setupToken),
      owner
    }) : undefined;
    if (claim?.state === "completed") return jsonResponse((claim.action.result ?? {}) as unknown as never, 200);
    if (claim?.state === "busy") return jsonResponse({ error: "Setup token is already being redeemed" }, 409);
    const entry = claim?.state === "claimed"
      ? claim.action.payload as unknown as PendingSetup
      : input.postgres ? undefined : pending.get(jti);
    if (!entry) return jsonResponse({ error: "Setup token not recognized or expired" }, 400);
    if (entry.redeemed) return jsonResponse({ error: "Setup token already redeemed" }, 409);
    if (entry.expiresAt < Date.now()) {
      pending.delete(jti);
      return jsonResponse({ error: "Setup token expired" }, 400);
    }
    if (entry.expectedPluginId && !servicePluginIdsMatch(entry.expectedPluginId, body.pluginId)) {
      if (input.postgres) await input.postgres.releasePendingAction("setup", jti, owner);
      return jsonResponse({ error: "The replacement service plugin id does not match the existing registration" }, 409);
    }

    // Mint the real per-service API key. Stored in platform config as a tenant or platform service.
    const apiKey = `bp_sk_t_${randomBytes(32).toString("base64url")}`;

    // Persist registration on the CP side. id = instanceId from setup token
    // (pre-assigned UUIDv7) so routes/fragments referencing it resolve.
    // jwks (when provided) lets CM verify tokens issued by this service WITHOUT
    // reaching out to it for JWKS.
    let jwks: PublicJwks | undefined;
    try {
      jwks = body.jwks === undefined ? undefined : PublicJwksSchema.parse(body.jwks);
    } catch {
      if (input.postgres) await input.postgres.releasePendingAction("setup", jti, owner);
      return jsonResponse({ error: "Invalid RSA JWKS" }, 400);
    }
    const result = {
      apiKey,
      cpId: input.cpState.cpId,
      cpJwksUri: input.cpState.jwksUri
    };
    if (!input.postgres) entry.redeemed = true;
    try {
      const config = await registerServiceInPlatformConfig({
        storage: input.storage,
        instanceId: entry.instanceId,
        pluginId: body.pluginId,
        serviceUrl: entry.serviceUrl,
        authProvider: normalizeAuthProviderMetadata(body.authProvider),
        apiKey,
        publicKeyPem: typeof body.publicKeyPem === "string" ? body.publicKeyPem : undefined,
        keyId: typeof body.keyId === "string" ? body.keyId : undefined,
        jwks,
        sharedServiceId: entry.sharedServiceId,
        tenantScope: entry.tenantScope
      });
      if (input.postgres) await input.postgres.completePendingAction({ kind: "setup", key: jti, owner, result }, config);
      else {
        await input.storage.saveConfig(config);
        entry.redeemed = true;
        pending.delete(jti);
      }
    } catch (err) {
      if (!input.postgres) entry.redeemed = false;
      if (input.postgres) await input.postgres.releasePendingAction("setup", jti, owner);
      return jsonResponse({ error: "Failed to register service", detail: (err as Error).message }, 500);
    }

    return jsonResponse(result as Record<string, unknown> as never, 200);
  });
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeServiceOrigin(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.search || url.hash) return undefined;
    if (url.pathname !== "/") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function findServiceInstance(
  config: BetterPortalConfig,
  instanceId: string
): TenantServiceRegistration | PlatformService | SharedServiceDefinition | undefined {
  return config.platformServices.find((service) => service.id === instanceId)
    ?? config.sharedServiceCatalog.find((service) => service.id === instanceId)
    ?? config.tenants.flatMap((tenant) => tenant.services).find((service) => service.id === instanceId);
}

export function applyVerifiedServiceOrigin(
  service: TenantServiceRegistration | PlatformService | SharedServiceDefinition,
  expectedInstanceId: string,
  verifiedInstanceId: string | undefined,
  serviceUrl: string
): boolean {
  if (verifiedInstanceId !== expectedInstanceId) return false;
  if ("baseUrl" in service) service.baseUrl = serviceUrl;
  else service.hostname = serviceUrl;
  return true;
}

export function servicePluginIdsMatch(expectedPluginId: string | undefined, actualPluginId: string | undefined): boolean {
  return typeof expectedPluginId === "string" && expectedPluginId.length > 0 && expectedPluginId === actualPluginId;
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
  authProvider?: AuthProviderRuntimeMetadata;
  apiKey: string;
  publicKeyPem?: string;
  keyId?: string;
  jwks?: PublicJwks;
  sharedServiceId?: string;
  tenantScope?: { tenantId: string; appId?: string };
}): Promise<BetterPortalConfig> {
  const config = await input.storage.loadConfig();
  const apiKeyHash = await hashApiKey(input.apiKey);
  const now = new Date().toISOString();
  const id = input.instanceId;

  if (input.sharedServiceId) {
    const existing = config.sharedServiceCatalog.find((s) => s.id === input.sharedServiceId);
    if (!existing) throw new Error(`Shared service ${input.sharedServiceId} not found`);
    if (existing.serviceId && !servicePluginIdsMatch(existing.serviceId, input.pluginId)) {
      throw new Error(`Shared service ${existing.id} is linked to plugin ${existing.serviceId}, not installed plugin ${input.pluginId}`);
    }
    existing.serviceId = input.pluginId;
    existing.baseUrl = input.serviceUrl;
    if (input.authProvider && isAuthPlugin(input.pluginId)) existing.authProvider = input.authProvider;
    existing.apiKeyHash = apiKeyHash;
    existing.title = existing.title || input.pluginId;
    existing.tags = [...new Set([...(existing.tags ?? []), ...defaultCapabilities(input.pluginId)])];
    existing.enabled = true;
    if (input.jwks && isAuthPlugin(input.pluginId)) {
      attachSharedAuthJwks(config, input.sharedServiceId, input.jwks);
    }
    if (input.authProvider && isAuthPlugin(input.pluginId)) {
      attachSharedAuthProviderMetadata(config, input.sharedServiceId, input.authProvider);
    }
  } else if (input.tenantScope?.tenantId) {
    const tenant = config.tenants.find((t) => t.id === input.tenantScope!.tenantId);
    if (!tenant) throw new Error(`Tenant ${input.tenantScope.tenantId} not found`);

    // A replacement auth service can rotate its keys, so refresh every app
    // already bound to this service instance.
    for (const app of config.apps) {
      if (app.tenantId !== tenant.id || app.auth?.serviceId !== id) continue;
      if (input.jwks) app.auth.publicKeys = input.jwks;
      if (input.authProvider) applyAuthProviderMetadata(app.auth, input.authProvider);
    }

    // Update existing registration (bootstrap pre-creates the entry) or insert.
    const existing = tenant.services.find((s) => s.id === id);
    if (existing) {
      if (existing.serviceId && !servicePluginIdsMatch(existing.serviceId, input.pluginId)) {
        throw new Error(`Service ${existing.id} is linked to plugin ${existing.serviceId}, not installed plugin ${input.pluginId}`);
      }
      existing.hostname = input.serviceUrl;
      existing.apiKeyHash = apiKeyHash;
      existing.publicKeyPem = input.publicKeyPem;
      existing.keyId = input.keyId;
      existing.serviceId = input.pluginId;
      if (input.authProvider && isAuthPlugin(input.pluginId)) existing.authProvider = input.authProvider;
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
        ...(input.authProvider && isAuthPlugin(input.pluginId) ? { authProvider: input.authProvider } : {}),
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
      if (existing.serviceId && !servicePluginIdsMatch(existing.serviceId, input.pluginId)) {
        throw new Error(`Service ${existing.id} is linked to plugin ${existing.serviceId}, not installed plugin ${input.pluginId}`);
      }
      existing.hostname = input.serviceUrl;
      existing.apiKeyHash = apiKeyHash;
      existing.publicKeyPem = input.publicKeyPem;
      existing.keyId = input.keyId;
      existing.serviceId = input.pluginId;
      if (input.authProvider && isAuthPlugin(input.pluginId)) existing.authProvider = input.authProvider;
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
        ...(input.authProvider && isAuthPlugin(input.pluginId) ? { authProvider: input.authProvider } : {}),
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
  return config;
}

function defaultCapabilities(pluginId: string): string[] {
  if (pluginId.startsWith("org.betterportal.theme.")) return ["theme"];
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
  jwks: PublicJwks
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

function attachSharedAuthProviderMetadata(
  config: BetterPortalConfig,
  sharedServiceId: string,
  authProvider: AuthProviderRuntimeMetadata
): void {
  const activationIds = new Set(
    config.sharedServiceActivations
      .filter((activation) => activation.enabled && activation.sharedServiceId === sharedServiceId)
      .map((activation) => activation.id)
  );
  if (activationIds.size === 0) return;

  for (const app of config.apps) {
    if (app.auth && activationIds.has(app.auth.serviceId)) {
      applyAuthProviderMetadata(app.auth, authProvider);
    }
  }
}

function applyAuthProviderMetadata(appAuth: AppAuthConfig, authProvider: AuthProviderRuntimeMetadata): void {
  appAuth.expectedIssuer = authProvider.issuer;
  appAuth.expectedAudience = authProvider.audience;
  appAuth.jwksUri = authProvider.jwksUri;
  if (authProvider.publicKeys) appAuth.publicKeys = authProvider.publicKeys;
}

function normalizeAuthProviderMetadata(value: unknown): AuthProviderRuntimeMetadata | undefined {
  try {
    const parsed = AuthProviderRuntimeMetadataSchema.parse(value);
    const issuer = parsed.issuer.trim().replace(/\/+$/, "");
    const audience = parsed.audience.trim();
    const jwksUri = parsed.jwksUri.trim();
    return issuer && audience && jwksUri ? { ...parsed, issuer, audience, jwksUri } : undefined;
  } catch {
    return undefined;
  }
}

async function hashApiKey(apiKey: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  // MUST match storage/core.ts hashApiKey - validator uses hex.
  return createHash("sha256").update(apiKey).digest("hex");
}
