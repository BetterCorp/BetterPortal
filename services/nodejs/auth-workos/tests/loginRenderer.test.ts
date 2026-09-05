import assert from "node:assert/strict";
import test from "node:test";
import { createContext, Script } from "node:vm";
import { toHtmlString } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-workos/bp-routes/login/_renderer.bootstrap5/GET.js";

test("WorkOS login script is valid on repeated swaps and redirects only in automatic modes", () => {
  const html = toHtmlString(render({ status: "ok", loginUI: "default", authorizationUrl: "https://auth.test/authorize" }));
  const source = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert(source);
  const script = new Script(source);
  let clicks = 0;
  const dataset = { redirectUrl: "https://auth.test/authorize", mode: "ok", autoRedirect: "true" };
  const context = createContext({ document: {
    currentScript: { closest: () => ({ dataset }) },
    createElement: () => ({ href: "", click() { clicks++; }, remove() {} }),
    body: { appendChild() {} }
  } });
  script.runInContext(context);
  script.runInContext(context);
  assert.equal(clicks, 2, "repeated HTMX swaps must not redeclare global bindings");
  dataset.autoRedirect = "false";
  script.runInContext(context);
  dataset.autoRedirect = "true";
  dataset.mode = "error";
  script.runInContext(context);
  dataset.mode = "ok";
  dataset.redirectUrl = "";
  script.runInContext(context);
  assert.equal(clicks, 2, "manual/error/empty destinations must not redirect");
});
