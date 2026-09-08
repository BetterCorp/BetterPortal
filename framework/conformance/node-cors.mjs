import { createBetterPortalApp, handleCorsRequest } from "../nodejs/lib/runtime/h3.js";

const app = createBetterPortalApp();
app.use(event => handleCorsRequest(event, {
  origin: ["https://app.test"], methods: ["GET", "OPTIONS"],
  allowHeaders: event.req.headers.get("access-control-request-headers")?.split(",").map(value => value.trim())
    ?? ["Accept", "Authorization", "Content-Type", "HX-Request", "X-BP-Service-Authorization", "traceparent", "tracestate", "baggage"],
  exposeHeaders: ["HX-Trigger", "BP-SetHeader"], maxAge: "600", preflight: { statusCode: 204 }
}) || undefined);
app.all("/cors", () => Response.json({ handled: true }, { headers: { "x-test-handler": "ran" } }));

export const corsRequest = request => app.fetch(request);
