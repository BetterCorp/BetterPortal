import { setTimeout as delay } from "node:timers/promises";
import { ConfigRevisionConflictError } from "./storage/core.js";
import { credentialDiagnostics } from "./credentialDiagnostics.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  jsonResponse,
  eventObservability,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type JsonValue,
  type PlatformConfigStore
} from "@betterportal/framework";
import {
  PREVIEW_DEPLOYMENT_API_BASE,
  PreviewEnvironmentError,
  authenticatePreviewGroup,
  deleteExpiredPreviewDeployments,
  deletePreviewDeployment,
  provisionPreviewDeployment,
  type IssuedPreviewCredential
} from "./previewEnvironments.js";

const NO_STORE = { "Cache-Control": "no-store" };

export function registerPreviewDeploymentApi(input: {
  app: BetterPortalH3App;
  storage: PlatformConfigStore;
  controlPlaneUrl: string;
  replayEncryptionKey: string;
}): void {
  const route = `${PREVIEW_DEPLOYMENT_API_BASE}/:groupId/deployments/:key`;

  input.app.get(route, async (event) => withPreviewApiErrors(event, input.storage, async () => {
    const config = await input.storage.loadConfig();
    const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === event.context.params?.groupId);
    if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
    await authenticatePreviewGroup(group, event.req.headers.get("authorization"));
    const expired = deleteExpiredPreviewDeployments(config);
    if (expired.length) await input.storage.saveConfig(config);
    const deployment = config.previewEnvironmentDeployments.find((candidate) =>
      candidate.groupId === group.id && candidate.key === event.context.params?.key
    );
    if (!deployment) throw new PreviewEnvironmentError("Preview deployment was not found", 404);
    const { credentialReplay: _replay, ...publicDeployment } = deployment;
    return jsonResponse(publicDeployment as unknown as JsonValue, 200, NO_STORE);
  }));

  input.app.post(route, async (event) => {
    // Request bodies are streams: parse once, but reauthenticate and recompute on every attempt.
    let bodyPromise: Promise<Record<string, unknown>> | undefined;
    return withPreviewApiErrors(event, input.storage, async () => {
      const config = await input.storage.loadConfig();
      const groupId = event.context.params?.groupId ?? "";
      const key = event.context.params?.key ?? "";
      const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
      if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
      await authenticatePreviewGroup(group, event.req.headers.get("authorization"));
      const body = await (bodyPromise ??= readObject(event));
      if (body.setupMode !== undefined && body.setupMode !== "pull") {
        throw new PreviewEnvironmentError("Only pull setup mode is supported for preview deployments");
      }
      const existing = config.previewEnvironmentDeployments.find((candidate) => candidate.groupId === groupId && candidate.key === key);
      const hostname = typeof body.hostname === "string" ? body.hostname : existing?.hostname;
      if (!hostname) throw new PreviewEnvironmentError("hostname is required when creating a preview");
      const request = {
        key,
        name: typeof body.name === "string" ? body.name : undefined,
        hostname,
        expiresInDays: parseExpiry(body.expiresInDays),
        services: parseServices(body.services).sort((a, b) => a.serviceId.localeCompare(b.serviceId))
      };
      const requestHash = createHash("sha256").update(JSON.stringify(request)).digest("hex");
      const aad = `${groupId}:${key}:${requestHash}`;
      const replay = existing?.credentialReplay;
      if (replay?.requestHash === requestHash && Date.parse(replay.expiresAt) > Date.now()) {
        const payload = openReplay(replay.ciphertext, input.replayEncryptionKey, aad);
        logPreviewCredentials(event, groupId, key, "replayed", (payload as unknown as { credentials: IssuedPreviewCredential[] }).credentials);
        return jsonResponse(payload, (payload as { created: boolean }).created ? 201 : 200, NO_STORE);
      }
      const result = provisionPreviewDeployment(config, groupId, request, input.controlPlaneUrl);
      const payload = {
        created: result.created,
        preview: {
          key: result.deployment.key,
          name: result.deployment.name,
          hostname: result.deployment.hostname,
          expiresAt: result.deployment.expiresAt ?? null
        },
        credentials: result.credentials
      } as unknown as JsonValue;
      result.deployment.credentialReplay = {
        requestHash,
        ciphertext: sealReplay(payload, input.replayEncryptionKey, aad),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
      };
      await input.storage.saveConfig(config);
      logPreviewCredentials(event, groupId, key, result.created ? "created" : "updated", result.credentials);
      return jsonResponse(payload, result.created ? 201 : 200, NO_STORE);
    });
  });

  input.app.delete(route, async (event) => withPreviewApiErrors(event, input.storage, async () => {
    const config = await input.storage.loadConfig();
    const groupId = event.context.params?.groupId ?? "";
    const key = event.context.params?.key ?? "";
    const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
    if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
    await authenticatePreviewGroup(group, event.req.headers.get("authorization"));
    const deployment = config.previewEnvironmentDeployments.find((candidate) => candidate.groupId === groupId && candidate.key === key);
    if (deployment) {
      deletePreviewDeployment(config, deployment.id);
      await input.storage.saveConfig(config);
      eventObservability(event)?.logger.info("BP PREVIEW: deleted group={groupId} preview={previewKey} tenant={tenantId}", {
        groupId, previewKey: key, tenantId: deployment.tenantId
      });
    }
    return new Response(null, { status: 204, headers: NO_STORE });
  }));
}

