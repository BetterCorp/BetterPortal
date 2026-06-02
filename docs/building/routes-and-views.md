# Routes and Views

BetterPortal routes are file-based inside each service.

Codegen scans `bp-routes/` and creates the service registry. Do not hand-write the registry.

## File convention

```text
bp-routes/
  docs/
    index.ts
    _theme.bootstrap1/
      index.tsx
  docs/
    [section]/
      [page]/
        index.ts
        _theme.bootstrap1/
          index.tsx
```

Directory names become service paths. Bracketed names become params.

## View files

A view file exports schemas, metadata, and handlers.

```ts
export const ResponseSchema = av.object({
  title: av.string().minLength(1)
});

export const title = "Example View";
export const description = "Example BetterPortal view.";

export const handleGet = createHandler(
  { response: ResponseSchema },
  async () => ({ title: "Example View" })
);
```

## Theme renderers

HTML renderers live under `_theme.<themeId>/`.

```tsx
export function render(data: ResponseData): HtmlRenderable {
  return <section>{data.title}</section>;
}
```

Only actual renderer files should live inside `_theme.<themeId>/`. Shared helpers should live elsewhere, because codegen treats `.tsx` files in theme directories as renderers.

## App routes

The app route maps the visible URL to the service view:

```yaml
- id: docs
  path: /docs
  serviceId: docs-site
  viewId: docs.index
  targetPath: /docs
  title: Docs
  enabled: true
  methods:
    - GET
```
