import assert from "node:assert/strict";
import test from "node:test";
import { createServer, request as httpRequest } from "node:http";
import { fromNodeHandler, getRequestURL } from "h3";
import * as av from "anyvali";
import { createStreamHandler, ThemeLlmsDocumentPaths } from "@betterportal/framework";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "@betterportal/framework/lib/runtime/h3.js";
import { ProtocolEndpointRegistry, type BetterPortalProtocolEndpoint } from "../src/protocolEndpoints.js";
import { BPService } from "../src/service.js";

const definition = (changes: Partial<BetterPortalProtocolEndpoint> = {}): BetterPortalProtocolEndpoint => ({
  path: "/mcp/:appId", methods: ["GET", "POST", "DELETE"], cors: { origins: ["https://client.test"], allowHeaders: ["authorization", "content-type", "mcp-session-id"] },
  handler: async (event, params) => event.req.headers.get("authorization") === "Bearer verified-protocol-token"
    ? Response.json({ appId: params.appId }) : Response.json({ error: "Protocol token required" }, { status: 401 }), ...changes
});

function application(registry: ProtocolEndpointRegistry) {
  const app = createBetterPortalApp();
  app.use("/**", async event => (await registry.handle(event))?.response);
  app.get("/**", () => Response.json({ business: true }));
  return app;
}

test("protocol transport origin access never authenticates its handler", async () => {
  const registry = new ProtocolEndpointRegistry(); registry.register(definition(), []); const app = application(registry);
  const call = (origin?: string, authorization?: string) => app.fetch(new Request("https://service.test/mcp/one", { method: "POST",
    headers: { ...(origin ? { origin } : {}), ...(authorization ? { authorization } : {}) } }));
  assert.equal((await call("https://client.test")).status, 401);
  const accepted = await call("https://client.test", "Bearer verified-protocol-token");
  assert.equal(accepted.status, 200); assert.deepEqual(await accepted.json(), { appId: "one" });
  assert.equal(accepted.headers.get("access-control-allow-origin"), "https://client.test");
  assert.equal(accepted.headers.get("access-control-allow-credentials"), null);
  assert.equal((await call("https://attacker.test", "Bearer verified-protocol-token")).status, 403);
  assert.equal((await call(undefined, "Bearer verified-protocol-token")).status, 200);
});

test("protocol preflight validates methods and headers without invoking protocol code", async () => {
  let calls = 0; const registry = new ProtocolEndpointRegistry();
  registry.register(definition({ handler: async () => { calls++; return new Response(); } }), []); const app = application(registry);
  const preflight = (method: string, headers = "authorization, MCP-Session-ID", origin = "https://client.test") => app.fetch(new Request("https://service.test/mcp/one", {
    method: "OPTIONS", headers: { origin, "access-control-request-method": method, "access-control-request-headers": headers }
  }));
  const accepted = await preflight("POST"); assert.equal(accepted.status, 204);
  assert.equal(accepted.headers.get("access-control-max-age"), "600");
  assert.equal((await preflight("PATCH")).status, 405);
  assert.equal((await preflight("POST", "x-service-secret")).status, 403);
  assert.equal((await preflight("POST", "authorization", "https://attacker.test")).status, 403);
  assert.equal(calls, 0);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/one", { method: "PATCH" }))).status, 405);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/one", { method: "OPTIONS" }))).status, 405);
});

test("only literal well-known GET metadata permits public non-credentialed CORS", async () => {
  const registry = new ProtocolEndpointRegistry();
  registry.register(definition({ path: "/.well-known/oauth-protected-resource/mcp", methods: ["GET", "HEAD"], cors: { origins: "*" } }), []);
  const response = await application(registry).fetch(new Request("https://service.test/.well-known/oauth-protected-resource/mcp", { headers: { origin: "https://any-client.test" } }));
  assert.equal(response.headers.get("access-control-allow-origin"), "*"); assert.equal(response.headers.get("access-control-allow-credentials"), null);
  for (const endpoint of [definition({ cors: { origins: "*" } }), definition({ path: "/.well-known/custom/:id", methods: ["GET"], cors: { origins: "*" } }),
    definition({ path: "/.well-known/custom", cors: { origins: "*" } }), definition({ cors: { origins: [], credentials: true } } as never)]) {
    assert.throws(() => new ProtocolEndpointRegistry().register(endpoint, []));
  }
});

