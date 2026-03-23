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
    name: "service-betterportal-theme-embedded",
    description: "Embedded BetterPortal theme",
    tags: ["betterportal", "theme", "embedded", "htmx"],
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
    obs.log.info("Embedded theme initialized");
  }

  async run(obs: Observable): Promise<void> {
    obs.log.info("Embedded theme ready");
  }

  async dispose(): Promise<void> {
  }
}

export { Config, EventSchemas };
