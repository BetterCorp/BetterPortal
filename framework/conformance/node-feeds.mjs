import { importSchema } from "anyvali";
import { createSse } from "../nodejs/lib/runtime/sse.js";

export class FeedProbe {
  constructor(body) {
    this.body = body;
    this.enabled = body.routes.some(route => route.feed);
    this.started = Promise.withResolvers(); this.mapped = Promise.withResolvers(); this.done = Promise.withResolvers();
    this.stop = new AbortController(); this.stats = { active: 0, closed: false, mapped: 0, inputErrors: 0 };
  }
  bind(item) {
    if (!item.feed) return {};
    const probe = this, spec = item.feed;
    const contract = createSse({ input: importSchema(spec.inputSchema), event: importSchema(spec.eventSchema) }, (value, context) => {
      probe.stats.mapped++; probe.mapped.resolve();
      if (spec.throw) throw new Error("private-mapper-secret");
      if (spec.contextEvent) return { params: context.params, query: context.query, tenantId: context.tenant.id, appId: context.app.id,
        caller: context.callerMode ?? null, user: context.user?.sub ?? null };
      return Object.hasOwn(spec, "result") ? spec.result : value;
    });
    return { sse: { ...contract, async *handler(context) {
      const signal = AbortSignal.any([context.signal, probe.stop.signal]);
      const iterator = contract.handler({ ...context, signal })[Symbol.asyncIterator]();
      probe.stats.active++;
      try {
        let pending = iterator.next();
        probe.started.resolve({ contract, spec, context, viewId: item.viewId });
        while (true) {
          const result = await pending;
          if (result.done) return;
          yield result.value;
          pending = iterator.next();
        }
      } finally { await iterator.return(); probe.stats.active--; probe.stats.closed = true; }
    } } };
  }
  start() { if (this.enabled) this.delivery = this.deliver(); }
  async deliver() {
    const connection = await Promise.race([this.started.promise, this.done.promise]);
    if (!connection) return;
    const { contract, spec, context, viewId } = connection;
    const app = this.body.snapshot.apps[0];
    try {
      for (const publication of spec.publications ?? []) {
        this.mapped = Promise.withResolvers();
        const tenantId = publication.tenantId ?? app.tenantId, appId = publication.appId ?? app.id;
        if (publication.viewId && publication.viewId !== viewId) continue;
        try { contract.publish({ tenant: { id: tenantId }, app: { id: appId } }, publication.value); }
        catch { this.stats.inputErrors++; continue; }
        if (context.tenant.id === tenantId && context.app.id === appId)
          await Promise.race([this.mapped.promise, this.done.promise]);
      }
    } finally { this.stop.abort(); }
  }
  async close() { this.done.resolve(); this.stop.abort(); await this.delivery; }
  result() { return this.enabled ? { feed: this.stats } : {}; }
}
