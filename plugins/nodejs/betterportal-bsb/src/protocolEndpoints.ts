import { handleCorsRequest, jsonResponse, type BetterPortalEvent } from "@betterportal/framework/lib/runtime/h3.js";

export type ProtocolHttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Transport policy for an explicitly owned native protocol endpoint. Never a BP user grant. */
export interface BetterPortalProtocolEndpoint {
  /** Literal path with optional named single-segment parameters. Wildcards are prohibited. */
  readonly path: string;
  readonly methods: ReadonlyArray<ProtocolHttpMethod>;
  readonly cors: {
    /** Wildcard is restricted to GET/HEAD /.well-known metadata without credentials. */
    readonly origins: "*" | ReadonlyArray<string>;
    readonly allowHeaders?: ReadonlyArray<string>;
    readonly exposeHeaders?: ReadonlyArray<string>;
    /** Cross-origin credentialed cookie access is not supported by this extension. */
    readonly credentials?: false;
    readonly maxAgeSeconds?: number;
  };
  /** Owns protocol authentication, input limits and authorization; must always return a response.
   * No BP user/service context is created. May return a Web Response or the opaque
   * handled result of h3.fromNodeHandler after it writes the real Node response.
   */
  readonly handler: (event: BetterPortalEvent, params: Readonly<Record<string, string>>) => unknown | Promise<unknown>;
}

