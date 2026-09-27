import { uuidv7, type BetterPortalObservability, type BetterPortalTraceContext } from "@betterportal/framework";
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
interface Mail extends RecordValue { scope: Scope; trace?: BetterPortalTraceContext; encrypted: string; attempts: number; nextAttempt: number; state: "pending" | "sending" | "sent" | "failed"; lease?: string; updatedAt: number }
const MailUrlSchema = av.string().format("url");
export function validateMailUrl(value: unknown): void {
  const result = MailUrlSchema.safeParse(value);
  if (!result.success) throw new AuthError("Email delivery requires a valid absolute URL.", 503);
  const url = new URL(result.data);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new AuthError("Email delivery requires HTTPS.", 503);
}
export class MailQueue {
  constructor(private readonly identity: IdentityService, private readonly config: (scope: Scope) => MailConfig | undefined, private readonly deliveryObs?: (parent?: BetterPortalTraceContext) => BetterPortalObservability) {}
  async enqueue(tx: AuthTransaction, scope: Scope, to: string, subject: string, text: string, obs?: BetterPortalObservability): Promise<void> {
    const span = obs?.startSpan("auth.mail.enqueue", { tenantId: scope.tenantId, appId: scope.appId });
    let reason = "configuration_invalid";
    try {
      const config = this.config(scope);
      if (!config) { reason = "not_configured"; throw new AuthError("Email delivery has not been configured.", 503); }
      validateMailUrl(config.url);
      reason = "queue_write_failed";
      if (this.identity.storage.mode === "simple") {
        const rows = await tx.list<Mail>("mail", scope);
        if (rows.filter(row => row.state !== "sent").length >= 500) throw new AuthError("Email queue is full. Contact your administrator.", 503);
        const sent = rows.filter(row => row.state === "sent");
        for (const row of sent.slice(0, Math.max(0, sent.length - 99))) await tx.remove("mail", row.id, scope);
      }
      await tx.put("mail", scope, {
        id: uuidv7(), scope, ...(span ? { trace: span.trace } : {}), encrypted: this.identity.cipher.encrypt(JSON.stringify({ to, subject, text })),
        attempts: 0, nextAttempt: Date.now(), state: "pending", updatedAt: Date.now()
      });
      span?.logger.info("Auth mail staged in transaction", { transport: config.transport });
    } catch (error) {
      span?.error(new Error("Auth mail enqueue failed"), { reason });
      span?.logger.error("Auth mail enqueue failed: {reason}", { reason });
      throw error;
    } finally { span?.end(); }
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
      let span = this.deliveryObs?.(row.trace);
      span = span?.setAttributes({ tenantId: row.scope.tenantId, appId: row.scope.appId, jobId: row.id, attempt: row.attempts + 1 });
      let success = false;
      let reason = "configuration_invalid";
      let status = 0;
      let transport = "unknown";
      const started = Date.now();
      try {
        span?.logger.info("Auth mail delivery started");
        try {
          const config = this.config(row.scope);
          if (!config) { reason = "not_configured"; throw new Error("Mail not configured"); }
          transport = config.transport;
          validateMailUrl(config.url);
          reason = "payload_invalid";
          const payload = JSON.parse(this.identity.cipher.decrypt(row.encrypted)) as { to: string; subject: string; text: string };
          const body = { from: config.from, to: payload.to, subject: payload.subject, text: payload.text, html: "" };
          const url = config.transport === "postal" ? `${config.url.replace(/\/+$/, "")}/api/v1/send/message` : config.url;
          reason = "network_error";
          const response = await fetch(url, {
            method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
            headers: { ...config.headers, "Content-Type": "application/json", ...(config.transport === "postal" ? { "X-Server-API-Key": config.apiKey ?? "" } : {}) },
            body: JSON.stringify(config.transport === "postal" ? { from: body.from, to: [body.to], subject: body.subject, plain_body: body.text, html_body: body.html } : body)
          });
          status = response.status;
          reason = response.ok ? "provider_rejected" : "http_error";
          success = response.ok && (config.transport !== "postal" || (await response.json() as { status?: string }).status === "success");
          if (!response.bodyUsed) await response.body?.cancel();
        } catch (error) {
          if (error instanceof Error && error.name === "TimeoutError") reason = "timeout";
          // Provider responses and exception messages can contain credentials or message contents.
        }
        const attributes = await this.identity.storage.transaction(row.scope, async tx => {
          const current = await tx.get<Mail>("mail", row.id, row.scope);
          if (current?.lease !== lease) return;
          const attempts = current.attempts + 1;
          const state = success ? "sent" : attempts >= 5 ? "failed" : "pending";
          await tx.put("mail", row.scope, { ...current, encrypted: success ? "" : current.encrypted, attempts, state, nextAttempt: Date.now() + Math.min(3600000, 30000 * 2 ** attempts), updatedAt: Date.now() });
          return { transport, status, attempts, state, reason: success ? "accepted" : reason, durationMs: Date.now() - started, retryScheduled: state === "pending" };
        });
        if (attributes) {
          span = span?.setAttributes(attributes);
          if (success) span?.logger.info("Auth mail accepted by provider", attributes);
          else {
            span?.error(new Error("Auth mail delivery failed"), attributes);
            if (attributes.state === "failed") span?.logger.error("Auth mail delivery exhausted retries", attributes);
            else span?.logger.warn("Auth mail delivery failed; retry scheduled", attributes);
          }
          span?.metrics.counter("auth_mail_delivery_total", "Auth mail delivery attempts", "Provider delivery outcomes", ["transport", "state", "reason"]).increment(1, { transport, state: attributes.state, reason: attributes.reason });
        }
      } catch (error) {
        span?.error(new Error("Auth mail queue update failed"));
        span?.logger.error("Auth mail queue update failed");
        throw error;
      } finally { span?.end(); }
    }
  }
}
