import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "../src/runtime/h3.js";

test("middleware response headers survive error responses", async () => {
  const app = createBetterPortalApp();
  app.use("/**", (event) => {
    event.res.headers.set("Access-Control-Allow-Origin", "https://root.example");
  });
  app.get("/conflict", () => new Response("details", { status: 409 }));

  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/conflict`);
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://root.example");
    assert.equal(await response.text(), "details");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
