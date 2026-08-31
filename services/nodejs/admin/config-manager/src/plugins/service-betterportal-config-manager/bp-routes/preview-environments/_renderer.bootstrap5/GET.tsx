/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../../../previewEnvironmentManagement.js";

function pageScript(): HtmlRenderable {
  return js(`(() => {
    const tenant = document.getElementById("bp-preview-source-tenant");
    const app = document.getElementById("bp-preview-source-app");
    const services = document.getElementById("bp-preview-service-ids");
    const syncApps = () => {
      if (!tenant || !app) return;
      [...app.options].forEach((option) => {
        option.hidden = !!option.value && option.dataset.tenantId !== tenant.value;
      });
      if (app.selectedOptions[0]?.hidden) app.value = "";
    };
    const syncServices = () => {
      const option = app?.selectedOptions[0];
      if (!services || !option?.value) return;
      services.value = option.dataset.requiredServices || option.dataset.services || "";
    };
    tenant?.addEventListener("change", syncApps);
    app?.addEventListener("change", syncServices);
    syncApps();

    document.querySelectorAll("[data-bp-copy-target]").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.dataset.bpCopyTarget);
        if (!target) return;
        await navigator.clipboard.writeText(target.value || target.textContent || "");
        const original = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = original; }, 1500);
      });
    });

    const decode64 = (value) => {
      const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
      return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    };
    const encode64 = (value) => btoa(String.fromCharCode(...new Uint8Array(value)))
      .replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    const importPreviewKey = async (value) => {
      if (!value.startsWith("bp_pck_")) throw new Error("Config key must start with bp_pck_");
      const bytes = decode64(value.slice(7));
      if (bytes.length !== 32) throw new Error("Config key must contain 32 bytes");
      return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    };
    const aad = (scope, key) => new TextEncoder().encode("betterportal.preview-config.v1\\n" + scope + "\\n" + key);
    const encryptValue = async (cryptoKey, scope, path, value) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(scope, path), tagLength: 128 }, cryptoKey, new TextEncoder().encode(value));
      return "encrypted:bp-aes256gcm-v1:" + encode64(iv) + ":" + encode64(encrypted);
    };
    const decryptValue = async (cryptoKey, scope, path, value) => {
      const prefix = "encrypted:bp-aes256gcm-v1:";
      if (!value.startsWith(prefix)) throw new Error("Unsupported encrypted config envelope");
      const [iv, encrypted] = value.slice(prefix.length).split(":");
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode64(iv), additionalData: aad(scope, path), tagLength: 128 }, cryptoKey, decode64(encrypted));
      return new TextDecoder().decode(clear);
    };

    document.querySelectorAll("[data-bp-preview-config-form]").forEach((form) => {
      const keyInput = form.querySelector("[data-bp-preview-key]");
      const status = form.querySelector("[data-bp-preview-config-status]");
      const existing = {};
      form.querySelectorAll("[data-bp-existing-config]").forEach((node) => {
        existing[node.dataset.serviceId] = {
          tenant: JSON.parse(node.dataset.tenant || "{}"),
          app: JSON.parse(node.dataset.app || "{}")
        };
      });
      form.querySelector("[data-bp-generate-key]")?.addEventListener("click", () => {
        keyInput.value = "bp_pck_" + encode64(crypto.getRandomValues(new Uint8Array(32)));
        keyInput.dispatchEvent(new Event("input"));
      });
      form.querySelector("[data-bp-decrypt-config]")?.addEventListener("click", async () => {
        try {
          const cryptoKey = await importPreviewKey(keyInput.value.trim());
          for (const input of form.querySelectorAll("[data-bp-config-field][data-secret=true]")) {
            const encrypted = existing[input.dataset.serviceId]?.[input.dataset.scope]?.[input.dataset.key];
            if (encrypted) input.value = await decryptValue(cryptoKey, input.dataset.scope, input.dataset.key, encrypted);
          }
          status.textContent = "Secrets decrypted in this browser only.";
          status.className = "alert alert-success py-2";
        } catch (error) {
          status.textContent = error.message || String(error);
          status.className = "alert alert-danger py-2";
        }
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          const values = structuredClone(existing);
          const clearedSecrets = new Set([...form.querySelectorAll("[data-bp-clear-secret]:checked")].map((input) =>
            input.dataset.serviceId + "\\n" + input.dataset.scope + "\\n" + input.dataset.key
          ));
          let cryptoKey;
          for (const input of form.querySelectorAll("[data-bp-config-field]")) {
            const service = values[input.dataset.serviceId] ||= { tenant: {}, app: {} };
            const scope = service[input.dataset.scope] ||= {};
            const value = input.value.trim();
            if (!value) {
              const secretKey = input.dataset.serviceId + "\\n" + input.dataset.scope + "\\n" + input.dataset.key;
              if (input.dataset.secret === "true" && scope[input.dataset.key] && !clearedSecrets.has(secretKey)) continue;
              if (input.required && !(input.dataset.secret === "true" && scope[input.dataset.key])) throw new Error(input.dataset.title + " is required");
              if (!input.required || clearedSecrets.has(secretKey)) delete scope[input.dataset.key];
              continue;
            }
            if (input.dataset.secret === "true") {
              cryptoKey ||= await importPreviewKey(keyInput.value.trim());
              scope[input.dataset.key] = await encryptValue(cryptoKey, input.dataset.scope, input.dataset.key, value);
            } else {
              scope[input.dataset.key] = value;
            }
          }
          status.textContent = "Saving encrypted config...";
          status.className = "alert alert-info py-2";
          await window.htmx.ajax("POST", form.dataset.path, {
            source: form,
            target: "#bp-main",
            swap: "innerHTML",
            values: { action: "save-config", groupId: form.dataset.groupId, configs: JSON.stringify(values) }
          });
        } catch (error) {
          status.textContent = error.message || String(error);
          status.className = "alert alert-danger py-2";
        }
      }, true);
    });
  })()`);
}

