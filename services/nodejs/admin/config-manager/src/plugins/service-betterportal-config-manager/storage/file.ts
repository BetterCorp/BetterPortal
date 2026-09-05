import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as yaml from "yaml";
import { BetterPortalConfigSchema, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage, ConfigRevisionConflictError, migrateOfficialPluginIds, migrateRouteOperations, migrateRouteParamSyntax } from "./core.js";

const EMPTY_CONFIG_YAML = "configManagement:\n  auth:\n    mechanism: none\nplatformServices: []\ntenants: []\napps: []";

export class FileStorage extends BaseStorage {
  private readonly configPath: string;
  // ponytail: process-local revisions; replicated config managers must use PostgreSQL.
  private revision = 0;
  private readonly snapshots = new WeakMap<BetterPortalConfig, number>();

  constructor(configPath: string) {
    super();
    this.configPath = resolve(configPath);
  }

  async loadConfig(): Promise<BetterPortalConfig> {
    const raw = existsSync(this.configPath)
      ? readFileSync(this.configPath, "utf8")
      : EMPTY_CONFIG_YAML;
    const config = this.canonicalizeConfig(migrateRouteParamSyntax(
      BetterPortalConfigSchema.parse(migrateRouteOperations(migrateOfficialPluginIds(yaml.parse(raw))))
    ));
    this.snapshots.set(config, this.revision);
    return config;
  }

  async saveConfig(config: BetterPortalConfig, options?: { notify?: boolean }): Promise<void> {
    const expected = this.snapshots.get(config);
    if (expected !== undefined && expected !== this.revision) throw new ConfigRevisionConflictError(expected, this.revision);
    const validated = this.canonicalizeConfig(BetterPortalConfigSchema.parse(migrateOfficialPluginIds(config)));
    this.validateConfigReferences(validated);
    const yamlStr = yaml.stringify(validated, { indent: 2, lineWidth: 120 });
    writeFileSync(this.configPath, yamlStr, "utf8");
    this.snapshots.set(config, ++this.revision);
    if (options?.notify !== false) this.notifyListeners();
  }

  dispose(): void {
    this.listeners.clear();
  }
}
