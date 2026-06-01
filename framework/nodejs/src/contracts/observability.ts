import * as av from "anyvali";
import type { Infer } from "anyvali";

export const ObservabilityValueSchema = av.union([av.string(), av.number(), av.bool()]);
export type ObservabilityValue = Infer<typeof ObservabilityValueSchema>;

export const ObservabilityAttributesSchema = av.record(ObservabilityValueSchema);
export type ObservabilityAttributes = Infer<typeof ObservabilityAttributesSchema>;

export const BetterPortalLogLevelSchema = av.enum_(["debug", "info", "warn", "error"] as const);
export type BetterPortalLogLevel = Infer<typeof BetterPortalLogLevelSchema>;

export const BetterPortalTraceContextSchema = av.object({
  traceId: av.string().minLength(1),
  spanId: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type BetterPortalTraceContext = Infer<typeof BetterPortalTraceContextSchema>;

export const BetterPortalResourceSchema = av.intersection([
  av.object({
    serviceName: av.string().minLength(1),
    serviceVersion: av.optional(av.string().minLength(1)),
    serviceInstanceId: av.optional(av.string().minLength(1)),
    environment: av.optional(av.string().minLength(1)),
    region: av.optional(av.string().minLength(1))
  }, { unknownKeys: "allow" }),
  av.record(ObservabilityValueSchema)
]);
export type BetterPortalResource = Infer<typeof BetterPortalResourceSchema>;

export type MetricLabelValue = string | number | boolean;
export type MetricLabels<TLabel extends string = string> = Partial<Record<TLabel, MetricLabelValue>>;

export interface BetterPortalLogger {
  debug(message: string, attributes?: ObservabilityAttributes): void;
  info(message: string, attributes?: ObservabilityAttributes): void;
  warn(message: string, attributes?: ObservabilityAttributes): void;
  error(message: string | Error, attributes?: ObservabilityAttributes): void;
}

export interface BetterPortalCounter<TLabel extends string = string> {
  increment(value?: number, labels?: MetricLabels<TLabel>): void;
}

export interface BetterPortalGauge<TLabel extends string = string> {
  set(value: number, labels?: MetricLabels<TLabel>): void;
  increment(value?: number, labels?: MetricLabels<TLabel>): void;
  decrement(value?: number, labels?: MetricLabels<TLabel>): void;
}

export interface BetterPortalHistogram<TLabel extends string = string> {
  observe(value: number, labels?: MetricLabels<TLabel>): void;
}

export interface BetterPortalTimer {
  stop(): number;
}

export interface BetterPortalMetrics {
  counter<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    labels?: readonly TLabel[]
  ): BetterPortalCounter<TLabel>;
  gauge<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    labels?: readonly TLabel[]
  ): BetterPortalGauge<TLabel>;
  histogram<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    boundaries?: readonly number[],
    labels?: readonly TLabel[]
  ): BetterPortalHistogram<TLabel>;
  timer(): BetterPortalTimer;
}

export interface BetterPortalObservability {
  readonly trace: BetterPortalTraceContext;
  readonly traceId: string;
  readonly spanId: string;
  readonly resource: BetterPortalResource;
  readonly attributes: ObservabilityAttributes;
  readonly logger: BetterPortalLogger;
  readonly metrics: BetterPortalMetrics;
  startSpan(name: string, attributes?: ObservabilityAttributes): BetterPortalObservability;
  setAttribute(key: string, value: ObservabilityValue): BetterPortalObservability;
  setAttributes(attributes: ObservabilityAttributes): BetterPortalObservability;
  end(attributes?: ObservabilityAttributes): void;
  error(error: Error, attributes?: ObservabilityAttributes): void;
}

export interface BetterPortalSpan extends BetterPortalObservability {
  readonly name: string;
}

class NoopCounter implements BetterPortalCounter {
  increment(): void {}
}

class NoopGauge implements BetterPortalGauge {
  set(): void {}
  increment(): void {}
  decrement(): void {}
}

class NoopHistogram implements BetterPortalHistogram {
  observe(): void {}
}

class DefaultTimer implements BetterPortalTimer {
  private readonly startedAt = performance.now();

  stop(): number {
    return performance.now() - this.startedAt;
  }
}

class NoopMetrics implements BetterPortalMetrics {
  counter<TLabel extends string = string>(): BetterPortalCounter<TLabel> {
    return new NoopCounter();
  }

  gauge<TLabel extends string = string>(): BetterPortalGauge<TLabel> {
    return new NoopGauge();
  }

  histogram<TLabel extends string = string>(): BetterPortalHistogram<TLabel> {
    return new NoopHistogram();
  }

  timer(): BetterPortalTimer {
    return new DefaultTimer();
  }
}

class NoopLogger implements BetterPortalLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

class NoopObservability implements BetterPortalSpan {
  readonly trace: BetterPortalTraceContext;
  readonly traceId: string;
  readonly spanId: string;
  readonly logger: BetterPortalLogger;
  readonly metrics: BetterPortalMetrics;

  constructor(
    public readonly name: string,
    public readonly resource: BetterPortalResource,
    public readonly attributes: ObservabilityAttributes = {},
    trace?: BetterPortalTraceContext
  ) {
    this.trace = trace ?? { traceId: "bp-noop-trace", spanId: name };
    this.traceId = this.trace.traceId;
    this.spanId = this.trace.spanId;
    this.logger = new NoopLogger();
    this.metrics = new NoopMetrics();
  }

  startSpan(name: string, attributes: ObservabilityAttributes = {}): BetterPortalObservability {
    return new NoopObservability(
      name,
      this.resource,
      {
        ...this.attributes,
        ...attributes
      },
      {
        traceId: this.traceId,
        spanId: `${this.spanId}.${name}`
      }
    );
  }

  setAttribute(key: string, value: ObservabilityValue): BetterPortalObservability {
    return this.setAttributes({ [key]: value });
  }

  setAttributes(attributes: ObservabilityAttributes): BetterPortalObservability {
    return new NoopObservability(
      this.name,
      this.resource,
      {
        ...this.attributes,
        ...attributes
      },
      this.trace
    );
  }

  end(): void {}

  error(): void {}
}

export function createNoopObservability(input?: {
  name?: string;
  resource?: BetterPortalResource;
  attributes?: ObservabilityAttributes;
  trace?: BetterPortalTraceContext;
}): BetterPortalObservability {
  return new NoopObservability(
    input?.name ?? "betterportal",
    BetterPortalResourceSchema.parse(input?.resource ?? { serviceName: "betterportal" }),
    ObservabilityAttributesSchema.parse(input?.attributes ?? {}),
    input?.trace
  );
}