function oidcFields(prefix: string, oidc?: ResponseData["groups"][number]["oidc"]): HtmlRenderable {
  return (
    <details class="border rounded p-3 mb-3">
      <summary class="fw-semibold">OIDC restrictions (recommended for CI)</summary>
      <div class="mt-3">
        <div class="mb-3">
          <label class="form-label" for={`${prefix}-oidc-issuer`}>Issuer</label>
          <input id={`${prefix}-oidc-issuer`} class="form-control font-monospace" type="url" name="oidcIssuer" value={oidc?.issuer ?? ""} placeholder="https://token.actions.githubusercontent.com" />
        </div>
        <div class="mb-3">
          <label class="form-label" for={`${prefix}-oidc-audience`}>Audience</label>
          <input id={`${prefix}-oidc-audience`} class="form-control font-monospace" name="oidcAudience" value={oidc?.audience ?? ""} />
        </div>
        <div class="mb-3">
          <label class="form-label" for={`${prefix}-oidc-jwks`}>JWKS URL</label>
          <input id={`${prefix}-oidc-jwks`} class="form-control font-monospace" type="url" name="oidcJwksUri" value={oidc?.jwksUri ?? ""} placeholder="https://token.actions.githubusercontent.com/.well-known/jwks" />
        </div>
        <div class="mb-3">
          <label class="form-label" for={`${prefix}-oidc-subject`}>Subject prefix</label>
          <input id={`${prefix}-oidc-subject`} class="form-control font-monospace" name="oidcSubjectPrefix" value={oidc?.subjectPrefix ?? ""} placeholder="repo:org/repository:" />
        </div>
        <div>
          <label class="form-label" for={`${prefix}-oidc-claims`}>Required claims (JSON string values)</label>
          <textarea id={`${prefix}-oidc-claims`} class="form-control font-monospace" name="oidcRequiredClaims" rows={3}>{oidc?.requiredClaimsJson ?? "{}"}</textarea>
        </div>
      </div>
    </details>
  );
}

