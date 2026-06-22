"use strict";

const { discover, actionChoices } = require("../shared/bp-client.js");

module.exports = function register(RED) {
  function BetterPortalActionNode(config) {
    RED.nodes.createNode(this, config);
    this.tenantUrl = config.tenantUrl;
    this.configManagerUrl = config.configManagerUrl;
    this.action = config.action;

    this.on("input", async (msg, send, done) => {
      try {
        const catalog = await discover({
          tenantUrl: msg.tenantUrl || this.tenantUrl,
          configManagerUrl: msg.configManagerUrl || this.configManagerUrl,
          apiKey: msg.apiKey
        });
        msg.bpCatalog = catalog;
        msg.bpActions = actionChoices(catalog);
        send(msg);
        done();
      } catch (error) {
        done(error);
      }
    });
  }

  RED.nodes.registerType("betterportal-action", BetterPortalActionNode);
};
