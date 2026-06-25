import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type DemoScenario,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

// -- Schemas ---------------------------------------------------------

export const QuerySchema = av.object({
  name: av.string().minLength(1).default("World")
}, { unknownKeys: "strip" });

export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  greeting: av.string().minLength(1)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

// -- Metadata --------------------------------------------------------

export const title = "Hello View";
export const description = "Example BetterPortal view with JSON, HTML, and metadata representations.";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 60,
  varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
};

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Default Greeting",
    match: { query: { name: "World" } },
    response: {
      greeting: "Hello, Demo User"
    }
  }
];

// -- Handler ---------------------------------------------------------

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => ({
    greeting: `Hello, ${ctx.query.name}`
  })
);
