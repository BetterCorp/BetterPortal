import { inspectRouteUrlSource } from "./codegen/routeUrlPolicy.js";

/** Routing authoring rules; enable `betterportal/routing-contract` as an error. */
export default {
  rules: {
    "routing-contract": {
      meta: { type: "problem", docs: { description: "Enforce BPRoute and service-context destination ownership", url: "https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/routing-lint.md" }, schema: [], messages: { contract: "{{message}}" } },
      create(context: {
        filename: string;
        sourceCode: { text: string; getLocFromIndex(index: number): { line: number; column: number } };
        report(value: { loc: { start: { line: number; column: number }; end: { line: number; column: number } }; messageId: string; data: { message: string } }): void;
      }) {
        return { Program() {
          for (const diagnostic of inspectRouteUrlSource(context.filename, context.sourceCode.text)) {
            const position = /:(\d+):(\d+)$/.exec(diagnostic.file);
            const loc = { line: position ? Number(position[1]) : 1, column: position ? Number(position[2]) - 1 : 0 };
            context.report({ loc: { start: loc, end: loc }, messageId: "contract", data: { message: diagnostic.message } });
          }
        } };
      }
    }
  }
};
