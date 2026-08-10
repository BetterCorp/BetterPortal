import {
  BSBService,
  createConfigSchema,
  createEventSchemas,
  type BSBServiceConstructor,
  type Observable
} from "@bsb/base";
import { BpSchemaOutputSchema, type BpSchemaOutput } from "@betterportal/framework";
import * as av from "anyvali";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ContractRegistryStore } from "./store.js";

const PublisherSchema = av.object({
  token: av.string().minLength(16),
  pluginIdPrefixes: av.array(av.string().minLength(1)).minItems(1)
});

const RegistryConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(80),
  dataDir: av.string().minLength(1).default("/mnt/temp/bp-registry"),
  publishers: av.record(PublisherSchema).default({}),
  maxBodyBytes: av.int().min(1024).default(10 * 1024 * 1024)
});

const Config = createConfigSchema({
  name: "service-betterportal-registry",
  description: "BetterPortal service-contract registry",
  tags: ["betterportal", "registry", "contracts"],
  documentation: ["./README.md"]
}, RegistryConfigSchema);

const EventSchemas = createEventSchemas({
  emitEvents: {}, onEvents: {}, emitReturnableEvents: {}, onReturnableEvents: {}, emitBroadcast: {}, onBroadcast: {}
});

const ProjectSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://io.betterportal.org/v1/project.schema.json",
  title: "BetterPortal project",
  type: "object",
  additionalProperties: false,
  properties: {
    $schema: { type: "string" },
    registryRef: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$" },
    defaultNamespace: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$" },
    dependencies: {
      type: "object",
      additionalProperties: { type: "string", minLength: 1 }
    }
  }
} as const;

function json(reply: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  reply.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...headers });
  reply.end(JSON.stringify(body));
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class Plugin extends BSBService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  readonly initBeforePlugins: string[] = [];
  readonly initAfterPlugins: string[] = [];
  readonly runBeforePlugins: string[] = [];
  readonly runAfterPlugins: string[] = [];

  private server!: Server;
  private store!: ContractRegistryStore;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  async init(_obs: Observable): Promise<void> {
    this.store = new ContractRegistryStore(this.config.dataDir);
    this.server = createServer((request, reply) => void this.handle(request, reply));
  }

  async run(obs: Observable): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.config.port, this.config.host, resolve);
    });
    obs.log.info("BetterPortal registry listening on {host}:{port}", { host: this.config.host, port: this.config.port });
  }

  async dispose(): Promise<void> {
    if (!this.server?.listening) return;
    await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }

  private authorized(request: IncomingMessage, namespace: string, pluginId: string): boolean {
    const publisher = this.config.publishers[namespace];
    if (!publisher || !publisher.pluginIdPrefixes.some((prefix) => pluginId.startsWith(prefix))) return false;
    const header = request.headers.authorization ?? "";
    return header.startsWith("Bearer ") && safeEqual(header.slice(7), publisher.token);
  }

  private async body(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > this.config.maxBodyBytes) throw new Error("request_too_large");
      chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  private async publish(request: IncomingMessage, reply: ServerResponse, namespace: string, name: string): Promise<void> {
    let contract: BpSchemaOutput;
    try {
      contract = BpSchemaOutputSchema.parse(await this.body(request));
    } catch (error) {
      json(reply, error instanceof Error && error.message === "request_too_large" ? 413 : 400, { error: "invalid_contract", message: error instanceof Error ? error.message : String(error) });
      return;
    }
    const registryRef = `${namespace}/${name}`;
    const { pluginId, version } = contract.manifest;
    if (!this.authorized(request, namespace, pluginId)) {
      json(reply, 403, { error: "forbidden", message: `Publisher cannot publish ${pluginId} under ${namespace}` });
      return;
    }
    const result = this.store.publish(registryRef, contract);
    if (!("stored" in result)) {
      json(reply, 409, { error: result.status, message: result.message });
      return;
    }
    json(reply, result.status === "created" ? 201 : 200, {
      registryRef,
      pluginId,
      version,
      digest: result.stored.digest,
      unchanged: result.status === "unchanged"
    });
  }

  private async handle(request: IncomingMessage, reply: ServerResponse): Promise<void> {
    try {
      if (request.method === "OPTIONS") {
        reply.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Accept,Authorization,Content-Type,traceparent,tracestate,baggage"
        });
        reply.end();
        return;
      }
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "GET" && url.pathname === "/health") return json(reply, 200, { ok: true });
      if (request.method === "GET" && url.pathname === "/v1/project.schema.json") return json(reply, 200, ProjectSchema);

      const publishMatch = url.pathname.match(/^\/v1\/packages\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/);
      if (request.method === "POST" && publishMatch) return await this.publish(request, reply, publishMatch[1], publishMatch[2]);

      const schemaMatch = url.pathname.match(/^\/v1\/packages\/([^/]+)\/([^/]+)\/([^/]+)\/schema\.json$/);
      if (request.method === "GET" && schemaMatch) {
        const registryRef = `${decodeURIComponent(schemaMatch[1])}/${decodeURIComponent(schemaMatch[2])}`;
        const stored = this.store.get(registryRef, decodeURIComponent(schemaMatch[3]));
        return stored
          ? json(reply, 200, stored.contract, { ETag: `"${stored.digest}"`, "BP-Registry-Ref": stored.registryRef })
          : json(reply, 404, { error: "not_found" });
      }

      const idMatch = url.pathname.match(/^\/v1\/plugin-ids\/([^/]+)\/([^/]+)\/schema\.json$/);
      if (request.method === "GET" && idMatch) {
        const pluginId = decodeURIComponent(idMatch[1]);
        const stored = this.store.getByPluginId(pluginId, decodeURIComponent(idMatch[2]));
        return stored
          ? json(reply, 200, stored.contract, { ETag: `"${stored.digest}"`, "BP-Registry-Ref": stored.registryRef })
          : json(reply, 404, { error: "not_found" });
      }

      if (request.method === "GET" && url.pathname === "/v1/packages") {
        const name = url.searchParams.get("name");
        return json(reply, 200, this.store.list(name ?? undefined));
      }

      const versionsMatch = url.pathname.match(/^\/v1\/packages\/([^/]+)\/([^/]+)\/versions$/);
      if (request.method === "GET" && versionsMatch) {
        const registryRef = `${decodeURIComponent(versionsMatch[1])}/${decodeURIComponent(versionsMatch[2])}`;
        const entry = this.store.versions(registryRef);
        return entry ? json(reply, 200, { registryRef, pluginId: entry.pluginId, versions: entry.versions }) : json(reply, 404, { error: "not_found" });
      }

      json(reply, 404, { error: "not_found" });
    } catch (error) {
      json(reply, 500, { error: "internal_error", message: error instanceof Error ? error.message : String(error) });
    }
  }
}

export { Config, EventSchemas };
