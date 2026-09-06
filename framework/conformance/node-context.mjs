import { ScopedServiceConfigSchema } from "../nodejs/lib/contracts/scopedConfig.js";
import { resolveRequestContextDetailed, isAllowedOriginForContext } from "../nodejs/lib/runtime/configProvider.js";

export function contextRequest(body) {
  try {
    const snapshot = ScopedServiceConfigSchema.parse(body.snapshot);
    const config = { ...snapshot, platformServices: [], sharedServiceActivations: [], sharedServiceCatalog: [],
      manifestCache: snapshot.apps.filter(app => app.shell).map(app => ({ serviceId: app.shell.serviceId, shell: app.shell })) };
    const context = resolveRequestContextDetailed(config, body.headers ?? {}, body.mode ?? "service").context;
    const output = context ? { tenantId: context.tenant.id, appId: context.app.id, renderer: context.app.shell?.renderer ?? null } : null;
    if (output && Object.hasOwn(body, "check")) output.allowed = isAllowedOriginForContext(context, body.check);
    return { status: 200, output };
  } catch { return { status: 400 }; }
}
