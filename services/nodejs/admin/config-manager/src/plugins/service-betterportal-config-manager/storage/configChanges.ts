import { createHash } from "node:crypto";
import { Client } from "pg";

/** Each replica listens independently; reconnecting always reloads persisted state. */
export class PostgresConfigChanges {
  private client?: Client;
  private stopped = false;
  private timer?: NodeJS.Timeout;
  private refreshTimer?: NodeJS.Timeout;
  private refreshing?: Promise<void>;
  private dirty = false;

  constructor(
    private readonly connectionString: string,
    private readonly channel: string,
    private readonly refresh: () => Promise<void>,
    private readonly report: (error: unknown) => void
  ) {}

  async start(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new Client({ connectionString: this.connectionString, application_name: "bp-config-changes" });
    this.client = client;
    const disconnected = () => {
      if (this.client !== client || this.stopped) return;
      this.client = undefined;
      void client.end().catch(() => {});
      this.timer = setTimeout(() => {
        void this.connect().catch(error => this.report(error));
      }, 1000);
      this.timer.unref();
    };
    client.on("error", error => { this.report(error); disconnected(); });
    client.on("end", disconnected);
    client.on("notification", message => {
      if (message.channel === this.channel && this.client === client) this.queueRefresh();
    });
    try {
      await client.connect();
      if (this.stopped) { await client.end(); return; }
      await client.query(`LISTEN "${this.channel}"`);
      // LISTEN first, then read: commits during connection establishment cannot be lost.
      this.queueRefresh();
      await this.refreshing;
    } catch (error) {
      disconnected();
      throw error;
    }
  }

  private queueRefresh(): void {
    this.dirty = true;
    if (this.refreshing || this.stopped) return;
    clearTimeout(this.refreshTimer);
    this.refreshing = (async () => {
      while (this.dirty && !this.stopped) {
        this.dirty = false;
        await this.refresh();
      }
    })().catch(error => {
      this.report(error);
      if (!this.stopped) {
        this.refreshTimer = setTimeout(() => this.queueRefresh(), 1000);
        this.refreshTimer.unref();
      }
    }).finally(() => { this.refreshing = undefined; });
  }

  async close(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.refreshTimer);
    const client = this.client;
    this.client = undefined;
    await client?.end();
    await this.refreshing;
  }
}

/** Database channels are scoped to the actual schema, table and configuration row. */
export function configChangeChannel(schema: string, table: string, scope: string): string {
  return `bp_config_${createHash("sha256").update(JSON.stringify([schema, table, scope])).digest("hex").slice(0, 48)}`;
}
