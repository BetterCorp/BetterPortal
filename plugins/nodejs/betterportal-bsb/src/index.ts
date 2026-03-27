import type { Observable } from "@bsb/base";
import type {
  BetterPortalLogger,
  BetterPortalObservability,
  BetterPortalSpan,
  BetterPortalTracer,
  ObservabilityAttributes,
  ObservabilityValue
} from "@betterportal/framework-nodejs";

function mergeAttributes(
  current: ObservabilityAttributes,
  next: ObservabilityAttributes
): ObservabilityAttributes {
  return {
    ...current,
    ...next
  };
}

class BsbSpanAdapter implements BetterPortalSpan {
  constructor(
    private readonly observable: Observable,
    public readonly name: string,
    public readonly attributes: ObservabilityAttributes = {}
  ) {}

  setAttribute(key: string, value: ObservabilityValue): BetterPortalSpan {
    return new BsbSpanAdapter(
      this.observable.setAttribute(key, value),
      this.name,
      {
        ...this.attributes,
        [key]: value
      }
    );
  }

  setAttributes(attributes: ObservabilityAttributes): BetterPortalSpan {
    return new BsbSpanAdapter(
      this.observable.setAttributes(attributes),
      this.name,
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

class BsbTracerAdapter implements BetterPortalTracer {
  constructor(private readonly observable: Observable) {}

  startSpan(name: string, attributes: ObservabilityAttributes = {}): BetterPortalSpan {
    return new BsbSpanAdapter(
      this.observable.startSpan(name, attributes),
      name,
      attributes
    );
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
  readonly logger: BetterPortalLogger;
  readonly tracer: BetterPortalTracer;

  constructor(
    private readonly observable: Observable,
    public readonly attributes: ObservabilityAttributes = {}
  ) {
    this.logger = new BsbLoggerAdapter(this.observable);
    this.tracer = new BsbTracerAdapter(this.observable);
  }

  withAttribute(key: string, value: ObservabilityValue): BetterPortalObservability {
    return new BsbObservabilityAdapter(
      this.observable.setAttribute(key, value),
      {
        ...this.attributes,
        [key]: value
      }
    );
  }

  withAttributes(attributes: ObservabilityAttributes): BetterPortalObservability {
    return new BsbObservabilityAdapter(
      this.observable.setAttributes(attributes),
      mergeAttributes(this.attributes, attributes)
    );
  }
}

export function createBsbObservability(observable: Observable): BetterPortalObservability {
  return new BsbObservabilityAdapter(observable);
}

export function createBsbLogger(observable: Observable): BetterPortalLogger {
  return new BsbLoggerAdapter(observable);
}
