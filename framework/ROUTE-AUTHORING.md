# Native route authoring

Python discovers modules from one filesystem package. .NET discovers public static
factory methods marked `[RouteModule]` in a compiled assembly. The C# compiler supplies
each factory's source path through `CallerFilePath`; discovery does not read C# or
PDB files. Keep the route-root segment when using compiler `PathMap` settings.
These packages are currently unpublished; build/install the local packages first.

Both forms return the same `Registry` used by hosting and contract export:

| File | Synchronous factory result |
| --- | --- |
| `index.py` / `index.cs` | `RouteDeclarationInput`: optional `viewId`, `title`, `description` |
| `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` | An `Operation` for that exact uppercase method |
| `sse.py` / `sse.cs` | An `SseFeed`, receiving the existing GET handler and resolved view ID |

An index needs at least one method. Every operation declares its own stable ID,
title, description, auth, dependencies and schemas. Index metadata cannot carry
method policy. A view title/description overrides its GET labels in the manifest;
otherwise the GET labels (or first declared method) supply them. Each method imports
the same params schema from its index or a shared module.

Folders map to URL segments. `[id]` publishes `:id`; `[[id]]` publishes every
included/omitted path combination. Optional path parameters need optional schema
properties. A root index publishes `/`. Catch-all, brace and partial parameters
are rejected. Default view IDs join folders with dots, turn parameters into `$id`,
and append `.index`; use an explicit ID to keep identity when moving a view.
Operation IDs are always explicit. Duplicate IDs, ambiguous paths and inconsistent
method params schemas fail through the ordinary registry checks.

Service APIs under `/.well-known/bp/` are independent of app page mounts, as in
[the BP protocol](../spec/protocol.md). Their operation auth still applies: declare
required auth and permissions for protected APIs. An empty app route list does
not disable these APIs, and placing a route here does not authenticate its caller.

Schemas use AnyVali. Discovery rejects `any`, `unknown` and objects with
`unknownKeys: allow`, including nested and referenced schemas. Use the platform's
recursive `JsonValueSchema`/`JsonObjectSchema` for arbitrary JSON values.

## Python example

Create empty `my_service/__init__.py` and `my_service/bp_routes/__init__.py` files.
Intermediate route directories can be namespace packages. Relative imports work
inside parameter and dotted URL directories; dotted segments use a private module
alias, so import shared code relatively there. Zip packages and route roots spread
over multiple filesystem locations are unsupported. Hidden directories,
`__pycache__` and `_renderer.*` helper directories are not scanned as routes.
The `.well-known` directory is included, matching Node.

<!-- file: python/my_service/bp_routes/hello/index.py -->
```python
from betterportal.generated_types import RouteDeclarationInput

def create() -> RouteDeclarationInput:
    return {"viewId": "hello.index", "title": "Hello"}
```

<!-- file: python/my_service/bp_routes/hello/GET.py -->
```python
from typing import Any
import anyvali as av
from betterportal.handler import Handler, HandlerContext
from betterportal.registry import Operation
from betterportal.rendering import Renderer

def hello(context: HandlerContext[Any, Any, Any, Any]) -> str:
    return "Hello"

def create() -> Operation:
    page = Renderer[str]({"renderer": "bootstrap5"}, lambda value, context: "<p>Hello</p>")
    return Operation(Handler(av.string(), hello, renderers=[page]), {
        "operationId": "hello.get", "method": "GET", "title": "Hello",
        "description": "Hello operation", "auth": {}
    })
```

<!-- file: python/my_service/definition.py -->
```python
from betterportal.discovery import discover
from betterportal.generated_types import BpSchemaOutput

def registry():
    return discover("my_service.bp_routes")

def contract() -> BpSchemaOutput:
    return registry().schema({"pluginId": "com.example.hello", "title": "Hello",
                              "description": "Example service", "version": "1.0.0"})
```

```sh
bp-python export --module my_service.definition:contract --project . --output bp-contract.json
bp-python export --module my_service.definition:contract --project . --output bp-contract.json --check
```

## .NET example

