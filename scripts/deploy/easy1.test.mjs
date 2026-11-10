import assert from 'node:assert/strict';
import test from 'node:test';
import { compareVersions, deployServices, rollout, services, validateHooks, waitFor, waitForReleasePackages } from './easy1.mjs';

const current = { sha: 'old', version: '11.0.11' };
const previous = { sha: 'prior', version: '11.0.8' };
const target = { sha: 'new', version: '11.0.12' };
const hooks = Object.fromEntries(services.map(service => [service.name, `https://easy1.eu2.betterweb.co.za/api/deploy/${service.name}`]));

test('inventory includes all seven runtime services and fifteen replicas', () => {
  assert.deepEqual(services.map(service => service.name).sort(), ['auth-authress-io', 'auth-default', 'auth-workos', 'bootstrap1', 'config-manager', 'embedded', 'hello-view']);
  assert.equal(services.reduce((sum, service) => sum + service.replicas, 0), 15);
  assert.deepEqual(validateHooks(JSON.stringify(hooks)), hooks);
  assert.throws(() => validateHooks(JSON.stringify({ ...hooks, 'auth-default': 'http://example.test/token' })));
  assert.throws(() => validateHooks(JSON.stringify({ ...hooks, unrelated: hooks.embedded })));
  assert.equal(compareVersions('11.0.12', '11.0.9'), 1);
  assert.equal(compareVersions('11.0.8', '11.0.11'), -1);
  assert.throws(() => compareVersions('11.0.12-rc.1', '11.0.11'));
});

test('a successful rollout retains the previous release before deploying', async () => {
  const calls = [];
  const result = await rollout({ current, previous, target,
    move: async (...args) => calls.push(['move', ...args]), deploy: async version => calls.push(['deploy', version]) });
  assert.deepEqual(calls, [['move', 'old', 'prior', 'new', 'old'], ['deploy', '11.0.12']]);
  assert.equal(result.status, 'deployed');
});

test('failed deployment restores both pointers and all services, while reporting failure', async () => {
  const calls = [], reports = [];
  await assert.rejects(rollout({ current, previous, target,
    move: async (...args) => calls.push(['move', ...args]),
    deploy: async version => { calls.push(['deploy', version]); if (version === target.version) throw new Error('health failed'); },
    report: result => reports.push(result.status)
  }), /all seven services restored to 11.0.11/);
  assert.deepEqual(calls, [['move', 'old', 'prior', 'new', 'old'], ['deploy', '11.0.12'], ['move', 'new', 'old', 'old', 'prior'], ['deploy', '11.0.11']]);
  assert.deepEqual(reports, ['rolling-back', 'rolled-back']);
});

test('a failed pointer comparison cannot deploy or roll back another rollout', async () => {
  let deployments = 0;
  await assert.rejects(rollout({ current, previous, target, move: async () => { throw new Error('lease changed'); },
    deploy: async () => deployments++ }), /lease changed/);
  assert.equal(deployments, 0);
});

test('failed rollback is explicitly reported and never presented as success', async () => {
  const reports = [];
  await assert.rejects(rollout({ current, previous, target, move: async () => {}, deploy: async () => { throw new Error('offline'); },
    report: result => reports.push(result.status) }), /rollback needs attention/);
  assert.equal(reports.at(-1), 'rollback-failed');
});

test('every hook is attempted after a partial failure without exposing its URL', async () => {
  const triggered = [], messages = [];
  await assert.rejects(deployServices('11.0.12', hooks, {
    log: message => messages.push(message),
    wait: async check => assert.equal(await check(), true),
    request: async (url, init) => {
      if (init.method === 'POST') { triggered.push(url); return new Response('', { status: url === hooks['auth-default'] ? 500 : 200 }); }
      return Response.json({ version: '11.0.12' });
    }
  }), /auth-default/);
  assert.equal(triggered.length, 7);
  assert.ok(messages.every(message => !message.includes('https://')));
});

test('deployment readiness waits when npm has published metadata but a tarball is missing', async () => {
  const checked = [];
  let frameworkAvailable = false;
  await waitForReleasePackages('11.0.12', {
    log() {},
    wait: async check => {
      assert.equal(await check(), false);
      frameworkAvailable = true;
      assert.equal(await check(), true);
    },
    request: async (url, init) => {
      assert.equal(init.method, 'HEAD');
      assert.equal(init.redirect, 'error');
      assert.match(url, /^https:\/\/registry\.npmjs\.org\/@betterportal\/[^/]+\/-\/[^/]+-11\.0\.12\.tgz$/);
      checked.push(url);
      return new Response(null, { status: url.includes('/framework/-/') && !frameworkAvailable ? 404 : 200 });
    }
  });
  assert.equal(new Set(checked).size, 10);
  assert.equal(checked.at(-1), 'https://registry.npmjs.org/@betterportal/framework/-/framework-11.0.12.tgz');
  assert.equal(checked.length, 11);
});

test('a rollout waits for publication and checks version and health on every service', async () => {
  const checked = new Set(), triggered = [];
  await deployServices('11.0.12', hooks, {
    log() {},
    wait: async check => { for (let i = 0; i < 5; i++) if (await check()) return; assert.fail('service not ready'); },
    request: async (url, init) => {
      if (init.method === 'POST') {
        assert.equal(init.headers['Content-Type'], 'application/json');
        assert.equal(init.body, '{}');
        triggered.push(url); return new Response('');
      }
      checked.add(url);
      return Response.json(url.endsWith('/health') ? { ok: true } : { version: '11.0.12' });
    }
  });
  assert.equal(triggered.length, 7);
  assert.equal(checked.size, 15);
});

test('wrong version and unhealthy service never pass verification', async () => {
  for (const failure of ['version', 'health']) {
    await assert.rejects(deployServices('11.0.12', hooks, {
      log() {},
      wait: async check => { for (let i = 0; i < 3; i++) if (await check()) return; throw new Error('not ready'); },
      request: async (url, init) => {
        if (init.method === 'POST') return new Response('');
        if (url.includes('raw.githubusercontent')) return Response.json({ version: '11.0.12' });
        return Response.json(url.endsWith('/health') ? { ok: failure !== 'health' } : { version: failure === 'version' ? '11.0.11' : '11.0.12' });
      }
    }), /not ready/);
  }
});

test('readiness has a bounded timeout and tolerates transient connection errors', async () => {
  let time = 0, attempts = 0;
  const clock = { now: () => time, sleep: async ms => { time += ms; }, intervalMs: 10, timeoutMs: 30 };
  await waitFor(() => { if (++attempts === 1) throw new Error('network'); return true; }, clock);
  assert.equal(attempts, 2);
  await assert.rejects(waitFor(() => false, clock), /Timed out/);
});


test('a failed rebuild of the active version rolls all services back to the previous release', async () => {
  const calls = [];
  await assert.rejects(rollout({ current, previous, target: current,
    move: async (...args) => calls.push(['move', ...args]),
    deploy: async version => { calls.push(['deploy', version]); if (version === current.version) throw new Error('rebuild failed'); }
  }), /all seven services restored to 11.0.8/);
  assert.deepEqual(calls, [['deploy', '11.0.11'], ['move', 'old', 'prior', 'prior', 'old'], ['deploy', '11.0.8']]);
});

test('a successful rebuild retains both existing release pointers', async () => {
  const calls = [];
  const result = await rollout({ current, previous, target: current,
    move: async () => assert.fail('rebuild must retain release pointers'), deploy: async version => calls.push(version) });
  assert.deepEqual(calls, ['11.0.11']);
  assert.equal(result.status, 'verified');
  assert.equal(result.previousVersion, '11.0.8');
});
