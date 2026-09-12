import { uuidv7 } from "@betterportal/framework";
import * as av from "anyvali";
import { AuthError, type IdentityService } from "./identity.js";
import type { AuthTransaction, RecordValue, Scope } from "./storage.js";

export interface MailConfig { transport: "postal" | "http"; url: string; from: string; apiKey?: string; headers?: Record<string, string> }
const MailHeadersSchema = av.record(av.string());
export function parseMailHeaders(configured: unknown): Record<string, string> | undefined {
  if (configured === undefined || configured === "") return undefined;
  let value: unknown;
  try { value = typeof configured === "string" ? JSON.parse(configured) : configured; }
  catch { throw new AuthError("Custom mail headers must be a valid JSON object of strings.", 503); }
  const result = MailHeadersSchema.safeParse(value);
  if (!result.success) throw new AuthError("Custom mail headers must be a JSON object of strings.", 503);
  try { new Headers(result.data); }
  catch { throw new AuthError("Custom mail headers contain an invalid HTTP header name or value.", 503); }
  return result.data;
}
interface Mail extends RecordValue { scope: Scope; encrypted: string; attempts: number; nextAttempt: number; state: "pending" | "sending" | "sent" | "failed"; lease?: string; updatedAt: number }
const MailUrlSchema = av.string().format("url");
export function validateMailUrl(value: unknown): void {
  const result = MailUrlSchema.safeParse(value);
  if (!result.success) throw new AuthError("Email delivery requires a valid absolute URL.", 503);
  const url = new URL(result.data);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new AuthError("Email delivery requires HTTPS.", 503);
}
export class MailQueue {
  constructor(private readonly identity: IdentityService, private readonly config: (scope: Scope) => MailConfig | undefined) {}
  async enqueue(tx: AuthTransaction, scope: Scope, to: string, subject: string, text: string): Promise<void> {
    const config = this.config(scope);
    if (!config) throw new AuthError("Email delivery has not been configured.", 503);
    validateMailUrl(config.url);
    if (this.identity.storage.mode === "simple") {
      const rows = await tx.list<Mail>("mail", scope);
      if (rows.filter(row => row.state !== "sent").length >= 500) throw new AuthError("Email queue is full. Contact your administrator.", 503);
      const sent = rows.filter(row => row.state === "sent");
      for (const row of sent.slice(0, Math.max(0, sent.length - 99))) await tx.remove("mail", row.id, scope);
    }
    await tx.put("mail", scope, {
      id: uuidv7(), scope, encrypted: this.identity.cipher.encrypt(JSON.stringify({ to, subject, text })),
      attempts: 0, nextAttempt: Date.now(), state: "pending", updatedAt: Date.now()
    });
  }
  async drain(): Promise<void> {
    const rows = await this.identity.storage.transaction({ tenantId: "", appId: "" }, tx => tx.dueMail<Mail>(Date.now(), 100));
    for (const row of rows) {
      if (row.state === "sent" || row.state === "failed" || row.nextAttempt > Date.now()) continue;
      const lease = uuidv7();
      const claimed = await this.identity.storage.transaction(row.scope, async tx => {
        const current = await tx.get<Mail>("mail", row.id, row.scope);
        if (!current || current.state === "sent" || current.state === "failed" || current.nextAttempt > Date.now()) return false;
        await tx.put("mail", row.scope, { ...current, lease, state: "sending", nextAttempt: Date.now() + 60000 }); return true;
      });
      if (!claimed) continue;
      let success = false;
      try {
        const config = this.config(row.scope);
        if (!config) throw new Error("Mail not configured");
        validateMailUrl(config.url);
        const payload = JSON.parse(this.identity.cipher.decrypt(row.encrypted)) as { to: string; subject: string; text: string };
        const body = { from: config.from, to: payload.to, subject: payload.subject, text: payload.text, html: "" };
        const url = config.transport === "postal" ? `${config.url.replace(/\/+$/, "")}/api/v1/send/message` : config.url;
        const response = await fetch(url, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
          headers: { ...config.headers, "Content-Type": "application/json", ...(config.transport === "postal" ? { "X-Server-API-Key": config.apiKey ?? "" } : {}) },
          body: JSON.stringify(config.transport === "postal" ? { from: body.from, to: [body.to], subject: body.subject, plain_body: body.text, html_body: body.html } : body)
        });
        success = response.ok && (config.transport !== "postal" || (await response.json() as { status?: string }).status === "success");
      } catch { /* Persist a bounded delivery status, never provider bodies or secrets. */ }
      await this.identity.storage.transaction(row.scope, async tx => {
        const current = await tx.get<Mail>("mail", row.id, row.scope);
        if (current?.lease !== lease) return;
        const attempts = current.attempts + 1;
        await tx.put("mail", row.scope, { ...current, encrypted: success ? "" : current.encrypted, attempts, state: success ? "sent" : attempts >= 5 ? "failed" : "pending", nextAttempt: Date.now() + Math.min(3600000, 30000 * 2 ** attempts), updatedAt: Date.now() });
      });
    }
  }
}