function expiryInput(current?: number, includeDefault = false, label = "Expiry"): HtmlRenderable {
  return <input class="form-control" name="expiresInDays" inputmode="numeric" maxlength="5" pattern="(?:never|[1-9][0-9]{0,3})" value={current === undefined ? includeDefault ? "" : "never" : String(current)} placeholder={includeDefault ? "Group default" : "30 or never"} aria-label={label} required={!includeDefault} />;
}

function credentials(data: ResponseData): HtmlRenderable | null {
  if (!data.issuedApiKey && data.issuedCredentials.length === 0) return null;
  return (
    <div class="alert alert-warning" role="status">
      <h3 class="h6">Copy these credentials now</h3>
      <p class="small mb-3">They are shown once and cannot be recovered.</p>
      {data.issuedApiKey ? (
        <div class="mb-3">
          <label class="form-label" for="bp-issued-group-key">Preview group API key</label>
          <div class="input-group">
            <input id="bp-issued-group-key" class="form-control font-monospace" value={data.issuedApiKey} readonly />
            <button class="btn btn-outline-dark" type="button" data-bp-copy-target="bp-issued-group-key">Copy</button>
          </div>
        </div>
      ) : null}
      {data.issuedCredentials.map((credential, index) => {
        const id = `bp-issued-service-${index}`;
        return (
          <div class="mb-3">
            <div class="fw-semibold">{credential.serviceId}</div>
            <textarea id={id} class="form-control font-monospace small" rows={2} readonly>{`BP_CONTROL_PLANE_URL=${credential.controlPlaneUrl}\nBP_SERVICE_API_KEY=${credential.apiKey}`}</textarea>
            <button class="btn btn-sm btn-outline-dark mt-2" type="button" data-bp-copy-target={id}>Copy environment</button>
          </div>
        );
      })}
    </div>
  );
}

