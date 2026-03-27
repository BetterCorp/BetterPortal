import { z } from "zod";

export const ObservabilityValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ObservabilityValue = z.infer<typeof ObservabilityValueSchema>;

export const ObservabilityAttributesSchema = z.record(z.string(), ObservabilityValueSchema);
export type ObservabilityAttributes = z.infer<typeof ObservabilityAttributesSchema>;

export const BetterPortalLogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type BetterPortalLogLevel = z.infer<typeof BetterPortalLogLevelSchema>;

export interface BetterPortalLogger {
  debug(message: string, attributes?: ObservabilityAttributes): void;
  info(message: string, attributes?: ObservabilityAttributes): void;
  warn(message: string, attributes?: ObservabilityAttributes): void;
  error(message: string | Error, attributes?: ObservabilityAttributes): void;
}

export interface BetterPortalSpan {
  readonly name: string;
  readonly attributes: ObservabilityAttributes;
  setAttribute(key: string, value: ObservabilityValue): BetterPortalSpan;
  setAttributes(attributes: ObservabilityAttributes): BetterPortalSpan;
  end(attributes?: ObservabilityAttributes): void;
  error(error: Error, attributes?: ObservabilityAttributes): void;
}

export interface BetterPortalTracer {
  startSpan(name: string, attributes?: ObservabilityAttributes): BetterPortalSpan;
}

export interface BetterPortalObservability {
  readonly logger: BetterPortalLogger;
  readonly tracer?: BetterPortalTracer;
  readonly attributes: ObservabilityAttributes;
  withAttribute(key: string, value: ObservabilityValue): BetterPortalObservability;
  withAttributes(attributes: ObservabilityAttributes): BetterPortalObservability;
}
