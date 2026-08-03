# BetterPortal v10 Media Types

Primary negotiated representations:

- `application/json`
- `application/vnd.betterportal.metadata+json`
- `text/html; mode=page`
- `text/html; mode=fragment`

Rules:

- same endpoint identity across JSON, HTML, and metadata
- JSON is canonical
- HTML renders from the same validated output model
- an unresolved shell renderer or unsupported render mode returns `406 Not Acceptable`
