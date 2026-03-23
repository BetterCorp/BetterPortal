import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { HelloManifest, handleHelloViewRequest } from "../../helloView";
import { z } from "zod";

const Config = createConfigSchema(
  {
    name: "service-betterportal-hello-view",
    description: "Hello view example service for BetterPortal v10",
    tags: ["betterportal", "service", "example", "htmx"],
    documentation: ["./README.md"]
  },
  z.object({
    host: z.string().min(1).default("0.0.0.0"),
    port: z.number().int().positive().default(3200),
    allowOrigin: z.string().default("http://localhost:3100")
  })
);

const EventSchemas = createEventSchemas({
  emitEvents: {},
  onEvents: {},
  emitReturnableEvents: {},
  onReturnableEvents: {},
  emitBroadcast: {},
  onBroadcast: {}
});

export class Plugin extends BSBService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  readonly initBeforePlugins: string[] = [];
  readonly initAfterPlugins: string[] = [];
  readonly runBeforePlugins: string[] = [];
  readonly runAfterPlugins: string[] = [];
  private server: Server | null = null;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  private configuredHost(): string {
    return typeof this.config.host === "string" && this.config.host.length > 0
      ? this.config.host
      : "0.0.0.0";
  }

  private configuredPort(): number {
    return typeof this.config.port === "number" && Number.isInteger(this.config.port) && this.config.port > 0
      ? this.config.port
      : 3200;
  }

  private configuredAllowOrigin(): string {
    return typeof this.config.allowOrigin === "string" && this.config.allowOrigin.length > 0
      ? this.config.allowOrigin
      : "http://localhost:3100";
  }

  async init(obs: Observable): Promise<void> {
    obs.log.info("Hello view example initialized");
  }

  private sendJson(response: ServerResponse, statusCode: number, body: string): void {
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(body);
  }

  private applyCors(request: IncomingMessage, response: ServerResponse): boolean {
    const originHeader = request.headers.origin;
    const allowedOrigin = typeof originHeader === "string" && originHeader === this.configuredAllowOrigin()
      ? originHeader
      : this.configuredAllowOrigin();
    const requestedHeaders = request.headers["access-control-request-headers"];
    const allowHeaders = typeof requestedHeaders === "string" && requestedHeaders.trim().length > 0
      ? requestedHeaders
      : "Accept, Content-Type, HX-Current-URL, HX-Request, HX-Target, HX-Trigger, HX-Trigger-Name";

    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin, Access-Control-Request-Headers");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", allowHeaders);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return true;
    }

    return false;
  }

  private queryValueFromUrl(request: IncomingMessage, key: string): string | undefined {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const value = requestUrl.searchParams.get(key);
    return value ?? undefined;
  }

  private acceptHeader(request: IncomingMessage): string | undefined {
    const header = request.headers.accept;
    return typeof header === "string" ? header : undefined;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (this.applyCors(request, response)) {
      return;
    }

    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (requestUrl.pathname === "/manifest") {
      this.sendJson(response, 200, JSON.stringify(HelloManifest, null, 2));
      return;
    }

    if (requestUrl.pathname === "/_health") {
      this.sendJson(response, 200, JSON.stringify({
        ok: true,
        plugin: "service-betterportal-hello-view",
        port: this.configuredPort()
      }, null, 2));
      return;
    }

    if (requestUrl.pathname === "/hello") {
      const negotiated = handleHelloViewRequest({
        acceptHeader: this.acceptHeader(request),
        query: {
          name: this.queryValueFromUrl(request, "name") ?? "World"
        }
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

    this.sendJson(response, 404, JSON.stringify({
      error: "Not found",
      path: requestUrl.pathname
    }, null, 2));
  }

  async run(obs: Observable): Promise<void> {
    if (this.server !== null) {
      return;
    }

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (server === null) {
        reject(new Error("Hello service server was not created"));
        return;
      }

      server.once("error", reject);
      server.listen(this.configuredPort(), this.configuredHost(), () => {
        server.off("error", reject);
        resolve();
      });
    });

    obs.log.info("Hello view example serving at http://{host}:{port}", {
      host: this.configuredHost(),
      port: this.configuredPort()
    });
  }

  async dispose(): Promise<void> {
    if (this.server !== null) {
      await new Promise<void>((resolve, reject) => {
        const server = this.server;
        if (server === null) {
          resolve();
          return;
        }

        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      this.server = null;
    }
  }
}

export { Config, EventSchemas };
