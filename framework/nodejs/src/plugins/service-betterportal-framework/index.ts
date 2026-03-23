import {
  BSBService,
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { z } from "zod";

const Config = createConfigSchema(
  {
    name: "service-betterportal-framework",
    description: "BetterPortal v10 framework runtime plugin for Node.js",
    tags: ["betterportal", "framework", "core"],
    documentation: ["./README.md"]
  },
  z.object({
    metadataSyncSeconds: z.number().int().positive().default(1800)
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
    obs.log.info("BetterPortal framework initialized with metadata sync of {seconds}s", {
      seconds: this.config.metadataSyncSeconds
    });
  }

  async run(obs: Observable): Promise<void> {
    obs.log.info("BetterPortal framework runtime plugin is ready");
  }

  async dispose(): Promise<void> {
  }
}

export { Config, EventSchemas };