interface RegisteredEndpoint { definition: BetterPortalProtocolEndpoint; segments: string[] }
const METHODS = new Set<ProtocolHttpMethod>(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const PARAMETER = /^:[A-Za-z_][A-Za-z0-9_]*$/;
const HEADER = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function segments(path: string): string[] {
  if (typeof path !== "string" || path.length > 2048 || !path.startsWith("/") || path === "/" || path.endsWith("/")) throw new Error("Protocol endpoints require an explicit non-root path");
  const parts = path.slice(1).split("/"); const names = new Set<string>();
  for (const part of parts) {
    if (!part || part === "." || part === ".." || (!PARAMETER.test(part) && !/^[A-Za-z0-9._~-]+$/.test(part))) throw new Error("Protocol paths allow only literal or named single segments");
    if (PARAMETER.test(part)) { if (names.has(part)) throw new Error("Duplicate protocol path parameter"); names.add(part); }
  }
  return parts;
}

function overlaps(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((part, index) => part === second[index] || PARAMETER.test(part) || PARAMETER.test(second[index]!));
}
function overlapsBusiness(path: string, protocol: string[]): boolean {
  const business = path.slice(1).split("/");
  for (let index = 0; index < business.length; index++) {
    const part = business[index]!;
    if (part.includes("*")) return true;
    const other = protocol[index];
    if (other === undefined || part !== other && !PARAMETER.test(part) && !PARAMETER.test(other)) return false;
  }
  return business.length === protocol.length;
}
function origin(value: string): string {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || !["https:", "http:"].includes(url.protocol)
    || (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Protocol origins require exact HTTPS origins; HTTP is only for loopback tests");
  return value;
}
function headerNames(values: ReadonlyArray<string>): string[] {
  if (values.length > 40 || values.some(value => !HEADER.test(value))) throw new Error("Invalid protocol CORS header names");
  return [...new Set(values.map(value => value.toLowerCase()))];
}

/** Internal registry behind BPService.registerProtocolEndpoint. No fallback into BP business routing. */
export class ProtocolEndpointRegistry {
  private readonly endpoints: RegisteredEndpoint[] = [];

  register(input: BetterPortalProtocolEndpoint, businessPaths: ReadonlyArray<string>): void {
    const parts = segments(input.path);
    if (PARAMETER.test(parts[0]!) || parts[0] === ".well-known" && (!parts[1] || PARAMETER.test(parts[1]))) throw new Error("Protocol endpoints require a literal namespace");
    if (input.path === "/.well-known/bp" || input.path.startsWith("/.well-known/bp/") || input.path === "/.well-known/jwks.json"
      || ["/login", "/logout", "/refresh", "/register", "/robots.txt", "/sitemap.xml"].includes(input.path)
      || parts[0] === "sitemaps") throw new Error("Protocol endpoints cannot replace BP native authentication, management or SEO paths");
    if (!input.methods.length || input.methods.length > 6 || input.methods.some(method => !METHODS.has(method))) throw new Error("Unsupported protocol HTTP method");
    if (typeof input.handler !== "function" || !input.cors || input.cors.credentials !== undefined && input.cors.credentials !== false) throw new Error("Protocol endpoint requires an owned handler and non-credentialed CORS");
    const methods = [...new Set(input.methods)];
    if (input.cors.origins === "*" && (!input.path.startsWith("/.well-known/") || parts.some(part => PARAMETER.test(part)) || methods.some(method => method !== "GET" && method !== "HEAD"))) throw new Error("Wildcard CORS is only for literal public metadata GET/HEAD endpoints");
    const origins = input.cors.origins === "*" ? "*" : [...new Set(input.cors.origins.map(origin))];
    if (origins !== "*" && origins.length > 100) throw new Error("Too many protocol origins");
    const allowHeaders = headerNames(input.cors.allowHeaders ?? ["Accept", "Authorization", "Content-Type"]);
    const exposeHeaders = headerNames(input.cors.exposeHeaders ?? ["WWW-Authenticate"]);
    const age = input.cors.maxAgeSeconds ?? 600;
    if (!Number.isInteger(age) || age < 0 || age > 3600) throw new Error("Invalid protocol preflight lifetime");
    if (this.endpoints.length >= 100 || this.endpoints.some(item => overlaps(item.segments, parts))) throw new Error("Duplicate or overlapping protocol endpoint");
    for (const path of businessPaths) {
      // Generated catch-all business routes must never be bypassed by a protocol exception.
      if (overlapsBusiness(path, parts)) throw new Error("Protocol endpoint conflicts with generated BP routes");
    }
    this.endpoints.push({ segments: parts, definition: Object.freeze({ path: input.path, methods: Object.freeze(methods), handler: input.handler,
      cors: Object.freeze({ origins: origins === "*" ? origins : Object.freeze(origins), credentials: false,
        allowHeaders: Object.freeze(allowHeaders), exposeHeaders: Object.freeze(exposeHeaders), maxAgeSeconds: age }) }) });
  }

  async handle(event: BetterPortalEvent): Promise<{ response: unknown } | undefined> {
    const parts = event.url.pathname.slice(1).split("/");
    const endpoint = this.endpoints.find(item => item.segments.length === parts.length
      && item.segments.every((part, index) => PARAMETER.test(part) || part === parts[index]));
    if (!endpoint) return undefined;
    const { definition } = endpoint; const { cors } = definition;
    const reject = (message: string, status: number) => ({ response: jsonResponse({ error: message }, status, { "cache-control": "no-store" }) });
    const requestedOrigin = event.req.headers.get("origin");
    if (requestedOrigin && cors.origins !== "*" && !cors.origins.includes(requestedOrigin)) return reject("Protocol origin is not allowed", 403);
    const preflight = event.req.method === "OPTIONS";
    const method = preflight ? event.req.headers.get("access-control-request-method") : event.req.method;
    if (!method || !definition.methods.includes(method as ProtocolHttpMethod)) {
      const response = reject("Protocol method is not allowed", 405); response.response.headers.set("Allow", [...definition.methods, "OPTIONS"].join(", ")); return response;
    }
    const requestedHeaders = (event.req.headers.get("access-control-request-headers") ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    if (preflight && (!requestedOrigin || requestedHeaders.some(name => !cors.allowHeaders!.includes(name)))) return reject("Protocol preflight is not allowed", 403);
    if (requestedOrigin) {
      const response = handleCorsRequest(event, { origin: cors.origins === "*" ? "*" : [...cors.origins], methods: [...definition.methods],
        allowHeaders: [...cors.allowHeaders!], exposeHeaders: [...cors.exposeHeaders!], credentials: false,
        maxAge: String(cors.maxAgeSeconds), preflight: { statusCode: 204 } });
      if (response) return { response };
    }
    const params: Record<string, string> = {};
    try {
      for (let index = 0; index < endpoint.segments.length; index++) if (PARAMETER.test(endpoint.segments[index]!)) {
        const value = decodeURIComponent(parts[index]!);
        if (!value || value === "." || value === ".." || /[\\/]/.test(value)
          || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return reject("Invalid protocol path parameter", 400);
        params[endpoint.segments[index]!.slice(1)] = value;
      }
    } catch { return reject("Invalid protocol path parameter", 400); }
    // A public Node adapter writes directly, so commit the selected transport headers
    // before invoking it. Preserve repeated Set-Cookie fields owned by that handler.
    const nodeResponse = event.runtime?.node?.res;
    if (nodeResponse && !nodeResponse.headersSent) event.res.headers.forEach((value, name) => nodeResponse.setHeader(name, value));
    const response = await definition.handler(event, Object.freeze(params));
    return response !== undefined && response !== null ? { response } : reject("Protocol handler did not return a response", 500);
  }
}
