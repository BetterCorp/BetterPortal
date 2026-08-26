import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as av from "anyvali";
import ts from "typescript";
import { createH3Router } from "../src/adapters/h3.js";
import { emitRegistry, emitRouteRuntime } from "../src/codegen/emitter.js";
import { scanRoutes } from "../src/codegen/scanner.js";
import { validateScanResult } from "../src/codegen/validate.js";
import type { BetterPortalRegistry, RegisteredRoute } from "../src/contracts/registry.js";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "../src/runtime/h3.js";
import { createSse } from "../src/runtime/sse.js";
import type { SseMapperContext } from "../src/contracts/route.js";

function write(path: string, content: string): void {
  writeFileSync(path, content, "utf8");
}

test("SSE contracts require canonical files and schema-owned handlers", (t) => {
  const baseDir = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), "bp-sse-codegen-"));
  t.after(() => rmSync(baseDir, { recursive: true, force: true }));
  const routeDir = join(baseDir, "bp-routes", "live");
  const rendererDir = join(routeDir, "_renderer.bootstrap5");
  mkdirSync(rendererDir, { recursive: true });

  write(join(baseDir, "index.ts"), "export type PluginFeature = { readonly label: string };\n");
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
  const sseSource = `
    import * as av from "anyvali";
    import { createSse } from "../../.bp-generated/route-runtime.js";
    const ValueSchema = av.object({ value: av.string() });
    export const InputSchema = ValueSchema;
    export const EventSchema = ValueSchema;
    export default createSse({ input: InputSchema, event: EventSchema }, (input) => input);
  `;
  write(join(routeDir, "sse.ts"), sseSource);
  write(join(rendererDir, "_body.live.GET.tsx"), `
    export function render(data: { value: string }) { return data.value; }
  `);
  write(join(rendererDir, "_body.live.sse.tsx"), `
    export function renderTick(data: { value: string }) { return data.value; }
  `);

  const scan = scanRoutes(baseDir);
  const route = scan.routes[0];
  const fragment = route.renderers[0];
  assert.match(route.sseRelativePath ?? "", /\/sse\.ts$/);
  assert.match(fragment.sseRendererPath ?? "", /_body\.live\.sse\.tsx$/);
  const generated = emitRegistry(scan);
  const routeRuntime = emitRouteRuntime(scan);
  assert.match(generated, /sseRender: .*\.renderTick satisfies SseRendererFor/);
  assert.match(generated, /sse: liveSse\.default/);
  assert.match(generated, /render: .*\.render satisfies ViewRendererFor/);
  assert.match(generated, /satisfies BetterPortalRegistry/);
  assert.match(routeRuntime, /forContext<PluginFeature, ServiceConfig>/);
  assert.match(routeRuntime, /createSse = baseCreateSse\.forContext/);
  assert.match(routeRuntime, /interface BetterPortalSseContracts/);
  assert.match(routeRuntime, /"live\.index": import\("anyvali"\)\.Infer/);
  assert.doesNotMatch(routeRuntime, /forContext<Plugin,/);
  assert.equal(validateScanResult(scan).some((issue) => issue.severity === "error"), false);

  const generatedDir = join(baseDir, ".bp-generated");
  mkdirSync(generatedDir);
  write(join(generatedDir, "route-runtime.ts"), routeRuntime);
  const usagePath = join(baseDir, "sse-types.ts");
  write(usagePath, `
    import type { BetterPortalSseContracts } from "@betterportal/framework";
    import "./.bp-generated/route-runtime.js";
    type ViewId = Extract<keyof BetterPortalSseContracts, string>;
    declare const emit: <TViewId extends ViewId>(viewId: TViewId, input: BetterPortalSseContracts[TViewId]) => void;
    emit("live.index", { value: "ok" });
    // @ts-expect-error wrong input
    emit("live.index", { value: 1 });
    // @ts-expect-error unknown view
    emit("missing.index", { value: "no" });
  `);
  const program = ts.createProgram([usagePath, join(generatedDir, "route-runtime.ts")], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => baseDir,
    getNewLine: () => "\n"
  }), "");

  write(join(routeDir, "sse.ts"), "export const InputSchema = {};\n");
  assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes("missing EventSchema, default")), true);

  write(join(routeDir, "sse.ts"), `
    export const tickSchema = {};
    export async function* handleSSE() {}
  `);
  assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes("must export InputSchema, EventSchema, and a default createSse")), true);

  write(join(routeDir, "sse.ts"), `
    import * as av from "anyvali";
    export const InputSchema = av.any();
    export const EventSchema = av.object({ value: av.string() });
    export default {};
  `);
  assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes("SSE schemas must be concrete")), true);
  write(join(routeDir, "sse.ts"), sseSource);

  write(join(rendererDir, "_body.live.GET.tsx"), `
    export const render = (data: { value: string }, ctx) => ctx.url.current() + data.value;
  `);
  assert.equal(validateScanResult(scanRoutes(baseDir)).some((issue) => issue.message.includes("ViewRenderContext")), true);

  write(join(routeDir, "GET.sse.ts"), "export async function* handleSSE() {}\n");
  write(join(rendererDir, "_body.live.GET.sse.tsx"), "export function renderTick() { return 'unsupported'; }\n");
  const aliasIssues = validateScanResult(scanRoutes(baseDir));
  assert.equal(aliasIssues.filter((issue) => issue.message.includes("method-qualified SSE")).length, 2);
});

