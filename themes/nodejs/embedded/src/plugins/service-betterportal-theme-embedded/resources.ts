import type { DeveloperResource } from "@betterportal/framework";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../bp-resources/${name}`, import.meta.url)), "utf8");
}

export const EmbeddedDeveloperResources: DeveloperResource[] = [
  {
    id: "embedded.ui-guide",
    kind: "guide",
    title: "Embedded UI guide",
    description: "Compact layout, HTMX and accessibility rules for embedded views.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("ui-guide.md")
  },
  {
    id: "embedded.skill",
    kind: "skill",
    title: "Embedded UI skill",
    description: "Agent workflow for producing Embedded-compatible service UI.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("SKILL.md")
  },
  {
    id: "embedded.page-template",
    kind: "template",
    title: "Embedded page template",
    description: "Minimal server-rendered JSX page structure.",
    mediaType: "text/plain; charset=utf-8",
    language: "typescript",
    content: read("page-template.tsx")
  }
];
