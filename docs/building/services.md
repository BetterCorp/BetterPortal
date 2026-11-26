# Building Services

A BetterPortal service is a BSB plugin that extends `BPService`.

Services own views, handlers, schemas, config descriptors, fragments, and HTML renderers.

## Service layout

```text
services/nodejs/<category>/<name>/
  package.json
  sec-config.yaml
  tsconfig.json
  src/
    index.ts
    plugins/
      service-betterportal-<name>/
        index.ts
        bp-routes/
        .bp-generated/
```

## Service definition

The plugin class returns a BetterPortal definition:

```ts
protected definition(): BPServiceDefinition {
  return {
    manifest: {
      pluginId: "org.betterportal.my-service",
      title: "My Service",
      description: "Service description",
      configSchemas: []
    }
  };
}
```

`bp-codegen` generates the route registry and BetterPortal loads it automatically. Service code must not import or return generated registry files.

## Independently authenticated protocol endpoints

Use generated BP routes for app APIs and views. A service that owns a separate standard protocol, such as an OAuth authorization server or an authenticated MCP resource, can register its native handler in `onRegistered`:

```ts
protected onRegistered(): void {
  this.registerProtocolEndpoint({
    path: "/mcp",
    methods: ["POST"],
    cors: {
      origins: ["https://approved-client.example"],
      allowHeaders: ["Authorization", "Content-Type", "MCP-Protocol-Version"],
      exposeHeaders: ["WWW-Authenticate"],
      credentials: false
    },
    handler: event => this.mcp.handleRequest(event.req)
  });
}
```

This Node BSB extension has its own transport policy. It does not assign tenant/app context, verify a BP bearer, grant service authority, or authenticate the native protocol. The handler must validate its own credential, issuer/resource, current grant, request bounds and readiness. A no-Origin server request can reach it; this does not make that request trusted. Callers cannot use a declared CORS origin as authorization.

Paths are explicit literals with optional named single-segment parameters, for example `/oauth/resume/:uid`. Wildcards, ambiguous registrations, collisions with generated BP paths (including auxiliary SSE paths), and replacement of BP authentication, management, AI discovery or SEO endpoints are rejected. The existing public AI document paths share `ThemeLlmsDocumentPaths` with the framework and theme mounts. Register each protocol path once with all intended methods. A matching request never falls through into app routing, including an unsupported method or a handler that fails to return a response.

Only literal `/.well-known/` metadata registered for GET/HEAD may use `origins: "*"`. All other browser origins are explicit HTTPS origins; HTTP is accepted only for loopback development. Credentialed cross-origin cookie access is not supported. Preflight checks the declared method and header list without invoking the handler. An unapproved Origin is rejected even for a simple request. Ordinary BP app CORS and route authentication remain unchanged.

The handler can return a Web `Response` or the handled result of H3's public `fromNodeHandler`. The latter requires the normal Node server backend and allows a maintained OAuth library's standard Node callback to own its transaction cookies. The registry applies its transport CORS headers before the callback writes the Node response and preserves repeated `Set-Cookie` fields. The library must still verify the original signed transaction cookie when completing an interaction; an opaque interaction ID alone is not browser ownership. Do not synthesize cookie headers or reimplement the library's transaction validation.

Applications consuming this extension must use a published BP release that includes it. Local owner build archives can verify compatibility but do not establish publication or authorize a production dependency override.

## Developer resources and AI discovery

Services can publish public implementation guidance with the same manifest and registry contract as their routes:

```ts
manifest: {
  pluginId: "com.example.orders",
  title: "Orders",
  description: "Order management",
  developerResources: [{
    id: "api.example",
    kind: "example",
    title: "Create an order",
    description: "Minimal authenticated request example.",
    mediaType: "text/markdown; charset=utf-8",
    language: "typescript",
    content: createOrderExample
  }]
}
```

Keep larger resources in package files and load them into the manifest at startup. Include those source files in the package's `files` list so installed builds can load them. Resource content is public, embedded in `/.well-known/bp/manifest` and the published registry contract, and limited to 512 KiB per item; never put secrets or private operations in it.

