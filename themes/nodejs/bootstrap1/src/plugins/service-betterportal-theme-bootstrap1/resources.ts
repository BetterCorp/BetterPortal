import type { DeveloperResource } from "@betterportal/framework";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../bp-resources/${name}`, import.meta.url)), "utf8");
}

export const Bootstrap1DeveloperResources: DeveloperResource[] = [
  {
    id: "bootstrap1.ui-guide",
    kind: "guide",
    title: "Bootstrap1 UI guide",
    description: "Layout, component, HTMX, responsive and accessibility rules.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("ui-guide.md")
  },
  {
    id: "bootstrap1.skill",
    kind: "skill",
    title: "Bootstrap1 UI skill",
    description: "Agent workflow for producing theme-compatible service UI.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("SKILL.md")
  },
  {
    id: "bootstrap1.page-template",
    kind: "template",
    title: "Bootstrap1 page template",
    description: "Minimal server-rendered JSX page structure.",
    mediaType: "text/plain; charset=utf-8",
    language: "typescript",
    content: read("page-template.tsx")
  }
];
