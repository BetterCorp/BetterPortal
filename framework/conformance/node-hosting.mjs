import * as av from "anyvali";
import { createBetterPortalApp, handleCorsRequest, eventHeaders } from "../nodejs/lib/runtime/h3.js";
import { createH3Router, registerBpWellKnownRoutes } from "../nodejs/lib/adapters/h3.js";
import { createHandler } from "../nodejs/lib/runtime/handler.js";
import { ScopedServiceConfigSchema } from "../nodejs/lib/contracts/scopedConfig.js";
import { MultipartRequestSchema } from "../nodejs/lib/contracts/route.js";
import { resolveRequestContextDetailed, buildOriginPolicy } from "../nodejs/lib/runtime/configProvider.js";
import { verifyJwt } from "../nodejs/lib/runtime/auth/tokens.js";
import { getSigningKeyForKid, clearJwksCache } from "../nodejs/lib/runtime/auth/jwks.js";
import { registryRequest } from "./node-registry.mjs";

export async function hostingRequest(body) {
  clearJwksCache();
  let invoked = 0;
  const snapshot = ScopedServiceConfigSchema.parse(body.snapshot);
  const config = { ...snapshot, platformServices: [], sharedServiceActivations: [], sharedServiceCatalog: [], manifestCache: [] };
  const resolve = event => resolveRequestContextDetailed(config, eventHeaders(event), "service").context;
  const routes = body.routes.flatMap(item => [item.path, ...(item.pathVariants ?? [])].map(path => {
    const methodRoutes = Object.fromEntries(item.operations.map(spec => {
      const schemas = { response: av.importSchema(spec.response), multipart: MultipartRequestSchema,
        ...Object.fromEntries(Object.entries(spec.schemas ?? {}).map(([key, value]) => [key, av.importSchema(value)])) };
      const declaration = av.importSchema(JSON.parse(body.operationDocument)).parse(spec.declaration);
      const handler = createHandler(schemas, context => {
        invoked++;
        if (spec.throw) throw new Error("private-password-must-not-leak");
        if (Object.hasOwn(spec, "result")) return spec.result;
        const form = /application\/x-www-form-urlencoded|multipart\/form-data/i.test(body.request.headers?.["content-type"] ?? "");
        const value = { params: context.params, query: context.query, request: context.request, multipart: form ? context.multipart ?? null : null,
          tenantId: context.tenant.id, appId: context.app.id, caller: context.callerMode ?? null, user: context.user?.sub ?? null };
        return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Uint8Array ? Array.from(item) : item));
      });
      return [declaration.method, { ...declaration, schemas, handler }];
    }));
    const primary = methodRoutes.GET ?? Object.values(methodRoutes)[0];
    return { viewId: item.viewId, path, paramNames: path.split("/").filter(part => part.startsWith(":")).map(part => part.slice(1)), methods: Object.keys(methodRoutes),
      schemas: primary.schemas, handlers: Object.fromEntries(Object.entries(methodRoutes).map(([method, spec]) => [method, spec.handler])), methodRoutes,
      title: primary.title, description: primary.description, renderers: {} };
  }));
  const app = createBetterPortalApp();
  app.use(event => {
    const context = resolve(event);
    return handleCorsRequest(event, { origin: context ? buildOriginPolicy(context).allowedOrigins : [],
      methods: [...new Set(routes.flatMap(route => route.methods)), "OPTIONS"], allowHeaders: ["Accept", "Content-Type", "Authorization"],
      preflight: { statusCode: 204 } }) || undefined;
  });
  createH3Router({ routes }, app, { resolveContext: resolve, resolveAuth: event => {
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
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text(), invoked };
}
