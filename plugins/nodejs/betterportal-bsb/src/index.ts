import type { Observable } from "@bsb/base";
import type {
  BetterPortalCounter,
  BetterPortalGauge,
  BetterPortalHistogram,
  BetterPortalLogger,
  BetterPortalMetrics,
  BetterPortalObservability,
  BetterPortalResource,
  BetterPortalTimer,
  ObservabilityAttributes,
  ObservabilityValue
} from "@betterportal/framework";

function mergeAttributes(
  current: ObservabilityAttributes,
  next: ObservabilityAttributes
): ObservabilityAttributes {
  return {
    ...current,
    ...next
  };
}

function toResource(observable: Observable): BetterPortalResource {
  return {
    serviceName: observable.resource["service.name"],
    serviceVersion: observable.resource["service.version"],
    serviceInstanceId: observable.resource["service.instance.id"],
    environment: observable.resource["deployment.environment"],
    ...(observable.resource["deployment.region"] ? { region: observable.resource["deployment.region"] } : {})
  };
}

class BsbCounterAdapter<TLabel extends string = string> implements BetterPortalCounter<TLabel> {
  constructor(private readonly counter: { increment(value?: number, labels?: Partial<Record<TLabel, string>>): void }) {}

  increment(value?: number, labels?: Partial<Record<TLabel, string | number | boolean>>): void {
    this.counter.increment(value, labels as Partial<Record<TLabel, string>> | undefined);
  }
}

class BsbGaugeAdapter<TLabel extends string = string> implements BetterPortalGauge<TLabel> {
  constructor(
    private readonly gauge: {
      set(value: number, labels?: Partial<Record<TLabel, string>>): void;
      increment(value?: number, labels?: Partial<Record<TLabel, string>>): void;
      decrement(value?: number, labels?: Partial<Record<TLabel, string>>): void;
    }
  ) {}

  set(value: number, labels?: Partial<Record<TLabel, string | number | boolean>>): void {
    this.gauge.set(value, labels as Partial<Record<TLabel, string>> | undefined);
  }

  increment(value?: number, labels?: Partial<Record<TLabel, string | number | boolean>>): void {
    this.gauge.increment(value, labels as Partial<Record<TLabel, string>> | undefined);
  }

  decrement(value?: number, labels?: Partial<Record<TLabel, string | number | boolean>>): void {
    this.gauge.decrement(value, labels as Partial<Record<TLabel, string>> | undefined);
  }
}

class BsbHistogramAdapter<TLabel extends string = string> implements BetterPortalHistogram<TLabel> {
  constructor(private readonly histogram: { record(value: number, labels?: Partial<Record<TLabel, string>>): void }) {}

  observe(value: number, labels?: Partial<Record<TLabel, string | number | boolean>>): void {
    this.histogram.record(value, labels as Partial<Record<TLabel, string>> | undefined);
  }
}

class BsbTimerAdapter implements BetterPortalTimer {
  constructor(private readonly timer: { stop(): number }) {}

  stop(): number {
    return this.timer.stop();
  }
}

class BsbMetricsAdapter implements BetterPortalMetrics {
  constructor(private readonly observable: Observable) {}

  counter<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    labels?: readonly TLabel[]
  ): BetterPortalCounter<TLabel> {
    return new BsbCounterAdapter(
      this.observable.metrics.counter(name, description, help, labels ? [...labels] : undefined)
    );
  }

  gauge<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    labels?: readonly TLabel[]
  ): BetterPortalGauge<TLabel> {
    return new BsbGaugeAdapter(
      this.observable.metrics.gauge(name, description, help, labels ? [...labels] : undefined)
    );
  }

  histogram<TLabel extends string = string>(
    name: string,
    description: string,
    help: string,
    boundaries?: readonly number[],
    labels?: readonly TLabel[]
  ): BetterPortalHistogram<TLabel> {
    return new BsbHistogramAdapter(
      this.observable.metrics.histogram(
        name,
        description,
        help,
        boundaries ? [...boundaries] : undefined,
        labels ? [...labels] : undefined
      )
    );
  }

  timer(): BetterPortalTimer {
    return new BsbTimerAdapter(this.observable.metrics.timer());
  }
}

class BsbLoggerAdapter implements BetterPortalLogger {
  constructor(private readonly observable: Observable) {}

  private meta(attributes?: ObservabilityAttributes): [] | [never] {
    if (attributes === undefined || Object.keys(attributes).length === 0) {
      return [];
    }

    return [attributes as never];
  }

  debug(message: string, attributes?: ObservabilityAttributes): void {
    this.observable.log.debug(message, ...this.meta(attributes));
  }

  info(message: string, attributes?: ObservabilityAttributes): void {
    this.observable.log.info(message, ...this.meta(attributes));
  }

  warn(message: string, attributes?: ObservabilityAttributes): void {
    this.observable.log.warn(message, ...this.meta(attributes));
  }

  error(message: string | Error, attributes?: ObservabilityAttributes): void {
    this.observable.log.error(message, ...this.meta(attributes));
  }
}

class BsbObservabilityAdapter implements BetterPortalObservability {
  readonly trace;
  readonly traceId;
  readonly spanId;
  readonly resource;
  readonly logger: BetterPortalLogger;
  readonly metrics: BetterPortalMetrics;

  constructor(
    private readonly observable: Observable,
    public readonly attributes: ObservabilityAttributes = {}
  ) {
    this.trace = {
      traceId: this.observable.traceId,
      spanId: this.observable.spanId
    };
    this.traceId = this.observable.traceId;
    this.spanId = this.observable.spanId;
    this.resource = toResource(this.observable);
    this.logger = new BsbLoggerAdapter(this.observable);
    this.metrics = new BsbMetricsAdapter(this.observable);
  }

  startSpan(name: string, attributes: ObservabilityAttributes = {}): BetterPortalObservability {
    return new BsbObservabilityAdapter(
      this.observable.startSpan(name, attributes),
      mergeAttributes(this.attributes, attributes)
    );
  }

  setAttribute(key: string, value: ObservabilityValue): BetterPortalObservability {
    return new BsbObservabilityAdapter(
      this.observable.setAttribute(key, value),
      {
        ...this.attributes,
        [key]: value
      }
    );
  }

  setAttributes(attributes: ObservabilityAttributes): BetterPortalObservability {
    return new BsbObservabilityAdapter(
      this.observable.setAttributes(attributes),
      mergeAttributes(this.attributes, attributes)
    );
  }

  end(attributes?: ObservabilityAttributes): void {
    this.observable.end(attributes);
  }

  error(error: Error, attributes?: ObservabilityAttributes): void {
    this.observable.error(error, attributes);
  }
}

export function createBsbObservability(observable: Observable): BetterPortalObservability {
  return new BsbObservabilityAdapter(observable, observable.attributes);
}

export function createBsbLogger(observable: Observable): BetterPortalLogger {
  return new BsbLoggerAdapter(observable);
}

export {
  BPService,
  BetterPortalConfigSchema,
  type BetterPortalConfig,
  type BPServiceConfig,
  type BPServiceDefinition
} from "./service.js";
