"use strict";

const { discover, actionChoices } = require("../shared/bp-client.js");

const listActions = async (z, bundle) => {
  const catalog = await discover({
    tenantUrl: bundle.authData.tenantUrl,
    configManagerUrl: bundle.authData.configManagerUrl,
    apiKey: bundle.authData.apiKey
  });
  return actionChoices(catalog);
};

module.exports = {
  version: "0.1.0",
  platformVersion: "15.0.0",
  authentication: {
    type: "custom",
    fields: [
      { key: "tenantUrl", label: "Tenant URL", required: true },
      { key: "configManagerUrl", label: "Config Manager URL", required: false },
      { key: "apiKey", label: "API Key", required: false, type: "password" }
    ],
    test: async (z, bundle) => {
      const catalog = await discover(bundle.authData);
      return { tenantId: catalog.tenantId, appId: catalog.appId };
    }
  },
  creates: {
    action_catalog: {
      key: "action_catalog",
      noun: "BetterPortal Action",
      display: {
        label: "List BetterPortal Actions",
        description: "Discovers BetterPortal services and callable actions."
      },
      operation: {
        perform: listActions,
        sample: { name: "Example: GET hello.index", value: "service:GET:hello.index" }
      }
    }
  }
};
