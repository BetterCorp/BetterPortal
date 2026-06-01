import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas
} from "@bsb/base";
import * as av from "anyvali";
import { BPService, type BPServiceDefinition } from "@betterportal/plugin-bsb";
import { registry } from "./.bp-generated/registry.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3400),
  bpConfigPath: av.string().minLength(1),
  configApiToken: av.string().minLength(1).default("bp-dev-config-token"),
  configEncryptionKey: av.optional(av.string().minLength(16))
}, { unknownKeys: "strip" });

const Config = createConfigSchema(
  {
    name: "service-betterportal-docs-site",
    description: "Documentation site service for BetterPortal",
    tags: ["betterportal", "service", "docs"],
    documentation: ["./README.md"]
  },
  PluginConfigSchema
);

const EventSchemas = createEventSchemas({
  emitEvents: {},
  onEvents: {},
  emitReturnableEvents: {},
  onReturnableEvents: {},
  emitBroadcast: {},
  onBroadcast: {}
});

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "service.betterportal.docs-site",
        title: "BetterPortal Docs",
        description: "Dogfooded BetterPortal documentation site backed by repository Markdown files.",
        configSchemas: []
      },
      registry
    };
  }
}

export { Config, EventSchemas };
