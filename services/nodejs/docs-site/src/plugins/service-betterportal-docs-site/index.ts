import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as av from "anyvali";
import { BetterPortalConfigSchema, BPService, type BPServiceDefinition } from "@betterportal/plugin-bsb";
import type { BetterPortalRegistry } from "@betterportal/framework";
import { registry } from "./.bp-generated/registry.js";

const AssetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "assets");
const AllowedAssets = new Set(["portal-map.svg", "doc-wave.svg"]);

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3400),
  betterportal: BetterPortalConfigSchema
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

  protected onRegistered(_registry: BetterPortalRegistry, _obs: Observable): void {
    this.app.get("/docs-assets/**", async (event) => {
      const assetName = event.url.pathname.replace(/^\/docs-assets\/+/, "");
      if (!AllowedAssets.has(assetName)) {
        return new Response(JSON.stringify({ error: "Asset not found" }), {
          status: 404,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      }

      const body = await readFile(resolve(AssetRoot, assetName), "utf8");
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    });
  }
}

export { Config, EventSchemas };
