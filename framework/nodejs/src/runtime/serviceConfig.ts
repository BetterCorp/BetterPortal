import type { ConfigSchemaDescriptor } from "../contracts/config.js";
import type { JsonObject } from "../contracts/json.js";
import {
  ServiceConfigReadResponseSchema,
  ServiceConfigSchemaResponseSchema,
  ServiceConfigStateSchema,
  ServiceConfigTicketClaimsSchema,
  ServiceConfigWriteRequestSchema,
  type ServiceConfigAction,
  type ServiceConfigManagementMode,
  type ServiceConfigState,
  type ServiceConfigTicketClaims
} from "../contracts/serviceConfig.js";
import { jsonResponse, type BetterPortalEvent, type BetterPortalH3App } from "./h3.js";

export interface ServiceConfigAccessContext {
  ticket: ServiceConfigTicketClaims;
  action: ServiceConfigAction;
}

export interface ServiceConfigRouteOptions {
  app: BetterPortalH3App;
  serviceId: string;
  configSchemas: ConfigSchemaDescriptor[];
  mode: ServiceConfigManagementMode;
  supportsCustomUi?: boolean;
  customUiPath?: string;
  basePath?: string;
  validateTicket?: (ticketValue: string | null, event: BetterPortalEvent, action: ServiceConfigAction) => Promise<ServiceConfigTicketClaims | null> | ServiceConfigTicketClaims | null;
  validateScope?: (
    scope: { tenantId: string; appId?: string; action: ServiceConfigAction; ticket: ServiceConfigTicketClaims },
    event: BetterPortalEvent
  ) => Promise<boolean> | boolean;
  readConfig?: (context: ServiceConfigAccessContext, event: BetterPortalEvent) => Promise<ServiceConfigState | null> | ServiceConfigState | null;
  writeConfig?: (
    values: { tenantId: string; appId?: string; values: Record<string, unknown> },
    context: ServiceConfigAccessContext,
    event: BetterPortalEvent
  ) => Promise<ServiceConfigState | null> | ServiceConfigState | null;
  clearConfigKey?: (
    values: { tenantId: string; appId?: string; key: string },
    context: ServiceConfigAccessContext,
    event: BetterPortalEvent
  ) => Promise<ServiceConfigState | null> | ServiceConfigState | null;
  /** Extra response headers added to successful write responses (e.g., HX-Trigger). */
  writeSuccessHeaders?: Record<string, string>;
}

const DEFAULT_BASE_PATH = "/.well-known/bp/config";

async function resolveTicket(
  options: ServiceConfigRouteOptions,
  event: BetterPortalEvent,
  action: ServiceConfigAction
): Promise<ServiceConfigTicketClaims | null> {
  if (!options.validateTicket) {
    return null;
  }

  const bearerValue = event.req.headers.get("authorization");
  const ticketValue = bearerValue?.startsWith("Bearer ") ? bearerValue.slice("Bearer ".length) : null;
  const resolved = await options.validateTicket(ticketValue, event, action);
  if (!resolved) {
    return null;
  }

  const parsed = ServiceConfigTicketClaimsSchema.parse(resolved);
  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp <= now) {
    return null;
  }

  if (parsed.serviceId !== options.serviceId || !parsed.actions.includes(action)) {
    return null;
  }

  return parsed;
}

function redactSecretValues(
  configSchemas: ConfigSchemaDescriptor[],
  input: Record<string, unknown>
): Record<string, unknown> {
  const secretKeys = new Set(
    configSchemas.flatMap((schema) =>
      schema.fields
        .filter((field) => field.visibility === "secret")
        .map((field) => field.key)
    )
  );

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, secretKeys.has(key) ? "__redacted__" : value])
  );
}

