import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type CacheHints,
  type DemoScenario,
  type ViewAuthRequirement
} from "@betterportal/framework";
import { listDocs } from "./content.js";

const DocSummarySchema = av.object({
  id: av.string().minLength(1),
  section: av.string().minLength(1),
  page: av.string().minLength(1),
  title: av.string().minLength(1),
  href: av.string().minLength(1),
  sourcePath: av.string().minLength(1),
  excerpt: av.string()
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  description: av.string().minLength(1),
  docs: av.array(DocSummarySchema)
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "BetterPortal Docs";
export const description = "Documentation index for BetterPortal.";

export const auth: ViewAuthRequirement = {
  required: false,
  realm: "runtime",
  minimumTier: "public",
  audiences: [],
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 15,
  varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
};

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Docs Index",
    response: {
      title: "BetterPortal Docs",
      description: "Documentation for the BetterPortal platform.",
      docs: []
    }
  }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  async () => ({
    title: "BetterPortal Docs",
    description: "Documentation for the BetterPortal platform.",
    docs: await listDocs()
  })
);
