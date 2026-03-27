import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Bootstrap1Manifest, renderBootstrap1HostPage } from "./theme";
import { z } from "zod";

const Config = createConfigSchema(
  {
    name: "service-betterportal-theme-bootstrap1",
    description: "Bootstrap 5 and HTMX based BetterPortal theme",
    tags: ["betterportal", "theme", "bootstrap", "htmx"],
    documentation: ["./README.md"]
  },
  z.object({
    host: z.string().min(1).default("0.0.0.0"),
    port: z.number().int().positive().default(3100),
    defaultMode: z.enum(["light", "dark"]).default("light"),
    brandName: z.string().min(1).default("BetterPortal"),
    helloServiceOrigin: z.string().url().default("http://localhost:3200"),
    defaultGreetingName: z.string().min(1).default("Mitchell")
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
    obs.log.info("Bootstrap1 theme initialized with default mode {mode}", {
      mode: this.config.defaultMode
    });
  }

  private sendJson(response: ServerResponse, statusCode: number, body: Record<string, string | number | boolean>): void {
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify(body, null, 2));
  }

  private sendHtml(response: ServerResponse, statusCode: number, body: string): void {
    response.writeHead(statusCode, {
      "Content-Type": "text/html; charset=utf-8"
    });
    response.end(body);
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === "/") {
      this.sendHtml(response, 200, renderBootstrap1HostPage({
        title: this.config.brandName,
        brandName: this.config.brandName,
        themeMode: this.config.defaultMode,
        helloServiceOrigin: this.config.helloServiceOrigin,
        defaultName: this.config.defaultGreetingName
      }));
      return;
    }

    if (requestUrl.pathname === "/manifest") {
      this.sendJson(response, 200, {
        pluginId: Bootstrap1Manifest.pluginId,
        category: Bootstrap1Manifest.category,
        version: Bootstrap1Manifest.version
      });
      return;
    }

    if (requestUrl.pathname === "/_health") {
      this.sendJson(response, 200, {
        ok: true,
        plugin: "service-betterportal-theme-bootstrap1",
        port: this.config.port
      });
      return;
    }

    this.sendJson(response, 404, {
      error: "Not found",
      path: requestUrl.pathname
    });
  }

  async run(obs: Observable): Promise<void> {
    if (this.server === null) {
      throw new Error("Bootstrap1 server was not created during init");
    }

    if (this.server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (server === null) {
        reject(new Error("Bootstrap1 server missing during run"));
        return;
      }
      server.once("error", reject);
      server.listen(this.config.port, this.config.host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    obs.log.info("Bootstrap1 theme serving at http://{host}:{port}", {
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
      this.server = null;
    }
  }
}

export { Config, EventSchemas };
