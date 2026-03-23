import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  BetterPortalControlPlaneStore,
  type App,
  type BindingRecord,
  type JsonValue,
  syncAllBindingManifests,
  type Tenant
} from "@betterportal/framework-nodejs";
import { signJwt } from "@betterportal/auth-nodejs";
import { renderBootstrap1Shell } from "@betterportal/theme-bootstrap1-nodejs";
import { HelloManifest, handleHelloViewRequest, renderHelloWithinTheme } from "./helloView";

const HOST_PORT = 3100;
const PLUGIN_PORT = 3200;
const HOST_ORIGIN = `http://localhost:${HOST_PORT}`;
const PLUGIN_ORIGIN = `http://localhost:${PLUGIN_PORT}`;

const store = new BetterPortalControlPlaneStore();

const tenant: Tenant = store.upsertTenant({
  id: "tenant-demo",
  slug: "demo",
  title: "BetterPortal Demo",
  branding: {
    primaryColor: "#0d6efd",
    secondaryColor: "#6c757d"
  }
});

const app: App = store.upsertApp({
  id: "app-demo-web",
  tenantId: tenant.id,
  slug: "web",
  hostname: `localhost:${HOST_PORT}`,
  title: "BetterPortal Demo App",
  themeId: "bootstrap1",
  routes: [
    {
      id: "route-hello",
      title: "Hello",
      path: "/hello",
      viewId: "hello.index",
      serviceId: HelloManifest.pluginId,
      enabled: true
    }
  ]
});

const binding: BindingRecord = store.upsertBinding({
  bindingId: "binding-demo-hello",
  serviceId: HelloManifest.pluginId,
  tenantId: tenant.id,
  appIds: [app.id],
  endpointBaseUrl: PLUGIN_ORIGIN,
  deploymentMode: "self-hosted",
  enabled: true,
  importedManifestVersion: "0.0.0",
  trust: {
    credentialId: "cred-demo-hello",
    issuer: "betterportal-demo",
    audience: "betterportal-demo-plugin",
    scopes: ["manifest:read", "tenant:read", "app:read"],
    rotationVersion: "1"
  }
});

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(body);
}

function applyPluginCors(request: IncomingMessage, response: ServerResponse): boolean {
  response.setHeader("Access-Control-Allow-Origin", HOST_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, HX-Request, HX-Target, HX-Trigger");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return true;
  }

  return false;
}

function queryValueFromUrl(request: IncomingMessage, key: string): string | undefined {
  const requestUrl = new URL(request.url ?? "/", HOST_ORIGIN);
  const value = requestUrl.searchParams.get(key);
  return value ?? undefined;
}

function demoRuntimeToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    secret: "betterportal-demo-secret",
    claims: {
      iss: "betterportal-demo-auth",
      aud: "betterportal-runtime",
      sub: "demo-user",
      exp: now + 1800,
      iat: now,
      jti: "demo-jwt",
      realm: "runtime",
      tenantId: tenant.id,
      appId: app.id,
      roles: ["user"],
      tokenType: "id",
      policyVersion: "1"
    }
  });
}

