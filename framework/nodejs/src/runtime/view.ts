import * as av from "anyvali";
import type { Infer } from "anyvali";
import { RenderMode } from "../contracts/common.js";
import { JsonValue } from "../contracts/json.js";
import {
  CacheHints,
  HtmlRepresentationSupport,
  ViewMetadata,
  ViewMetadataSchema
} from "../contracts/view.js";
import type { ApiAuthRequirement } from "../contracts/route.js";
import { RequestedRepresentation, resolveRequestedRepresentation } from "./media.js";
import { toJsonSchemaDocument } from "./jsonSchema.js";

type AnySchema = av.BaseSchema<unknown, unknown>;
export interface HtmlRenderableLike {
  toString(): string;
}
export type HtmlRenderable = string | HtmlRenderableLike;

export interface ViewSchemas<
  ParamsSchema extends AnySchema,
  QuerySchema extends AnySchema,
  HeadersSchema extends AnySchema,
  BodySchema extends AnySchema,
  ResponseSchema extends AnySchema
> {
  params: ParamsSchema;
  query: QuerySchema;
  headers: HeadersSchema;
  body: BodySchema;
  response: ResponseSchema;
}

export interface CreateViewDefinitionInput<
  ParamsSchema extends AnySchema,
  QuerySchema extends AnySchema,
  HeadersSchema extends AnySchema,
  BodySchema extends AnySchema,
  ResponseSchema extends AnySchema
> {
  viewId: string;
  title: string;
  description: string;
  path: string;
  methods: ReadonlyArray<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS">;
  schemas: ViewSchemas<ParamsSchema, QuerySchema, HeadersSchema, BodySchema, ResponseSchema>;
  html: HtmlRepresentationSupport;
  auth: ApiAuthRequirement;
  demoScenarios?: ReadonlyArray<{
    id: string;
    title: string;
    response: Infer<ResponseSchema>;
  }>;
  cacheHints: CacheHints;
}

export interface BetterPortalViewDefinition<
  ParamsSchema extends AnySchema,
  QuerySchema extends AnySchema,
  HeadersSchema extends AnySchema,
  BodySchema extends AnySchema,
  ResponseSchema extends AnySchema
> extends CreateViewDefinitionInput<ParamsSchema, QuerySchema, HeadersSchema, BodySchema, ResponseSchema> {
  toMetadata(): ViewMetadata;
}

export interface NegotiatedViewResponse {
  status: number;
  contentType: string;
  body: JsonValue | HtmlRenderable;
}

export function createViewDefinition<
  ParamsSchema extends AnySchema,
  QuerySchema extends AnySchema,
  HeadersSchema extends AnySchema,
  BodySchema extends AnySchema,
  ResponseSchema extends AnySchema
>(
  input: CreateViewDefinitionInput<ParamsSchema, QuerySchema, HeadersSchema, BodySchema, ResponseSchema>
): BetterPortalViewDefinition<ParamsSchema, QuerySchema, HeadersSchema, BodySchema, ResponseSchema> {
  const metadata = ViewMetadataSchema.parse({
    viewId: input.viewId,
    title: input.title,
    description: input.description,
    path: input.path,
    methods: [...input.methods],
    paramsSchema: toJsonSchemaDocument(input.schemas.params),
    querySchema: toJsonSchemaDocument(input.schemas.query),
    headersSchema: toJsonSchemaDocument(input.schemas.headers),
    bodySchema: toJsonSchemaDocument(input.schemas.body),
    jsonResponseSchema: toJsonSchemaDocument(input.schemas.response),
    metadataResponseSchema: toJsonSchemaDocument(ViewMetadataSchema),
    html: input.html,
    auth: input.auth,
    demoScenarios: (input.demoScenarios ?? []).map((scenario) => ({
      ...scenario,
      response: input.schemas.response.parse(scenario.response) as JsonValue
    })),
    cacheHints: input.cacheHints
  });

  return {
    ...input,
    toMetadata(): ViewMetadata {
      return metadata;
    }
  };
}

function resolveTheme(html: HtmlRepresentationSupport, requestedTheme?: string): string | null {
  if (!requestedTheme) return null;
  return requestedTheme in html.themeRenderers ? requestedTheme : null;
}

function resolveMode(html: HtmlRepresentationSupport, theme: string, requestedMode?: RenderMode): RenderMode | null {
  const renderer = html.themeRenderers[theme];
  if (!renderer) return null;
  if (!requestedMode) return renderer.renderModes[0] ?? null;
  return renderer.renderModes.includes(requestedMode) ? requestedMode : null;
}

export function negotiateViewResponse<ResponseSchema extends AnySchema>(
  view: BetterPortalViewDefinition<AnySchema, AnySchema, AnySchema, AnySchema, ResponseSchema>,
  acceptHeader: string | undefined,
  jsonBody: Infer<ResponseSchema>,
  renderHtml: ((theme: string, mode: RenderMode, body: Infer<ResponseSchema>) => HtmlRenderable) | undefined
): NegotiatedViewResponse {
  const requested = resolveRequestedRepresentation(acceptHeader);
  const validatedJsonBody = view.schemas.response.parse(jsonBody) as JsonValue;

  if (requested.kind === "metadata") {
    return {
      status: 200,
      contentType: "application/vnd.betterportal.metadata+json",
      body: view.toMetadata()
    };
  }

  if (requested.kind === "json") {
    return {
      status: 200,
      contentType: "application/json",
      body: validatedJsonBody
    };
  }

  // NDJSON streaming is only supported by streaming routes (spec/streaming.md),
  // which negotiate in the adapter - never through this buffered path.
  if (requested.kind === "ndjson") {
    return {
      status: 406,
      contentType: "application/json",
      body: {
        error: "NDJSON streaming is not supported by this view"
      }
    };
  }

  if (!renderHtml) {
    return {
      status: 406,
      contentType: "application/json",
      body: {
        error: "HTML rendering is not available for this view"
      }
    };
  }

  const theme = resolveTheme(view.html, requested.theme);
  if (!theme) {
    return {
      status: 406,
      contentType: "application/json",
      body: {
        error: "Requested HTML representation is not supported"
      }
    };
  }
  const mode = resolveMode(view.html, theme, requested.mode);
  if (!mode) {
    return {
      status: 406,
      contentType: "application/json",
      body: {
        error: "Requested HTML representation is not supported"
      }
    };
  }

  return {
    status: 200,
    contentType: `text/html; theme=${theme}; mode=${mode}`,
    body: renderHtml(theme, mode, jsonBody)
  };
}

export function resolveRepresentationFromAccept(acceptHeader?: string): RequestedRepresentation {
  return resolveRequestedRepresentation(acceptHeader);
}
