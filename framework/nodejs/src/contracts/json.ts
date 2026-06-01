import * as av from "anyvali";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// AnyVali does not currently expose a convenient recursive builder for JSON values.
// Keep the runtime contract JSON-shaped while retaining the explicit TS types above.
export const JsonValueSchema = av.any() as av.BaseSchema<unknown, JsonValue>;
export const JsonObjectSchema = av.record(av.any()) as av.BaseSchema<unknown, JsonObject>;
