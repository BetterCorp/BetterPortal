import { createRawHandler, type BetterPortalEvent } from "@betterportal/framework";
import type { Plugin } from "../../../../../index.js";
import { QuerySchema } from "./index.js";

export const handleGet = createRawHandler.forContext<Plugin>()({ query: QuerySchema }, async (ctx) =>
  (ctx.plugin as Plugin).renderRoleSyncFragment(ctx.rawEvent as BetterPortalEvent, undefined, ctx));
export default handleGet;
