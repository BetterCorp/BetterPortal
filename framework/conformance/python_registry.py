import anyvali as av
from betterportal.handler import Handler
from betterportal.registry import Operation, Route, Registry


def registry_request(body):
    try:
        routes = []
        for item in body["routes"]:
            operations = []
            for operation in item["operations"]:
                handler = Handler(av.import_schema(operation["response"]), lambda context: None,
                                  **{key: av.import_schema(value) for key, value in operation.get("schemas", {}).items()})
                operations.append(Operation(handler, operation["declaration"]))
            routes.append(Route(item["viewId"], item["path"], operations, path_variants=item.get("pathVariants", [])))
        registry = Registry(routes, dependencies=body.get("dependencies"))
        return {"status": 200, "schema": registry.schema(body["declaration"])}
    except (av.ValidationError, ValueError):
        return {"status": 400}
