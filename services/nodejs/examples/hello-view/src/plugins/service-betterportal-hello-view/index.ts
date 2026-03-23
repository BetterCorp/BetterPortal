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
    name: "service-betterportal-hello-view",
    description: "Hello view example service for BetterPortal v10",
    tags: ["betterportal", "service", "example", "htmx"],
    documentation: ["./README.md"]
  },
  z.object({})
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
    obs.log.info("Hello view example initialized");
  }

  async run(obs: Observable): Promise<void> {
    obs.log.info("Hello view example ready");
  }

  async dispose(): Promise<void> {
  }
}

export { Config, EventSchemas };
