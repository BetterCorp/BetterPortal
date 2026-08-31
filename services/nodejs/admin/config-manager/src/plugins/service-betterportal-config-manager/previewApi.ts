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
  provisionPreviewDeployment
} from "./previewEnvironments.js";

const NO_STORE = { "Cache-Control": "no-store" };

export function registerPreviewDeploymentApi(input: {
  app: BetterPortalH3App;
  storage: PlatformConfigStore;
  controlPlaneUrl: string;
}): void {
  const route = `${PREVIEW_DEPLOYMENT_API_BASE}/:groupId/deployments/:key`;

  input.app.get(route, async (event) => withPreviewApiErrors(event, async () => {
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
    return jsonResponse(deployment as unknown as JsonValue, 200, NO_STORE);
  }));

  input.app.post(route, async (event) => withPreviewApiErrors(event, async () => {
    const config = await input.storage.loadConfig();
    const groupId = event.context.params?.groupId ?? "";
    const key = event.context.params?.key ?? "";
    const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
    if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
    await authenticatePreviewGroup(group, event.req.headers.get("authorization"));
    const body = await readObject(event);
    if (body.setupMode !== undefined && body.setupMode !== "pull") {
      throw new PreviewEnvironmentError("Only pull setup mode is supported for preview deployments");
    }
    const existing = config.previewEnvironmentDeployments.find((candidate) => candidate.groupId === groupId && candidate.key === key);
    const hostname = typeof body.hostname === "string" ? body.hostname : existing?.hostname;
    if (!hostname) throw new PreviewEnvironmentError("hostname is required when creating a preview");
    const result = provisionPreviewDeployment(config, groupId, {
      key,
      name: typeof body.name === "string" ? body.name : undefined,
      hostname,
      expiresInDays: parseExpiry(body.expiresInDays),
      services: parseServices(body.services)
    }, input.controlPlaneUrl);
    await input.storage.saveConfig(config);
    return jsonResponse({
      created: result.created,
      preview: {
        key: result.deployment.key,
        name: result.deployment.name,
        hostname: result.deployment.hostname,
        expiresAt: result.deployment.expiresAt ?? null
      },
      credentials: result.credentials
    } as unknown as JsonValue, result.created ? 201 : 200, NO_STORE);
  }));

  input.app.delete(route, async (event) => withPreviewApiErrors(event, async () => {
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
    }
    return new Response(null, { status: 204, headers: NO_STORE });
  }));
}

async function withPreviewApiErrors(event: BetterPortalEvent, action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof PreviewEnvironmentError) {
      return jsonResponse({ error: error.message }, error.status, NO_STORE);
    }
    eventObservability(event)?.logger.error("Preview deployment API failed: {msg}", {
      msg: error instanceof Error ? error.message : String(error)
    });
    return jsonResponse({ error: "Preview operation failed" }, 500, NO_STORE);
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
