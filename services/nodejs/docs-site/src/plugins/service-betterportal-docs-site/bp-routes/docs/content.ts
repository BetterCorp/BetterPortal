import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface DocSummary {
  id: string;
  section: string;
  page: string;
  title: string;
  href: string;
  sourcePath: string;
  excerpt: string;
}

export interface DocPage extends DocSummary {
  markdown: string;
}

const DocsRootCandidates = [
  path.resolve(process.cwd(), "../../../docs"),
  path.resolve(process.cwd(), "../../../../docs"),
  path.resolve(process.cwd(), "docs"),
  path.resolve(process.cwd(), "../../../../../docs")
];

function docsRoot(): string {
  const root = DocsRootCandidates.find((candidate) => existsSync(candidate));
  return root ?? DocsRootCandidates[0];
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  const heading = markdown.split(/\r?\n/).find((line) => line.startsWith("# "));
  return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

function excerptFromMarkdown(markdown: string): string {
  const paragraph = markdown
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .find((block) => block.length > 0 && !block.startsWith("#"));
  return paragraph ? paragraph.replace(/\s+/g, " ").slice(0, 180) : "";
}

function labelFromSlug(slug: string): string {
  return slug
    .replace(/^\d+-/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function listDocs(): Promise<DocSummary[]> {
  const root = docsRoot();
  if (!existsSync(root)) return [];

  const sections = await readdir(root, { withFileTypes: true });
  const docs: DocSummary[] = [];

  for (const sectionEntry of sections) {
    if (!sectionEntry.isDirectory()) continue;
    const section = sectionEntry.name;
    const sectionDir = path.join(root, section);
    const files = await readdir(sectionDir, { withFileTypes: true });

    for (const fileEntry of files) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith(".md")) continue;
      const page = fileEntry.name.slice(0, -3);
      const sourcePath = path.join(sectionDir, fileEntry.name);
      const markdown = await readFile(sourcePath, "utf8");
      const fallbackTitle = labelFromSlug(page);
      docs.push({
        id: `${section}/${page}`,
        section,
        page,
        title: titleFromMarkdown(markdown, fallbackTitle),
        href: `/docs/${section}/${page}`,
        sourcePath: path.relative(root, sourcePath).replace(/\\/g, "/"),
        excerpt: excerptFromMarkdown(markdown)
      });
    }
  }

  return docs.sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
}

export async function getDoc(section: string, page: string): Promise<DocPage | null> {
  const root = docsRoot();
  const safeSection = section.replace(/[^a-zA-Z0-9_-]/g, "");
  const safePage = page.replace(/[^a-zA-Z0-9._-]/g, "");
  const sourcePath = path.join(root, safeSection, `${safePage}.md`);

  if (!existsSync(sourcePath)) return null;

  const markdown = await readFile(sourcePath, "utf8");
  const fallbackTitle = labelFromSlug(safePage);
  return {
    id: `${safeSection}/${safePage}`,
    section: safeSection,
    page: safePage,
    title: titleFromMarkdown(markdown, fallbackTitle),
    href: `/docs/${safeSection}/${safePage}`,
    sourcePath: path.relative(root, sourcePath).replace(/\\/g, "/"),
    excerpt: excerptFromMarkdown(markdown),
    markdown
  };
}
