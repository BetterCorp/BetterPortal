import { RenderMode, RenderModeSchema } from "../contracts/common.js";

export interface AcceptEntry {
  mediaType: string;
  parameters: Readonly<Record<string, string>>;
  quality: number;
}

export type RequestedRepresentation =
  | { kind: "json" }
  | { kind: "metadata" }
  | { kind: "html"; theme?: string; mode?: RenderMode };

function parseParameter(raw: string): [string, string] | null {
  const separatorIndex = raw.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = raw.slice(0, separatorIndex).trim().toLowerCase();
  const value = raw.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
  if (key.length === 0 || value.length === 0) {
    return null;
  }

  return [key, value];
}

export function parseAcceptHeader(headerValue?: string): AcceptEntry[] {
  if (!headerValue || headerValue.trim().length === 0) {
    return [{ mediaType: "application/json", parameters: {}, quality: 1 }];
  }

  return headerValue
    .split(",")
    .map((rawEntry) => rawEntry.trim())
    .filter((rawEntry) => rawEntry.length > 0)
    .map((rawEntry) => {
      const parts = rawEntry.split(";").map((part) => part.trim()).filter((part) => part.length > 0);
      const mediaType = parts[0].toLowerCase();
      const parameters: Record<string, string> = {};
      let quality = 1;

      for (const parameter of parts.slice(1)) {
        const parsed = parseParameter(parameter);
        if (!parsed) {
          continue;
        }

        const [key, value] = parsed;
        if (key === "q") {
          const parsedQuality = Number(value);
          if (Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1) {
            quality = parsedQuality;
          }
          continue;
        }

        parameters[key] = value;
      }

      return { mediaType, parameters, quality };
    })
    .sort((left, right) => right.quality - left.quality);
}

export function resolveRequestedRepresentation(headerValue?: string): RequestedRepresentation {
  const entries = parseAcceptHeader(headerValue);

  for (const entry of entries) {
    if (entry.mediaType === "application/vnd.betterportal.metadata+json") {
      return { kind: "metadata" };
    }

    if (entry.mediaType === "application/json" || entry.mediaType === "*/*") {
      return { kind: "json" };
    }

    if (entry.mediaType === "text/html") {
      const modeCandidate = entry.parameters.mode;
      const mode = modeCandidate ? RenderModeSchema.parse(modeCandidate) : undefined;
      return {
        kind: "html",
        theme: entry.parameters.theme,
        mode
      };
    }
  }

  return { kind: "json" };
}