export function registerServiceConfigRoutes(options: ServiceConfigRouteOptions): void {
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;

  options.app.get(`${basePath}/schema`, async () => {
    const response = ServiceConfigSchemaResponseSchema.parse({
      serviceId: options.serviceId,
      mode: options.mode,
      configSchemas: options.configSchemas,
      supportsCustomUi: options.supportsCustomUi ?? Boolean(options.customUiPath),
      ...(options.customUiPath ? { customUiPath: options.customUiPath } : {}),
      supportsWrite: Boolean(options.writeConfig)
    });

    return jsonResponse(response as JsonObject);
  });

  options.app.get(basePath, async (event) => {
    const ticket = await resolveTicket(options, event, "config.read");
    if (!ticket) {
      return jsonResponse({
        error: "A valid BetterPortal config ticket is required for config.read"
      }, 401);
    }

    if (!options.readConfig) {
      return jsonResponse({
        error: "This service does not expose dynamic config reads"
      }, 501);
    }

    const requestedAppId = event.req.headers.get("x-bp-app-id") ?? undefined;
    if (options.validateScope && !(await options.validateScope({
      tenantId: ticket.tenantId,
      ...(requestedAppId ? { appId: requestedAppId } : {}),
      action: "config.read",
      ticket
    }, event))) {
      return jsonResponse({
        error: "Config read scope is not allowed for this ticket"
      }, 403);
    }

    const state = await options.readConfig({
      ticket,
      action: "config.read"
    }, event);

    const parsedState = ServiceConfigStateSchema.parse(state ?? { tenant: {}, app: {} });
    const rawValues = requestedAppId
      ? parsedState.app[requestedAppId] ?? {}
      : parsedState.tenant;

    const response = ServiceConfigReadResponseSchema.parse({
      serviceId: options.serviceId,
      tenantId: ticket.tenantId,
      ...(requestedAppId ? { appId: requestedAppId } : {}),
      values: redactSecretValues(options.configSchemas, rawValues) as JsonObject
    });

    return jsonResponse(response as JsonObject);
  });

  options.app.post(basePath, async (event) => {
    const ticket = await resolveTicket(options, event, "config.write");
    if (!ticket) {
      return jsonResponse({
        error: "A valid BetterPortal config ticket is required for config.write"
      }, 401);
    }

    if (!options.writeConfig) {
      return jsonResponse({
        error: "This service does not expose dynamic config writes"
      }, 501);
    }

    const body = await event.req.json().catch(() => null);
    const parsedWrite = ServiceConfigWriteRequestSchema.safeParse(body);
    if (!parsedWrite.success) {
      return jsonResponse({
        error: "Invalid config write payload",
        issues: parsedWrite.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join("."),
          message: issue.message
        }))
      }, 400);
    }

    if (parsedWrite.data.tenantId !== ticket.tenantId) {
      return jsonResponse({
        error: "Config write tenant does not match the ticket tenant"
      }, 403);
    }

    if (options.validateScope && !(await options.validateScope({
      tenantId: parsedWrite.data.tenantId,
      ...(parsedWrite.data.appId ? { appId: parsedWrite.data.appId } : {}),
      action: "config.write",
      ticket
    }, event))) {
      return jsonResponse({
        error: "Config write scope is not allowed for this ticket"
      }, 403);
    }

    let state: ServiceConfigState | null = null;
    for (const key of parsedWrite.data.clearKeys) {
      state = options.clearConfigKey
        ? await options.clearConfigKey({
            tenantId: parsedWrite.data.tenantId,
            appId: parsedWrite.data.appId,
            key
          }, {
            ticket,
            action: "config.write"
          }, event)
        : state;
    }

    state = await options.writeConfig({
      tenantId: parsedWrite.data.tenantId,
      appId: parsedWrite.data.appId,
      values: parsedWrite.data.values as Record<string, unknown>
    }, {
      ticket,
      action: "config.write"
    }, event);

    const parsedState = ServiceConfigStateSchema.parse(state ?? { tenant: {}, app: {} });
    return jsonResponse({
      ok: true,
      serviceId: options.serviceId,
      tenantId: ticket.tenantId,
      ...(parsedWrite.data.appId ? { appId: parsedWrite.data.appId } : {}),
      values: redactSecretValues(
        options.configSchemas,
        parsedWrite.data.appId ? parsedState.app[parsedWrite.data.appId] ?? {} : parsedState.tenant
      ) as JsonObject
    }, 200, options.writeSuccessHeaders);
  });
}
