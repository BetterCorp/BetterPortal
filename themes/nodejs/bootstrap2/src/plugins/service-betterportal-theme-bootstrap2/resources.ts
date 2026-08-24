import type { DeveloperResource } from "@betterportal/framework";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../bp-resources/${name}`, import.meta.url)), "utf8");
}

export const Bootstrap2DeveloperResources: DeveloperResource[] = [
  {
    id: "bootstrap2.ui-guide",
    kind: "guide",
    title: "Bootstrap2 UI guide",
    description: "Layout, component, HTMX, responsive and accessibility rules.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("ui-guide.md")
  },
  {
    id: "bootstrap2.skill",
    kind: "skill",
    title: "Bootstrap2 UI skill",
    description: "Agent workflow for producing theme-compatible service UI.",
    mediaType: "text/markdown; charset=utf-8",
    content: read("SKILL.md")
  },
  {
    id: "bootstrap2.page-template",
    kind: "template",
    title: "Bootstrap2 page template",
    description: "Minimal server-rendered JSX page structure.",
    mediaType: "text/plain; charset=utf-8",
    language: "typescript",
    content: read("page-template.tsx")
  },
  {
    id: "bootstrap2.bootstrap5-examples",
    kind: "example",
    title: "Bootstrap2 Bootstrap 5 examples",
    description: "Compact forms, tables, HTMX, sidebars, states, fragments, and SSE patterns.",
    mediaType: "text/markdown; charset=utf-8",
    language: "typescript",
    content: read("bootstrap5-examples.md")
  },
  {
    id: "bootstrap2.critical-alert-fragment",
    kind: "example",
    title: "Bootstrap2 critical alert fragment",
    description: "Service-owned empty/SSE alert outlet example for the critical-alerts shell block.",
    mediaType: "text/plain; charset=utf-8",
    language: "typescript",
    content: read("critical-alert-fragment.tsx")
  }
];
