"use strict";

const { discover, actionChoices } = require("../shared/bp-client.js");

class BetterPortal {
  constructor() {
    this.description = {
      displayName: "BetterPortal",
      name: "betterPortal",
      group: ["transform"],
      version: 1,
      description: "Discover BetterPortal services and actions",
      defaults: { name: "BetterPortal" },
      inputs: ["main"],
      outputs: ["main"],
      properties: [
        { displayName: "Tenant URL", name: "tenantUrl", type: "string", default: "", required: true },
        { displayName: "Config Manager URL", name: "configManagerUrl", type: "string", default: "" },
        { displayName: "API Key", name: "apiKey", type: "string", typeOptions: { password: true }, default: "" }
      ]
    };
  }

  async execute() {
    const items = this.getInputData();
    const output = [];
    for (let i = 0; i < items.length; i++) {
      const catalog = await discover({
        tenantUrl: this.getNodeParameter("tenantUrl", i),
        configManagerUrl: this.getNodeParameter("configManagerUrl", i),
        apiKey: this.getNodeParameter("apiKey", i)
      });
      output.push({ json: { catalog, actions: actionChoices(catalog) } });
    }
    return [output];
  }
}

module.exports = { BetterPortal };
