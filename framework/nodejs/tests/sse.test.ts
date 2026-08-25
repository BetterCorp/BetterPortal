import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createH3Router } from "../src/adapters/h3.js";
import { emitRegistry } from "../src/codegen/emitter.js";
import { scanRoutes } from "../src/codegen/scanner.js";
import { validateScanResult } from "../src/codegen/validate.js";
import type { BetterPortalRegistry, RegisteredRoute } from "../src/contracts/registry.js";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "../src/runtime/h3.js";

function write(path: string, content: string): void {
  writeFileSync(path, content, "utf8");
}

test("SSE shorthand infers GET and rejects duplicate aliases", (t) => {
  const baseDir = mkdtempSync(join(tmpdir(), "bp-sse-codegen-"));
  t.after(() => rmSync(baseDir, { recursive: true, force: true }));
  const routeDir = join(baseDir, "bp-routes", "live");
  const rendererDir = join(routeDir, "_renderer.bootstrap5");
  mkdirSync(rendererDir, { recursive: true });

  write(join(baseDir, "index.ts"), "export class Plugin {}\n");
  write(join(routeDir, "index.ts"), `
    export const viewId = "live.index";
    export const title = "Live";
    export const description = "";
  `);
  write(join(routeDir, "GET.ts"), `
    export const operationId = "live.stream";
    export const title = "Live stream";
    export const description = "";
    export const auth = { required: false, permissions: [] };
    export const cacheHints = { ttlSeconds: 0, varyBy: [] };
    export const demoScenarios = [];
    export const ResponseSchema = {};
    export default function handle() { return { value: "ready" }; }
  `);
  write(join(routeDir, "sse.ts"), `
    export async function* handleSSE() { yield { value: "tick" }; }
    export const tickSchema = {};
  `);
  write(join(rendererDir, "_body.live.GET.tsx"), `
    export function render(data: { value: string }) { return data.value; }
  `);
  write(join(rendererDir, "_body.live.sse.tsx"), `
    export function renderTick(data: { value: string }) { return data.value; }
  `);

  const scan = scanRoutes(baseDir);
  const route = scan.routes[0];
  const fragment = route.renderers[0];
  assert.equal(route.sseMethod, "GET");
  assert.match(route.sseRelativePath ?? "", /\/sse\.ts$/);
  assert.match(fragment.sseRendererPath ?? "", /_body\.live\.sse\.tsx$/);
  const generated = emitRegistry(scan);
  assert.match(generated, /sseRender: .*\.renderTick satisfies SseRendererFor/);
  assert.match(generated, /render: .*\.render satisfies ViewRendererFor/);
  assert.match(generated, /satisfies BetterPortalRegistry/);
  assert.equal(validateScanResult(scan).some((issue) => issue.severity === "error"), false);

  write(join(routeDir, "GET.sse.ts"), "export async function* handleSSE() {}\n");
  write(join(rendererDir, "_body.live.GET.sse.tsx"), "export function renderTick() { return 'legacy'; }\n");
  const duplicateIssues = validateScanResult(scanRoutes(baseDir));
  assert.equal(duplicateIssues.filter((issue) => issue.message.includes("multiple")).length, 2);
});

test("SSE fragments use the resolved app shell renderer and ignore client overrides", async () => {
  const handler = () => ({ value: "ready" });
  const route = {
    viewId: "live.index",
    path: "/live",
    methods: ["GET"],
    paramNames: [],
    schemas: {},
    handlers: { GET: handler },
    methodRoutes: {
      GET: {
        method: "GET",
        operationId: "live.stream",
        title: "Live",
        description: "",
        schemas: {},
        handler,
        auth: { required: false, permissions: [] },
        cacheHints: {},
        demoScenarios: []
      }
    },
    title: "Live",
    description: "",
    auth: { required: false, permissions: [] },
    cacheHints: {},
    demoScenarios: [],
    renderers: {
      bootstrap5: {
        pages: [],
        components: [],
        fragments: [{
          rendererId: "body.live",
          type: "fragment",
          method: "GET",
          fragmentLocation: "body",
          fragmentId: "live",
          render: () => "ready",
          sseRender: (data: { value: string }) => `<strong>${data.value}</strong>`
        }]
      }
    },
    sse: {
      handler: async function* () {
        yield { value: "tick" };
      }
    }
  } satisfies RegisteredRoute;
  const registry: BetterPortalRegistry = { routes: [route] };
  const app = createBetterPortalApp();
  app.use("/**", (event) => {
    (event as unknown as { __bpApp: { shell: { renderer: string } } }).__bpApp = {
      shell: { renderer: "bootstrap5" }
    };
  });
  createH3Router(registry, app, {
    resolveContext: () => ({
      tenant: { id: "tenant", slug: "tenant", title: "Tenant", active: true, branding: {}, services: [], activatedPlatformServices: [] },
      app: {
        id: "app",
        tenantId: "tenant",
        slug: "app",
        title: "App",
        hostnames: ["127.0.0.1"],
        originOverrides: [],
        refererOverrides: [],
        themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
        defaultRoute: "/",
        routes: [{
          id: "route",
          kind: "api",
          path: "/_bp/service/test/live",
          serviceId: "service",
          viewId: "live.index",
          enabled: true,
          operations: ["live.stream"],
          resolvedServicePath: "/live",
          resolvedMethods: ["GET"]
        }],
        menu: [], slots: [], fragments: {}, shellFragments: {}
      }
    })
  });
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/live/__sse?_f=body.live&_theme=evil`, {
      headers: { accept: "text/event-stream; theme=evil", "x-bp-theme": "evil" }
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    assert.match(await response.text(), /data: <strong>tick<\/strong>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