function configEditor(group: ResponseData["groups"][number], path: string): HtmlRenderable {
  const hasFields = group.services.some((service) => service.fields.length > 0);
  const existing = (service: ResponseData["groups"][number]["services"][number], scope: "tenant" | "app") => {
    try { return JSON.parse(scope === "tenant" ? service.encryptedTenantConfig : service.encryptedAppConfig) as Record<string, string>; }
    catch { return {}; }
  };
  const fieldControl = (service: ResponseData["groups"][number]["services"][number], field: ResponseData["groups"][number]["services"][number]["fields"][number]) => {
    const current = existing(service, field.scope)[field.key];
    if (!field.secret && field.control === "select" && field.options.length > 0) {
      return <select class="form-select" data-bp-config-field="" data-service-id={service.serviceId} data-scope={field.scope} data-key={field.key} data-title={field.title} data-secret="false" required={field.required}>{!field.required ? <option value="">Not set</option> : null}{field.options.map((option) => <option value={option.value} selected={current === option.value}>{option.label}</option>)}</select>;
    }
    return <input class="form-control" type={field.secret ? "password" : field.control === "email" || field.control === "url" ? field.control : "text"} maxlength="255" value={field.secret ? "" : current ?? ""} autocomplete={field.secret ? "new-password" : "off"} data-bp-config-field="" data-service-id={service.serviceId} data-scope={field.scope} data-key={field.key} data-title={field.title} data-secret={field.secret ? "true" : "false"} required={field.required && !field.secret} />;
  };
  return (
    <details class="border rounded p-3 mt-3">
      <summary class="fw-semibold">Encrypted service configuration</summary>
      {!hasFields ? <div class="alert alert-secondary mt-3 mb-0">No synced service config schemas are available for this group.</div> : (
        <form class="mt-3" data-bp-preview-config-form="" data-group-id={group.id} data-path={path}>
          <div class="alert alert-warning small">Use preview-only values. The key and decrypted secrets stay in this browser; BetterPortal stores only <code>encrypted:</code> envelopes.</div>
          <label class="form-label" for={`bp-preview-key-${group.id}`}>Preview config key</label>
          <div class="input-group mb-2">
            <input id={`bp-preview-key-${group.id}`} class="form-control font-monospace" type="password" autocomplete="off" data-bp-preview-key="" />
            <button class="btn btn-outline-secondary" type="button" data-bp-generate-key="">Generate</button>
            <button class="btn btn-outline-secondary" type="button" data-bp-copy-target={`bp-preview-key-${group.id}`}>Copy</button>
          </div>
          <div class="form-text mb-3">Set this exact value as <code>BP_PREVIEW_CONFIG_KEY</code> on every configured preview service. Keep it outside BetterPortal.</div>
          <button class="btn btn-sm btn-outline-secondary mb-3" type="button" data-bp-decrypt-config="">Decrypt stored secrets</button>
          {group.services.map((service) => (
            <fieldset class="border rounded p-3 mb-3">
              <legend class="float-none w-auto px-2 fs-6">{service.title}</legend>
              <span hidden data-bp-existing-config="" data-service-id={service.serviceId} data-tenant={service.encryptedTenantConfig} data-app={service.encryptedAppConfig}></span>
              {(["tenant", "app"] as const).map((scope) => {
                const fields = service.fields.filter((field) => field.scope === scope);
                return fields.length === 0 ? null : <div class="mb-3"><div class="text-uppercase text-secondary small fw-semibold mb-2">{scope} config</div><div class="row g-3">{fields.map((field) => <div class="col-12 col-lg-6"><label class="form-label">{field.title}{field.required ? " *" : ""}</label>{fieldControl(service, field)}<div class="form-text">{field.description}{field.secret ? " Blank keeps the stored value." : ""}</div>{field.secret && !field.required ? <div class="form-check mt-1"><input class="form-check-input" type="checkbox" data-bp-clear-secret="" data-service-id={service.serviceId} data-scope={field.scope} data-key={field.key} id={`bp-clear-${group.id}-${service.serviceId}-${field.scope}-${field.key}`} /><label class="form-check-label small" for={`bp-clear-${group.id}-${service.serviceId}-${field.scope}-${field.key}`}>Clear stored value</label></div> : null}</div>)}</div></div>;
              })}
            </fieldset>
          ))}
          <div class="alert alert-secondary py-2" data-bp-preview-config-status="" role="status">Key is never submitted.</div>
          <button class="btn btn-primary" type="submit">Encrypt and save config</button>
        </form>
      )}
    </details>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="container-fluid px-0">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 class="mb-1">{data.title}</h2>
          <p class="text-secondary mb-0">Clone an existing tenant/app configuration while CI owns where each service runs.</p>
        </div>
        <button class="btn btn-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-create-preview-group">Create group</button>
      </div>

      {data.notice ? <div class="alert alert-success" role="status">{data.notice}</div> : null}
      {data.error ? <div class="alert alert-danger" role="alert">{data.error}</div> : null}
      {credentials(data)}

      <div class="alert alert-info d-flex gap-2 align-items-start">
        <span aria-hidden="true">i</span>
        <div><strong>Pull setup only.</strong> Services receive credentials from CI, publish their manifest on first sync, and rebuild preview routes/menu automatically.</div>
      </div>

      {data.groups.length === 0 ? (
        <div class="card border-0 shadow-sm"><div class="card-body py-5 text-center text-secondary">No preview groups configured.</div></div>
      ) : data.groups.map((group) => (
        <section class="card border-0 shadow-sm mb-4" aria-labelledby={`bp-group-${group.id}`}>
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h3 class="h5 mb-1" id={`bp-group-${group.id}`}>{group.name}</h3>
                <div class="small text-secondary">{group.sourceLabel}</div>
                <code class="small">{group.id}</code>
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="collapse" data-bs-target={`#bp-new-${group.id}`}>New preview</button>
                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse" data-bs-target={`#bp-settings-${group.id}`}>Settings</button>
                <button
                  class="btn btn-sm btn-outline-danger"
                  hx-delete={`${data.previewPath}?entity=group&id=${encodeURIComponent(group.id)}`}
                  hx-confirm={`Delete ${group.name} and all of its previews?`}
                  hx-target="#bp-main"
                  hx-swap="innerHTML"
                >Delete</button>
              </div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-12 col-xl-7">
                <div class="small text-secondary mb-1">CI endpoint</div>
                <code class="d-block text-break">POST {data.deploymentApiBase}/{group.id}/deployments/&lt;key&gt;</code>
              </div>
              <div class="col-12 col-xl-5">
                <div class="small text-secondary mb-1">Managed services</div>
                <div class="d-flex flex-wrap gap-1">{group.services.map((service) => <span class="badge text-bg-secondary">{service.serviceId}</span>)}</div>
              </div>
            </div>

            <div class="collapse mb-4" id={`bp-new-${group.id}`}>
              <div class="border rounded p-3 bg-body-tertiary">
                <h4 class="h6">Create preview manually</h4>
                <form hx-post={data.previewPath} hx-target="#bp-main" hx-swap="innerHTML">
                  <input type="hidden" name="action" value="create-deployment" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <div class="row g-3">
                    <div class="col-12 col-md-4"><label class="form-label">Key</label><input class="form-control font-monospace" name="key" maxlength="255" pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" required /></div>
                    <div class="col-12 col-md-4"><label class="form-label">Name</label><input class="form-control" name="name" /></div>
                    <div class="col-12 col-md-4"><label class="form-label">Expiry</label>{expiryInput(undefined, true)}</div>
                    <div class="col-12"><label class="form-label">App hostname or origin</label><input class="form-control font-monospace" name="hostname" placeholder="pr-123.preview.example.com" required /></div>
                    {group.services.map((service) => (
                      <div class="col-12 col-lg-6">
                        <label class="form-label">{service.title} URL</label>
                        <input class="form-control font-monospace" type="url" name={`service.${service.serviceId}`} placeholder="https://service-pr-123.example.com" required />
                        <div class="form-text font-monospace">{service.serviceId}</div>
                      </div>
                    ))}
                  </div>
                  <button class="btn btn-primary mt-3" type="submit">Create preview</button>
                </form>
              </div>
            </div>

            <div class="collapse mb-4" id={`bp-settings-${group.id}`}>
              <div class="border rounded p-3">
                <form hx-put={data.previewPath} hx-target="#bp-main" hx-swap="innerHTML">
                  <input type="hidden" name="action" value="update-group" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <div class="row g-3 mb-3">
                    <div class="col-12 col-md-8"><label class="form-label">Group name</label><input class="form-control" name="name" value={group.name} required /></div>
                    <div class="col-12 col-md-4"><label class="form-label">Maximum/default expiry</label>{expiryInput(group.expiresInDays)}</div>
                  </div>
                  {oidcFields(`bp-group-${group.id}`, group.oidc)}
                  <button class="btn btn-primary" type="submit">Save settings</button>
                </form>
                <hr />
                <form hx-post={data.previewPath} hx-target="#bp-main" hx-swap="innerHTML">
                  <input type="hidden" name="action" value="rotate-key" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <button class="btn btn-outline-warning" type="submit" hx-confirm="Rotate this group API key? Existing CI credentials will stop working.">Rotate API key</button>
                </form>
                {configEditor(group, data.previewPath)}
              </div>
            </div>

            {group.deployments.length === 0 ? <div class="text-secondary small">No active previews.</div> : (
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead><tr><th>Preview</th><th>App</th><th>Services</th><th>Expiry</th><th></th></tr></thead>
                  <tbody>{group.deployments.map((deployment) => (
                    <tr>
                      <td><div class="fw-semibold">{deployment.name}</div><code class="small">{deployment.key}</code><div><span class={`badge ${deployment.ready ? "text-bg-success" : "text-bg-warning"}`}>{deployment.ready ? "Synced" : "Waiting for sync"}</span></div></td>
                      <td><a href={deployment.hostname.startsWith("http") ? deployment.hostname : `https://${deployment.hostname}`} target="_blank" rel="noreferrer">{deployment.hostname}</a></td>
                      <td>{deployment.services.map((service) => <div class="small"><span class={`badge ${service.ready ? "text-bg-success" : "text-bg-warning"}`}>{service.ready ? "Synced" : "Waiting"}</span> <span class="font-monospace">{service.serviceId}</span></div>)}</td>
                      <td>
                        <form class="d-flex gap-2" hx-put={data.previewPath} hx-target="#bp-main" hx-swap="innerHTML">
                          <input type="hidden" name="action" value="update-expiry" />
                          <input type="hidden" name="deploymentId" value={deployment.id} />
                          {expiryInput(deployment.expiresInDays, false, `Expiry for ${deployment.name}`)}
                          <button class="btn btn-sm btn-outline-secondary" type="submit">Save</button>
                        </form>
                        <div class="small text-secondary mt-1">{deployment.expiresAt ? new Date(deployment.expiresAt).toLocaleString() : "Never expires"}</div>
                      </td>
                      <td><button class="btn btn-sm btn-outline-danger" hx-delete={`${data.previewPath}?entity=deployment&id=${encodeURIComponent(deployment.id)}`} hx-confirm={`Delete preview ${deployment.name}?`} hx-target="#bp-main" hx-swap="innerHTML">Delete</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      <aside class="offcanvas offcanvas-end" tabindex={-1} id="bp-create-preview-group" aria-labelledby="bp-create-preview-group-title">
        <div class="offcanvas-header">
          <h3 class="offcanvas-title h5" id="bp-create-preview-group-title">Create preview group</h3>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <form hx-post={data.previewPath} hx-target="#bp-main" hx-swap="innerHTML">
            <input type="hidden" name="action" value="create-group" />
            <div class="mb-3"><label class="form-label" for="bp-preview-group-name">Name</label><input id="bp-preview-group-name" class="form-control" name="name" maxlength="120" required /></div>
            <div class="mb-3">
              <label class="form-label" for="bp-preview-source-tenant">Source tenant</label>
              <select id="bp-preview-source-tenant" class="form-select" name="sourceTenantId" required><option value="">Select tenant</option>{data.sourceTenants.map((tenant) => <option value={tenant.id}>{tenant.title}</option>)}</select>
            </div>
            <div class="mb-3">
              <label class="form-label" for="bp-preview-source-app">Source app</label>
              <select id="bp-preview-source-app" class="form-select" name="sourceAppId" required><option value="">Select app</option>{data.sourceApps.map((app) => <option value={app.id} data-tenant-id={app.tenantId} data-services={app.serviceIds.join(",")} data-required-services={app.requiredServiceIds.join(",")}>{app.title}</option>)}</select>
            </div>
            <div class="mb-3">
              <label class="form-label" for="bp-preview-service-ids">Service plugin IDs</label>
              <textarea id="bp-preview-service-ids" class="form-control font-monospace" name="serviceIds" rows={4} required></textarea>
              <div class="form-text">Required source services are filled automatically. Add more tenant services if CI will deploy them.</div>
            </div>
            <div class="mb-3"><label class="form-label">Maximum/default expiry</label>{expiryInput(30)}</div>
            {oidcFields("bp-new-group")}
            <button class="btn btn-primary w-100" type="submit">Create group</button>
          </form>
        </div>
      </aside>
      <script>{pageScript()}</script>
    </div>
  );
}
