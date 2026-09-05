import * as av from "anyvali";
import type { BetterPortalConfig, PreviewEnvironmentDeployment } from "@betterportal/framework";

export const PreviewServiceStatusSchema = av.object({
  state: av.enum_(["missing-registration", "waiting-manifest", "needs-reconciliation", "waiting-config", "configured"] as const),
  manifestVersion: av.optional(av.string()),
  manifestAt: av.optional(av.string()),
  lastSeenAt: av.optional(av.string()),
  lastSyncAt: av.optional(av.string()),
  enabledRoutes: av.int().min(0),
  advertisedOperations: av.int().min(0),
  issues: av.array(av.string())
});

/** Configuration readiness, not a claim that a remote container or its dependencies are healthy. */
export function previewServiceStatus(config: BetterPortalConfig, deployment: PreviewEnvironmentDeployment, instanceId: string) {
  const registration = config.tenants.find(t => t.id === deployment.tenantId)?.services.find(s => s.id === instanceId);
  const app = config.apps.find(a => a.id === deployment.appId && a.tenantId === deployment.tenantId);
  // Deliberately use persisted metadata, not a replica's speculative hot manifest cache.
  const manifest = config.manifestCache.find(m => m.serviceId === instanceId);
  const routes = app?.routes.filter(r => r.serviceId === instanceId) ?? [];
  const operations = Object.values(manifest?.viewIndex ?? {}).flatMap(view => view.operations.map(operation => ({ view, operation })));
  const issues: string[] = [];
  if (!app) issues.push("Preview app is missing.");
  if (registration && !registration.enabled) issues.push("Service registration is disabled.");
  for (const { view, operation } of operations) {
    if (!routes.some(r => r.enabled && r.viewId === view.viewId && r.operations.includes(operation.operationId))) {
      issues.push(`No enabled mount for ${operation.method} ${view.path} (${operation.operationId}).`);
    }
  }
  const manifestAt = manifest?.fetchedAt;
  const delivered = !!registration?.lastSyncAt && !!manifestAt
    && Date.parse(registration.lastSyncAt) >= Date.parse(manifestAt);
  const state = !registration ? "missing-registration" : !manifest ? "waiting-manifest"
    : issues.length ? "needs-reconciliation" : !delivered ? "waiting-config" : "configured";
  return {
    state,
    manifestVersion: manifest?.manifestVersion,
    manifestAt,
    lastSeenAt: registration?.lastSeenAt,
    lastSyncAt: registration?.lastSyncAt,
    enabledRoutes: routes.filter(r => r.enabled).length,
    advertisedOperations: operations.length,
    issues
  } as const;
}

export const PreviewDiagnosticsSchema = av.object({
  deploymentId: av.string(),
  tenantId: av.string(),
  appId: av.string(),
  sourceTenantId: av.string(),
  sourceAppId: av.string(),
  hostname: av.string(),
  shellServiceId: av.optional(av.string()),
  authServiceId: av.optional(av.string()),
  authRedirects: av.array(av.object({ purpose: av.string(), serviceId: av.string(), viewId: av.string(), mounted: av.bool() })),
  services: av.array(av.object({
    serviceId: av.string(), instanceId: av.string(), origin: av.string(),
    status: PreviewServiceStatusSchema
  })),
  routes: av.array(av.object({
    id: av.string(), serviceId: av.string(), viewId: av.string(), path: av.string(),
    targetPath: av.string(), operations: av.array(av.string()), enabled: av.bool(), menu: av.string()
  }))
});

/** Explicitly allowlisted diagnostics: never serialize config values, API keys, hashes, or replay data. */
export function buildPreviewDiagnostics(config: BetterPortalConfig, deploymentId: string) {
  const deployment = config.previewEnvironmentDeployments.find(d => d.id === deploymentId);
  if (!deployment) return undefined;
  const group = config.previewEnvironmentGroups.find(g => g.id === deployment.groupId);
  const app = config.apps.find(a => a.id === deployment.appId && a.tenantId === deployment.tenantId);
  const menuRouteIds = new Set<string>();
  const visit = (items: NonNullable<typeof app>["menu"], enabled = true): void => {
    for (const item of items) {
      if (enabled && item.enabled && item.routeId) menuRouteIds.add(item.routeId);
      visit(item.children, enabled && item.enabled);
    }
  };
  visit(app?.menu ?? []);
  return {
    deploymentId, tenantId: deployment.tenantId, appId: deployment.appId,
    sourceTenantId: group?.sourceTenantId ?? "", sourceAppId: group?.sourceAppId ?? "",
    hostname: deployment.hostname, shellServiceId: app?.shell?.serviceId, authServiceId: app?.auth?.serviceId,
    authRedirects: Object.entries(app?.auth?.redirects ?? {}).flatMap(([purpose, target]) => target ? [{
      purpose, serviceId: target.serviceId, viewId: target.viewId,
      mounted: !!app?.routes.some(r => r.enabled && r.serviceId === target.serviceId && r.viewId === target.viewId)
    }] : []),
    services: deployment.services.map(service => {
      let origin = "Invalid HTTP(S) origin";
      try {
        const parsed = new URL(service.url);
        if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) origin = parsed.origin;
      } catch { /* Invalid registrations remain visible without turning them into links. */ }
      return { serviceId: service.serviceId, instanceId: service.instanceId, origin, status: previewServiceStatus(config, deployment, service.instanceId) };
    }),
    routes: (app?.routes ?? []).map(route => ({
      id: route.id, serviceId: route.serviceId, viewId: route.viewId, path: route.path,
      targetPath: route.targetPath ?? "", operations: [...route.operations], enabled: route.enabled,
      menu: !route.enabled ? "Disabled route" : route.kind === "api" ? "API only"
        : menuRouteIds.has(route.id) ? "Included (browser auth/health policies may hide it)" : "No enabled menu item"
    }))
  };
}
