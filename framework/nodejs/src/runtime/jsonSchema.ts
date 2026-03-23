import { z } from "zod";
import { JsonObject, JsonObjectSchema, JsonValue } from "../contracts/json";

function sanitizeJsonValue(value: unknown): JsonValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (typeof value === "object" && value !== null) {
    const output: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "function" || typeof entry === "undefined") {
        continue;
      }

      output[key] = sanitizeJsonValue(entry);
    }
    return output;
  }

  return String(value);
}

export function toJsonSchemaDocument(schema: z.ZodType<unknown>): JsonObject {
  return JsonObjectSchema.parse(sanitizeJsonValue(z.toJSONSchema(schema) as unknown));
}
