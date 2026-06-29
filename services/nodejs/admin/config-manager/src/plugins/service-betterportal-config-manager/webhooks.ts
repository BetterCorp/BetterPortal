import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  jsonResponse,
  uuidv7,
  type BetterPortalConfig,
  type BetterPortalApp,
  type BetterPortalEvent,
  type BetterPortalH3App,
  type JsonValue,
  type PlatformConfigStore,
  type WebhookTarget
} from "@betterportal/framework";
import { eventObservability } from "@betterportal/framework";
import { getManifestCache } from "./syncApi.js";

const API_BASE = "/.well-known/bp";
// Parse-only base for relative request URLs. Never emit this origin.
const RELATIVE_URL_PARSE_BASE = "http://betterportal.invalid";

type DeliveryStatus = "pending" | "delivered" | "failed";

interface DeliveryRecord {
  id: string;
  targetId: string;
  serviceId: string;
  eventId: string;
  tenantId: string;
  appId?: string;
  payload: JsonValue;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  createdAt: string;
  status: DeliveryStatus;
  lastStatus?: number;
  lastError?: string;
}

class WebhookDeliveryStore {
  private readonly filePath: string;

  constructor(filePath = "./.bp-webhook-deliveries.json") {
    this.filePath = resolve(filePath);
  }

  list(): DeliveryRecord[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
      return Array.isArray(parsed) ? parsed as DeliveryRecord[] : [];
    } catch {
      return [];
    }
  }

  save(records: DeliveryRecord[]): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const kept = records.filter((record) =>
      record.status === "pending" || Date.parse(record.createdAt) >= cutoff
    );
    writeFileSync(this.filePath, JSON.stringify(kept, null, 2), "utf8");
  }

  add(records: DeliveryRecord[]): void {
    this.save([...this.list(), ...records]);
  }
}

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

function appMatchesTenantUrl(app: BetterPortalApp, tenantUrl: string): boolean {
  let host = "";
  try {
    host = new URL(tenantUrl).host.toLowerCase();
  } catch {
    host = tenantUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
  return app.hostnames.some((hostname) => {
    const value = hostname.toLowerCase();
    if (value === host) return true;
    try {
      return new URL(value).host.toLowerCase() === host;
    } catch {
      return false;
    }
  });
}

function currentAppFromRequest(config: BetterPortalConfig, event: BetterPortalEvent): BetterPortalApp | undefined {
  const url = new URL(event.req.url, RELATIVE_URL_PARSE_BASE);
  const appId = url.searchParams.get("appId") ?? event.req.headers.get("x-bp-app-id") ?? "";
  const tenantUrl = url.searchParams.get("tenantUrl") ?? event.req.headers.get("referer") ?? event.req.headers.get("origin") ?? "";
  return appId
    ? config.apps.find((entry) => entry.id === appId)
    : config.apps.find((entry) => tenantUrl && appMatchesTenantUrl(entry, tenantUrl));
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
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text().catch(() => response.statusText) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function processDeliveries(store: PlatformConfigStore, deliveryStore: WebhookDeliveryStore): Promise<void> {
  const config = await store.loadConfig();
  const targets = new Map(config.webhooks.targets.map((target) => [target.id, target]));
  const now = Date.now();
  const records = deliveryStore.list();
  let changed = false;

  for (const record of records) {
    if (record.status !== "pending" || Date.parse(record.nextAttemptAt) > now) continue;
    const target = targets.get(record.targetId);
    if (!target?.enabled || !config.tenants.some((tenant) => tenant.id === target.tenantId && tenant.active)) {
      record.status = "failed";
      record.lastError = "target disabled or tenant inactive";
      changed = true;
      continue;
    }

    record.attempts += 1;
    const result = await deliver(target, record);
    record.lastStatus = result.status;
    record.lastError = result.error;
    record.status = result.ok ? "delivered" : record.attempts >= record.maxAttempts ? "failed" : "pending";
    record.nextAttemptAt = new Date(Date.now() + backoff(record.attempts) * 1000).toISOString();
    changed = true;
  }

  if (changed) deliveryStore.save(records);
}

export function registerWebhookRoutes(app: BetterPortalH3App, store: PlatformConfigStore): { start(): void; stop(): void } {
  const deliveryStore = new WebhookDeliveryStore();
  let timer: ReturnType<typeof setInterval> | undefined;

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
    if (!eventId || !tenantId) return jsonResponse({ error: "eventId and tenantId are required" }, 400);

    const manifest = getManifestCache().get(validated.serviceId);
    if (!manifest?.webhooks.some((entry) => entry.id === eventId)) return jsonResponse({ error: "Webhook event is not declared by service manifest" }, 400);

    const config = await store.loadConfig();
    const targets = matchingTargets(config, validated.serviceId, eventId, tenantId, appId);
    const createdAt = new Date().toISOString();
    const records = targets.map((target): DeliveryRecord => ({
      id: uuidv7(),
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
    deliveryStore.add(records);
    obs?.logger.info("BP WEBHOOK: queued service={serviceId} event={eventId} tenant={tenantId} app={appId} targets={targets}", {
      serviceId: validated.serviceId,
      eventId,
      tenantId,
      appId: appId ?? "",
      targets: records.length
    });
    await processDeliveries(store, deliveryStore);
    return jsonResponse({ queued: records.length } as JsonValue, 202);
  });

  return {
    start() {
      timer ??= setInterval(() => {
        processDeliveries(store, deliveryStore).catch(() => undefined);
      }, 30_000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    }
  };
}
