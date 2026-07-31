import {
  ApiContractDescriptorSchema,
  M2MRequestDescriptorSchema,
  uuidv7,
  type BetterPortalApp,
  type BetterPortalConfig,
  type M2MCallerMode,
  type M2MRequestDescriptor
} from "@betterportal/framework";
import { getAvailableServiceInstanceIdsForApp } from "./storage/core.js";
import { getCachedManifestForService, getManifestCache, type CachedManifest } from "./syncApi.js";

export type M2MConnectionStatus = "connected" | "pending" | "choice" | "unavailable" | "stale";

export interface M2MConnectionCandidate {
  targetServiceId: string;
  targetServiceTitle: string;
  targetServiceType: string;
  targetViewId: string;
}

export interface M2MConnectionView {
  sourceServiceId: string;
  sourceServiceTitle: string;
  sourceServiceType: string;
  requestId: string;
  title: string;
  contractId: string;
  version?: string;
  mode: M2MCallerMode;
  methods: string[];
  permissions: string[];
  optional: boolean;
  status: M2MConnectionStatus;
  message: string;
  bindingId?: string;
  targetServiceId?: string;
  targetViewId?: string;
  candidates: M2MConnectionCandidate[];
}

export interface M2MConnectionSelection {
  sourceServiceId: string;
  requestId: string;
  targetServiceId?: string;
  targetViewId?: string;
}

export class M2MConnectionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) {
    super(message);
    this.name = "M2MConnectionError";
  }
}

function serviceDetails(config: BetterPortalConfig, serviceId: string): { title: string; serviceId: string } {
  for (const tenant of config.tenants) {
    const service = tenant.services.find((candidate) => candidate.id === serviceId);
    if (service) return { title: service.title ?? service.serviceId ?? service.id, serviceId: service.serviceId ?? service.id };
  }
  const platform = config.platformServices.find((candidate) => candidate.id === serviceId);
  if (platform) return { title: platform.title ?? platform.serviceId ?? platform.id, serviceId: platform.serviceId ?? platform.id };
  const activation = config.sharedServiceActivations.find((candidate) => candidate.id === serviceId);
  const shared = activation
    ? config.sharedServiceCatalog.find((candidate) => candidate.id === activation.sharedServiceId)
    : undefined;
  return shared
    ? { title: shared.title, serviceId: shared.serviceId ?? shared.id }
    : { title: serviceId, serviceId };
}

