import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { acceptHeader, sendJson, sendNegotiatedResponse } from "@betterportal/framework-nodejs";
import { HelloManifest, handleHelloRoute } from "./routes/hello";
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
    allowOrigin: z.string().url().default("http://localhost:3100")
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
  private server: Server;
  private readonly requestHandler: (request: IncomingMessage, response: ServerResponse) => void;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
    this.requestHandler = (request, response) => {
      void this.handleRequest(request, response);
    };
    this.server = createServer((request, response) => {
      this.requestHandler(request, response);
    });
  }

  async init(obs: Observable): Promise<void> {
    obs.log.info("Hello view example initialized");
  }

  private applyCors(request: IncomingMessage, response: ServerResponse): boolean {
    const originHeader = request.headers.origin;
    const allowedOrigin = typeof originHeader === "string" && originHeader === this.config.allowOrigin
      ? originHeader
      : this.config.allowOrigin;
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

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (this.applyCors(request, response)) {
      return;
    }

    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (requestUrl.pathname === "/manifest") {
      sendJson(response, 200, HelloManifest);
      return;
    }

    if (requestUrl.pathname === "/_health") {
      sendJson(response, 200, {
        ok: true,
        plugin: "service-betterportal-hello-view",
        port: this.config.port
      });
      return;
    }

    if (requestUrl.pathname === "/hello") {
      const negotiated = handleHelloRoute({
        acceptHeader: acceptHeader(request),
        query: {
          name: this.queryValueFromUrl(request, "name") ?? "World"
        }
      });

      sendNegotiatedResponse(response, negotiated);
      return;
    }

    sendJson(response, 404, {
      error: "Not found",
      path: requestUrl.pathname
    });
  }

  async run(obs: Observable): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (this.server === null) {
        reject(new Error("Hello service server missing during run"));
        return;
      }
      this.server.once("error", reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    obs.log.info("Hello view example serving at http://{host}:{port}", {
      host: this.config.host,
      port: this.config.port
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
    }
  }
}

export { Config, EventSchemas };
