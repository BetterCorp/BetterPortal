import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Local cache for the scoped platform config that a BPService receives from
 * its control plane (CM). Lets the service serve requests on restart before
 * the first sync completes, and means BP services NEVER share CM's bp-config.yaml
 * - they hold their own cached projection of just the slice the CP sent them.
 *
 * Default file backend; will become pluggable (redis/psql) - keep this surface
 * narrow so other backends slot in with `read()` / `write()`.
 */
export interface ScopedConfigCacheOptions {
  filePath: string;
}

export class ScopedConfigCache {
  private cache: unknown = null;
  private readonly filePath: string;

  constructor(options: ScopedConfigCacheOptions) {
    this.filePath = resolve(options.filePath);
  }

  read(): unknown | null {
    if (this.cache !== null) return this.cache;
    if (!existsSync(this.filePath)) return null;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      this.cache = JSON.parse(raw);
      return this.cache;
    } catch {
      return null;
    }
  }

  write(scopedConfig: unknown): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(scopedConfig, null, 2), { mode: 0o600 });
    this.cache = scopedConfig;
  }

  clear(): void {
    this.cache = null;
  }
}
