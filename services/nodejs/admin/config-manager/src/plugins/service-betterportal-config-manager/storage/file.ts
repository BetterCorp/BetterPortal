import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as yaml from "yaml";
import { BetterPortalConfigSchema, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage } from "./core.js";

const EMPTY_CONFIG_YAML = "configManagement:\n  auth:\n    mechanism: none\nplatformServices: []\ntenants: []\napps: []";

export class FileStorage extends BaseStorage {
  private readonly configPath: string;

  constructor(configPath: string) {
    super();
    this.configPath = resolve(configPath);
  }

  async loadConfig(): Promise<BetterPortalConfig> {
    const raw = existsSync(this.configPath)
      ? readFileSync(this.configPath, "utf8")
      : EMPTY_CONFIG_YAML;
    return this.canonicalizeConfig(BetterPortalConfigSchema.parse(yaml.parse(raw)));
  }

  async saveConfig(config: BetterPortalConfig): Promise<void> {
    const validated = this.canonicalizeConfig(BetterPortalConfigSchema.parse(config));
    this.validateConfigReferences(validated);
    const yamlStr = yaml.stringify(validated, { indent: 2, lineWidth: 120 });
    writeFileSync(this.configPath, yamlStr, "utf8");
    this.notifyListeners();
  }

  dispose(): void {
    this.listeners.clear();
  }
}
