import { z } from "zod";
import { RenderMode } from "../contracts/common";
import { JsonValue } from "../contracts/json";
import {
  CacheHints,
  HtmlRepresentationSupport,
  ViewAuthRequirement,
  ViewMetadata,
  ViewMetadataSchema
} from "../contracts/view";
import { RequestedRepresentation, resolveRequestedRepresentation } from "./media";
import { toJsonSchemaDocument } from "./jsonSchema";

type AnySchema = z.ZodType<unknown>;
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
  auth: ViewAuthRequirement;
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
  if (requestedTheme && html.supportedThemes.includes(requestedTheme)) {
    return requestedTheme;
  }

  if (!requestedTheme && html.allowDefaultThemeWhenOmitted && html.defaultTheme) {
    return html.supportedThemes.includes(html.defaultTheme) ? html.defaultTheme : null;
  }

  return null;
}

function resolveMode(html: HtmlRepresentationSupport, requestedMode?: RenderMode): RenderMode | null {
  if (!requestedMode) {
    return html.renderModes[0] ?? null;
  }

  return html.renderModes.includes(requestedMode) ? requestedMode : null;
}

export function negotiateViewResponse<ResponseSchema extends AnySchema>(
  view: BetterPortalViewDefinition<AnySchema, AnySchema, AnySchema, AnySchema, ResponseSchema>,
  acceptHeader: string | undefined,
  jsonBody: z.infer<ResponseSchema>,
  renderHtml: ((theme: string, mode: RenderMode, body: z.infer<ResponseSchema>) => HtmlRenderable) | undefined
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
  const mode = resolveMode(view.html, requested.mode);
  if (!theme || !mode) {
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