In a .NET 10 project referencing `BetterPortal`, include these files. The normal
SDK compile glob includes bracket and dotted route directories. Factory names and
C# namespaces are unrestricted; source filenames determine their roles. Mark
exactly one factory in each route module. Unmarked helpers are not discovered.

The SDK excludes hidden directories from its default compile glob. For `.well-known`
routes, add this item to your `.csproj`:

<!-- well-known-compile -->
```xml
<ItemGroup>
  <Compile Include="**/.well-known/**/*.cs" />
</ItemGroup>
```

<!-- file: dotnet/bp-routes/hello/index.cs -->
```csharp
using BetterPortal;
using BetterPortal.Generated;

namespace HelloService.Routes;
public static class Index
{
    [RouteModule]
    public static RouteDeclarationInput Create() => new() { ViewId = "hello.index", Title = "Hello" };
}
```

<!-- file: dotnet/bp-routes/hello/GET.cs -->
```csharp
using AnyVali;
using BetterPortal;
using BetterPortal.Generated;

namespace HelloService.Routes;
public static class Get
{
    [RouteModule]
    public static Operation Create()
    {
        var page = new Renderer<string>(new() { Renderer = "bootstrap5" }, (value, context) => "<p>Hello</p>");
        var handler = new Handler<object?, object?, object?, object?, string>(
            V.String(), context => ValueTask.FromResult("Hello"), renderers: [page]);
        return new(handler, new() { OperationId = "hello.get", Method = HttpMethodInput.GET,
            Title = "Hello", Description = "Hello operation", Auth = new() });
    }
}
```

<!-- file: dotnet/Definition.cs -->
```csharp
using BetterPortal;
using BetterPortal.Generated;

namespace HelloService;
public static class Definition
{
    public static Registry Registry() => Discovery.Discover(typeof(Definition).Assembly);
    public static BpSchemaOutput Export() => Registry().Schema(new() {
        PluginId = "com.example.hello", Title = "Hello", Description = "Example service", Version = "1.0.0"
    });
}
```

```sh
dotnet build
bp-dotnet export --assembly bin/Debug/net10.0/HelloService.dll --factory HelloService.Definition:Export --output bp-contract.json
bp-dotnet export --assembly bin/Debug/net10.0/HelloService.dll --factory HelloService.Definition:Export --output bp-contract.json --check
```

`Discovery.Discover` accepts `rootDirectory` to select a different source-directory
name, and `dependencies` for resolved service aliases. Python `discover` accepts
the same dependency mapping. Export factories can obtain it from the native
project's locked dependencies as described in the port READMEs.

## Renderers and streams

Method factories attach typed page, component and fragment `Renderer` objects to
their handlers. Put renderer code in separate helper modules/classes and import it
explicitly. The handler's result type determines renderer input; discovery never
attaches renderers by erasing their data type. Renderer IDs, fragment locations,
component keys and error status selection use the existing runtime declaration
and negotiation rules. There is no mandatory template engine.

A raw method returns an operation containing `RawHandler`. A finite GET uses
`FiniteHandler` with its item/summary schemas and `StreamRenderers`. For subscriber
SSE, Python `sse.py` exports `create(owner, view_id)`; C# `sse.cs` marks a factory
returning `SseFeed<TInput,TEvent>` with two parameters: a compatible typed `Handler`
and `string viewId`. Bind it with `SseFeed<TInput,TEvent>.Bind`. The returned feed
must retain that exact owner and view ID. Its tick fragment renderers must match
an existing GET fragment. `GET.sse` and other method-qualified SSE files are invalid.

Discovery runs selected module initializers and authoring factories. Keep those
free of host startup and external side effects; request handlers, renderer callbacks
and stream producers are not invoked. Reuse the discovered registry when starting
the host. The existing `export --check` command validates and compares the generated
contract without changing it. No Node executable or BSB build hook is involved.

`python framework/conformance/check_discovery.py` compiles/loads the exact example
files above, checks both export CLIs, and compares the native discovery corpus with
Node's scanner. The HTTP runtime suites separately exercise the returned registry's
authorization, renderer negotiation and streaming behavior.
