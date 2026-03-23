import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { TokenLifetimeConfigSchema } from "@betterportal/framework-nodejs";
import { z } from "zod";

const Config = createConfigSchema(
  {
    name: "service-betterportal-auth-default",
    description: "Default BetterPortal v10 auth plugin for Node.js",
    tags: ["betterportal", "auth", "jwt"],
    documentation: ["./README.md"]
  },
  z.object({
    issuer: z.string().min(1).default("betterportal-auth"),
    tokenConfig: TokenLifetimeConfigSchema.default({
      idTokenSeconds: 60 * 30,
      refreshTokenSeconds: 60 * 60 * 24 * 7
    })
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

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  async init(obs: Observable): Promise<void> {
    obs.log.info("BetterPortal auth plugin initialized for issuer {issuer}", {
      issuer: this.config.issuer
    });
  }

  async run(obs: Observable): Promise<void> {
    obs.log.info("BetterPortal auth plugin is ready with id token lifetime {seconds}s", {
      seconds: this.config.tokenConfig.idTokenSeconds
    });
  }

  async dispose(): Promise<void> {
  }
}

export { Config, EventSchemas };
