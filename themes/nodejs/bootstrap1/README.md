# BetterPortal Bootstrap1 Theme for Node.js

Custom BetterPortal v10 theme built on Bootstrap 5 and HTMX.

Design goals:

- modern and minimal
- clean light and dark modes
- shell-first, not app-logic-first
- HTMX and generic route chrome lifecycle supplied by `@betterportal/theme-runtime`
- Bootstrap-specific modal, offcanvas, loading, component, and chrome presentation

The Bootstrap adapter is type-checked TSX built with `jsx-htmx` `js()`. It contains presentation hooks only; the shared runtime owns HTMX events and chrome state. Fullscreen chrome hides Bootstrap shell furniture through CSS and does not imply an authentication layout.
