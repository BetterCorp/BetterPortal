/** @jsxImportSource jsx-htmx */
import type { PageRenderer } from "@betterportal/framework";

export const render: PageRenderer = (data) => (
  <section aria-labelledby="page-title">
    <h1 id="page-title">Page title</h1>
    <p>Explain the task in one sentence.</p>
    <div>{JSON.stringify(data)}</div>
  </section>
);
