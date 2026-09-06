import * as av from "anyvali";
import { createBetterPortalApp, handleCorsRequest, eventHeaders } from "../nodejs/lib/runtime/h3.js";
import { createH3Router, registerBpWellKnownRoutes } from "../nodejs/lib/adapters/h3.js";
import { createHandler, createRawHandler } from "../nodejs/lib/runtime/handler.js";
import { createStreamHandler } from "../nodejs/lib/runtime/streamHandler.js";
import { ScopedServiceConfigSchema } from "../nodejs/lib/contracts/scopedConfig.js";
import { MultipartRequestSchema } from "../nodejs/lib/contracts/route.js";
import { resolveRequestContextDetailed, buildOriginPolicy } from "../nodejs/lib/runtime/configProvider.js";
import { verifyJwt } from "../nodejs/lib/runtime/auth/tokens.js";
import { getSigningKeyForKid, clearJwksCache } from "../nodejs/lib/runtime/auth/jwks.js";
import { registryRequest, rendererSets } from "./node-registry.mjs";
import { urlCalls } from "./node-urls.mjs";

export async function hostingRequest(body) {
  clearJwksCache();
  let invoked = 0;
  const snapshot = ScopedServiceConfigSchema.parse(body.snapshot);
  const config = { ...snapshot, platformServices: [], sharedServiceActivations: [], sharedServiceCatalog: [],
    manifestCache: snapshot.apps.filter(app => app.shell).map(app => ({ serviceId: app.shell.serviceId, shell: app.shell })) };
  const resolve = event => {
    const context = resolveRequestContextDetailed(config, eventHeaders(event), "service").context;
    // This trusted app attachment is BP orchestration currently performed by BSB.
    if (context) event.__bpApp = context.app;
    return context;
  };
  const routes = body.routes.flatMap(item => [item.path, ...(item.pathVariants ?? [])].map(path => {
    const methodRoutes = Object.fromEntries(item.operations.map(spec => {
      const schemas = { response: av.importSchema(spec.response), multipart: MultipartRequestSchema,
        ...Object.fromEntries(Object.entries(spec.schemas ?? {}).map(([key, value]) => [key, av.importSchema(value)])) };
      const declaration = av.importSchema(JSON.parse(body.operationDocument)).parse(spec.declaration);
      const run = context => {
        invoked++;
        if (spec.status !== undefined) context.setStatus(spec.status);
        for (const [key, value] of spec.responseHeaders ?? []) context.responseHeaders.append(key, value);
        if (spec.throw) throw new Error("private-password-must-not-leak");
        if (spec.urlCalls) return urlCalls(context, spec.urlCalls);
        if (Object.hasOwn(spec, "result")) return spec.result;
        if (spec.raw) {
          const raw = spec.raw;
          const bytes = value => Buffer.from(value, "base64");
          const content = raw.chunks ? new ReadableStream({ start(controller) { for (const chunk of raw.chunks) controller.enqueue(bytes(chunk)); controller.close(); } }) : raw.body ? bytes(raw.body) : null;
          if (raw.filename) return context.file(content, { filename: raw.filename, contentType: raw.contentType ?? "application/octet-stream", disposition: raw.inline ? "inline" : "attachment" });
          return context.response(content, { status: raw.status ?? 200, headers: raw.headers });
        }
        const form = /application\/x-www-form-urlencoded|multipart\/form-data/i.test(body.request.headers?.["content-type"] ?? "");
        const value = { params: context.params, query: context.query, request: context.request, multipart: form ? context.multipart ?? null : null,
          tenantId: context.tenant.id, appId: context.app.id, caller: context.callerMode ?? null, user: context.user?.sub ?? null };
        return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Uint8Array ? Array.from(item) : item));
      };
      let handler;
      if (spec.finite) {
        schemas.item = av.importSchema(spec.finite.itemSchema);
        if (spec.finite.summarySchema) schemas.summary = av.importSchema(spec.finite.summarySchema);
        handler = createStreamHandler(schemas, async function* (context) {
          invoked++;
          for (const item of spec.finite.items ?? []) yield item;
          if (spec.finite.contextItem) { invoked--; yield run(context); }
          if (spec.finite.fail) throw new Error("private-stream-secret");
          return spec.finite.summary;
        });
        schemas.response = handler.responseSchema;
      } else handler = (spec.raw && !spec.jsonHandler ? createRawHandler : createHandler)(schemas, run);
      return [declaration.method, { ...declaration, schemas, handler, ...(spec.raw ? { raw: true } : {}) }];
    }));
    const primary = methodRoutes.GET ?? Object.values(methodRoutes)[0];
    return { viewId: item.viewId, path, paramNames: path.split("/").filter(part => part.startsWith(":")).map(part => part.slice(1)), methods: Object.keys(methodRoutes),
      schemas: primary.schemas, handlers: Object.fromEntries(Object.entries(methodRoutes).map(([method, spec]) => [method, spec.handler])), methodRoutes,
      title: primary.title, description: primary.description, ...rendererSets(item) };
  }));
  const app = createBetterPortalApp();
  app.use(event => {
    const context = resolve(event);
    return handleCorsRequest(event, { origin: context ? buildOriginPolicy(context).allowedOrigins : [],
      methods: [...new Set(routes.flatMap(route => route.methods)), "OPTIONS"], allowHeaders: ["Accept", "Content-Type", "Authorization"],
      preflight: { statusCode: 204 } }) || undefined;
  });
  createH3Router({ routes, dependencies: body.dependencies ?? {} }, app, { serviceId: snapshot.serviceIdentity?.id ?? body.declaration.pluginId, resolveContext: resolve, resolveAuth: event => {
    const context = resolve(event); const auth = context?.app.auth;
    if (!context || !auth) return undefined;
    return { tenantId: context.tenant.id, appId: context.app.id, appAuthConfig: auth,
      serviceIdAliases: Object.fromEntries(context.tenant.services.filter(service => service.serviceId).map(service => [service.id, service.serviceId])),
      platformRoot: { tenantId: snapshot.configManagement?.adminTenantId, appId: snapshot.configManagement?.managementAppId },
      verifier: { verify: token => verifyJwt(token, { expectedIssuer: auth.expectedIssuer, expectedAudience: auth.expectedAudience, expectedTokenType: "access",
        keyResolver: kid => getSigningKeyForKid({ issuer: auth.expectedIssuer, jwksUri: auth.jwksUri }, kid) }) } };
  } });
  const schema = registryRequest(body).schema;
  registerBpWellKnownRoutes(app, schema.manifest, schema);
  const request = body.request;
  const payload = request.bodyBase64 ? Buffer.from(request.bodyBase64, "base64") : request.body;
  const response = await app.fetch(new Request("http://service.test" + request.path, { method: request.method, headers: request.headers,
    ...(payload !== undefined && !["GET", "HEAD"].includes(request.method) ? { body: payload } : {}) }));
  const content = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: Object.fromEntries(response.headers), body: content.toString(), bodyBase64: content.toString("base64"), cookies: response.headers.getSetCookie(), invoked };
}
