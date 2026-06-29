/**
 * Vanilla HTML bootstrap wizard. No theme dependency.
 *
 * Flow (browser-side):
 *  1. Operator enters bootstrap key + admin tenant/app + theme URL + auth URL.
 *  2. Browser:
 *     a) POST /.well-known/bp/bootstrap/commit  -> registers admin tenant/app in CP DB
 *     b) For each of {theme, auth}:
 *        - POST /.well-known/bp/admin/services/begin-install -> get setupToken
 *        - POST {serviceUrl}/.well-known/bp/install with {setupToken, cpUrl}
 *     c) Redirect to admin app URL
 *  3. Admin app's login flow redirects to /register while the auth service has
 *     zero users; the operator creates the first admin THERE (app origin, so
 *     tenant/app context resolves from the request). Then logs in.
 */
export function renderBootstrapWizardHtml(input: { cpIssuer: string }): string {
  const cpIssuerSafe = JSON.stringify(input.cpIssuer);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BetterPortal Bootstrap</title>
<style>
  :root { color-scheme: light dark; --bg:#0e1116; --fg:#e6edf3; --muted:#7d8590; --accent:#2f81f7; --ok:#3fb950; --err:#f85149; --card:#161b22; --border:#30363d; --input:#0d1117; }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f6f8fa; --fg:#1f2328; --muted:#656d76; --accent:#0969da; --ok:#1a7f37; --err:#cf222e; --card:#ffffff; --border:#d0d7de; --input:#ffffff; }
  }
  *,*::before,*::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; padding: 2rem 1rem; }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { margin: 0 0 0.5rem; font-size: 1.8rem; letter-spacing: -0.02em; }
  p.lead { color: var(--muted); margin: 0 0 2rem; line-height: 1.6; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
  .card h2 { margin: 0 0 0.25rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .card p.hint { margin: 0.25rem 0 1rem; color: var(--muted); font-size: 0.9rem; }
  label { display: block; margin: 0.75rem 0 0.25rem; font-size: 0.85rem; font-weight: 600; }
  input { width: 100%; padding: 0.6rem 0.75rem; font: inherit; background: var(--input); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; }
  input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  button { width: 100%; padding: 0.75rem; font: inherit; font-weight: 600; background: var(--accent); color: white; border: 0; border-radius: 8px; cursor: pointer; }
  button:hover { filter: brightness(1.1); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  pre { background: var(--input); border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; }
  .step { display: flex; align-items: center; padding: 0.5rem 0; gap: 0.75rem; color: var(--muted); font-size: 0.9rem; }
  .step.done { color: var(--ok); }
  .step.err { color: var(--err); }
  .step .marker { width: 1.2rem; text-align: center; }
  .alert-err { background: color-mix(in srgb, var(--err) 12%, transparent); color: var(--err); border: 1px solid var(--err); padding: 0.75rem; border-radius: 6px; margin-top: 1rem; }
  .alert-ok { background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); border: 1px solid var(--ok); padding: 0.75rem; border-radius: 6px; margin-top: 1rem; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal-backdrop.open { display: flex; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 12px; max-width: 560px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); }
  .modal-header h2 { margin: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .modal-close { background: transparent; color: var(--muted); border: 0; font-size: 1.25rem; line-height: 1; padding: 0.25rem 0.5rem; cursor: pointer; border-radius: 4px; }
  .modal-close:hover { color: var(--fg); background: var(--input); }
  .modal-body { padding: 1rem 1.5rem; overflow-y: auto; flex: 1; }
</style>
</head>
<body>
<div class="wrap">
  <h1>BetterPortal Bootstrap</h1>
  <p class="lead">First-time setup. Enter the bootstrap key from your config-manager stdout, then point at your theme + auth service URLs and create the first admin user.</p>

  <form id="wizard">
    <div class="card">
      <h2>1. Bootstrap key</h2>
      <p class="hint">Logged to config-manager stdout on startup. Valid 15 minutes.</p>
      <label>Key</label>
      <input id="bootstrapKey" name="bootstrapKey" autocomplete="off" required placeholder="bootstrap-...">
    </div>

    <div class="card">
      <h2>2. Admin tenant + app</h2>
      <p class="hint">The product itself. This is where you log in to manage other tenants. IDs are auto-generated.</p>
      <label>Tenant title</label>
      <input name="adminTenant.title" value="BetterPortal" required>
      <label>App title</label>
      <input name="adminApp.title" value="Admin Portal" required>
      <label>App URL (where you'll log in)</label>
      <input name="adminApp.hostname" placeholder="http://localhost:3100" required>
    </div>

    <div class="card">
      <h2>3. Theme service</h2>
      <p class="hint">Renders the admin UI. Identity (UUIDv7) is auto-generated.</p>
      <label>Title</label>
      <input name="themeService.title" value="Bootstrap1" required>
      <label>Theme URL</label>
      <input name="themeService.hostname" placeholder="http://localhost:3100" required>
    </div>

    <div class="card">
      <h2>4. Auth service</h2>
      <p class="hint">Issues login tokens. Must publish /.well-known/bp/manifest. Identity (UUIDv7) is auto-generated.</p>
      <label>Title</label>
      <input name="authService.title" value="Auth Default" required>
      <label>Auth URL</label>
      <input name="authService.hostname" placeholder="http://localhost:3210" required>
    </div>

    <p class="hint">No admin user is created here. After setup you'll be redirected to the admin app, which walks you through creating the first admin account (open only while the auth service has zero users).</p>

    <button type="submit" id="submitBtn">Run setup</button>
  </form>

</div>

<div class="modal-backdrop" id="progressModal" role="dialog" aria-modal="true" aria-labelledby="progressModalTitle">
  <div class="modal" role="document">
    <div class="modal-header">
      <h2 id="progressModalTitle">Setup progress</h2>
      <button type="button" class="modal-close" id="progressModalClose" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body" id="steps"></div>
  </div>
</div>

<script>
const CP_ISSUER = ${cpIssuerSafe};

function getValue(form, name) { return form.elements.namedItem(name) ? form.elements.namedItem(name).value : ""; }
async function readJson(res, label) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  let text = "";
  try { text = await res.text(); } catch (_) {}
  throw new Error(label + " returned " + (contentType || "non-JSON") + " HTTP " + res.status + (text ? ": " + text.slice(0, 160) : ""));
}

function step(id, label) {
  const wrap = document.getElementById("steps");
  const div = document.createElement("div");
  div.className = "step";
  div.id = id;
  div.innerHTML = '<span class="marker">...</span><span>' + label + '</span>';
  wrap.appendChild(div);
  return {
    done() { div.classList.add("done"); div.querySelector(".marker").textContent = "OK"; },
    fail(msg) { div.classList.add("err"); div.querySelector(".marker").textContent = "X"; if (msg) div.querySelector("span:last-child").textContent = label + " - " + msg; }
  };
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "accept": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let text = "";
    try { text = await res.text(); } catch (_) {}
    throw new Error("HTTP " + res.status + " " + (text || res.statusText));
  }
  return readJson(res, "POST " + url);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return readJson(res, "GET " + url);
}

async function installService(label, serviceUrl, scope, options) {
  const s = step("install-" + label, "Install " + label + " service");
  try {
    const beginRes = await postJson(CP_ISSUER + "/.well-known/bp/admin/services/begin-install", {
      serviceUrl,
      ...(scope || {}),
      ...(options && options.instanceId ? { instanceId: options.instanceId } : {}),
      ...(options && options.sharedServiceId ? { sharedServiceId: options.sharedServiceId } : {})
    });
    const installRes = await postJson(serviceUrl.replace(/\\/+$/, "") + "/.well-known/bp/install", {
      setupToken: beginRes.setupToken,
      cpUrl: CP_ISSUER
    });
    s.done();
    return installRes;
  } catch (e) {
    s.fail(e.message);
    throw e;
  }
}

async function buildAdminRole(adminAppId, payload, commit) {
  const s = step("admin-role", "Build admin role from service manifests");
  try {
    // Fetch each known service's manifest to discover view-level permission requirements.
    // serviceId in grants MUST be the UUIDv7 instance id (matches routes/fragments
    // and what the framework auth resolver compares against), NOT the pluginId.
    const sources = [
      { instanceId: commit.cmInstanceId, url: CP_ISSUER },
      { instanceId: commit.authActivationId, url: payload.authService.hostname }
    ];
    if (payload.themeService && payload.themeService.hostname && commit.themeActivationId) {
      sources.push({ instanceId: commit.themeActivationId, url: payload.themeService.hostname });
    }
    const ACTIONS = ["read", "create", "update", "delete"];
    const grants = [];
    for (const src of sources) {
      try {
        const m = await getJson(src.url.replace(/\\/+$/, "") + "/.well-known/bp/manifest");
        const views = Array.isArray(m.views) ? m.views : [];
        for (const v of views) {
          if (!v.viewId) continue;
          grants.push({
            serviceId: src.instanceId,
            viewId: v.viewId,
            permissions: ACTIONS.slice()
          });
        }
      } catch (e) {
        // Manifest fetch can fail in race with install. Continue with whatever we have.
        // (silent - surface only via the wizard's overall failure step if all manifests miss)
      }
    }

    // POST admin role with all gathered grants
    const res = await postJson(CP_ISSUER + "/.well-known/bp/admin/apps/" + encodeURIComponent(adminAppId) + "/auth/roles", {
      id: "admin",
      title: "Administrator",
      description: "Full access to all services and views. Auto-created during bootstrap.",
      permissions: grants
    });
    s.done();
    return res;
  } catch (e) {
    s.fail(e.message);
    throw e;
  }
}

async function commitBootstrap(payload) {
  const s = step("commit", "Register admin tenant/app");
  try {
    const r = await postJson(CP_ISSUER + "/.well-known/bp/bootstrap/commit", payload);
    s.done();
    return r;
  } catch (e) {
    s.fail(e.message);
    throw e;
  }
}

const progressModal = document.getElementById("progressModal");
const stepsEl = document.getElementById("steps");
function openProgressModal() {
  stepsEl.innerHTML = "";
  progressModal.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeProgressModal() {
  progressModal.classList.remove("open");
  document.body.style.overflow = "";
  stepsEl.innerHTML = "";
  document.getElementById("submitBtn").disabled = false;
}
document.getElementById("progressModalClose").addEventListener("click", closeProgressModal);
progressModal.addEventListener("click", (e) => { if (e.target === progressModal) closeProgressModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && progressModal.classList.contains("open")) closeProgressModal();
});

document.getElementById("wizard").addEventListener("submit", async (evt) => {
  evt.preventDefault();
  const form = evt.currentTarget;
  document.getElementById("submitBtn").disabled = true;
  openProgressModal();

  const payload = {
    bootstrapKey: getValue(form, "bootstrapKey"),
    adminTenant: {
      title: getValue(form, "adminTenant.title")
    },
    adminApp: {
      title: getValue(form, "adminApp.title"),
      hostname: getValue(form, "adminApp.hostname")
    },
    themeService: {
      hostname: getValue(form, "themeService.hostname"),
      title: getValue(form, "themeService.title")
    },
    authService: {
      hostname: getValue(form, "authService.hostname"),
      title: getValue(form, "authService.title")
    }
  };

  try {
    // 1. Commit admin tenant + app to CP (CM generates UUIDv7 ids and returns them)
    const commit = await commitBootstrap(payload);

    // 2. Install auth + theme services via setup-token handshake (browser dispatches).
    //    instanceIds from commit response -> match pre-created tenant.services placeholders.
    await installService(
      "auth",
      payload.authService.hostname,
      { tenantId: commit.adminTenantId, appId: commit.adminAppId },
      { sharedServiceId: commit.authSharedServiceId }
    );
    if (payload.themeService && payload.themeService.hostname) {
      await installService(
        "theme",
        payload.themeService.hostname,
        { tenantId: commit.adminTenantId, appId: commit.adminAppId },
        { sharedServiceId: commit.themeSharedServiceId }
      );
    }

    // 3. Build admin role with all permissions from every registered service's manifest.
    await buildAdminRole(commit.adminAppId, payload, commit);

    // 4. Redirect to admin app. First admin user is created THERE: the app's
    //    login flow redirects to /register while the auth service has zero
    //    users, so the request originates from the app origin and tenant/app
    //    context resolves naturally.
    const okStep = step("done", "Bootstrap complete - redirecting to " + payload.adminApp.hostname + " to create the first admin");
    okStep.done();
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = payload.adminApp.hostname;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, 2000);
  } catch (e) {
    const note = document.createElement("div");
    note.className = "alert-err";
    note.textContent = "Setup failed: " + e.message;
    stepsEl.appendChild(note);
    document.getElementById("submitBtn").disabled = false;
  }
});
</script>
</body>
</html>`;
}
