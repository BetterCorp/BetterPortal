import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const services = JSON.parse(readFileSync(new URL('../../deploy/easy1/services.json', import.meta.url)));
const repository = 'BetterCorp/BetterPortal';
const ref = 'refs/heads/deploy/easy1';
const previousRef = 'refs/heads/deploy/easy1-previous';
const releaseUrl = 'https://raw.githubusercontent.com/BetterCorp/BetterPortal/deploy/easy1/package.json';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/${repository}/${path}`], { encoding: 'utf8' }));
const stableVersion = value => /^\d+\.\d+\.\d+$/.test(value);
export function compareVersions(a, b) {
  if (!stableVersion(a) || !stableVersion(b)) throw new Error('Expected a stable release version');
  const parts = b.split('.').map(Number);
  return a.split('.').map(Number).reduce((result, part, i) => result || Math.sign(part - parts[i]), 0);
}

export function validateHooks(raw) {
  let hooks;
  try { hooks = JSON.parse(raw); } catch { throw new Error("Deployment hook secret is not valid JSON"); }
  for (const service of services) {
    let url;
    try { url = new URL(hooks[service.name]); } catch { throw new Error(`Missing deployment hook for ${service.name}`); }
    if (url.origin !== 'https://easy1.eu2.betterweb.co.za' || !url.pathname.startsWith('/api/deploy/') || url.username || url.password || url.hash) {
      throw new Error(`Invalid scoped deployment hook for ${service.name}`);
    }
  }
  if (Object.keys(hooks).length !== services.length) throw new Error('Expected exactly seven deployment hooks');
  return hooks;
}

export async function waitFor(check, { timeoutMs = 900_000, intervalMs = 10_000, sleep = delay, now = Date.now } = {}) {
  const deadline = now() + timeoutMs;
  do {
    try { if (await check()) return; } catch { /* health and publication can be transient */ }
    await sleep(intervalMs);
  } while (now() < deadline);
  throw new Error('Timed out waiting for deployment readiness');
}

export async function waitForReleasePackages(version, { request = fetch, wait = waitFor, log = console.log } = {}) {
  if (!stableVersion(version)) throw new Error('Expected a stable release version');
  const packages = [
    '@betterportal/framework',
    '@betterportal/plugin-bsb',
    '@betterportal/theme-runtime',
    ...services.map(service => service.package)
  ];
  const pending = new Set(packages);
  try {
    await wait(async () => {
      await Promise.all([...pending].map(async name => {
        const filename = name.split('/').at(-1);
        try {
          const response = await request(`https://registry.npmjs.org/${name}/-/${filename}-${version}.tgz`, {
            method: 'HEAD', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000)
          });
          if (response.ok) pending.delete(name);
        } catch { /* retry packages that are not reachable yet */ }
      }));
      return pending.size === 0;
    }, { timeoutMs: 600_000 });
  } catch {
    throw new Error(`npm tarballs for ${version} are not available: ${[...pending].join(', ')}`);
  }
  log(`All Easy1 npm tarballs are available for ${version}`);
}

export async function deployServices(version, hooks, { request = fetch, wait = waitFor, log = console.log } = {}) {
  await wait(async () => {
    const response = await request(releaseUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
    return response.ok && (await response.json()).version === version;
  }, { timeoutMs: 600_000 });
  const deadline = Date.now() + 20 * 60_000;
  // Trigger all seven even if an earlier trigger failed: rollback also repairs partial deployments.
  const failed = [];
  for (const service of services) {
    log(`Deploying ${service.name} to ${version}`);
    try {
      const response = await request(hooks[service.name], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (!response.ok) failed.push(service.name);
    } catch { failed.push(service.name); }
  }
  if (failed.length) throw new Error(`Deployment trigger failed for: ${failed.join(', ')}`);
  for (const service of services) {
    let consecutive = 0;
    await wait(async () => {
      try {
      const [manifest, health] = await Promise.all([
        request(`${service.origin}/.well-known/bp/manifest`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) }),
        request(`${service.origin}/.well-known/bp/health`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) })
      ]);
      const ready = manifest.ok && health.ok && (await manifest.json()).version === version && (await health.json()).ok === true;
      consecutive = ready ? consecutive + 1 : 0;
      return consecutive >= 3;
      } catch { consecutive = 0; return false; }
    }, { timeoutMs: Math.max(1, deadline - Date.now()) });
    log(`${service.name} is healthy on ${version}`);
  }
}

