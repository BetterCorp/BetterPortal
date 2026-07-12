import { createRawHandler, type BetterPortalEvent } from "@betterportal/framework";
import type { Plugin } from "../../../../../../index.js";
import { QuerySchema } from "./index.js";

export const handlePost = createRawHandler.forContext<Plugin>()({ query: QuerySchema }, async (ctx) =>
  (ctx.plugin as Plugin).handleRoleSync(ctx.rawEvent as BetterPortalEvent, ctx));
export default handlePost;
