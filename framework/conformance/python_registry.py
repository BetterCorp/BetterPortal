import anyvali as av
from betterportal.handler import Handler
from betterportal.finite import FiniteHandler, StreamRenderers
from betterportal.registry import Operation, Route, Registry
from betterportal.rendering import Renderer
from betterportal.response import RawHandler, RawResponse


def build_registry(body):
    routes = []
    for item in body["routes"]:
        operations = []
        for operation in item["operations"]:
            schemas = {key: av.import_schema(value) for key, value in operation.get("schemas", {}).items()}
            handler = (RawHandler(lambda context: RawResponse(), **schemas) if operation.get("raw") else
                Handler(av.import_schema(operation["response"]), lambda context: dict(context.request_context.config) if body.get("returnConfig") else None,
                    renderers=[Renderer(item["declaration"], lambda data, context: "") for item in operation.get("renderers", [])], **schemas))
            if "finite" in operation:
                async def empty(context):
                    if False: yield None
                finite = operation["finite"]
                handler = FiniteHandler(av.import_schema(finite["itemSchema"]), empty,
                    summary=av.import_schema(finite["summarySchema"]) if "summarySchema" in finite else None,
                    renderers=[Renderer(item["declaration"], lambda data, context: "") for item in operation.get("renderers", [])],
                    stream_renderers=[StreamRenderers(item["renderer"], lambda data, context: "", lambda data, context: "") for item in operation.get("streamRenderers", [])], **schemas)
            operations.append(Operation(handler, operation["declaration"]))
        routes.append(Route(item["viewId"], item["path"], operations, path_variants=item.get("pathVariants", [])))
    return Registry(routes, dependencies=body.get("dependencies"))


def registry_request(body):
    try:
        return {"status": 200, "schema": build_registry(body).schema(body["declaration"])}
    except (av.ValidationError, ValueError):
        return {"status": 400}
