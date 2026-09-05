import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  eventHeaders,
  jsonResponse,
  resolveEmbeddedRequestContext,
  uuidv7,
  type BetterPortalConfig,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type JsonValue,
  type PlatformConfigStore,
  type WebhookTarget
} from "@betterportal/framework";
import { eventObservability } from "@betterportal/framework";
import { getManifestCache } from "./syncApi.js";
import type { PostgresStorage, WebhookDeliveryRecord } from "./storage/postgres.js";

const API_BASE = "/.well-known/bp";
const RELATIVE_URL_PARSE_BASE = "http://betterportal.invalid";

type DeliveryRecord = WebhookDeliveryRecord;

function readBearer(event: BetterPortalEvent): string | null {
  const auth = event.req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function readJson(event: BetterPortalEvent): Promise<Record<string, unknown>> {
  const parsed = await event.req.json().catch(() => null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function stringValue(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function currentAppFromRequest(config: BetterPortalConfig, event: BetterPortalEvent) {
  const url = new URL(event.req.url, RELATIVE_URL_PARSE_BASE);
  const appId = url.searchParams.get("appId") ?? event.req.headers.get("x-bp-app-id") ?? "";
  return appId
    ? config.apps.find((entry) => entry.id === appId)
    : resolveEmbeddedRequestContext(config, eventHeaders(event))?.app;
}

function matchingTargets(config: BetterPortalConfig, serviceId: string, eventId: string, tenantId: string, appId?: string): WebhookTarget[] {
  const tenant = config.tenants.find((entry) => entry.id === tenantId && entry.active);
  if (!tenant) return [];
  return config.webhooks.targets.filter((target) =>
    target.enabled
    && target.serviceId === serviceId
    && target.eventId === eventId
    && target.tenantId === tenantId
    && (!target.appId || target.appId === appId)
  );
}

function sign(target: WebhookTarget, record: DeliveryRecord, timestamp: string): string {
  const body = `${timestamp}.${record.id}.${record.eventId}.${JSON.stringify(record.payload)}`;
  return `sha256=${createHmac("sha256", target.secret).update(body).digest("hex")}`;
}

function backoff(attempts: number): number {
  return Math.min(60 * 60, 2 ** Math.max(0, attempts - 1) * 30);
}

async function deliver(target: WebhookTarget, record: DeliveryRecord): Promise<{ ok: boolean; status?: number; error?: string }> {
  const timestamp = new Date().toISOString();
  try {
    const response = await fetch(target.url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "content-type": "application/json",
        "x-bp-webhook-id": record.id,
        "x-bp-webhook-event": record.eventId,
        "x-bp-webhook-timestamp": timestamp,
        "x-bp-webhook-signature": sign(target, record, timestamp)
      },
      body: JSON.stringify({
        id: record.id,
        serviceId: record.serviceId,
        eventId: record.eventId,
        tenantId: record.tenantId,
        appId: record.appId,
        payload: record.payload
      })
    });
    // Do not buffer an unbounded error body or leave a successful body unread.
    await response.body?.cancel();
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : response.statusText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function processDeliveries(
  store: PlatformConfigStore,
  postgres: PostgresStorage | undefined,
  owner: string,
  memoryQueue: DeliveryRecord[]
): Promise<void> {
  const config = await store.loadConfig();
  const targets = new Map(config.webhooks.targets.map((target) => [target.id, target]));
  const now = Date.now();
  const records = postgres
    ? (async function* () {
      for (let count = 0; count < 25; count++) {
        const claimed = await postgres.claimWebhookDeliveries(owner, 1);
        if (!claimed.length) return;
        yield claimed[0];
      }
    })()
    : memoryQueue.filter((record) => record.status === "pending" && Date.parse(record.nextAttemptAt) <= now);

  for await (const record of records) {
    const target = targets.get(record.targetId);
    if (!target?.enabled || !config.tenants.some((tenant) => tenant.id === target.tenantId && tenant.active)) {
      record.status = "failed";
      record.lastError = "target disabled or tenant inactive";
      if (postgres) await postgres.finishWebhookDelivery(owner, record);
      continue;
    }

    record.attempts += 1;
    const result = await deliver(target, record);
    record.lastStatus = result.status;
    record.lastError = result.error;
    record.status = result.ok ? "delivered" : record.attempts >= record.maxAttempts ? "failed" : "pending";
    record.nextAttemptAt = new Date(Date.now() + backoff(record.attempts) * 1000).toISOString();
    if (postgres) await postgres.finishWebhookDelivery(owner, record);
  }
  if (postgres) await postgres.cleanupWebhookDeliveries();
  else {
    for (let index = memoryQueue.length - 1; index >= 0; index -= 1) {
      if (memoryQueue[index].status !== "pending") memoryQueue.splice(index, 1);
    }
  }
}

export function registerWebhookRoutes(
  app: BetterPortalH3App,
  store: PlatformConfigStore,
  postgres?: PostgresStorage,
  owner = "single"
): { start(): void; stop(): void; drain(): Promise<void> } {
  const memoryQueue: DeliveryRecord[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let draining: Promise<void> | undefined;
  const enqueue = async (records: DeliveryRecord[]) => {
    if (postgres) await postgres.enqueueWebhookDeliveries(records);
    else memoryQueue.push(...records.filter((record) => !memoryQueue.some((queued) => queued.id === record.id)));
  };
  const drain = () => draining ??= processDeliveries(store, postgres, owner, memoryQueue).finally(() => { draining = undefined; });

  app.get(`${API_BASE}/admin/webhooks/events`, async () => {
    const manifests = [...getManifestCache().entries()].map(([serviceId, manifest]) => ({
      serviceId,
      title: manifest.title,
      webhooks: manifest.webhooks
    }));
    return jsonResponse(manifests as unknown as JsonValue);
  });

  app.get(`${API_BASE}/admin/webhooks/targets`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config.webhooks.targets.map(({ secret: _secret, ...target }) => target) as unknown as JsonValue);
  });

  app.get(`${API_BASE}/manage/webhooks/events`, async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const services = new Set([
      ...(config.tenants.find((tenant) => tenant.id === appDef.tenantId)?.services.map((service) => service.id) ?? []),
      ...config.sharedServiceActivations
        .filter((activation) => activation.enabled && activation.tenantId === appDef.tenantId && (!activation.appId || activation.appId === appDef.id))
        .map((activation) => activation.id)
    ]);
    return jsonResponse([...getManifestCache().entries()]
      .filter(([serviceId]) => services.has(serviceId))
      .map(([serviceId, manifest]) => ({ serviceId, title: manifest.title, webhooks: manifest.webhooks })) as unknown as JsonValue);
  });

  app.get(`${API_BASE}/manage/webhooks/targets`, async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    return jsonResponse(config.webhooks.targets
      .filter((target) => target.tenantId === appDef.tenantId && (!target.appId || target.appId === appDef.id))
      .map(({ secret: _secret, ...target }) => target) as unknown as JsonValue);
  });

  app.post(`${API_BASE}/manage/webhooks/targets`, async (event) => {
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const body = await readJson(event);
    const serviceId = stringValue(body, "serviceId");
    const eventId = stringValue(body, "eventId");
    const url = stringValue(body, "url");
    if (!serviceId || !eventId || !url) return jsonResponse({ error: "serviceId, eventId and url are required" }, 400);
    const manifest = getManifestCache().get(serviceId);
    if (!manifest?.webhooks.some((entry) => entry.id === eventId)) return jsonResponse({ error: "Webhook event is not declared by service manifest" }, 400);
    const target: WebhookTarget = {
      id: uuidv7(),
      tenantId: appDef.tenantId,
      appId: appDef.id,
      serviceId,
      eventId,
      url,
      secret: randomBytes(32).toString("hex"),
      createdAt: new Date().toISOString(),
      enabled: true,
      maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : 10
    };
    config.webhooks.targets.push(target);
    await store.saveConfig(config);
    return jsonResponse(target as unknown as JsonValue, 201);
  });

  app.delete(`${API_BASE}/manage/webhooks/targets/:targetId`, async (event) => {
    const targetId = event.context.params?.targetId;
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const target = config.webhooks.targets.find((entry) => entry.id === targetId);
    if (!target || target.tenantId !== appDef.tenantId || (target.appId && target.appId !== appDef.id)) {
      return jsonResponse({ error: "Webhook target not found" }, 404);
    }
    config.webhooks.targets = config.webhooks.targets.filter((entry) => entry.id !== targetId);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  app.post(`${API_BASE}/manage/webhooks/targets/:targetId/test`, async (event) => {
    const targetId = event.context.params?.targetId;
    const config = await store.loadConfig();
    const appDef = currentAppFromRequest(config, event);
    if (!appDef) return jsonResponse({ error: "Unable to resolve current BetterPortal app" }, 404);
    const target = config.webhooks.targets.find((entry) => entry.id === targetId);
    if (!target || target.tenantId !== appDef.tenantId || (target.appId && target.appId !== appDef.id)) {
      return jsonResponse({ error: "Webhook target not found" }, 404);
    }
    const record: DeliveryRecord = {
      id: uuidv7(),
      targetId: target.id,
      serviceId: target.serviceId,
      eventId: target.eventId,
      tenantId: target.tenantId,
      appId: target.appId,
      payload: { test: true },
      attempts: 0,
      maxAttempts: 1,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    const result = await deliver(target, record);
    return jsonResponse({ ok: result.ok, status: result.status, error: result.error } as JsonValue, result.ok ? 202 : 502);
  });

  app.post(`${API_BASE}/admin/webhooks/targets`, async (event) => {
    const body = await readJson(event);
    const tenantId = stringValue(body, "tenantId");
    const serviceId = stringValue(body, "serviceId");
    const eventId = stringValue(body, "eventId");
    const url = stringValue(body, "url");
    if (!tenantId || !serviceId || !eventId || !url) return jsonResponse({ error: "tenantId, serviceId, eventId and url are required" }, 400);

    const manifest = getManifestCache().get(serviceId);
    if (!manifest?.webhooks.some((entry) => entry.id === eventId)) return jsonResponse({ error: "Webhook event is not declared by service manifest" }, 400);

    const config = await store.loadConfig();
    if (!config.tenants.some((tenant) => tenant.id === tenantId && tenant.active)) return jsonResponse({ error: "Tenant not found or disabled" }, 404);

    const target: WebhookTarget = {
      id: uuidv7(),
      tenantId,
      appId: stringValue(body, "appId"),
      serviceId,
      eventId,
      url,
      secret: randomBytes(32).toString("hex"),
      createdAt: new Date().toISOString(),
      enabled: true,
      maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : 10
    };
    config.webhooks.targets.push(target);
    await store.saveConfig(config);
    return jsonResponse(target as unknown as JsonValue, 201);
  });

  app.delete(`${API_BASE}/admin/webhooks/targets/:targetId`, async (event) => {
    const targetId = event.context.params?.targetId;
    const config = await store.loadConfig();
    config.webhooks.targets = config.webhooks.targets.filter((target) => target.id !== targetId);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  app.post(`${API_BASE}/admin/webhooks/targets/:targetId/test`, async (event) => {
    const targetId = event.context.params?.targetId;
    const config = await store.loadConfig();
    const target = config.webhooks.targets.find((entry) => entry.id === targetId);
    if (!target) return jsonResponse({ error: "Webhook target not found" }, 404);
    const record: DeliveryRecord = {
      id: uuidv7(),
      targetId: target.id,
      serviceId: target.serviceId,
      eventId: target.eventId,
      tenantId: target.tenantId,
      appId: target.appId,
      payload: { test: true },
      attempts: 0,
      maxAttempts: 1,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    const result = await deliver(target, record);
    return jsonResponse({ ok: result.ok, status: result.status, error: result.error } as JsonValue, result.ok ? 202 : 502);
  });

  app.post(`${API_BASE}/webhooks/events`, async (event) => {
    const obs = eventObservability(event);
    const apiKey = readBearer(event);
    if (!apiKey) return jsonResponse({ error: "Bearer token required" }, 401);
    const validated = await store.validateApiKey(apiKey);
    if (!validated?.serviceId) return jsonResponse({ error: "Invalid service token" }, 403);

    const body = await readJson(event);
    const eventId = stringValue(body, "eventId");
    const tenantId = stringValue(body, "tenantId") ?? validated.tenantId;
    const appId = stringValue(body, "appId");
    const idempotencyKey = event.req.headers.get("idempotency-key")?.trim() || stringValue(body, "idempotencyKey");
    if (!eventId || !tenantId) return jsonResponse({ error: "eventId and tenantId are required" }, 400);
    if (!idempotencyKey) return jsonResponse({ error: "Idempotency-Key header or idempotencyKey is required" }, 400);

    const manifest = getManifestCache().get(validated.serviceId);
    if (!manifest?.webhooks.some((entry) => entry.id === eventId)) return jsonResponse({ error: "Webhook event is not declared by service manifest" }, 400);

    const config = await store.loadConfig();
    const targets = matchingTargets(config, validated.serviceId, eventId, tenantId, appId);
    const createdAt = new Date().toISOString();
    const records = targets.map((target): DeliveryRecord => ({
      id: deterministicDeliveryId(validated.serviceId!, eventId, tenantId, appId, idempotencyKey, target.id),
      targetId: target.id,
      serviceId: validated.serviceId!,
      eventId,
      tenantId,
      appId,
      payload: (body.payload ?? null) as JsonValue,
      attempts: 0,
      maxAttempts: target.maxAttempts,
      nextAttemptAt: createdAt,
      createdAt,
      status: "pending"
    }));
    await enqueue(records);
    obs?.logger.info("BP WEBHOOK: queued service={serviceId} event={eventId} tenant={tenantId} app={appId} targets={targets}", {
      serviceId: validated.serviceId,
      eventId,
      tenantId,
      appId: appId ?? "",
      targets: records.length
    });
    if (!postgres) await drain();
    return jsonResponse({ queued: records.length } as JsonValue, 202);
  });

  return {
    start() {
      timer ??= setInterval(() => {
        void drain().catch(() => undefined);
      }, 30_000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    drain
  };
}

function deterministicDeliveryId(...parts: Array<string | undefined>): string {
  return `wh_${createHash("sha256").update(parts.map((part) => part ?? "").join("\0")).digest("hex")}`;
}
