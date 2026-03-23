# BetterPortal v10 Media Types

Primary negotiated representations:

- `application/json`
- `application/vnd.betterportal.metadata+json`
- `text/html; theme=bootstrap1; mode=page`
- `text/html; theme=embedded; mode=fragment`

Rules:

- same endpoint identity across JSON, HTML, and metadata
- JSON is canonical
- HTML renders from the same validated output model
- unsupported HTML theme or render mode returns `406 Not Acceptable`
