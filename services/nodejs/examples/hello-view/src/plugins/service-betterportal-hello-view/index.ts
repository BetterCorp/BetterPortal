import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas
} from "@bsb/base";
import * as av from "anyvali";
import { BetterPortalConfigSchema, BPService, type BPServiceDefinition } from "@betterportal/plugin-bsb";
import type { ConfigSchemaDescriptor } from "@betterportal/framework";
import { registry } from "./.bp-generated/registry.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3200),
  betterportal: BetterPortalConfigSchema
}, { unknownKeys: "strip" });

const Config = createConfigSchema(
  {
    name: "service-betterportal-hello-view",
    description: "Hello view example service for BetterPortal v10",
    tags: ["betterportal", "service", "example", "htmx"],
    documentation: ["./README.md"],
    image: "./betterportal-logo.png"
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
        pluginId: "service.betterportal.hello-view",
        title: "BetterPortal Hello View Example",
        description: "Example business service showing API-first view negotiation.",
        configSchemas: [
          {
            id: "hello.tenant",
            title: "Hello Tenant Config",
            description: "Tenant-scoped config for the hello example service.",
            scope: "tenant",
            jsonSchema: { greetingPrefix: "string", supportEmail: "string", apiKey: "string" },
            fields: [
              { key: "greetingPrefix", title: "Greeting Prefix", description: "Prefix shown before the hello response.", scope: "tenant", visibility: "protected", ownership: "plugin", sourceOfTruth: "plugin", required: false },
              { key: "supportEmail", title: "Support Email", description: "Support contact shown in admin tooling.", scope: "tenant", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false },
              { key: "apiKey", title: "API Key", description: "Example secret field for managed service credentials.", scope: "tenant", visibility: "secret", ownership: "plugin", sourceOfTruth: "plugin", required: false }
            ]
          },
          {
            id: "hello.app",
            title: "Hello App Override",
            description: "App-specific overrides for the hello example service.",
            scope: "app",
            jsonSchema: { displayName: "string" },
            fields: [
              { key: "displayName", title: "Display Name", description: "Overrides the display name for the app context.", scope: "app", visibility: "protected", ownership: "mixed", sourceOfTruth: "bp", required: false }
            ]
          }
        ] satisfies ConfigSchemaDescriptor[]
      },
      registry
    };
  }
}

export { Config, EventSchemas };