/** The previous pointer is written atomically with the active pointer before any service changes. */
export async function rollout({ current, previous, target, move, deploy, report = () => {} }) {
  const rebuild = target.sha === current.sha;
  const recovery = rebuild ? previous : current;
  if (!recovery) throw new Error('A previous release is required for rebuild recovery');
  if (!rebuild) await move(current.sha, previous?.sha, target.sha, current.sha);
  try {
    await deploy(target.version);
    const result = { status: rebuild ? 'verified' : 'deployed', version: target.version, previousVersion: recovery.version };
    report(result);
    return result;
  } catch (error) {
    report({ status: 'rolling-back', version: target.version, previousVersion: recovery.version });
    try {
      if (rebuild) await move(current.sha, previous.sha, previous.sha, current.sha);
      else await move(target.sha, current.sha, current.sha, previous?.sha);
      await deploy(recovery.version);
    } catch {
      report({ status: 'rollback-failed', version: target.version, previousVersion: recovery.version });
      throw new Error('Deployment failed and rollback needs attention. Inspect all seven services.');
    }
    report({ status: 'rolled-back', version: target.version, previousVersion: recovery.version });
    throw new Error(`Deployment failed; all seven services restored to ${recovery.version}`, { cause: error });
  }
}

function readPointer(name) {
  const result = git('ls-remote', 'origin', name).split(/\s+/)[0];
  if (!/^[a-f0-9]{40}$/.test(result)) return undefined;
  git('fetch', '--no-tags', 'origin', result);
  const version = JSON.parse(git('show', `${result}:package.json`)).version;
  if (!stableVersion(version)) throw new Error('Deployment pointer must reference a stable release');
  return { sha: result, version };
}

function movePointers(expected, expectedPrevious, target, prior) {
  const args = ['-c', 'credential.helper=!gh auth git-credential', 'push', '--atomic',
    `--force-with-lease=${ref}:${expected}`, `--force-with-lease=${previousRef}:${expectedPrevious ?? ''}`,
    'origin', `${target}:${ref}`, prior ? `${prior}:${previousRef}` : `:${previousRef}`];
  git(...args);
}

function verifiedRelease(version, automatic = false) {
  if (!stableVersion(version)) throw new Error('Expected a stable x.y.z release');
  const tag = `v${version}`;
  let object;
  try { object = api(`git/ref/tags/${tag}`).object; } catch (error) {
    if (automatic && String(error.stderr).includes("HTTP 404")) return undefined;
    throw error;
  }
  if (object.type !== 'tag') throw new Error('Release must have a signed annotated tag');
  const annotated = api(`git/tags/${object.sha}`);
  if (!annotated.verification?.verified || annotated.object.type !== 'commit') throw new Error('Release tag signature must be verified');
  const sha = annotated.object.sha;
  git('fetch', '--no-tags', 'origin', 'master', sha);
  git('merge-base', '--is-ancestor', sha, 'origin/master');
  if (JSON.parse(git('show', `${sha}:package.json`)).version !== version) throw new Error('Release version does not match its tag');
  for (const [workflow, branch] of [['publish.yml', tag], ['publish-python.yml', tag], ['ci.yml', 'master']]) {
    const runs = api(`actions/workflows/${workflow}/runs?head_sha=${sha}&event=push&per_page=100`).workflow_runs;
    if (!runs.some(run => run.head_branch === branch && run.conclusion === 'success')) {
      return undefined;
    }
  }
  return { sha, version };
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const automatic = process.env.GITHUB_EVENT_NAME === 'workflow_run';
  if (automatic && (event.workflow_run.event !== 'push' || event.workflow_run.conclusion !== 'success' || event.workflow_run.repository.full_name !== repository)) return;
  const current = readPointer(ref);
  const previous = readPointer(previousRef);
  if (!current || !previous) throw new Error('Bootstrap both release pointers before enabling deployment');
  const action = automatic ? 'deploy' : event.inputs.action;
  if (!['deploy', 'rollback'].includes(action)) throw new Error('Unknown deployment action');
  const branch = automatic ? event.workflow_run.head_branch : undefined;
  const version = automatic ? (branch === 'master' ? JSON.parse(git('show', `${event.workflow_run.head_sha}:package.json`)).version : branch?.replace(/^v/, ''))
    : action === 'rollback' ? previous.version : event.inputs.version;
  const target = verifiedRelease(version, automatic);
  if (automatic && target && target.sha !== event.workflow_run.head_sha) { console.log("Completed build is not the signed release commit."); return; }
  if (!target) {
    if (automatic) { console.log('Waiting for the release publications and master CI to succeed.'); return; }
    throw new Error('Release publications and master CI must all succeed before deployment');
  }
  if (automatic && compareVersions(target.version, current.version) <= 0) { console.log('Release is already deployed or superseded.'); return; }
  const hooks = validateHooks(process.env.EASY1_DEPLOY_WEBHOOKS);
  const report = result => {
    writeFileSync('easy1-deployment.json', JSON.stringify({ ...result, services: services.map(({ name, replicas }) => ({ name, replicas })) }, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Easy1: ${result.status}; requested ${result.version}; previous ${result.previousVersion}.\n\n`);
  };
  await waitForReleasePackages(target.version);
  await rollout({ current, previous, target, move: movePointers, deploy: version => deployServices(version, hooks), report });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