function requestsForManifest(manifest: CachedManifest | undefined): M2MRequestDescriptor[] {
  return (manifest?.m2mRequests ?? []).flatMap((value) => {
    const parsed = M2MRequestDescriptorSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

function candidatesForRequest(
  config: BetterPortalConfig,
  app: BetterPortalApp,
  request: M2MRequestDescriptor,
  cache: ReadonlyMap<string, CachedManifest>
): M2MConnectionCandidate[] {
  const candidates: M2MConnectionCandidate[] = [];
  for (const targetServiceId of getAvailableServiceInstanceIdsForApp(config, app)) {
    const manifest = getCachedManifestForService(config, targetServiceId, cache);
    if (!manifest) continue;
    for (const rawContract of manifest.apiContracts) {
      const parsed = ApiContractDescriptorSchema.safeParse(rawContract);
      if (!parsed.success) continue;
      const contract = parsed.data;
      if (
        contract.id !== request.contractId
        || (request.version !== undefined && contract.version !== request.version)
        || !contract.modes.includes(request.mode)
        || !request.methods.every((method) => contract.methods.includes(method))
        || !request.permissions.every((permission) => contract.permissions.includes(permission))
        || !request.requiredCapabilities.every((capability) => contract.capabilities.includes(capability))
      ) continue;
      const details = serviceDetails(config, targetServiceId);
      candidates.push({
        targetServiceId,
        targetServiceTitle: details.title,
        targetServiceType: details.serviceId,
        targetViewId: contract.viewId
      });
    }
  }
  return candidates.filter((candidate, index, all) =>
    all.findIndex((other) => other.targetServiceId === candidate.targetServiceId && other.targetViewId === candidate.targetViewId) === index
  );
}

export function buildM2MConnectionModel(
  config: BetterPortalConfig,
  appId: string,
  cache: ReadonlyMap<string, CachedManifest> = getManifestCache()
): M2MConnectionView[] {
  const app = config.apps.find((candidate) => candidate.id === appId);
  if (!app) return [];
  const available = getAvailableServiceInstanceIdsForApp(config, app);
  const rows: M2MConnectionView[] = [];
  const seenBindings = new Set<string>();

  for (const sourceServiceId of available) {
    const sourceManifest = getCachedManifestForService(config, sourceServiceId, cache);
    const source = serviceDetails(config, sourceServiceId);
    for (const request of requestsForManifest(sourceManifest)) {
      const candidates = candidatesForRequest(config, app, request, cache);
      const bindings = config.m2m.bindings.filter((binding) =>
        binding.enabled
        && binding.tenantId === app.tenantId
        && binding.appId === app.id
        && binding.sourceServiceId === sourceServiceId
        && binding.requestId === request.id
      );
      bindings.forEach((binding) => seenBindings.add(binding.id));
      const binding = bindings[0];
      const grant = binding
        ? config.m2m.grants.find((candidate) => candidate.enabled && candidate.bindingId === binding.id)
        : undefined;
      const boundCandidate = binding
        ? candidates.find((candidate) => candidate.targetServiceId === binding.targetServiceId && candidate.targetViewId === binding.targetViewId)
        : undefined;
      const grantMatches = Boolean(grant
        && request.methods.every((method) => grant.methods.includes(method))
        && request.permissions.every((permission) => grant.permissions.includes(permission)));
      const connected = bindings.length === 1
        && binding?.mode === request.mode
        && binding.contractId === request.contractId
        && Boolean(boundCandidate)
        && grantMatches;
      const status: M2MConnectionStatus = binding
        ? connected ? "connected" : "stale"
        : candidates.length === 0 ? "unavailable" : candidates.length === 1 ? "pending" : "choice";
      const message = status === "connected" ? "Connected"
        : status === "stale" ? "Stored connection no longer matches the current manifests or grant"
        : status === "pending" ? "Ready for approval"
        : status === "choice" ? "Select a compatible provider"
        : request.optional ? "Optional provider unavailable" : "No compatible provider";
      rows.push({
        sourceServiceId,
        sourceServiceTitle: source.title,
        sourceServiceType: source.serviceId,
        requestId: request.id,
        title: request.title,
        contractId: request.contractId,
        ...(request.version ? { version: request.version } : {}),
        mode: request.mode,
        methods: [...request.methods],
        permissions: [...request.permissions],
        optional: request.optional,
        status,
        message,
        ...(binding ? {
          bindingId: binding.id,
          targetServiceId: binding.targetServiceId,
          targetViewId: binding.targetViewId
        } : {}),
        candidates
      });
    }
  }

  for (const binding of config.m2m.bindings.filter((candidate) =>
    candidate.enabled
    && candidate.tenantId === app.tenantId
    && candidate.appId === app.id
    && !seenBindings.has(candidate.id)
  )) {
    const source = serviceDetails(config, binding.sourceServiceId);
    rows.push({
      sourceServiceId: binding.sourceServiceId,
      sourceServiceTitle: source.title,
      sourceServiceType: source.serviceId,
      requestId: binding.requestId,
      title: binding.requestId,
      contractId: binding.contractId,
      mode: binding.mode,
      methods: [],
      permissions: [],
      optional: false,
      status: "stale",
      message: "Request is unavailable in the current source manifest",
      bindingId: binding.id,
      targetServiceId: binding.targetServiceId,
      targetViewId: binding.targetViewId,
      candidates: []
    });
  }

  return rows.sort((left, right) =>
    left.sourceServiceTitle.localeCompare(right.sourceServiceTitle)
    || left.title.localeCompare(right.title)
  );
}

export function approveM2MConnections(
  config: BetterPortalConfig,
  appId: string,
  selections: readonly M2MConnectionSelection[],
  cache: ReadonlyMap<string, CachedManifest> = getManifestCache()
): { created: string[]; existing: string[] } {
  const app = config.apps.find((candidate) => candidate.id === appId);
  if (!app) throw new M2MConnectionError("App not found", 404);
  if (selections.length === 0) throw new M2MConnectionError("At least one connection is required", 400);
  const model = buildM2MConnectionModel(config, appId, cache);
  const pending: Array<{ row: M2MConnectionView; candidate: M2MConnectionCandidate }> = [];
  const existing: string[] = [];
  const keys = new Set<string>();

  for (const selection of selections) {
    const key = `${selection.sourceServiceId}\n${selection.requestId}`;
    if (keys.has(key)) throw new M2MConnectionError(`Duplicate connection selection for ${selection.requestId}`, 400);
    keys.add(key);
    const row = model.find((candidate) => candidate.sourceServiceId === selection.sourceServiceId && candidate.requestId === selection.requestId);
    if (!row) throw new M2MConnectionError(`M2M request not found: ${selection.requestId}`, 404);
    if (row.status === "connected" && row.bindingId) {
      existing.push(row.bindingId);
      continue;
    }
    if (row.bindingId) throw new M2MConnectionError(`Revoke the stale connection before approving ${selection.requestId}`);
    const candidates = row.candidates.filter((candidate) =>
      (!selection.targetServiceId || candidate.targetServiceId === selection.targetServiceId)
      && (!selection.targetViewId || candidate.targetViewId === selection.targetViewId)
    );
    if (candidates.length !== 1) {
      throw new M2MConnectionError(candidates.length === 0
        ? `No compatible provider for ${selection.requestId}`
        : `Select one provider for ${selection.requestId}`);
    }
    pending.push({ row, candidate: candidates[0] });
  }

  const created: string[] = [];
  const createdAt = new Date().toISOString();
  for (const { row, candidate } of pending) {
    const bindingId = uuidv7();
    config.m2m.bindings.push({
      id: bindingId,
      tenantId: app.tenantId,
      appId: app.id,
      sourceServiceId: row.sourceServiceId,
      requestId: row.requestId,
      contractId: row.contractId,
      targetServiceId: candidate.targetServiceId,
      targetViewId: candidate.targetViewId,
      mode: row.mode,
      enabled: true,
      createdAt
    });
    config.m2m.grants.push({
      id: uuidv7(),
      tenantId: app.tenantId,
      appId: app.id,
      bindingId,
      methods: row.methods as Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS">,
      permissions: [...row.permissions],
      enabled: true,
      createdAt
    });
    created.push(bindingId);
  }
  return { created, existing };
}

export function revokeM2MConnection(config: BetterPortalConfig, appId: string, bindingId: string): boolean {
  const app = config.apps.find((candidate) => candidate.id === appId);
  const binding = config.m2m.bindings.find((candidate) => candidate.id === bindingId);
  if (!app || !binding || binding.appId !== app.id || binding.tenantId !== app.tenantId) return false;
  config.m2m.grants = config.m2m.grants.filter((grant) => grant.bindingId !== bindingId);
  config.m2m.bindings = config.m2m.bindings.filter((candidate) => candidate.id !== bindingId);
  return true;
}