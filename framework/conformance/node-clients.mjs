// Test-only generated TypeScript caller using the production BSB S2S policy.
import ts from 'typescript';
import { emitTypeScriptClient } from '../nodejs/lib/cli/client.js';
import { BPService } from '../../plugins/nodejs/betterportal-bsb/lib/service.js';
import { key } from './node-security.mjs';

export async function generatedClientRequest(body) {
  const source = emitTypeScriptClient('peer', body.contract);
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const generated = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
  const context = { tenant: { id: body.tenantId }, app: { id: body.appId }, user: { sub: 'user-1' },
    rawEvent: { req: new Request('https://source.test/check', { headers: body.headers }) },
    obs: { startSpan: () => ({ traceId: '1'.repeat(32), spanId: '2'.repeat(16), end() {}, error() {} }) } };
  const service = Object.assign(Object.create(BPService.prototype), { scopedConfig: body.snapshot, s2sKeyPair: key, s2sIdentityReady: true });
  let runtime;
  if (body.mode === 'service') runtime = service.m2mClient('read-item', context);
  else if (body.mode === 'delegated') runtime = service.delegatedM2mClient('read-item', context);
  else runtime = { baseUrl: body.baseUrl, headers: { origin: 'https://app.test' }, token: body.headers.authorization.slice(7) };
  return { status: 200, output: await generated.checkGet(runtime, { params: { key: 'item' } }) };
}
