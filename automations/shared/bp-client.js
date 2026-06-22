"use strict";

function trimUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options && options.headers ? options.headers : {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body && body.error) || `BetterPortal request failed: ${response.status}`);
  }
  return body;
}

async function discover(input) {
  const tenantUrl = trimUrl(input.tenantUrl);
  if (!tenantUrl) throw new Error("tenantUrl is required");

  const publicManifest = input.configManagerUrl
    ? null
    : await fetchJson(`${tenantUrl}/.well-known/bp/public`);
  const configManagerUrl = trimUrl(input.configManagerUrl || (publicManifest && publicManifest.configManagerUrl));
  if (!configManagerUrl) throw new Error("configManagerUrl is required or must be discoverable from the tenant theme");

  const catalogUrl = new URL(`${configManagerUrl}/.well-known/bp/automation/catalog`);
  catalogUrl.searchParams.set("tenantUrl", tenantUrl);
  if (input.appId) catalogUrl.searchParams.set("appId", input.appId);

  return fetchJson(catalogUrl.toString(), {
    headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : undefined
  });
}

function actionChoices(catalog) {
  return (catalog.services || []).flatMap((service) =>
    (service.actions || []).flatMap((action) =>
      (action.methods || []).map((method) => ({
        name: `${service.title || service.serviceId}: ${method} ${action.viewId}`,
        value: `${service.id}:${method}:${action.viewId}`,
        serviceId: service.id,
        method,
        viewId: action.viewId,
        path: action.path
      }))
    )
  );
}

module.exports = { discover, actionChoices };