function renderHostPage(): string {
  const content = `
    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <section class="mb-4">
          <span class="badge text-bg-primary mb-3">v10 demo</span>
          <h1 class="display-6 mb-3">BetterPortal Bootstrap1 + HTMX demo</h1>
          <p class="text-body-secondary mb-0">
            This shell is hosted on <code>${HOST_ORIGIN}</code>. The hello plugin is hosted separately on
            <code>${PLUGIN_ORIGIN}</code> and is loaded directly by the browser through HTMX.
          </p>
        </section>
        <section
          id="hello-fragment"
          class="border rounded-4 p-3 bg-body-tertiary"
          hx-get="${PLUGIN_ORIGIN}/hello?name=Mitchell"
          hx-trigger="load"
          hx-target="#hello-fragment"
          hx-swap="innerHTML"
          hx-headers='{"Accept":"text/html; theme=bootstrap1; mode=fragment"}'
        >
          <div class="text-body-secondary">Loading plugin fragment...</div>
        </section>
      </div>
      <div class="col-12 col-lg-4">
        <div class="d-grid gap-3">
          <a class="btn btn-outline-primary" href="${PLUGIN_ORIGIN}/hello?name=Mitchell" target="_blank" rel="noreferrer">
            Open plugin HTML directly
          </a>
          <a class="btn btn-outline-secondary" href="${HOST_ORIGIN}/admin/state" target="_blank" rel="noreferrer">
            Inspect control-plane state
          </a>
          <a class="btn btn-outline-dark" href="${PLUGIN_ORIGIN}/manifest" target="_blank" rel="noreferrer">
            Plugin manifest
          </a>
          <a class="btn btn-outline-warning" href="${HOST_ORIGIN}/demo/token" target="_blank" rel="noreferrer">
            Demo runtime token
          </a>
        </div>
      </div>
    </div>
  `;

  return renderBootstrap1Shell({
    title: app.title,
    brandName: tenant.title,
    themeMode: "light",
    bodyHtml: content,
    loginUrl: "/demo/token"
  });
}

async function handleHostRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", HOST_ORIGIN);

  if (requestUrl.pathname === "/") {
    sendHtml(response, 200, renderHostPage());
    return;
  }

  if (requestUrl.pathname === "/admin/state") {
    sendJson(response, 200, store.getSnapshot() as unknown as JsonValue);
    return;
  }

  if (requestUrl.pathname === "/demo/token") {
    sendJson(response, 200, {
      token: demoRuntimeToken(),
      issuer: "betterportal-demo-auth",
      audience: "betterportal-runtime"
    });
    return;
  }

  if (requestUrl.pathname === "/demo/refresh") {
    const syncResult = await syncAllBindingManifests(store, async () => HelloManifest);
    sendJson(response, 200, {
      refreshed: syncResult.length,
      importedAt: syncResult[0]?.importedAtIso ?? null
    });
    return;
  }

  sendJson(response, 404, { error: "Host route not found" });
}

function acceptHeader(request: IncomingMessage): string | undefined {
  const header = request.headers.accept;
  return typeof header === "string" ? header : undefined;
}

async function handlePluginRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (applyPluginCors(request, response)) {
    return;
  }

  const requestUrl = new URL(request.url ?? "/", PLUGIN_ORIGIN);
  if (requestUrl.pathname === "/manifest") {
    sendJson(response, 200, HelloManifest as unknown as JsonValue);
    return;
  }

  if (requestUrl.pathname === "/hello") {
    const accept = acceptHeader(request);
    const query = {
      name: queryValueFromUrl(request, "name") ?? "World"
    };

    const wantsShell = accept?.includes("mode=page") ?? false;
    const negotiated = wantsShell
      ? renderHelloWithinTheme({
          acceptHeader: accept,
          query,
          tenant,
          app,
          mode: "light",
          loginUrl: `${HOST_ORIGIN}/demo/token`
        })
      : handleHelloViewRequest({
          acceptHeader: accept,
          query
        });

    response.writeHead(negotiated.status, {
      "Content-Type": `${negotiated.contentType}; charset=utf-8`
    });
    response.end(
      typeof negotiated.body === "string"
        ? negotiated.body
        : JSON.stringify(negotiated.body, null, 2)
    );
    return;
  }

  sendJson(response, 404, { error: "Plugin route not found" });
}

export async function startDemoServers(): Promise<void> {
  await syncAllBindingManifests(store, async () => HelloManifest);

  const hostServer = createServer((request, response) => {
    void handleHostRequest(request, response);
  });
  const pluginServer = createServer((request, response) => {
    void handlePluginRequest(request, response);
  });

  await new Promise<void>((resolve) => hostServer.listen(HOST_PORT, resolve));
  await new Promise<void>((resolve) => pluginServer.listen(PLUGIN_PORT, resolve));

  console.log(`BetterPortal host demo running at ${HOST_ORIGIN}`);
  console.log(`BetterPortal plugin demo running at ${PLUGIN_ORIGIN}`);
  console.log("Try the shell first: http://localhost:3100/");
}

if (require.main === module) {
  void startDemoServers();
}
