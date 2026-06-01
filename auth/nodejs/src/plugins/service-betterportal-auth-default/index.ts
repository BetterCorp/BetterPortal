import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";

const Config = createConfigSchema(
  {
    name: "service-betterportal-auth-default",
    description: "Default BetterPortal v10 auth plugin for Node.js",
    tags: ["betterportal", "auth", "jwt"],
    documentation: ["./README.md"]
  },
  av.object({
    issuer: av.string().minLength(1).default("betterportal-auth"),
    tokenConfig: av.object({
      idTokenSeconds: av.int().min(1).default(60 * 30),
      refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7)
    }, { unknownKeys: "strip" }).default({
      idTokenSeconds: 60 * 30,
      refreshTokenSeconds: 60 * 60 * 24 * 7
    })
  }, { unknownKeys: "strip" })
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
    const tokenConfig = this.config.tokenConfig ?? { idTokenSeconds: 1800, refreshTokenSeconds: 604800 };
    obs.log.info("BetterPortal auth plugin is ready with id token lifetime {seconds}s", {
      seconds: tokenConfig.idTokenSeconds
    });
  }

  async dispose(): Promise<void> {
  }
}

export { Config, EventSchemas };
