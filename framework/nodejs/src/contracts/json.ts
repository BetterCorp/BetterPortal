import * as av from "anyvali";
import type { AnyValiDocument, ExportMode, ParseContext, SchemaNode } from "anyvali";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export const JSON_VALUE_DEFINITION = "BetterPortalJsonValue";
export const JSON_VALUE_REF = `#/definitions/${JSON_VALUE_DEFINITION}`;

export const JsonValueSchemaNode: SchemaNode = {
  kind: "union",
  variants: [
    { kind: "null" },
    { kind: "bool" },
    { kind: "string" },
    { kind: "number" },
    { kind: "array", items: { kind: "ref", ref: JSON_VALUE_REF } },
    { kind: "record", valueSchema: { kind: "ref", ref: JSON_VALUE_REF } }
  ]
};

const MAX_JSON_DEPTH = 100;

function receivedType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function invalidJson(ctx: ParseContext, value: unknown, message = "Expected a JSON value"): undefined {
  ctx.issues.push({
    code: av.ISSUE_CODES.INVALID_TYPE,
    message,
    path: [...ctx.path],
    expected: "JSON value",
    received: receivedType(value)
  });
  return undefined;
}

function validateJsonValue(input: unknown, ctx: ParseContext, depth: number): JsonValue | undefined {
  if (depth > MAX_JSON_DEPTH) {
    ctx.issues.push({
      code: av.ISSUE_CODES.TOO_DEEP,
      message: `Maximum JSON validation depth of ${MAX_JSON_DEPTH} exceeded`,
      path: [...ctx.path],
      expected: `<= ${MAX_JSON_DEPTH} levels`,
      received: "too deep"
    });
    return undefined;
  }

  if (input === null || typeof input === "string" || typeof input === "boolean") return input;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : invalidJson(ctx, input, "JSON numbers must be finite");
  }
  if (typeof input !== "object") return invalidJson(ctx, input);

  if (!ctx.seen) ctx.seen = new WeakSet<object>();
  if (ctx.seen.has(input)) return invalidJson(ctx, input, "Circular references are not valid JSON");
  ctx.seen.add(input);

  try {
    if (Array.isArray(input)) {
      return input.map((value, index) => {
        ctx.path.push(index);
        const parsed = validateJsonValue(value, ctx, depth + 1);
        ctx.path.pop();
        return parsed as JsonValue;
      });
    }

    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidJson(ctx, input, "JSON objects must be plain objects");
    }

    const output = Object.create(null) as JsonObject;
    for (const [key, value] of Object.entries(input)) {
      ctx.path.push(key);
      const parsed = validateJsonValue(value, ctx, depth + 1);
      ctx.path.pop();
      Object.defineProperty(output, key, {
        value: parsed as JsonValue,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    Object.setPrototypeOf(output, Object.prototype);
    return output;
  } finally {
    ctx.seen.delete(input);
  }
}

class JsonValueContractSchema<T extends JsonValue> extends av.BaseSchema<unknown, T> {
  constructor(private readonly objectOnly: boolean) {
    super();
  }

  _validate(input: unknown, ctx: ParseContext): T | undefined {
    if (this.objectOnly && (typeof input !== "object" || input === null || Array.isArray(input))) {
      return invalidJson(ctx, input, "Expected a JSON object");
    }
    return validateJsonValue(input, ctx, 0) as T | undefined;
  }

  _toNode(): SchemaNode {
    const node: SchemaNode = this.objectOnly
      ? { kind: "record", valueSchema: { kind: "ref", ref: JSON_VALUE_REF } }
      : { kind: "ref", ref: JSON_VALUE_REF };
    return this._addDefault(node);
  }

  export(mode?: ExportMode): AnyValiDocument {
    const document = super.export(mode);
    document.definitions[JSON_VALUE_DEFINITION] = JsonValueSchemaNode;
    return document;
  }
}

/** A recursively validated JSON value. Use this instead of `av.any()` in published contracts. */
export const JsonValueSchema: av.BaseSchema<unknown, JsonValue> = new JsonValueContractSchema<JsonValue>(false);

/** A recursively validated JSON object. Use this instead of `av.record(av.any())`. */
export const JsonObjectSchema: av.BaseSchema<unknown, JsonObject> = new JsonValueContractSchema<JsonObject>(true);
