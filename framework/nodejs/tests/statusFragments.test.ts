import assert from "node:assert/strict";
import test from "node:test";
import { statusService } from "./helpers/statusService.js";

test("declared service status renderers preserve fragment negotiation and the handler status", async () => {
  const service = statusService();
  for (const [accept, query] of [["text/html; mode=fragment", ""], ["text/html; fragment=body.errors", ""], ["text/html", "?_f=body.errors"], ["text/html", "?_c=errors"]]) {
    const response = await service.request(accept!, query);
    assert.equal(response.status, 422);
    assert.match(response.headers.get("content-type")!, /text\/html;.*mode=fragment/);
    assert.match(await response.text(), /id="service-validation"/);
  }
  assert.equal(service.calls(), 4);
});

test("full-page service status HTML and JSON retain their existing representations", async () => {
  const service = statusService();
  const page = await service.request("text/html");
  assert.equal(page.status, 422); assert.match(page.headers.get("content-type")!, /mode=status/);
  assert.match(await page.text(), /Choose a different related record/);
  const json = await service.request("application/json");
  assert.equal(json.status, 422); assert.match(json.headers.get("content-type")!, /application\/json/);
  assert.deepEqual(await json.json(), { message: "Choose a different related record." });
});

test("framework validation/auth errors retain their representations and unmatched status renderers remain empty", async () => {
  const invalidService = statusService();
  const invalid = await invalidService.request("text/html; mode=fragment", "", "");
  assert.equal(invalid.status, 400); assert.match(invalid.headers.get("content-type")!, /application\/json/);
  assert.equal(invalidService.calls(), 0);
  const auth = await statusService({ authRequired: true }).request("text/html; mode=fragment");
  assert.equal(auth.status, 401); assert.match(auth.headers.get("content-type")!, /mode=status/);
  const absent = await statusService({ statusRenderer: false }).request("text/html; mode=fragment");
  assert.equal(absent.status, 422); assert.equal(await absent.text(), "");
});
