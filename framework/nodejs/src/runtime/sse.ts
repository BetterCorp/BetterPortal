import type { BaseSchema, Infer } from "anyvali";
import type { BetterPortalResolvedApp, BetterPortalTenant } from "../contracts/platformConfig.js";
import type { SseMapperContext } from "../contracts/route.js";

/** Augmentation point populated by generated service-specific SSE contracts. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Generated declarations merge their contract fields into this interface.
export interface BetterPortalSseContracts {}

export interface SseScope {
  readonly tenant: Pick<BetterPortalTenant, "id">;
  readonly app: Pick<BetterPortalResolvedApp, "id">;
}

export interface SseRoute<
  TInputSchema extends BaseSchema<unknown, unknown>,
  TEventSchema extends BaseSchema<unknown, unknown>,
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
> {
  readonly inputSchema: TInputSchema;
  readonly eventSchema: TEventSchema;
  readonly handler: (ctx: SseMapperContext<TPlugin, TServiceConfig>) => AsyncIterable<Infer<TEventSchema>>;
  /** @internal BetterPortal runtime entrypoint. Services emit through `this.betterPortal.sse`. */
  publish(scope: SseScope, input: unknown): Infer<TInputSchema>;
}

/** Create a route-local SSE contract. BetterPortal owns publication and scoping. */
export function createSse<
  TInputSchema extends BaseSchema<unknown, unknown>,
  TEventSchema extends BaseSchema<unknown, unknown>,
  TPlugin = never,
  TServiceConfig = Record<string, unknown>
>(
  schemas: { readonly input: TInputSchema; readonly event: TEventSchema },
  map: (
    input: Infer<TInputSchema>,
    ctx: SseMapperContext<TPlugin, TServiceConfig>
  ) => Infer<TEventSchema> | Promise<Infer<TEventSchema>>
): SseRoute<TInputSchema, TEventSchema, TPlugin, TServiceConfig> {
  type Input = Infer<TInputSchema>;
  const listeners = new Map<string, Set<(input: Input) => void>>();
  const key = (scope: SseScope) => `${scope.tenant.id}\0${scope.app.id}`;

  return {
    inputSchema: schemas.input,
    eventSchema: schemas.event,
    publish(scope, input) {
      const parsed = schemas.input.parse(input) as Input;
      for (const listener of listeners.get(key(scope)) ?? []) listener(parsed);
      return parsed;
    },
    async *handler(ctx) {
      const scopeKey = key(ctx);
      const queue: Input[] = [];
      let overflow = false;
      let resume: (() => void) | undefined;
      const listener = (input: Input) => {
        // A slow subscriber reconnects instead of retaining an unbounded event history.
        if (queue.length >= 256) { overflow = true; queue.length = 0; scoped.delete(listener); }
        else queue.push(input);
        resume?.();
        resume = undefined;
      };
      const scoped = listeners.get(scopeKey) ?? new Set<(input: Input) => void>();
      scoped.add(listener);
      listeners.set(scopeKey, scoped);
      const onAbort = () => resume?.();
      ctx.signal?.addEventListener("abort", onAbort, { once: true });

      try {
        while (!ctx.signal?.aborted) {
          if (queue.length === 0 && !overflow) {
            const next = new Promise<void>((resolve) => { resume = resolve; });
            await next;
          }
          if (ctx.signal?.aborted) return;
          if (overflow) throw new Error("SSE subscriber exceeded its pending event limit");
          yield schemas.event.parse(await map(queue.shift()!, ctx)) as Infer<TEventSchema>;
        }
      } finally {
        ctx.signal?.removeEventListener("abort", onAbort);
        scoped.delete(listener);
        if (scoped.size === 0) listeners.delete(scopeKey);
      }
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- Declaration merging exposes schema inference types on the public factory.
export namespace createSse {
  export function forContext<TPlugin = never, TServiceConfig = Record<string, unknown>>() {
    return createSse as <
      TInputSchema extends BaseSchema<unknown, unknown>,
      TEventSchema extends BaseSchema<unknown, unknown>
    >(
      schemas: { readonly input: TInputSchema; readonly event: TEventSchema },
      map: (
        input: Infer<TInputSchema>,
        ctx: SseMapperContext<TPlugin, TServiceConfig>
      ) => Infer<TEventSchema> | Promise<Infer<TEventSchema>>
    ) => SseRoute<TInputSchema, TEventSchema, TPlugin, TServiceConfig>;
  }
}