test("registration cannot shadow BP routes, native management or wildcard paths", () => {
  for (const path of ["/", "/:all", "/.well-known/:kind/:id", "/oauth/**", "/oauth/*", "/oauth/:id/:id", "/oauth/%2e%2e", "/.well-known/bp/config", "/.well-known/jwks.json", "/login", "/robots.txt", "/sitemap.xml", "/sitemaps/:chunk"]) {
    assert.throws(() => new ProtocolEndpointRegistry().register(definition({ path }), []));
  }
  assert.throws(() => new ProtocolEndpointRegistry().register(definition(), ["/mcp/:tenantId"]));
  assert.throws(() => new ProtocolEndpointRegistry().register(definition(), ["/mcp/**"]));
  new ProtocolEndpointRegistry().register(definition(), ["/assets/**"]);
  const registry = new ProtocolEndpointRegistry(); registry.register(definition(), []);
  assert.throws(() => registry.register(definition({ path: "/mcp/one" }), []));
  for (const origins of [["https://client.test/path"], ["https://credentials@client.test"], ["http://public.test"], ["null"]]) {
    assert.throws(() => new ProtocolEndpointRegistry().register(definition({ cors: { origins } }), []));
  }
});

test("registration snapshots the transport policy rather than retaining mutable caller arrays", async () => {
  const origins = ["https://client.test"];
  const methods: Array<"GET" | "POST"> = ["GET"];
  const headers = ["authorization"];
  const registry = new ProtocolEndpointRegistry();
  registry.register(definition({ methods, cors: { origins, allowHeaders: headers } }), []);
  origins.push("https://attacker.test"); methods.push("POST"); headers.push("x-unreviewed");
  const app = application(registry);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/app", { headers: { origin: "https://attacker.test" } }))).status, 403);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/app", { method: "POST" }))).status, 405);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/app", { method: "OPTIONS", headers: {
    origin: "https://client.test", "access-control-request-method": "GET", "access-control-request-headers": "x-unreviewed"
  } }))).status, 403);
});

test("protocol registration cannot replace canonical shell AI discovery documents", () => {
  for (const path of Object.values(ThemeLlmsDocumentPaths)) {
    assert.throws(() => new ProtocolEndpointRegistry().register(definition({ path }), []), /cannot replace BP native/);
  }
  new ProtocolEndpointRegistry().register(definition({ path: "/oauth/llms.txt" }), []);
});

test("BPService reserves generated SSE paths for explicit SSE and streaming GET routes", () => {
  const stream = createStreamHandler({ item: av.string() }, async function* () { yield "row"; });
  for (const route of [
    { path: "/feed/:channel", handlers: { GET: () => ({}) }, sse: { handler: async function* () { yield "event"; } } },
    { path: "/feed/:channel", handlers: { GET: stream } }
  ]) {
    const service = Object.create(BPService.prototype) as any;
    service.registeredRoutes = [route];
    for (const path of ["/feed/:name/__sse", "/feed/main/__sse"]) {
      assert.throws(() => service.registerProtocolEndpoint(definition({ path })), /conflicts with generated BP routes/);
    }
    service.registerProtocolEndpoint(definition({ path: "/other/__sse" }));
  }
  const ordinary = Object.create(BPService.prototype) as any;
  ordinary.registeredRoutes = [{ path: "/ordinary", handlers: { GET: () => ({}) } }];
  ordinary.registerProtocolEndpoint(definition({ path: "/ordinary/__sse" }));
});

test("BP-looking headers do not provide native protocol authority or create a BP caller", async () => {
  let calls = 0;
  const registry = new ProtocolEndpointRegistry();
  registry.register(definition({ handler: async event => {
    calls++;
    assert.equal(event.context.user, undefined);
    assert.equal(event.context.serviceCaller, undefined);
    return new Response("Independent protocol authorization required", { status: 401 });
  } }), []);
  const response = await application(registry).fetch(new Request("https://service.test/mcp/app", { method: "POST", headers: {
    origin: "https://client.test", authorization: "Bearer non-protocol-user-or-service-token",
    "x-bp-tenant-id": "caller-selected-tenant", "x-bp-app-id": "caller-selected-app",
    "x-bp-service-id": "caller-selected-service", "x-bp-service-authorization": "Bearer forged-service-envelope"
  } }));
  assert.equal(response.status, 401); assert.equal(calls, 1);
});