function logPreviewCredentials(
  event: BetterPortalEvent,
  groupId: string,
  previewKey: string,
  action: string,
  credentials: IssuedPreviewCredential[]
): void {
  const logger = eventObservability(event)?.logger;
  logger?.info("BP PREVIEW: {action} group={groupId} preview={previewKey} credentialCount={credentialCount}", {
    action, groupId, previewKey, credentialCount: credentials.length
  });
  for (const credential of credentials) {
    logger?.info("BP PREVIEW: credential {action} group={groupId} preview={previewKey} service={serviceId} serviceInstance={serviceInstanceId} fingerprint={keyFingerprint} instance={configManagerInstance} controlPlane={controlPlaneUrl}", {
      action, groupId, previewKey,
      serviceId: credential.serviceId,
      serviceInstanceId: credential.instanceId,
      controlPlaneUrl: credential.environment.BP_CONTROL_PLANE_URL,
      ...credentialDiagnostics(credential.environment.BP_SERVICE_API_KEY)
    });
  }
}

function sealReplay(value: JsonValue, secret: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function openReplay(value: string, secret: string, aad: string): JsonValue {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as JsonValue;
}

async function withPreviewApiErrors(
  event: BetterPortalEvent,
  storage: PlatformConfigStore,
  action: () => Promise<Response>
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ConfigRevisionConflictError) {
        // Never resave the rejected snapshot: discard cached state and rerun the
        // full operation, including authorization and credential replay lookup.
        storage.invalidate();
        if (attempt < 4) {
          await delay(25 * 2 ** attempt * (1 + Math.random()));
          continue;
        }
        return jsonResponse({ error: "Preview configuration is busy; retry submission" }, 503, {
          ...NO_STORE,
          "Retry-After": "1"
        });
      }
      if (error instanceof PreviewEnvironmentError) {
        return jsonResponse({ error: error.message }, error.status, NO_STORE);
      }
      eventObservability(event)?.logger.error("Preview deployment API failed: {msg}", {
        msg: error instanceof Error ? error.message : String(error)
      });
      return jsonResponse({ error: "Preview operation failed" }, 500, NO_STORE);
    }
  }
}

async function readObject(event: BetterPortalEvent): Promise<Record<string, unknown>> {
  const body = await event.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PreviewEnvironmentError("A JSON object request body is required");
  }
  return body as Record<string, unknown>;
}

function parseServices(value: unknown): Array<{ serviceId: string; url: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PreviewEnvironmentError("services must be an object keyed by service plugin ID");
  }
  return Object.entries(value as Record<string, unknown>).map(([serviceId, url]) => {
    if (typeof url !== "string") throw new PreviewEnvironmentError(`Service URL for ${serviceId} must be a string`);
    return { serviceId, url };
  });
}

function parseExpiry(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "never") return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new PreviewEnvironmentError("expiresInDays must be an integer or null");
  }
  return value;
}
