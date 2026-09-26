import { isDeepStrictEqual } from "node:util";
import type { BetterPortalConfig } from "@betterportal/framework";

/** Each entry is an independently persisted/revisioned configuration aggregate. */
export interface ConfigEntity {
  kind: string;
  id: string;
  value: Record<string, any>;
}
export interface ConfigEntityRow extends ConfigEntity { revision: string | number }
export const entityKey = (kind: string, id: string): string => JSON.stringify([kind, id]);
export const keyOf = (entity: ConfigEntity): string => entityKey(entity.kind, entity.id);

export function splitConfig(config: BetterPortalConfig): Map<string, ConfigEntity> {
  const entities = new Map<string, ConfigEntity>();
  const add = (kind: string, id: string, value: unknown) => {
    const entity = { kind, id, value: structuredClone(value) as ConfigEntity["value"] };
    if (entities.has(keyOf(entity))) throw new Error(`Duplicate config entity ${kind}/${id}`);
    entities.set(keyOf(entity), entity);
  };
  add("settings", "platform", config.configManagement);
  for (const kind of ["tenants", "apps", "platformServices", "sharedServiceCatalog", "sharedServiceActivations", "previewEnvironmentGroups", "previewEnvironmentDeployments"] as const) {
    for (const value of config[kind]) {
      // Presence is stored separately; polling must never dirty a tenant record.
      const entry = structuredClone(value);
      if (kind === "tenants") {
        const tenant = entry as BetterPortalConfig["tenants"][number];
        for (const service of tenant.services) {
          delete service.lastSeenAt;
          delete service.lastSyncAt;
          add("tenantServices", service.id, { ...service, tenantId: tenant.id });
        }
        tenant.services = [];
      }
      if (kind === "previewEnvironmentDeployments") {
        const deployment = entry as BetterPortalConfig["previewEnvironmentDeployments"][number];
        if (deployment.effectiveConfig) add("previewConfigs", deployment.id, { id: deployment.id, ...deployment.effectiveConfig });
        delete deployment.effectiveConfig;
      }
      add(kind, value.id, entry);
    }
  }
  for (const value of config.manifestCache) add("manifestCache", value.serviceId, value);
  for (const kind of ["bindings", "grants"] as const) for (const value of config.m2m[kind]) add(kind, value.id, value);
  for (const value of config.webhooks.targets) add("webhookTargets", value.id, value);
  return entities;
}

export function assembleConfig(entities: Iterable<ConfigEntity>): unknown {
  const result: Record<string, any> = {
    tenants: [], apps: [], platformServices: [], sharedServiceCatalog: [], sharedServiceActivations: [],
    manifestCache: [], previewEnvironmentGroups: [], previewEnvironmentDeployments: [],
    m2m: { bindings: [], grants: [] }, webhooks: { targets: [] }
  };
  const services: Record<string, any>[] = [];
  const previews: Record<string, any>[] = [];
  for (const { kind, value } of entities) {
    if (kind === "previewConfigs") { previews.push(value); continue; }
    if (kind === "tenantServices") { services.push(value); continue; }
    if (kind === "settings") result.configManagement = structuredClone(value);
    else if (kind === "bindings" || kind === "grants") result.m2m[kind].push(structuredClone(value));
    else if (kind === "webhookTargets") result.webhooks.targets.push(structuredClone(value));
    else if (Array.isArray(result[kind])) result[kind].push(structuredClone(value));
    else throw new Error(`Unknown config entity kind: ${kind}`);
  }
  for (const { tenantId, ...service } of services) {
    const tenant = result.tenants.find((candidate: any) => candidate.id === tenantId);
    if (!tenant) throw new Error(`Service ${service.id} references missing tenant ${tenantId}`);
    tenant.services.push(structuredClone(service));
  }
  for (const { id, ...effectiveConfig } of previews) {
    const deployment = result.previewEnvironmentDeployments.find((candidate: any) => candidate.id === id);
    if (!deployment) throw new Error(`Preview config ${id} references missing deployment`);
    deployment.effectiveConfig = structuredClone(effectiveConfig);
  }
  return result;
}

export function changedEntityKeys(before: Map<string, ConfigEntity>, after: Map<string, ConfigEntity>): string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter(key =>
    !isDeepStrictEqual(before.get(key)?.value, after.get(key)?.value)
  ).sort();
}

/** References are both DB foreign keys and shared locks during dependent writes. */
export function entityReferences(entity: ConfigEntity, entities: Map<string, ConfigEntity>): string[] {
  const refs = new Set<string>();
  const add = (kind: string, id: unknown) => { if (typeof id === "string" && id) refs.add(entityKey(kind, id)); };
  const service = (id: string) => {
    for (const kind of ["tenantServices", "platformServices", "sharedServiceCatalog", "sharedServiceActivations"]) {
      if (entities.has(entityKey(kind, id))) { add(kind, id); return; }
    }
  };
  const { kind, value } = entity;
  if (kind === "previewConfigs") add("previewEnvironmentDeployments", entity.id);
  if (kind === "settings") { add("tenants", value.adminTenantId); add("apps", value.managementAppId); }
  if (kind === "tenants") for (const id of value.activatedPlatformServices) add("platformServices", id);
  if (["tenantServices", "apps", "sharedServiceActivations", "bindings", "grants", "webhookTargets", "previewEnvironmentDeployments"].includes(kind)) {
    add("tenants", value.tenantId); add("apps", value.appId);
  }
  if (kind === "sharedServiceActivations") add("sharedServiceCatalog", value.sharedServiceId);
  if (kind === "webhookTargets" || kind === "manifestCache") service(value.serviceId);
  if (kind === "bindings") { service(value.sourceServiceId); service(value.targetServiceId); }
  if (kind === "grants") add("bindings", value.bindingId);
  if (kind === "previewEnvironmentGroups") { add("tenants", value.sourceTenantId); add("apps", value.sourceAppId); }
  if (kind === "previewEnvironmentDeployments") add("previewEnvironmentGroups", value.groupId);
  if (kind === "apps") {
    // Walk nested route, auth, shell, fragment and permission service references.
    const walk = (input: unknown): void => {
      if (!input || typeof input !== "object") return;
      for (const [name, child] of Object.entries(input)) {
        if (name === "serviceId" && typeof child === "string") service(child);
        else walk(child);
      }
    };
    walk(value);
  }
  refs.delete(keyOf(entity));
  return [...refs].sort();
}

/** Uniqueness claims must also serialize concurrent inserts with different IDs. */
export function entityClaims(entity: ConfigEntity): string[] {
  const { kind, value } = entity;
  if (kind === "apps") return [...new Set<string>(value.hostnames.map((hostname: string) => `hostname:${hostname.toLowerCase()}`))];
  if (kind === "previewEnvironmentDeployments") return [`preview:${value.groupId}:${value.key}`];
  if (kind === "bindings" && value.enabled) return [`binding:${JSON.stringify([value.tenantId, value.appId, value.sourceServiceId, value.requestId, value.mode])}`];
  if (kind === "grants" && value.enabled) return [`grant:${value.bindingId}`];
  return [];
}
