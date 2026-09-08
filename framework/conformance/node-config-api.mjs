// Actual Node config route/store and BSB-owned ticket/scope entry points.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBetterPortalApp } from '../nodejs/lib/runtime/h3.js';
import { registerServiceConfigRoutes } from '../nodejs/lib/runtime/serviceConfig.js';
import { FileBackedServiceConfigStore } from '../nodejs/lib/runtime/configStore.js';
import { ScopedServiceConfigSchema } from '../nodejs/lib/contracts/scopedConfig.js';
import { clearJwksCache } from '../nodejs/lib/runtime/auth/jwks.js';

export async function configApiRequest(body) {
  const { BPService } = await import('../../plugins/nodejs/betterportal-bsb/lib/service.js');
  clearJwksCache();
  const directory = await mkdtemp(join(tmpdir(), 'bp-config-api-'));
  const filePath = join(directory, 'state.json');
  try {
    if (body.stored !== undefined) await writeFile(filePath, body.stored);
    const store = new FileBackedServiceConfigStore({ filePath, encryptionKey: body.key, configSchemas: body.descriptors });
    const runtime = { scopedConfig: ScopedServiceConfigSchema.parse(body.snapshot), manifest: body.declaration,
      bootstrapState: { read: () => ({ cpUrl: body.issuer, cpJwksUri: body.jwksUri }) },
      bp: {}, validateDevConfigToken: BPService.prototype.validateDevConfigToken };
    const app = createBetterPortalApp();
    registerServiceConfigRoutes({ app, serviceId: body.declaration.pluginId, configSchemas: body.descriptors,
      mode: body.mode ?? (body.unsupported ? 'static' : 'hybrid'), customUiPath: body.customUiPath,
      validateTicket: (token, event, action) => BPService.prototype.validateConfigTicket.call(runtime, token, event, action),
      validateScope: scope => BPService.prototype.validateConfigScope.call(runtime, scope.tenantId, scope.appId),
      ...(body.unsupported ? {} : { readConfig: ({ticket}) => store.read(ticket) }),
      ...(body.unsupported || body.writable === false ? {} : {
        writeConfig: (scope, {ticket}) => store.write(scope.tenantId, scope.appId, scope.values, ticket),
        clearConfigKey: (scope, {ticket}) => store.clearKey(scope.tenantId, scope.appId, scope.key, ticket) })
    });
    const outcomes = [];
    for (const step of body.steps) {
      if (step.snapshot) { runtime.scopedConfig = ScopedServiceConfigSchema.parse(step.snapshot); continue; }
      const response = await app.fetch(new Request('http://service.test' + step.path, { method: step.method, headers: step.headers,
        ...(step.method === 'GET' || step.method === 'HEAD' ? {} : {body: step.body ?? ''}) }));
      outcomes.push({status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers)});
    }
    return {outcomes, stored: await readFile(filePath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; })};
  } finally { await rm(directory, {recursive: true}); }
}
