import assert from "node:assert/strict";
import test from "node:test";
import { BPElement, type BPElementReference, type ViewRenderContext } from "../src/index.js";

test("BPElement consumes ctx without serializing it", () => {
  let reference: BPElementReference | undefined;
  const ctx = {
    secret: "must-not-leak",
    element(value: BPElementReference) {
      reference = value;
      return { serviceId: "019f0000-0000-7000-8000-000000000001", url: "https://crm.example.test/customers/42?_f=profile.summary" };
    }
  } as unknown as ViewRenderContext;
  const html = String(BPElement({
    ctx,
    service: "crm",
    path: "/customers/:customerId",
    fragment: "profile.summary",
    args: { params: { customerId: 42 } },
    children: "<bp-loading>Loading</bp-loading><bp-nok>Unavailable</bp-nok>"
  }));

  assert.equal(reference?.service, "crm");
  assert.match(html, /hx-get="https:\/\/crm\.example\.test\/customers\/42\?_f=profile\.summary"/);
  assert.doesNotMatch(html, /must-not-leak/);
});

test("BPElement requires an insertion point when bp-ok is present", () => {
  const ctx = { element: () => ({ unavailable: "service_unavailable" }) } as unknown as ViewRenderContext;
  assert.throws(() => BPElement({ ctx, service: "crm", path: "/x", fragment: "x", children: "<bp-ok>Missing</bp-ok>" }), /exactly one/);
});
