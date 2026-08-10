import * as av from "anyvali";
import type { AnyValiDocument, SchemaNode } from "anyvali";
import {
  JSON_VALUE_DEFINITION,
  JSON_VALUE_REF,
  JsonObject,
  JsonObjectSchema,
  JsonValue,
  JsonValueSchemaNode
} from "../contracts/json.js";

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

export function toJsonSchemaDocument(schema: av.BaseSchema<unknown, unknown>): JsonObject {
  const document = av.exportSchema(schema, "portable");
  if (referencesJsonValue(document.root)) {
    document.definitions[JSON_VALUE_DEFINITION] = JsonValueSchemaNode;
  }
  return JsonObjectSchema.parse(sanitizeJsonValue(document));
}

function referencesJsonValue(node: SchemaNode): boolean {
  switch (node.kind) {
    case "ref":
      return node.ref === JSON_VALUE_REF;
    case "array":
      return referencesJsonValue(node.items);
    case "tuple":
      return node.items.some(referencesJsonValue);
    case "object":
      return Object.values(node.properties).some(referencesJsonValue);
    case "record":
      return referencesJsonValue(node.valueSchema);
    case "union":
      return node.variants.some(referencesJsonValue);
    case "intersection":
      return node.allOf.some(referencesJsonValue);
    case "optional":
    case "nullable":
      return referencesJsonValue(node.inner);
    default:
      return false;
  }
}

interface LooseSchemaNode {
  readonly kind: "any" | "unknown" | "unknownKeys.allow";
  readonly path: string;
}

function looseSchemaNodes(document: AnyValiDocument): LooseSchemaNode[] {
  const found: LooseSchemaNode[] = [];

  function visit(node: SchemaNode, path: string): void {
    if (node.kind === "any" || node.kind === "unknown") {
      found.push({ kind: node.kind, path });
      return;
    }
    switch (node.kind) {
      case "array":
        visit(node.items, `${path}.items`);
        break;
      case "tuple":
        node.items.forEach((item, index) => visit(item, `${path}.items[${index}]`));
        break;
      case "object":
        if (node.unknownKeys === "allow") found.push({ kind: "unknownKeys.allow", path });
        for (const [name, property] of Object.entries(node.properties)) {
          visit(property, `${path}.properties.${name}`);
        }
        break;
      case "record":
        visit(node.valueSchema, `${path}.valueSchema`);
        break;
      case "union":
        node.variants.forEach((variant, index) => visit(variant, `${path}.variants[${index}]`));
        break;
      case "intersection":
        node.allOf.forEach((schema, index) => visit(schema, `${path}.allOf[${index}]`));
        break;
      case "optional":
      case "nullable":
        visit(node.inner, `${path}.inner`);
        break;
    }
  }

  visit(document.root, "root");
  for (const [name, definition] of Object.entries(document.definitions)) {
    visit(definition, `definitions.${name}`);
  }
  return found;
}

/**
 * Export a service-owned wire contract. Published contracts must be concrete
 * enough for validation and generated clients in every BetterPortal SDK.
 */
export function toPublishedJsonSchemaDocument(
  schema: av.BaseSchema<unknown, unknown>,
  label = "Published schema"
): JsonObject {
  const document = av.exportSchema(schema, "portable");
  if (referencesJsonValue(document.root)) {
    document.definitions[JSON_VALUE_DEFINITION] = JsonValueSchemaNode;
  }
  const loose = looseSchemaNodes(document);
  if (loose.length > 0) {
    const locations = loose.map(({ kind, path }) => kind === "unknownKeys.allow"
      ? `unknownKeys: "allow" at ${path}`
      : `av.${kind}() at ${path}`).join(", ");
    throw new Error(
      `${label} contains unconstrained wire values (${locations}). `
      + "Use a concrete AnyVali schema, JsonValueSchema, or JsonObjectSchema."
    );
  }
  return JsonObjectSchema.parse(sanitizeJsonValue(document));
}