test("matched handlers cannot fall through or receive malformed decoded parameters", async () => {
  const registry = new ProtocolEndpointRegistry(); registry.register(definition({ handler: async () => undefined }), []); const app = application(registry);
  assert.equal((await app.fetch(new Request("https://service.test/mcp/one"))).status, 500);
  for (const value of ["a%2Fb", "%5C", "%00", "%ZZ"]) assert.equal((await app.fetch(new Request(`https://service.test/mcp/${value}`))).status, 400);
});

test("BPService consults registered native protocols while ordinary app CORS remains unchanged", async () => {
  const service = Object.create(BPService.prototype) as any;
  service.registeredRoutes = [];
  service.resolveRequestContext = async () => null;
  service.describeCorsContextFailure = async () => ({ candidateHosts: "", configuredAppHosts: "" });
  service.logContextResolutionFailure = () => undefined;
  service.registerProtocolEndpoint(definition());
  const app = createBetterPortalApp(); app.use("/**", (event: any) => service.handleWithCors(event));
  app.get("/business", () => Response.json({ business: true }));
  assert.equal((await app.fetch(new Request("https://service.test/mcp/app", { method: "POST", headers: { origin: "https://client.test" } }))).status, 401);
  const normal = await app.fetch(new Request("https://service.test/business", { headers: { origin: "https://client.test" } }));
  assert.equal(normal.headers.get("access-control-allow-origin"), null);
  const preflight = await app.fetch(new Request("https://service.test/business", { method: "OPTIONS",
    headers: { origin: "https://client.test", "access-control-request-method": "GET" } }));
  assert.equal(preflight.status, 403);
});

test("official Node adapter preserves protocol CORS and repeated owner Set-Cookie headers", async () => {
  const registry = new ProtocolEndpointRegistry();
  const node = fromNodeHandler((_req, res) => {
    res.setHeader("set-cookie", ["transaction=first; HttpOnly; SameSite=Lax", "signature=second; HttpOnly; SameSite=Lax"]);
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ native: true }));
  });
  registry.register(definition({ path: "/oauth/token", methods: ["POST"], handler: event => node(event) }), []);
  const server = createServer(createBetterPortalNodeHandler(application(registry)));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/oauth/token`, { method: "POST", headers: { origin: "https://client.test" } });
    assert.deepEqual(await response.json(), { native: true });
    assert.equal(response.headers.get("access-control-allow-origin"), "https://client.test");
    assert.equal(response.headers.getSetCookie().length, 2);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test("canonical protocol URL uses the existing direct-peer proxy trust policy", async () => {
  const service = Object.create(BPService.prototype) as any;
  service.registeredRoutes = [];
  const transport = { trustedProxyHeaders: true, trustedProxyIps: [] as string[] };
  Object.defineProperty(service, "bp", { value: transport });
  service.registerProtocolEndpoint({ path: "/mcp", methods: ["GET"], cors: { origins: [] }, handler: (event: any) => {
    const trust = service.headerTrustOptions(event);
    const effective = getRequestURL(event, { xForwardedHost: trust.trustedProxyHeaders === true,
      xForwardedProto: trust.trustedProxyHeaders === true });
    return Response.json({ rawUrl: event.req.url, effectiveUrl: effective.toString() });
  } });
  const app = createBetterPortalApp(); app.use("/**", (event: any) => service.handleWithCors(event));
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/mcp`;
    const request = () => new Promise<{ rawUrl: string; effectiveUrl: string }>((resolve, reject) => {
      const request = httpRequest(url, { headers: { host: "internal.service.test", "x-forwarded-host": "apps.public.test", "x-forwarded-proto": "https" } }, response => {
        let text = ""; response.setEncoding("utf8"); response.on("data", chunk => { text += chunk; });
        response.once("end", () => { try { resolve(JSON.parse(text)); } catch (error) { reject(error); } });
      });
      request.once("error", reject); request.end();
    });
    const untrusted = await request();
    assert.equal(untrusted.rawUrl, "http://internal.service.test/mcp");
    assert.equal(untrusted.effectiveUrl, "http://internal.service.test/mcp");
    transport.trustedProxyIps.push("127.0.0.1");
    const trusted = await request();
    assert.equal(trusted.rawUrl, "http://internal.service.test/mcp");
    assert.equal(trusted.effectiveUrl, "https://apps.public.test/mcp");
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