The framework automatically serves the resource index at `/.well-known/bp/resources` and individual content at `/.well-known/bp/resources/<id>`. Themes use the same contract for `/llms-ui.txt`; developers do not register resource routes manually. See [`spec/ai.md`](../../spec/ai.md) and [`spec/manifest.md`](../../spec/manifest.md#7-developerresources).

## Service contracts and typed clients

Each publishable service has a `betterportal.json`. Its registry reference is a distribution coordinate; it is deliberately separate from the runtime `pluginId`:

```json
{
  "$schema": "https://io.betterportal.org/v1/project.schema.json",
  "registryRef": "betterportal/my-service",
  "defaultNamespace": "betterportal",
  "dependencies": {}
}
```

Node.js and .NET tools use explicit `--dev-paths`, `--registry`, and `--token-file` options in place of `BP_DEV_PATHS`, `BP_REGISTRY_URL`, and `BP_REGISTRY_TOKEN`. Python reads these settings through its centralized, AnyVali-validated environment configuration.

Use `bp client install <pluginId|namespace/name|short-name>` to add another service. Resolution checks an explicit `--path`, this repository's workspaces, installed packages, sibling repositories, and explicit `--dev-paths` before `https://io.betterportal.org`. Local contracts are synced again by the BSB build hook, so adjacent services under development immediately regenerate the consumer's types. Use a full registry reference when a short name is ambiguous.

Generated clients expose one input and response type per `operationId`. Undeclared inputs are omitted, schema-optional inputs remain optional, and inputs with required schema fields are required at the call site. Responses and nested request fields are generated directly from the published AnyVali contracts.

`bp setup` installs the BSB hooks. `bp run gen` generates route metadata before compilation, `bp run types` syncs dependency clients before compilation, and `bp run contract` writes the canonical publishable contract after compilation. A service with manually registered routes can declare compiled definition sources instead of `betterportal.routes`:

```json
{
  "betterportal": {
    "definitions": ["src/plugins/service-example/index.ts"]
  }
}
```

BSB plugins continue to publish their BSB package/schema normally and additionally run `bp publish --token-file /path/to/registry-token`. Services written in another language can publish the same `/.well-known/bp/schema.json` contract directly to the registry API.

## BSB lifecycle overrides

Inherit `init`, `run`, and `dispose` unless the service has custom lifecycle work. Empty overrides should be removed. When overriding, the BetterPortal base lifecycle must still run:

```ts
async init(obs: Observable): Promise<void> {
  await super.init(obs);
  // custom initialization
}

async run(obs: Observable): Promise<void> {
  await super.run(obs);
  // custom post-start work
}

async dispose(): Promise<void> {
  await super.dispose();
  // custom cleanup
}
```

Use `onRegistered()` instead of overriding `init()` when custom work only needs the initialized BetterPortal app or router. The `bp-codegen` build hook rejects lifecycle overrides that omit the corresponding `super` call; `init` and `run` must await or return it.

## Runtime config

`sec-config.yaml` controls the service host, port, config token, and BP config path.

The `bpConfigPath` must be correct for the service directory depth. If it points to the wrong place, the service cannot resolve tenant/app/theme context.

## Dependencies and tests

Runnable BetterPortal services are BSB plugins. They need `@bsb/base` at runtime, not only for types:

```json
{
  "dependencies": {
    "@bsb/base": "^9.7.4",
    "anyvali": "^1.1.6",
    "@betterportal/framework": "10.7.1",
    "@betterportal/plugin-bsb": "10.7.1"
  }
}
```

The repository baseline is BSB 9.7.4 and AnyVali 1.1.6 (npm, PyPI and NuGet). Python and .NET pin AnyVali 1.1.6; Node service/theme packages require at least those BSB and AnyVali releases.

Packages that want the shared BSB plugin lifecycle checks add `@bsb/tests` as a dev dependency and keep the BSB CLI as the public test command:

```json
{
  "devDependencies": {
    "@bsb/tests": "^9.7.4"
  },
  "scripts": {
    "test": "bsb-plugin-cli test"
  }
}
```

Packages with custom tests can use their own runner. Keep `tests/` and `*.test.ts` excluded from TypeScript output and package `files`.

## Registering a service

Add the service to the tenant in `bp-config.yaml`:

```yaml
services:
  - id: docs-site
    hostname: http://localhost:3400
    serviceId: org.betterportal.docs-site
    title: BetterPortal Docs
    deploymentMode: self-hosted
    enabled: true
```

Then bind routes in the app.
