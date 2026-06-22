/**
 * 400 status view for register POST failures (duplicate user, weak input, no
 * context). Same renderer as the main view — it re-renders the form with the
 * error message so the response swaps into #bp-main like any other view.
 */
export { render } from "./index.js";
