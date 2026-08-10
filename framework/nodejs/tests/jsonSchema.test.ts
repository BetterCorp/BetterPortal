import assert from "node:assert/strict";
import test from "node:test";
import * as av from "anyvali";
import {
  BETTERPORTAL_MENU_MAX_DEPTH,
  BetterPortalMenuItemSchema,
  JsonObjectSchema,
  JsonValueSchema,
  MultipartRequestSchema,
  ViewMetadataSchema,
  toJsonSchemaDocument,
  toPublishedJsonSchemaDocument,
  uuidv7
} from "../src/index.js";

test("JSON contracts accept recursive JSON and reject non-JSON values", () => {
  assert.deepEqual(JsonValueSchema.parse({
    enabled: true,
    values: [1, "two", null, { nested: false }]
  }), {
    enabled: true,
    values: [1, "two", null, { nested: false }]
  });
  assert.deepEqual(JsonObjectSchema.parse({ value: 1 }), { value: 1 });
  assert.equal(JsonValueSchema.safeParse({ value: undefined }).success, false);
  assert.equal(JsonValueSchema.safeParse(Number.POSITIVE_INFINITY).success, false);
  assert.equal(JsonObjectSchema.safeParse([]).success, false);

  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(JsonValueSchema.safeParse(circular).success, false);
});

test("JSON contracts export a portable recursive definition without any or unknown", () => {
  assert.equal(av.exportSchema(JsonValueSchema).definitions.BetterPortalJsonValue.kind, "union");
  const document = toJsonSchemaDocument(av.object({
    payload: JsonValueSchema,
    metadata: JsonObjectSchema
  }));
  assert.equal(
    JSON.stringify(document).includes('"kind":"any"')
      || JSON.stringify(document).includes('"kind":"unknown"'),
    false
  );
  assert.deepEqual(document.root, {
    kind: "object",
    properties: {
      payload: { kind: "ref", ref: "#/definitions/BetterPortalJsonValue" },
      metadata: {
        kind: "record",
        valueSchema: { kind: "ref", ref: "#/definitions/BetterPortalJsonValue" }
      }
    },
    required: ["payload", "metadata"],
    unknownKeys: "strip"
  });
  assert.equal(
    (document.definitions as Record<string, { kind?: string }>).BetterPortalJsonValue.kind,
    "union"
  );

  const protoKey = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  const parsed = JsonObjectSchema.parse(protoKey);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "__proto__"), true);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("published schemas reject any and unknown at every nesting level", () => {
  assert.throws(
    () => toPublishedJsonSchemaDocument(
      av.object({
        values: av.array(av.record(av.optional(av.any()))),
        fallback: av.unknown()
      }),
      "example POST RequestSchema"
    ),
    /example POST RequestSchema contains unconstrained wire values.*root\.properties\.values\.items\.valueSchema\.inner.*root\.properties\.fallback/
  );
  assert.doesNotThrow(() => toPublishedJsonSchemaDocument(
    av.object({ payload: JsonValueSchema }),
    "example POST RequestSchema"
  ));
  assert.doesNotThrow(() => toPublishedJsonSchemaDocument(
    ViewMetadataSchema,
    "MetadataResponseSchema"
  ));
  assert.throws(
    () => toPublishedJsonSchemaDocument(
      av.object({ value: av.string() }, { unknownKeys: "allow" }),
      "unsafe ResponseSchema"
    ),
    /unknownKeys: "allow" at root/
  );
});

test("menu schemas permit 32 levels and reject deeper or circular menus", () => {
  const item = (children: unknown[] = []): Record<string, unknown> => ({ id: uuidv7(), children });
  let valid = item();
  for (let depth = 1; depth < BETTERPORTAL_MENU_MAX_DEPTH; depth++) valid = item([valid]);
  assert.equal(BetterPortalMenuItemSchema.safeParse(valid).success, true);

  const tooDeep = item([valid]);
  const result = BetterPortalMenuItemSchema.safeParse(tooDeep);
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.issues[0]?.message ?? "", /maximum depth of 32/);

  const circular = item();
  circular.children = [circular];
  assert.equal(BetterPortalMenuItemSchema.safeParse(circular).success, false);
});

test("multipart uploads have a concrete portable schema", () => {
  const data = new Uint8Array([1, 2, 3]);
  assert.deepEqual(MultipartRequestSchema.parse({
    fields: { title: "Report", tags: ["one", "two"] },
    files: {
      document: {
        fieldName: "document",
        filename: "report.pdf",
        contentType: "application/pdf",
        size: data.byteLength,
        data
      }
    }
  }).files.document, {
    fieldName: "document",
    filename: "report.pdf",
    contentType: "application/pdf",
    size: data.byteLength,
    data
  });
  assert.doesNotThrow(() => toPublishedJsonSchemaDocument(MultipartRequestSchema, "MultipartSchema"));
});
