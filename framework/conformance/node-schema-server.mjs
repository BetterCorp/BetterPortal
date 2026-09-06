import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { importSchema, exportSchema, encrypt, decrypt, safeParseEncrypted, object } from "anyvali";
import { security } from "./node-security.mjs";
import { encryption } from "./node-encryption.mjs";
import { authorization } from "./node-authorization.mjs";
import { resolveRequestedRepresentation } from "../nodejs/lib/runtime/media.js";
import { streaming, streamProbe } from "./node-stream.mjs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.action === "stream-probe") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(await streamProbe()));
      return;
    }
    if (body.action === "stream") {
      const abort = new AbortController();
      response.once("close", () => abort.abort());
      const result = await streaming(body, abort.signal);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      await pipeline(Readable.fromWeb(result.body), response);
      return;
    }
    if (body.action === "media") {
      const value = resolveRequestedRepresentation(body.accept);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: 200, output: { kind: value.kind, mode: value.kind === "html" ? value.mode ?? "page" : null } }));
      return;
    }
    if (body.action === "auth-request") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(await authorization(body)));
      return;
    }
    if (body.action?.startsWith("crypto-")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(await encryption(body)));
      return;
    }
    if (body.action?.startsWith("jwt-") || body.action?.startsWith("keys-")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(await security(body)));
      return;
    }
    if (!body.document && !/^[A-Za-z][A-Za-z0-9_]*$/.test(body.contract)) throw new Error("Invalid contract");
    const document = body.document ?? JSON.parse(await readFile(new URL(`contracts/${body.contract}.json`, import.meta.url), "utf8"));
    let schema = importSchema(document);
    if (body.wrapDocument) {
      const child = exportSchema(schema);
      schema = importSchema({ ...child, root: { kind: "object", properties: { payload: child.root }, required: ["payload"], unknownKeys: "strip" } });
    }
    if (body.wrap) schema = object({ payload: schema });
    if (body.roundtrip || body.action === "roundtrip") schema = importSchema(exportSchema(schema));
    let result = body.action === "import" ? { success: true, data: true } : schema.safeParse(body.input);
    if (body.action === "encrypt") result = { success: true, data: encrypt(schema, body.input, (_path, value) => `encrypted:${JSON.stringify(value)}`) };
    if (body.action === "decrypt") result = { success: true, data: decrypt(schema, body.input, (_path, value) => JSON.parse(value.slice("encrypted:".length))) };
    if (body.action === "encrypted") result = safeParseEncrypted(schema, body.input);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ valid: result.success, ...(result.success ? { output: result.data } : {}), document: exportSchema(schema) }));
  } catch (error) {
    if (response.destroyed || response.writableEnded) return;
    if (response.headersSent) { response.destroy(error); return; }
    response.statusCode = 500;
    response.end(JSON.stringify({ error: error.message }));
  }
}).listen(Number(process.argv[2] ?? 8310), "127.0.0.1");
