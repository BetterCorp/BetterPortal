import { createHash } from "node:crypto";
import type { BpSchemaOutput } from "../contracts/manifest.js";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

export function contractDigest(contract: BpSchemaOutput): string {
  return `sha256:${createHash("sha256").update(canonicalJson(contract)).digest("hex")}`;
}
