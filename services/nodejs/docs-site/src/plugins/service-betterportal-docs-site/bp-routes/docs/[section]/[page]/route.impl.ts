import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type CacheHints,
  type DemoScenario,
  type ApiAuthRequirement
} from "@betterportal/framework";
import { getDoc, listDocs } from "../../content.js";

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
  section: av.string().minLength(1),
  page: av.string().minLength(1),
  sourcePath: av.string().minLength(1),
  markdown: av.string(),
  docs: av.array(DocSummarySchema),
  notFound: av.bool()
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "BetterPortal Doc Page";
export const description = "Markdown-backed BetterPortal documentation page.";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 15,
  varyBy: ["accept", "origin", "referer", ":origin", ":referer"]
};

export const demoScenarios: DemoScenario<ResponseData>[] = [
  {
    id: "default",
    title: "Quick Start",
    response: {
      title: "Quick Start",
      section: "getting-started",
      page: "quick-start",
      sourcePath: "getting-started/quick-start.md",
      markdown: "# Quick Start\n\nBetterPortal documentation.",
      docs: [],
      notFound: false
    }
  }
];

export const handleGet = createHandler(
  { response: ResponseSchema },
  async (ctx) => {
    const params = ctx.params as { section?: string; page?: string };
    const section = params.section ?? "";
    const page = params.page ?? "";
    const [doc, docs] = await Promise.all([getDoc(section, page), listDocs()]);

    if (!doc) {
      return {
        title: "Doc not found",
        section,
        page,
        sourcePath: `${section}/${page}.md`,
        markdown: "# Doc not found\n\nThe requested documentation page does not exist.",
        docs,
        notFound: true
      };
    }

    return {
      title: doc.title,
      section: doc.section,
      page: doc.page,
      sourcePath: doc.sourcePath,
      markdown: doc.markdown,
      docs,
      notFound: false
    };
  }
);