test("schema-owned SSE contracts validate and isolate tenant/app input", async () => {
  const sse = createSse(
    {
      input: av.object({ value: av.string().minLength(1) }),
      event: av.object({ label: av.string().minLength(1) })
    },
    (input) => ({ label: input.value })
  );
  const context = {
    tenant: { id: "tenant-a" },
    app: { id: "app-a" }
  } as SseMapperContext;
  const iterator = sse.handler(context)[Symbol.asyncIterator]();
  const next = iterator.next();

  sse.publish({ tenant: { id: "tenant-b" }, app: { id: "app-a" } }, { value: "other tenant" });
  sse.publish({ tenant: { id: "tenant-a" }, app: { id: "app-b" } }, { value: "other app" });
  assert.deepEqual(sse.publish(context, { value: "created" }), { value: "created" });
  assert.deepEqual(await next, { value: { label: "created" }, done: false });
  assert.throws(() => sse.publish(context, { value: "" }));
  await iterator.return?.();

  const invalidOutput = createSse(
    {
      input: av.object({ value: av.string() }),
      event: av.object({ label: av.string().minLength(1) })
    },
    () => ({ label: "" })
  );
  const invalidIterator = invalidOutput.handler(context)[Symbol.asyncIterator]();
  const invalidNext = invalidIterator.next();
  invalidOutput.publish(context, { value: "accepted input" });
  await assert.rejects(invalidNext);
});

test("SSE fragments use the resolved app shell renderer and ignore client overrides", async () => {
  const handler = () => ({ value: "ready" });
  const liveSse = createSse(
    {
      input: av.object({ value: av.string() }),
      event: av.object({ value: av.string() })
    },
    (input) => input
  );
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
    sse: liveSse
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
    const abort = new AbortController();
    const publisher = setInterval(() => {
      liveSse.publish({ tenant: { id: "tenant" }, app: { id: "app" } }, { value: "tick" });
    }, 10);
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/live/__sse?_f=body.live&_theme=evil`, {
        headers: { accept: "text/event-stream; theme=evil", "x-bp-theme": "evil" },
        signal: abort.signal
      });
      assert.equal(response.headers.get("content-type"), "text/event-stream");
      const chunk = await response.body!.getReader().read();
      assert.match(new TextDecoder().decode(chunk.value), /data: <strong>tick<\/strong>/);
    } finally {
      clearInterval(publisher);
      abort.abort();
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
