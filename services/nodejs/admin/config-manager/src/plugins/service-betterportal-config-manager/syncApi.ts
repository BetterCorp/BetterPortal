import { createEventStream } from "h3";
import type {
  BetterPortalH3App,
  BetterPortalEvent,
  PlatformConfigStore,
  JsonValue
} from "@betterportal/framework";
import { jsonResponse } from "@betterportal/framework";

const SYNC_PATH = "/.well-known/bp/sync";

export function registerSyncEndpoint(app: BetterPortalH3App, store: PlatformConfigStore): void {

  app.get(SYNC_PATH, async (event: BetterPortalEvent) => {
    const authHeader = event.req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!apiKey) {
      return jsonResponse({ error: "Bearer token required" }, 401);
    }

    const validated = await store.validateApiKey(apiKey);
    if (!validated) {
      return jsonResponse({ error: "Invalid API key" }, 403);
    }

    if (!validated.serviceId) {
      return jsonResponse({ error: "Service not yet linked — serviceId unknown" }, 412);
    }

    const stream = createEventStream(event);

    const sendScopedConfig = async () => {
      const scoped = await store.getScopedConfig(validated.serviceId!, validated.scope, validated.tenantId);
      await stream.push({
        event: "config",
        data: JSON.stringify(scoped)
      });
    };

    await sendScopedConfig();

    const unsubscribe = store.onChange(() => {
      sendScopedConfig().catch(() => { /* stream may be closed */ });
    });

    stream.onClosed(() => {
      unsubscribe();
    });

    return stream.send();
  });

  app.get(`${SYNC_PATH}/poll`, async (event: BetterPortalEvent) => {
    const authHeader = event.req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!apiKey) {
      return jsonResponse({ error: "Bearer token required" }, 401);
    }

    const validated = await store.validateApiKey(apiKey);
    if (!validated) {
      return jsonResponse({ error: "Invalid API key" }, 403);
    }

    if (!validated.serviceId) {
      return jsonResponse({ error: "Service not yet linked" }, 412);
    }

    const scoped = await store.getScopedConfig(validated.serviceId, validated.scope, validated.tenantId);
    return jsonResponse(scoped as unknown as JsonValue);
  });
}
