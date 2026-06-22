import { Pool } from "pg";
import { BetterPortalConfigSchema, type BetterPortalConfig } from "@betterportal/framework";
import {
  BaseStorage,
  type PostgresStorageOptions
} from "./core.js";

function quotePgIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export class PostgresStorage extends BaseStorage {
  private readonly connectionString: string;
  private readonly tableName: string;
  private readonly rowId: string;
  private pool: Pool | null = null;

  constructor(options: PostgresStorageOptions) {
    super();
    this.connectionString = options.connectionString;
    this.tableName = quotePgIdent(options.tableName ?? "bp_platform_config");
    this.rowId = options.rowId ?? "default";
  }

  async loadConfig(): Promise<BetterPortalConfig> {
    await this.ensureSchema();

    const pool = await this.getPool();
    const result = await pool.query<{ config: unknown }>(
      `select config from ${this.tableName} where id = $1`,
      [this.rowId]
    );

    if (result.rows.length === 0) {
      const empty = this.canonicalizeConfig(BetterPortalConfigSchema.parse({}));
      await this.saveConfig(empty);
      return empty;
    }

    return this.canonicalizeConfig(BetterPortalConfigSchema.parse(result.rows[0].config));
  }

  async saveConfig(config: BetterPortalConfig): Promise<void> {
    await this.ensureSchema();
    const validated = this.canonicalizeConfig(BetterPortalConfigSchema.parse(config));
    this.validateConfigReferences(validated);
    const pool = await this.getPool();
    await pool.query(
      `insert into ${this.tableName} (id, config)
       values ($1, $2::jsonb)
       on conflict (id) do update set config = excluded.config, updated_at = now()`,
      [this.rowId, JSON.stringify(validated)]
    );
    this.notifyListeners();
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
    await this.pool?.end();
    this.pool = null;
  }

  private getPool(): Pool {
    this.pool ??= new Pool({ connectionString: this.connectionString });
    return this.pool;
  }

  private async ensureSchema(): Promise<void> {
    const pool = await this.getPool();
    await pool.query(
      `create table if not exists ${this.tableName} (
        id text primary key,
        config jsonb not null,
        updated_at timestamptz not null default now()
      )`
    );
  }
}
