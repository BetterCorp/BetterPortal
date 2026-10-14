import * as av from "anyvali";
import type { Infer } from "anyvali";

export const BetterPortalRouteChromeValueSchema = av.union([av.string(), av.number(), av.bool()]);
export type BetterPortalRouteChromeValue = Infer<typeof BetterPortalRouteChromeValueSchema>;

export const BetterPortalRouteChromeSchema = av.intersection([
  av.object({
    hideMenu: av.optional(av.bool()),
    hideHeader: av.optional(av.bool()),
    hideFooter: av.optional(av.bool()),
    fullScreen: av.optional(av.bool()),
    title: av.optional(av.string()),
    parents: av.optional(av.array(av.string().pattern("^(?!//)")))
  }),
  av.record(av.union([BetterPortalRouteChromeValueSchema, av.array(av.string())]))
]);
export type BetterPortalRouteChrome = Infer<typeof BetterPortalRouteChromeSchema>;
